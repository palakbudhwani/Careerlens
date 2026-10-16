// Offline tests for dual-provider fallback: Gemini is PRIMARY, Groq is the
// FALLBACK. Every scenario is exercised through the real aiProvider/llm/skill
// gap/mock interview code paths with a stubbed global fetch — no live
// Gemini or Groq requests are made and no API key ever leaves the process.
//
// Covered: Gemini success (no Groq), Gemini 429 / transient / network /
// timeout / invalid generated JSON / provider-specific rejections (HTTP 400,
// 401, missing key) → exactly one Groq attempt, both providers failing →
// structured AI_PROVIDERS_EXHAUSTED (never mock data; local rule-based only
// for availability/generation failures), entry-point ordering for all AI
// tasks, resume parsing with zero provider calls while BOTH keys are
// configured, deduplication of concurrent fallback chains, question-count
// contract, and key confidentiality.
import test from 'node:test';
import assert from 'node:assert/strict';

// Must be set before importing the modules under test. dotenv does not
// override pre-set variables, so these win over backend/.env.
process.env.AI_PROVIDER = 'gemini';
process.env.AI_FALLBACK_PROVIDER = 'groq';
process.env.GEMINI_API_KEY = 'AIza_dummy_primary_key_not_real';
process.env.GROQ_API_KEY = 'gsk_dummy_fallback_key_not_real';
// Offline determinism: no result caching and no fallback backoff in these
// tests (the dedicated ruleBasedFallback suite exercises both).
process.env.AI_RESULT_CACHE_TTL_MS = '0';
process.env.AI_FALLBACK_BACKOFF_MS = '0';
delete process.env.GEMINI_MODEL;
delete process.env.GROQ_API_URL;

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GROQ_KEY = process.env.GROQ_API_KEY;

const events = [];
let geminiHandler = null;
let groqHandler = null;

globalThis.fetch = async (url, init) => {
  const u = String(url);
  const provider = u.includes('generativelanguage.googleapis.com') ? 'gemini' : 'groq';
  events.push({ provider, url: u, body: init?.body ? JSON.parse(init.body) : null });
  if (provider === 'gemini') return geminiHandler(u, init);
  return groqHandler(u, init);
};

const geminiOk = (content) => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  headers: new Headers({ 'content-type': 'application/json' }),
  json: async () => ({ candidates: [{ content: { role: 'model', parts: [{ text: content }] } }] }),
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

const geminiNetworkThrow = () => {
  throw new TypeError('fetch failed');
};

const geminiTimeoutThrow = () => {
  const error = new Error('The operation was aborted');
  error.name = 'TimeoutError';
  throw error;
};

const groqOk = (content) => ({
  ok: true,
  status: 200,
  headers: { get: () => null },
  json: async () => ({ choices: [{ message: { content } }] }),
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
  getAiProvider,
  getFallbackProvider,
  isAiEnabled,
  generateStructured,
  AiProviderError,
  isEligibleForFallback,
  canTryFallbackProvider,
  clearAiResultCache,
  clearProviderCooldowns
} = provider;
const { analyzeMatch, generateQuestions, evaluateAnswer, parseResume } = await import('../llm.js');
const { analyzeSkillGaps, generateCareerGrowthPlan } = await import('../skillGapLlm.js');
const { generateMockQuestions, evaluateMockAnswer, generateFinalScorecard } = await import('../mockInterviewLlm.js');

const RESUME =
  'Experienced software engineer skilled in React TypeScript Node.js building web applications with REST APIs and automated tests at ACME Corp.';
const JOB =
  'Looking for a frontend engineer with React TypeScript experience to build accessible user interfaces and collaborate with product designers and product managers.';

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
  geminiHandler = () => geminiOk('{"name":"g","score":1,"tags":[],"nested":{"ok":true}}');
  groqHandler = () => groqOk('{"name":"q","score":2,"tags":[],"nested":{"ok":false}}');
}

test.beforeEach(reset);

test('provider configuration: Gemini is primary and Groq is the fallback', () => {
  assert.equal(getAiProvider(), 'gemini');
  assert.equal(getFallbackProvider(), 'groq');
  assert.equal(isAiEnabled(), true);
  assert.ok(GEMINI_KEY && GROQ_KEY, 'both keys must be configured for these tests');

  // Local rule-based takeover: transient/provider-output problems only…
  assert.equal(isEligibleForFallback({ code: 'AI_RATE_LIMITED' }), true);
  assert.equal(isEligibleForFallback({ code: 'AI_TIMEOUT' }), true);
  assert.equal(isEligibleForFallback({ code: 'AI_UPSTREAM_ERROR' }), true);
  assert.equal(isEligibleForFallback({ code: 'AI_UNREACHABLE' }), true);
  assert.equal(isEligibleForFallback({ code: 'AI_INVALID_JSON' }), true);
  assert.equal(isEligibleForFallback({ code: 'AI_EMPTY_RESPONSE' }), true);
  assert.equal(isEligibleForFallback({ code: 'AI_SCHEMA_MISMATCH' }), true);
  // …while invalid requests and config errors never authorize it.
  assert.equal(isEligibleForFallback({ code: 'AI_BAD_REQUEST' }), false);
  assert.equal(isEligibleForFallback({ code: 'AI_UNAUTHORIZED' }), false);
  assert.equal(isEligibleForFallback({ code: 'AI_NOT_CONFIGURED' }), false);
  assert.equal(isEligibleForFallback(null), false);

  // Cross-provider retry additionally covers primary-side rejections: a bad
  // primary key or primary-only HTTP 400/404 says nothing about the fallback.
  assert.equal(canTryFallbackProvider({ code: 'AI_BAD_REQUEST' }), true);
  assert.equal(canTryFallbackProvider({ code: 'AI_UNAUTHORIZED' }), true);
  assert.equal(canTryFallbackProvider({ code: 'AI_NOT_CONFIGURED' }), true);
  assert.equal(canTryFallbackProvider({ code: 'AI_RATE_LIMITED' }), true);
  assert.equal(canTryFallbackProvider({ code: 'AI_SCHEMA_MISMATCH' }), true);
  assert.equal(canTryFallbackProvider({ code: 'AI_DISABLED' }), false);
  assert.equal(canTryFallbackProvider(null), false);
});

test('Gemini success returns the validated result without calling Groq', async () => {
  geminiHandler = () => geminiOk('{"matchId":"from-gemini","atsScore":"91.6"}');

  const result = await analyzeMatch(RESUME, JOB);

  assert.equal(result.matchId, 'from-gemini');
  assert.equal(result.atsScore, 92, 'schema normalization must coerce the score');
  const seen = counts();
  assert.equal(seen.gemini, 1, 'exactly one Gemini request');
  assert.equal(seen.groq, 0, 'Groq must not be called when Gemini succeeds');

  // Gemini request carries the existing Flash model and JSON response contract.
  const call = events.find((e) => e.provider === 'gemini');
  assert.match(call.url, /models\/gemini-flash-latest:generateContent/);
  assert.equal(call.body.generationConfig.responseMimeType, 'application/json');
  assert.ok(call.body.generationConfig.responseSchema, 'response schema must be forwarded');
  assert.equal(typeof call.body.generationConfig.maxOutputTokens, 'number');
});

test('Gemini HTTP 429 falls back to Groq exactly once', async () => {
  geminiHandler = () => geminiHttpError(429, 'RESOURCE_EXHAUSTED: quota exceeded for this model');
  groqHandler = () => groqOk('{"matchId":"from-groq","atsScore":84}');

  const result = await analyzeMatch(RESUME, JOB);

  assert.equal(result.matchId, 'from-groq');
  assert.equal(result.atsScore, 84, 'the result must come from the Groq fallback');
  const seen = counts();
  assert.equal(seen.gemini, 1, 'no repeated attempts against the rate-limited provider');
  assert.equal(seen.groq, 1, 'exactly one fallback attempt');
});

test('Gemini transient upstream failure falls back to Groq', async () => {
  geminiHandler = () => geminiHttpError(503, 'The model is overloaded right now');
  groqHandler = () => groqOk('{"matchId":"groq-after-503","atsScore":70}');

  const result = await analyzeMatch(RESUME, JOB);
  assert.equal(result.matchId, 'groq-after-503');
  const seen = counts();
  assert.equal(seen.gemini, 1);
  assert.equal(seen.groq, 1);
});

test('Gemini network failure falls back to Groq', async () => {
  geminiHandler = geminiNetworkThrow;
  groqHandler = () => groqOk('{"matchId":"groq-after-network","atsScore":71}');

  const result = await analyzeMatch(RESUME, JOB);
  assert.equal(result.matchId, 'groq-after-network');
  const seen = counts();
  assert.equal(seen.gemini, 1);
  assert.equal(seen.groq, 1);
});

test('Gemini timeout falls back to Groq', async () => {
  geminiHandler = geminiTimeoutThrow;
  groqHandler = () => groqOk('{"matchId":"groq-after-timeout","atsScore":72}');

  const result = await analyzeMatch(RESUME, JOB);
  assert.equal(result.matchId, 'groq-after-timeout');
  const seen = counts();
  assert.equal(seen.gemini, 1);
  assert.equal(seen.groq, 1);
});

test('eligible Gemini generated-output errors fall back to Groq', async () => {
  // Malformed JSON in the generated output.
  geminiHandler = () => geminiOk('this is not json at all {{{');
  groqHandler = () => groqOk('{"matchId":"groq-after-bad-json","atsScore":73}');
  let result = await analyzeMatch(RESUME, JOB);
  assert.equal(result.matchId, 'groq-after-bad-json');
  let seen = counts();
  assert.equal(seen.gemini, 1);
  assert.equal(seen.groq, 1);

  // Empty model output (no candidates).
  reset();
  geminiHandler = () => ({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ candidates: [] }),
    text: async () => ''
  });
  groqHandler = () => groqOk('{"matchId":"groq-after-empty","atsScore":74}');
  result = await analyzeMatch(RESUME, JOB);
  assert.equal(result.matchId, 'groq-after-empty');
  seen = counts();
  assert.equal(seen.gemini, 1);
  assert.equal(seen.groq, 1);
});

test('Gemini HTTP 400 (provider-specific rejection) tries the fallback once and reports honestly when it also fails', async () => {
  geminiHandler = () => geminiHttpError(400, 'INVALID_ARGUMENT: request schema was rejected');
  groqHandler = () => groqHttpError(400, 'INVALID_ARGUMENT: request rejected');

  await assert.rejects(
    () => generateStructured({ prompt: 'bad-request', systemInstruction: 's', schema: tinySchema, schemaName: 'bad_request_probe' }),
    (err) => {
      assert.ok(err instanceof AiProviderError);
      assert.equal(err.code, 'AI_PROVIDERS_EXHAUSTED');
      assert.equal(err.primaryCode, 'AI_BAD_REQUEST');
      assert.equal(err.fallbackCode, 'AI_BAD_REQUEST');
      assert.equal(err.localFallbackEligible, false, 'config/invalid-request failures never authorize the local formula');
      assert.match(err.message, /Both AI providers failed/);
      return true;
    }
  );

  const seen = counts();
  assert.equal(seen.gemini, 1, 'no retry loop against the primary');
  assert.equal(seen.groq, 1, 'a primary-side HTTP 400 gets exactly one fallback attempt');
});

test('Gemini 401 credentials error is rescued by a healthy Groq fallback', async () => {
  geminiHandler = () => geminiHttpError(401, 'API key not valid');
  groqHandler = () => groqOk('{"name":"groq-after-401","score":5,"tags":[],"nested":{"ok":true}}');

  const result = await generateStructured({ prompt: 'unauthorized', systemInstruction: 's', schema: tinySchema, schemaName: 'unauthorized_probe' });
  assert.equal(result.name, 'groq-after-401', 'the fallback provider must serve the result');

  const seen = counts();
  assert.equal(seen.gemini, 1, 'one rejected primary attempt');
  assert.equal(seen.groq, 1, 'exactly one fallback attempt after the primary credential failure');
});

test('a rejected primary key surfaces a loud error when the fallback key is also bad (no formula masquerade)', async () => {
  geminiHandler = () => geminiHttpError(401, 'API key not valid');
  groqHandler = () => groqHttpError(401, 'Invalid API Key');

  // Task layer: the error propagates instead of a rule-based result.
  await assert.rejects(
    () => analyzeMatch(RESUME, JOB),
    (err) => {
      assert.ok(err instanceof AiProviderError);
      assert.equal(err.code, 'AI_PROVIDERS_EXHAUSTED');
      assert.equal(err.primaryCode, 'AI_UNAUTHORIZED');
      assert.equal(err.fallbackCode, 'AI_UNAUTHORIZED');
      assert.equal(err.localFallbackEligible, false, 'credential failures must never silently become formula output');
      assert.ok(!err.message.includes(GEMINI_KEY), 'message must not contain the Gemini key');
      assert.ok(!err.message.includes(GROQ_KEY), 'message must not contain the Groq key');
      return true;
    }
  );

  // Question generation: same honest failure, never the curated bank.
  await assert.rejects(
    () => generateQuestions(RESUME, JOB, 'Mid', 5),
    (err) => err.code === 'AI_PROVIDERS_EXHAUSTED' && err.localFallbackEligible === false
  );

  const seen = counts();
  assert.equal(seen.gemini, 2, 'one primary attempt per task call');
  assert.equal(seen.groq, 2, 'one fallback attempt per task call');
});

test('a rejected primary key with a healthy fallback yields AI-labeled results for both target features', async () => {
  // The real-world misconfiguration this suite guards against: a malformed
  // GEMINI_API_KEY (HTTP 401/403/400 from Google) plus a valid Groq key.
  geminiHandler = () => geminiHttpError(403, 'PERMISSION_DENIED: API key not valid');

  groqHandler = () =>
    groqOk(
      JSON.stringify({
        matchId: 'groq-match',
        atsScore: 77,
        breakdown: { skillsMatchScore: 80, experienceScore: 70, educationScore: 75, keywordDensityScore: 78 },
        summary: 'Groq-served analysis for this resume and job.',
        matchingSkills: ['React'],
        missingSkills: ['Docker'],
        gaps: [],
        atsFeedback: { formattingNotes: [], actionVerbsCheck: 'ok', keywordFrequency: [] }
      })
    );
  const match = await analyzeMatch(RESUME, JOB);
  assert.equal(match.atsScore, 77, 'the AI response (not the formula) must determine the score');
  assert.equal(match.source, 'AI-generated (Groq fallback)', 'the source label must name the provider that served it');

  const question = () => ({ id: 'q', type: 'Technical', question: 'Q?', context: 'C', sampleAnswerOutline: ['a', 'b', 'c'], evalCriteria: 'E' });
  groqHandler = () =>
    groqOk(
      JSON.stringify({
        resumeBasedQuestions: [question(), question(), question()],
        roleBasedQuestions: [question(), question()]
      })
    );
  const questions = await generateQuestions(RESUME, JOB, 'Mid', 5);
  assert.equal(questions.resumeBasedQuestions.length, 3);
  assert.equal(questions.roleBasedQuestions.length, 2);
  assert.equal(questions.source, 'AI-generated (Groq fallback)', 'AI questions must be labeled as AI, not as the bank');

  const seen = counts();
  assert.equal(seen.gemini, 2, 'primary rejected once per task');
  assert.equal(seen.groq, 2, 'fallback served both tasks');
});

test('both providers failing: structured exhaustion from the provider layer, rule-based results from task entry points', async () => {
  geminiHandler = () => geminiHttpError(429, 'RESOURCE_EXHAUSTED: quota exceeded');
  groqHandler = () => groqHttpError(503, 'Service unavailable');

  // 1. The provider layer itself still fails loudly — a structured error, not
  //    a value — and it flags that both failures were eligibility-based.
  await assert.rejects(
    () => generateStructured({ prompt: 'both-fail', systemInstruction: 's', schema: tinySchema, schemaName: 'both_fail_probe' }),
    (err) => {
      assert.ok(err instanceof AiProviderError);
      assert.equal(err.code, 'AI_PROVIDERS_EXHAUSTED');
      assert.equal(err.expose, true);
      assert.equal(err.statusCode, 429, 'a rate-limit failure is the actionable status');
      assert.match(err.message, /Both AI providers failed/);
      assert.match(err.message, /Gemini \(AI_RATE_LIMITED\)/);
      assert.match(err.message, /Groq \(AI_UPSTREAM_ERROR\)/);
      assert.equal(err.primaryCode, 'AI_RATE_LIMITED');
      assert.equal(err.fallbackCode, 'AI_UPSTREAM_ERROR');
      assert.equal(err.localFallbackEligible, true, 'both failures eligible → deterministic local fallback allowed');
      assert.ok(!err.message.includes(GEMINI_KEY), 'message must not contain the Gemini key');
      assert.ok(!err.message.includes(GROQ_KEY), 'message must not contain the Groq key');
      return true;
    }
  );

  let seen = counts();
  assert.equal(seen.gemini, 1, 'no retry loop against the primary');
  assert.equal(seen.groq, 1, 'exactly one fallback attempt');

  // 2. Task entry points honor the eligibility flag: they compute a real
  //    deterministic result from THIS resume + job (never fabricated data)
  //    after exactly one attempt per provider, and label it honestly.
  const result = await analyzeMatch(RESUME, JOB);
  assert.equal(typeof result.atsScore, 'number');
  assert.equal(result.source, 'Rule-based fallback');
  assert.ok(result.summary.length > 0, 'the deterministic summary must explain what was computed');

  seen = counts();
  assert.equal(seen.gemini, 2, 'one more Gemini attempt for the task-level call');
  assert.equal(seen.groq, 2, 'one more Groq fallback attempt');
});

test('every AI entry point tries Gemini first and falls back to Groq exactly once', async () => {
  const entryPoints = [
    ['match analysis', () => analyzeMatch(RESUME, JOB), (r) => typeof r.atsScore === 'number'],
    [
      'skill-gap analysis',
      () => analyzeSkillGaps(RESUME, ['React'], 'Frontend Engineer', JOB),
      (r) => typeof r.readinessScore === 'number'
    ],
    [
      'career-growth recommendations',
      () => generateCareerGrowthPlan(['Docker'], 'Frontend Engineer', RESUME),
      (r) => typeof r.targetRole === 'string'
    ],
    [
      'interview-question generation',
      () => generateQuestions(RESUME, JOB, 'Mid', 5),
      (r) => Array.isArray(r.resumeBasedQuestions) && Array.isArray(r.roleBasedQuestions)
    ],
    [
      'answer evaluation',
      () => evaluateAnswer('Tell me about a project', 'I built a React dashboard with tests.'),
      (r) => typeof r.score === 'number'
    ],
    [
      'mock-interview question generation',
      () => generateMockQuestions(RESUME, JOB, 'Frontend Developer'),
      (r) => Array.isArray(r.round1)
    ],
    [
      'mock answer evaluation',
      () => evaluateMockAnswer('What is a closure?', 'A closure captures its scope.', 2),
      (r) => typeof r.score === 'number'
    ],
    [
      'mock-interview scorecards',
      () =>
        generateFinalScorecard({
          targetRole: 'Frontend Developer',
          violationCount: 0,
          status: 'COMPLETED',
          answers: { q1: { userAnswerText: 'short answer', score: 8, feedback: 'solid', evaluatedCriteria: {} } }
        }),
      (r) => typeof r.overallScore === 'number'
    ]
  ];

  for (const [label, run, validate] of entryPoints) {
    reset();
    geminiHandler = () => geminiOk('{}');

    const result = await run();
    assert.ok(validate(result), `${label}: normalized result must satisfy its schema`);
    let seen = counts();
    assert.equal(seen.gemini, 1, `${label}: must call Gemini first`);
    assert.equal(seen.groq, 0, `${label}: Groq must not be called on Gemini success`);

    reset();
    geminiHandler = () => geminiHttpError(429, 'RESOURCE_EXHAUSTED');
    groqHandler = () => groqOk('{}');

    const fallbackResult = await run();
    assert.ok(validate(fallbackResult), `${label}: fallback result must satisfy its schema`);
    seen = counts();
    assert.equal(seen.gemini, 1, `${label}: one primary attempt`);
    assert.equal(seen.groq, 1, `${label}: exactly one fallback attempt after an eligible failure`);
  }
});

test('interview questions keep the 3 resume-based + 2 role-based default through the fallback chain', async () => {
  const question = () => ({ id: 'q', type: 'technical', question: 'Q?', context: 'C', sampleAnswerOutline: ['a'], evalCriteria: 'E' });
  geminiHandler = () =>
    geminiOk(
      JSON.stringify({
        resumeBasedQuestions: [question(), question(), question()],
        roleBasedQuestions: [question(), question()]
      })
    );

  const questions = await generateQuestions(RESUME, JOB, 'Mid', 5);
  assert.equal(questions.resumeBasedQuestions.length, 3, 'default count: three resume-based questions');
  assert.equal(questions.roleBasedQuestions.length, 2, 'default count: two role-based questions');

  // The Gemini request carries the same split instruction as before.
  const call = events.find((e) => e.provider === 'gemini');
  assert.match(call.body.systemInstruction.parts[0].text, /exactly 3 resume-based questions and exactly 2 role-based questions/);

  // After an eligible Gemini failure the same contract holds via Groq.
  reset();
  geminiHandler = () => geminiHttpError(429, 'RESOURCE_EXHAUSTED');
  groqHandler = () =>
    groqOk(
      JSON.stringify({
        resumeBasedQuestions: [question(), question(), question()],
        roleBasedQuestions: [question(), question()]
      })
    );
  const fallbackQuestions = await generateQuestions(RESUME, JOB, 'Mid', 5);
  assert.equal(fallbackQuestions.resumeBasedQuestions.length, 3);
  assert.equal(fallbackQuestions.roleBasedQuestions.length, 2);
  const seen = counts();
  assert.equal(seen.gemini, 1);
  assert.equal(seen.groq, 1);
});

test('concurrent identical calls share one fallback chain', async () => {
  geminiHandler = () => geminiHttpError(429, 'RESOURCE_EXHAUSTED');
  groqHandler = () =>
    new Promise((resolve) => setTimeout(() => resolve(groqOk('{"name":"shared","score":3,"tags":[],"nested":{"ok":true}}')), 30));

  const before = counts();
  const [first, second] = await Promise.all([
    generateStructured({ prompt: 'coalesce-fallback', systemInstruction: 'sys', schema: tinySchema, schemaName: 'coalesce_fb' }),
    generateStructured({ prompt: 'coalesce-fallback', systemInstruction: 'sys', schema: tinySchema, schemaName: 'coalesce_fb' })
  ]);

  const seen = counts();
  assert.equal(seen.gemini - before.gemini, 1, 'identical concurrent calls share one Gemini attempt');
  assert.equal(seen.groq - before.groq, 1, 'identical concurrent calls share one Groq attempt');
  assert.deepEqual(first, second);
  assert.notEqual(first, second, 'callers receive independent copies');
  assert.equal(first.name, 'shared');
});

test('resume parsing makes zero provider calls with BOTH keys configured', async () => {
  assert.equal(getAiProvider(), 'gemini');
  assert.equal(getFallbackProvider(), 'groq');
  assert.ok(process.env.GEMINI_API_KEY, 'Gemini key configured');
  assert.ok(process.env.GROQ_API_KEY, 'Groq key configured');

  const text =
    'Dual Provider Parse Resume\ncontact: dual.parse@example.com\nSKILLS\n- react, typescript, node\n' +
    'EXPERIENCE\nEngineer at Initech 2019 - 2023\nBuilt dashboards and shipped features across teams regularly.\n';

  const before = events.length;
  const first = await parseResume(text);
  const second = await parseResume(text);
  const [p1, p2] = await Promise.all([parseResume(text), parseResume(text)]);

  assert.equal(events.length - before, 0, 'resume parsing must make zero Gemini/Groq calls');
  assert.equal(first.email, 'dual.parse@example.com');
  assert.ok(first.skills.includes('react'));
  assert.equal(typeof first.isAuthentic, 'boolean');
  assert.deepEqual(first, second);
  assert.deepEqual(p1, p2);
});

test('diagnostics and errors never expose either API key', async () => {
  const captured = { log: [], warn: [] };
  const originalLog = console.log;
  const originalWarn = console.warn;
  console.log = (...args) => captured.log.push(args.join(' '));
  console.warn = (...args) => captured.warn.push(args.join(' '));
  try {
    // A successful fallback run and a both-fail run.
    geminiHandler = () => geminiHttpError(429, 'RESOURCE_EXHAUSTED: quota');
    groqHandler = () => groqOk('{"name":"safe","score":1,"tags":[],"nested":{"ok":true}}');
    await generateStructured({ prompt: 'log-success', systemInstruction: 's', schema: tinySchema, schemaName: 'log_probe' });

    groqHandler = () => groqHttpError(500, 'Internal server error');
    const failure = await generateStructured({ prompt: 'log-failure', systemInstruction: 's', schema: tinySchema, schemaName: 'log_probe' }).then(
      () => null,
      (error) => error
    );
    assert.ok(failure instanceof AiProviderError);
    assert.ok(!failure.message.includes(GEMINI_KEY));
    assert.ok(!failure.message.includes(GROQ_KEY));

    const lines = [...captured.log, ...captured.warn];
    assert.ok(lines.length > 0, 'diagnostics must be emitted');
    for (const line of lines) {
      assert.ok(!line.includes(GEMINI_KEY), 'logs must never contain the Gemini key');
      assert.ok(!line.includes(GROQ_KEY), 'logs must never contain the Groq key');
      assert.ok(!line.includes('dual.parse@example.com'), 'logs must never contain resume content');
    }
    // The diagnostics identify the provider and whether fallback was used.
    assert.ok(lines.some((l) => l.includes('served_by=gemini') || l.includes('served_by=groq')));
    assert.ok(lines.some((l) => l.includes('used_fallback=true')));
    assert.ok(lines.some((l) => l.includes('AI_PROVIDERS_EXHAUSTED')));
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
  }
});
