// Offline regression tests for truncated AI output handling (the Groq
// gpt-oss HTTP 400 "max completion tokens ... truncated" failure) and the
// Gemini thinking-budget guard (finishReason MAX_TOKENS).
//
// Covered:
//   - Gemini finishing with finishReason MAX_TOKENS is discarded instead of
//     being parsed as a partial analysis, and the Groq fallback still runs.
//   - Groq HTTP 400 json_validate_failed / "max completion tokens" truncation
//     is classified as AI_OUTPUT_TRUNCATED: it authorizes exactly one fallback
//     attempt AND the local rule-based result when both providers fail.
//   - Groq HTTP 200 with finish_reason "length" is never accepted as success.
//   - Unrelated HTTP 400s keep their existing AI_BAD_REQUEST classification
//     (no rule-based takeover).
//   - Groq gpt-oss requests carry the low reasoning_effort tuning together
//     with the task token budget.
//
// Every provider call is stubbed — no live Gemini/Groq request is made.
import test from 'node:test';
import assert from 'node:assert/strict';

// Must be set before importing the modules under test. dotenv does not
// override pre-set variables, so these win over backend/.env.
process.env.AI_PROVIDER = 'gemini';
process.env.AI_FALLBACK_PROVIDER = 'groq';
process.env.GEMINI_API_KEY = 'AIza_dummy_primary_key_not_real';
process.env.GROQ_API_KEY = 'gsk_dummy_fallback_key_not_real';
// Pin the model so the reasoning_effort assertion is deterministic even when
// backend/.env configures a different override.
process.env.GROQ_MODEL = 'openai/gpt-oss-120b';
// Offline determinism: no result caching and no fallback backoff.
process.env.AI_RESULT_CACHE_TTL_MS = '0';
process.env.AI_FALLBACK_BACKOFF_MS = '0';
delete process.env.GEMINI_MODEL;
delete process.env.GROQ_API_URL;

const GROQ_TRUNCATION_MESSAGE =
  'max completion tokens reached before generating a valid document: the output was truncated to fit max_completion_tokens and is missing required content.';

const events = [];
let geminiHandler = null;
let groqHandler = null;

globalThis.fetch = async (url, init) => {
  const u = String(url);
  const provider = u.includes('generativelanguage.googleapis.com') ? 'gemini' : 'groq';
  events.push({ provider, url: u, body: init?.body ? JSON.parse(init.body) : null });
  return provider === 'gemini' ? geminiHandler(u, init) : groqHandler(u, init);
};

const geminiResponse = (content, finishReason) => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  headers: new Headers({ 'content-type': 'application/json' }),
  json: async () => ({
    candidates: [
      {
        content: { role: 'model', parts: [{ text: content }] },
        ...(finishReason ? { finishReason } : {})
      }
    ]
  }),
  text: async () => ''
});

const geminiHttpError = (status, message) => ({
  ok: false,
  status,
  statusText: 'Error',
  headers: new Headers({ 'content-type': 'application/json' }),
  json: async () => ({ error: { code: status, message, status: 'ERROR' } }),
  text: async () => JSON.stringify({ error: { message } })
});

const groqOk = (content, finishReason = 'stop') => ({
  ok: true,
  status: 200,
  headers: { get: () => null },
  json: async () => ({ choices: [{ finish_reason: finishReason, message: { content } }] }),
  text: async () => ''
});

const groqHttpError = (status, message) => ({
  ok: false,
  status,
  headers: { get: () => null },
  json: async () => ({ error: { message } }),
  text: async () => JSON.stringify({ error: { message } })
});

const provider = await import('../aiProvider.js');
const {
  generateStructured,
  isEligibleForFallback,
  canTryFallbackProvider,
  clearAiResultCache,
  clearProviderCooldowns
} = provider;

const tinySchema = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING' },
    score: { type: 'INTEGER' },
    tags: { type: 'ARRAY', items: { type: 'STRING' } },
    nested: { type: 'OBJECT', properties: { ok: { type: 'BOOLEAN' } }, required: ['ok'] }
  },
  required: ['name', 'score', 'tags', 'nested']
};

const counts = () => ({
  gemini: events.filter((e) => e.provider === 'gemini').length,
  groq: events.filter((e) => e.provider === 'groq').length
});

function reset() {
  events.length = 0;
  clearAiResultCache();
  clearProviderCooldowns();
  geminiHandler = () => geminiResponse('{"name":"g","score":1,"tags":[],"nested":{"ok":true}}');
  groqHandler = () => groqOk('{"name":"fallback-ok","score":2,"tags":[],"nested":{"ok":true}}');
}

test.beforeEach(reset);

test('Gemini MAX_TOKENS output is discarded and the Groq fallback answers', async () => {
  geminiHandler = () => geminiResponse('{"name":"partial', 'MAX_TOKENS');
  const result = await generateStructured({
    prompt: 'gemini-truncated',
    systemInstruction: 's',
    schema: tinySchema,
    schemaName: 'truncation_gemini_max_tokens'
  });
  assert.equal(result.name, 'fallback-ok', 'the fallback result must be used, not the partial Gemini text');
  assert.deepEqual(counts(), { gemini: 1, groq: 1 });
});

test('Groq truncation HTTP 400 is AI_OUTPUT_TRUNCATED and authorizes both fallbacks', async () => {
  geminiHandler = () => geminiHttpError(503, 'UNAVAILABLE: try again later');
  groqHandler = () => groqHttpError(400, GROQ_TRUNCATION_MESSAGE);
  await assert.rejects(
    () =>
      generateStructured({
        prompt: 'groq-truncated-http-400',
        systemInstruction: 's',
        schema: tinySchema,
        schemaName: 'truncation_groq_400'
      }),
    (err) => {
      assert.equal(err.code, 'AI_PROVIDERS_EXHAUSTED');
      assert.equal(err.primaryCode, 'AI_UPSTREAM_ERROR');
      assert.equal(err.fallbackCode, 'AI_OUTPUT_TRUNCATED');
      assert.equal(err.localFallbackEligible, true, 'a truncated document may be replaced by the deterministic result');
      return true;
    }
  );
});

test('Groq HTTP 200 with finish_reason "length" is never accepted as success', async () => {
  geminiHandler = () => geminiHttpError(503, 'UNAVAILABLE: try again later');
  groqHandler = () => groqOk('{"name":"cut-off","score":70,"tags":[]', 'length');
  await assert.rejects(
    () =>
      generateStructured({
        prompt: 'groq-truncated-finish-length',
        systemInstruction: 's',
        schema: tinySchema,
        schemaName: 'truncation_groq_length'
      }),
    (err) => {
      assert.equal(err.code, 'AI_PROVIDERS_EXHAUSTED');
      assert.equal(err.fallbackCode, 'AI_OUTPUT_TRUNCATED');
      assert.equal(err.localFallbackEligible, true);
      return true;
    }
  );
});

test('unrelated Groq HTTP 400s keep the AI_BAD_REQUEST classification', async () => {
  geminiHandler = () => geminiHttpError(503, 'UNAVAILABLE: try again later');
  groqHandler = () => groqHttpError(400, 'INVALID_ARGUMENT: request rejected');
  await assert.rejects(
    () =>
      generateStructured({
        prompt: 'groq-generic-400',
        systemInstruction: 's',
        schema: tinySchema,
        schemaName: 'truncation_groq_generic_400'
      }),
    (err) => {
      assert.equal(err.code, 'AI_PROVIDERS_EXHAUSTED');
      assert.equal(err.fallbackCode, 'AI_BAD_REQUEST');
      assert.equal(err.localFallbackEligible, false, 'invalid requests must still surface as errors');
      return true;
    }
  );
});

test('Groq gpt-oss requests carry reasoning_effort low and the task budget', async () => {
  geminiHandler = () => geminiHttpError(503, 'UNAVAILABLE: try again later');
  const result = await generateStructured({
    prompt: 'groq-body-shape',
    systemInstruction: 's',
    schema: tinySchema,
    schemaName: 'truncation_groq_body',
    maxCompletionTokens: 3000
  });
  assert.equal(result.name, 'fallback-ok');
  const groqCall = events.find((event) => event.provider === 'groq');
  assert.ok(groqCall, 'the fallback must have been called');
  assert.equal(groqCall.body.model, 'openai/gpt-oss-120b');
  assert.equal(groqCall.body.reasoning_effort, 'low');
  assert.equal(groqCall.body.max_completion_tokens, 3000);
});

test('AI_OUTPUT_TRUNCATED is fallback-eligible by code', () => {
  assert.equal(isEligibleForFallback({ code: 'AI_OUTPUT_TRUNCATED' }), true);
  assert.equal(canTryFallbackProvider({ code: 'AI_OUTPUT_TRUNCATED' }), true);
});
