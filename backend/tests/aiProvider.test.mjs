// Offline tests for the AI provider layer: task-specific token limits,
// request deduplication/coalescing, structured-response normalization, prompt
// clipping, and HTTP 429 handling. All provider traffic is stubbed — no live
// Groq/Gemini requests are made.
import test from 'node:test';
import assert from 'node:assert/strict';

// Environment must be set before importing the modules under test.
// dotenv does not override pre-set variables, so these win over backend/.env.
// These unit tests exercise single-provider (Groq) behavior explicitly;
// dual-provider fallback behavior lives in providerFallback.test.mjs.
process.env.AI_PROVIDER = 'groq';
process.env.AI_FALLBACK_PROVIDER = 'none';
process.env.GROQ_API_KEY = 'gsk_unit_test_dummy_key_not_real';
// Offline determinism: no result caching and no fallback backoff in these
// unit tests (the dedicated ruleBasedFallback suite exercises both).
process.env.AI_RESULT_CACHE_TTL_MS = '0';
process.env.AI_FALLBACK_BACKOFF_MS = '0';
delete process.env.GROQ_API_URL;
delete process.env.GEMINI_API_KEY;

const calls = [];
let nextResponse = null;

globalThis.fetch = async (url, init) => {
  calls.push({ url, init, body: JSON.parse(init.body) });
  if (typeof nextResponse === 'function') return nextResponse(url, init);
  return nextResponse;
};

const okJson = (content) => ({
  ok: true,
  status: 200,
  headers: { get: () => null },
  json: async () => ({ choices: [{ message: { content } }] }),
  text: async () => JSON.stringify({ choices: [{ message: { content } }] })
});

const httpError = (status, message, headers = {}) => ({
  ok: false,
  status,
  headers: { get: (name) => headers[String(name).toLowerCase()] ?? null },
  json: async () => ({ error: { message } }),
  text: async () => JSON.stringify({ error: { message } })
});

const provider = await import('../aiProvider.js');
const {
  getAiProvider,
  isAiEnabled,
  generateStructured,
  AiProviderError,
  clampMaxCompletionTokens,
  clearAiResultCache,
  clearProviderCooldowns
} = provider;
const { analyzeMatch, generateQuestions, evaluateAnswer, parseResume } = await import('../llm.js');
const { analyzeSkillGaps, generateCareerGrowthPlan } = await import('../skillGapLlm.js');
const { generateMockQuestions, evaluateMockAnswer, generateFinalScorecard } = await import('../mockInterviewLlm.js');

// No state may leak between tests: cached results and provider cooldowns from
// one test must never suppress (or reroute) another test's provider traffic.
test.beforeEach(() => {
  clearAiResultCache();
  clearProviderCooldowns();
});

const RESUME = 'Experienced software engineer skilled in React TypeScript Node.js building web applications with REST APIs and automated tests at ACME Corp.';
const JOB = 'Looking for a frontend engineer with React TypeScript experience to build accessible user interfaces and collaborate with product designers and product managers.';

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

test('provider resolution and AI enablement', () => {
  assert.equal(getAiProvider(), 'groq');
  assert.equal(isAiEnabled(), true);
});

test('explicit completion-token budgets are forwarded, defaulted, and clamped', async () => {
  nextResponse = okJson('{"name":"a","score":1,"tags":[],"nested":{"ok":true}}');

  await generateStructured({ prompt: 'p1', systemInstruction: 's', schema: tinySchema, maxCompletionTokens: 1200 });
  assert.equal(calls.at(-1).body.max_completion_tokens, 1200);

  await generateStructured({ prompt: 'p2', systemInstruction: 's', schema: tinySchema });
  assert.equal(calls.at(-1).body.max_completion_tokens, 4096);

  await generateStructured({ prompt: 'p3', systemInstruction: 's', schema: tinySchema, maxCompletionTokens: 99999 });
  assert.equal(calls.at(-1).body.max_completion_tokens, 4096);

  await generateStructured({ prompt: 'p4', systemInstruction: 's', schema: tinySchema, maxCompletionTokens: 10 });
  assert.equal(calls.at(-1).body.max_completion_tokens, 256);

  assert.equal(clampMaxCompletionTokens(undefined), 4096);
  assert.equal(clampMaxCompletionTokens(NaN), 4096);
  assert.equal(clampMaxCompletionTokens(1500), 1500);
});

test('each llm task sends its own token budget', async () => {
  nextResponse = okJson('{"matchId":"m1","atsScore":80}');
  await analyzeMatch(RESUME, JOB);
  assert.equal(calls.at(-1).body.max_completion_tokens, 2000);

  nextResponse = okJson('{"resumeBasedQuestions":[],"roleBasedQuestions":[]}');
  await generateQuestions(RESUME, JOB, 'Mid', 5);
  assert.equal(calls.at(-1).body.max_completion_tokens, 2000);

  nextResponse = okJson('{"score":80,"feedback":"ok","suggested_improvement":"be clearer"}');
  await evaluateAnswer('Tell me about a project', 'I built a React dashboard.');
  assert.equal(calls.at(-1).body.max_completion_tokens, 800);

  nextResponse = okJson('{"targetRole":"FE","readinessScore":70}');
  await analyzeSkillGaps(RESUME, ['React'], 'Frontend Engineer', '');
  assert.equal(calls.at(-1).body.max_completion_tokens, 1400);

  nextResponse = okJson('{"targetRole":"FE","summary":"s","courses":[],"milestones":[]}');
  await generateCareerGrowthPlan(['Docker'], 'Frontend Engineer', RESUME);
  assert.equal(calls.at(-1).body.max_completion_tokens, 2000);

  nextResponse = okJson('{"round1":[],"round2":[],"round3":[]}');
  await generateMockQuestions(RESUME, JOB, 'Frontend Developer');
  assert.equal(calls.at(-1).body.max_completion_tokens, 1800);

  nextResponse = okJson('{"score":8,"instantFeedback":"good","evaluatedCriteria":{"technicalAccuracy":8,"clarity":8,"relevanceToRole":8}}');
  await evaluateMockAnswer('What is a closure?', 'A closure is...', 2);
  assert.equal(calls.at(-1).body.max_completion_tokens, 600);

  nextResponse = okJson('{"overallScore":80,"strengths":[],"improvementAreas":[],"hiringRecommendation":"Recommended"}');
  await generateFinalScorecard({
    targetRole: 'Frontend Developer',
    violationCount: 0,
    status: 'COMPLETED',
    answers: { q1: { userAnswerText: 'short answer', score: 8, feedback: 'solid', evaluatedCriteria: {} } }
  });
  assert.equal(calls.at(-1).body.max_completion_tokens, 900);
});

test('interview question count drives the prompt split and budget', async () => {
  nextResponse = okJson('{"resumeBasedQuestions":[],"roleBasedQuestions":[]}');

  await generateQuestions(RESUME, JOB, 'Mid', 5);
  let system = calls.at(-1).body.messages[0].content;
  assert.match(system, /exactly 3 resume-based questions and exactly 2 role-based questions/);
  assert.doesNotMatch(system, /exactly 10 questions/);
  assert.equal(calls.at(-1).body.max_completion_tokens, 400 + 320 * 5);

  await generateQuestions(RESUME, JOB, 'Senior', 1);
  system = calls.at(-1).body.messages[0].content;
  assert.match(system, /exactly 1 resume-based questions and exactly 1 role-based questions/);

  await generateQuestions(RESUME, JOB, 'Mid', 99);
  system = calls.at(-1).body.messages[0].content;
  assert.match(system, /exactly 5 resume-based questions and exactly 5 role-based questions/);
  assert.equal(calls.at(-1).body.max_completion_tokens, 400 + 320 * 10);
});

test('oversized resume and job description are clipped in prompts', async () => {
  const hugeResume = 'Experienced engineer with React skills and many projects.   '.repeat(4000);
  const hugeJob = 'Looking for a frontend engineer with React and accessibility experience. '.repeat(1500);

  nextResponse = okJson('{"matchId":"m2","atsScore":75}');
  await analyzeMatch(hugeResume, hugeJob);
  const matchUser = calls.at(-1).body.messages[1].content;
  assert.ok(matchUser.length < 14000 + 8000 + 120, `match prompt too long: ${matchUser.length}`);
  assert.match(matchUser, /\[content truncated for length\]/);

  nextResponse = okJson('{"round1":[],"round2":[],"round3":[]}');
  await generateMockQuestions(hugeResume, hugeJob, 'Frontend Developer');
  const mockUser = calls.at(-1).body.messages[1].content;
  assert.ok(mockUser.length < 8000 + 6000 + 160, `mock prompt too long: ${mockUser.length}`);

  // Whitespace from PDF extraction is collapsed (no runs of blank lines).
  nextResponse = okJson('{"matchId":"m3","atsScore":70}');
  await analyzeMatch('Line one\n\n\n\n\nLine two     with    spaces', JOB);
  assert.doesNotMatch(calls.at(-1).body.messages[1].content, /\n{3,}/);
});

test('concurrent identical structured calls coalesce into one upstream request', async () => {
  nextResponse = () =>
    new Promise(resolve => setTimeout(() => resolve(okJson('{"name":"shared","score":1,"tags":[],"nested":{"ok":true}}')), 40));

  const before = calls.length;
  const [first, second] = await Promise.all([
    generateStructured({ prompt: 'coalesce-me', systemInstruction: 'sys', schema: tinySchema, schemaName: 'coalesce' }),
    generateStructured({ prompt: 'coalesce-me', systemInstruction: 'sys', schema: tinySchema, schemaName: 'coalesce' })
  ]);
  assert.equal(calls.length, before + 1, 'concurrent identical calls must share one fetch');
  assert.deepEqual(first, second);
  assert.notEqual(first, second, 'callers must receive independent copies');
  first.name = 'mutated-by-caller';
  assert.equal(second.name, 'shared', 'mutation must not leak between callers');

  nextResponse = okJson('{"name":"other","score":2,"tags":[],"nested":{"ok":true}}');
  await generateStructured({ prompt: 'different-prompt', systemInstruction: 'sys', schema: tinySchema, schemaName: 'coalesce' });
  assert.equal(calls.length, before + 2, 'different prompts must not coalesce');
});

test('resume parsing makes zero provider fetches even with Groq configured and rate-limited', async () => {
  // Groq IS the configured provider and AI is enabled…
  assert.equal(getAiProvider(), 'groq');
  assert.equal(isAiEnabled(), true);

  // …and the stubbed provider rate-limits. Prove the stub is live by hitting
  // it through a different llm entry point first.
  nextResponse = httpError(429, 'Rate limit reached for model openai/gpt-oss-120b', { 'retry-after': '45' });
  await assert.rejects(
    () => analyzeMatch(RESUME, JOB),
    (err) => err.statusCode === 429 && err.code === 'AI_RATE_LIMITED'
  );
  assert.ok(calls.length > 0, 'the rate-limit stub must be reachable through the provider');

  // Resume parsing must not touch the provider at all — not once, not
  // concurrently, not on repeat parses (there is no LLM parse left to cache).
  const before = calls.length;
  const text =
    'Unique Parse Test Resume\ncontact: parse.test@example.com\nSKILLS\n- react, typescript, node\n' +
    'EXPERIENCE\nSoftware Engineer at Acme Corp 2019 - 2023\nBuilt dashboards and shipped features across teams regularly.\n';
  const first = await parseResume(text);
  const second = await parseResume(text);
  const [p1, p2] = await Promise.all([parseResume(text), parseResume(text)]);
  assert.equal(calls.length, before, 'resume parsing must make zero provider fetches');

  // Same response schema as before: required fields always present.
  for (const parsed of [first, second, p1, p2]) {
    assert.equal(typeof parsed.name, 'string');
    assert.equal(typeof parsed.email, 'string');
    assert.ok(Array.isArray(parsed.skills));
    assert.ok(Array.isArray(parsed.workExperience));
    assert.ok(Array.isArray(parsed.education));
    assert.equal(typeof parsed.isAuthentic, 'boolean');
    assert.ok(Array.isArray(parsed.validationErrors));
  }
  assert.deepEqual(first, second);
  assert.deepEqual(p1, p2);

  // Details are read from the text itself — nothing invented.
  assert.equal(first.email, 'parse.test@example.com');
  assert.ok(first.skills.includes('react'));

  // Deterministic authenticity rules still fire without any AI request.
  const placeholder = await parseResume(
    'John Doe\njane.doe@example.com\n[Company Name]\n[Insert Degree]\n' +
      'EXPERIENCE\nDeveloper at Example Corp 2020 - 2022\nSkills and education content for length purposes here.\n'
  );
  assert.equal(placeholder.isAuthentic, false);
  assert.ok(placeholder.validationErrors.includes('Placeholder template contents detected'));
  assert.equal(calls.length, before, 'authenticity checks must not call the provider either');
});

test('valid structured response is normalized to the schema', async () => {
  nextResponse = okJson(JSON.stringify({ name: 123, score: '87.6', tags: 'x', nested: { ok: 'true' }, extra: 'drop' }));
  const result = await generateStructured({ prompt: 'normalize', systemInstruction: 's', schema: tinySchema, schemaName: 'normalize' });
  assert.deepEqual(result, { name: '123', score: 88, tags: ['x'], nested: { ok: true } });

  const call = calls.at(-1);
  assert.equal(call.url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(call.init.headers.Authorization, `Bearer ${process.env.GROQ_API_KEY}`);
  assert.equal(call.body.model, 'openai/gpt-oss-120b');
  assert.equal(call.body.response_format.type, 'json_schema');
  const rf = call.body.response_format.json_schema;
  assert.equal(rf.strict, true);
  assert.deepEqual(rf.schema.required, ['name', 'score', 'tags', 'nested']);
  assert.equal(rf.schema.additionalProperties, false);
  assert.equal(rf.schema.properties.score.type, 'integer');
  assert.equal(call.body.messages[0].role, 'system');
  assert.equal(call.body.messages[1].role, 'user');
});

test('fillDefaults=false keeps missing fields missing', async () => {
  nextResponse = okJson('{"score":5}');
  const result = await generateStructured({ prompt: 'partial', systemInstruction: 's', schema: tinySchema, fillDefaults: false });
  assert.deepEqual(Object.keys(result), ['score']);
});

test('HTTP 429 reports retry timing, sends no retry, and leaks no secrets', async () => {
  const before = calls.length;
  nextResponse = httpError(429, 'Rate limit reached for model openai/gpt-oss-120b with tokens per min limit of 8192', {
    'retry-after': '45'
  });
  await assert.rejects(
    () => generateStructured({ prompt: 'rate-limited-call', systemInstruction: 's', schema: tinySchema }),
    (err) => {
      assert.ok(err instanceof AiProviderError);
      assert.equal(err.statusCode, 429);
      assert.equal(err.code, 'AI_RATE_LIMITED');
      assert.equal(err.expose, true);
      assert.match(err.message, /rate-limited/);
      assert.match(err.message, /No automatic retries/);
      assert.match(err.message, /Retry in about 45 seconds/);
      assert.match(err.message, /Rate limit reached for model/);
      assert.ok(!err.message.includes(process.env.GROQ_API_KEY), 'message must not contain the API key');
      return true;
    }
  );
  assert.equal(calls.length, before + 1, 'a 429 must trigger exactly one request (no automatic retries)');
});

test('429 token-reset headers are translated into a human retry window', async () => {
  nextResponse = httpError(429, 'Tokens per minute limit reached', { 'x-ratelimit-reset-tokens': '90' });
  await assert.rejects(
    () => generateStructured({ prompt: 'tpm-call', systemInstruction: 's', schema: tinySchema }),
    (err) => {
      assert.equal(err.statusCode, 429);
      assert.match(err.message, /tokens-per-minute limit/);
      assert.match(err.message, /Retry in about 2 minutes/);
      return true;
    }
  );

  nextResponse = httpError(429, 'Rate limit reached');
  await assert.rejects(
    () => generateStructured({ prompt: 'no-header-call', systemInstruction: 's', schema: tinySchema }),
    (err) => {
      assert.equal(err.statusCode, 429);
      assert.match(err.message, /No automatic retries/);
      assert.match(err.message, /Try again in a moment/);
      return true;
    }
  );
});

test('other provider failures keep their safe status mapping', async () => {
  nextResponse = httpError(401, 'Invalid API Key Provided');
  await assert.rejects(
    () => generateStructured({ prompt: 'auth', systemInstruction: 's', schema: tinySchema }),
    (err) => err.statusCode === 503 && err.code === 'AI_UNAUTHORIZED' && err.expose === true
  );

  nextResponse = httpError(503, 'Model overloaded');
  await assert.rejects(
    () => generateStructured({ prompt: 'five-xx', systemInstruction: 's', schema: tinySchema }),
    (err) => err.statusCode === 502 && err.code === 'AI_UPSTREAM_ERROR'
  );

  nextResponse = okJson('this is not json');
  await assert.rejects(
    () => generateStructured({ prompt: 'bad-json', systemInstruction: 's', schema: tinySchema }),
    (err) => err.statusCode === 502 && err.code === 'AI_INVALID_JSON'
  );

  nextResponse = () => {
    const error = new Error('The operation was aborted');
    error.name = 'TimeoutError';
    throw error;
  };
  await assert.rejects(
    () => generateStructured({ prompt: 'timeout', systemInstruction: 's', schema: tinySchema }),
    (err) => err.statusCode === 504 && err.code === 'AI_TIMEOUT'
  );
});

test('non-strict models fall back to json_object with the schema in the system prompt', async () => {
  const originalModel = process.env.GROQ_MODEL;
  process.env.GROQ_MODEL = 'some-other-model';
  try {
    nextResponse = okJson('{"name":"a","score":1,"tags":[],"nested":{"ok":true}}');
    await generateStructured({ prompt: 'non-strict', systemInstruction: 's', schema: tinySchema, schemaName: 'ns' });
    const call = calls.at(-1);
    assert.equal(call.body.response_format.type, 'json_object');
    assert.match(call.body.messages[0].content, /JSON Schema/);
  } finally {
    if (originalModel === undefined) delete process.env.GROQ_MODEL;
    else process.env.GROQ_MODEL = originalModel;
  }
});

test('llm entry points propagate provider errors instead of returning mock data', async () => {
  nextResponse = httpError(429, 'Rate limit reached');
  await assert.rejects(
    () => analyzeMatch(RESUME, JOB),
    (err) => err.statusCode === 429 && err.code === 'AI_RATE_LIMITED'
  );
  await assert.rejects(
    () => generateQuestions(RESUME, JOB, 'Mid', 5),
    (err) => err.statusCode === 429 && err.code === 'AI_RATE_LIMITED'
  );
  await assert.rejects(
    () => analyzeSkillGaps(RESUME, ['React'], 'Frontend Engineer', ''),
    (err) => err.statusCode === 429 && err.code === 'AI_RATE_LIMITED'
  );
});

test('AI_PROVIDER=none uses local fallbacks with zero provider requests', async () => {
  process.env.AI_PROVIDER = 'none';
  try {
    assert.equal(getAiProvider(), 'none');
    assert.equal(isAiEnabled(), false);
    const before = calls.length;
    const match = await analyzeMatch(RESUME, JOB);
    assert.equal(typeof match.atsScore, 'number');
    const questions = await generateQuestions(RESUME, JOB, 'Mid', 5);
    assert.ok(Array.isArray(questions.resumeBasedQuestions));
    assert.equal(calls.length, before, 'no provider requests must be made when AI is disabled');
  } finally {
    process.env.AI_PROVIDER = 'groq';
  }
});
