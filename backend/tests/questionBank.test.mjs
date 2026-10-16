// Offline tests for the curated interview-question bank and the task-layer
// question contract (requirement 11).
//
// Covered: exact count splits and clamps through generateQuestions; resume/
// job grounding (ACME/React/Docker present, RESUME_B has no ACME); stable
// determinism for identical inputs; word/outline caps, id shape, and the
// difficulty prefix after stamping; job-title inference; bank inventory;
// contract violations (wrong counts / blank fields / hollow outlines) falling
// back to the bank with no extra provider call, and unparseable Gemini JSON +
// Groq "{}" costing exactly one attempt each; well-formed Groq output passing
// validation untouched.
// Every provider call is stubbed — no live Gemini/Groq request is made.
import test from 'node:test';
import assert from 'node:assert/strict';

// Must be set before importing the modules under test. dotenv does not
// override pre-set variables, so these win over backend/.env.
process.env.AI_PROVIDER = 'gemini';
process.env.AI_FALLBACK_PROVIDER = 'groq';
process.env.GEMINI_API_KEY = 'AIza_dummy_primary_key_not_real';
process.env.GROQ_API_KEY = 'gsk_dummy_fallback_key_not_real';
process.env.AI_RESULT_CACHE_TTL_MS = '0';
process.env.AI_FALLBACK_BACKOFF_MS = '0';
delete process.env.GEMINI_MODEL;
delete process.env.GROQ_API_URL;

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

const { clearAiResultCache, clearProviderCooldowns } = await import('../aiProvider.js');
const { generateQuestions } = await import('../llm.js');
const { buildInterviewQuestions, RULE_BASED_SOURCE } = await import('../ruleBasedFallback.js');
const { selectInterviewQuestions, inferJobTitle, questionBankSizes } = await import('../questionBank.js');

// ---------------------------------------------------------------------------
// Fixtures (same as ruleBasedFallback.test.mjs so expectations line up)
// ---------------------------------------------------------------------------

const RESUME_A =
  'Alex Rivera\n' +
  'SUMMARY\n' +
  'Software engineer building web applications.\n' +
  'SKILLS\n' +
  'React, TypeScript, Node.js\n' +
  'EXPERIENCE\n' +
  'Frontend Engineer — ACME Corp | 2022 - 2024\n' +
  '- Built dashboards with React and TypeScript for internal analytics.\n' +
  'EDUCATION\n' +
  'Bachelor of Science in Computer Science 2020\n';

const RESUME_B =
  'Sam Chen\n' +
  'SUMMARY\n' +
  'Data-focused engineer working on pipelines.\n' +
  'SKILLS\n' +
  'Python, SQL, Pandas\n' +
  'PROJECTS\n' +
  'Demand Forecasting Tool — python | Predictions for retail demand using machine learning.\n' +
  'EXPERIENCE\n' +
  'Data Analyst — Globex Inc | 2021 - 2023\n' +
  '- Built ETL pipelines with Python and SQL.\n' +
  'EDUCATION\n' +
  'Master of Science in Data Science 2021\n';

const JD_A =
  'We are hiring a frontend engineer.\n' +
  'Requirements:\n' +
  'React\n' +
  'TypeScript\n' +
  'Docker\n' +
  'Kubernetes\n';

const failBoth = () => {
  geminiHandler = () => geminiHttpError(429, 'RESOURCE_EXHAUSTED: quota exceeded');
  groqHandler = () => groqHttpError(503, 'Service unavailable');
};

const counts = () => ({
  gemini: events.filter((e) => e.provider === 'gemini').length,
  groq: events.filter((e) => e.provider === 'groq').length
});

const wordCount = (value) => String(value).trim().split(/\s+/).filter(Boolean).length;

const allQuestions = (result) => [...result.resumeBasedQuestions, ...result.roleBasedQuestions];

test.beforeEach(() => {
  events.length = 0;
  clearAiResultCache();
  clearProviderCooldowns();
  failBoth();
});

// ---------------------------------------------------------------------------
// 1. Counts and clamps
// ---------------------------------------------------------------------------

test('question counts clamp to [2,10] and split ceil(count/2) + remainder', async () => {
  const cases = [
    [1, 1, 1],
    [2, 1, 1],
    [4, 2, 2],
    [5, 3, 2],
    [9, 5, 4],
    [99, 5, 5]
  ];
  for (const [requested, resumeExpected, roleExpected] of cases) {
    events.length = 0;
    failBoth();
    const result = await generateQuestions(RESUME_A, JD_A, 'Mid', requested);
    assert.equal(result.source, RULE_BASED_SOURCE, `count=${requested}: rule-based source`);
    assert.equal(result.resumeBasedQuestions.length, resumeExpected, `count=${requested}: resume split`);
    assert.equal(result.roleBasedQuestions.length, roleExpected, `count=${requested}: role split`);
    const seen = counts();
    assert.equal(seen.gemini, 1, `count=${requested}: one primary attempt`);
    assert.equal(seen.groq, 1, `count=${requested}: one fallback attempt`);
  }
});

test('question ids are stamped q-res-N / q-role-N and unique within a result', async () => {
  const result = buildInterviewQuestions({ resumeText: RESUME_A, jobDescription: JD_A, difficulty: 'Mid', total: 5 });
  const ids = allQuestions(result).map((q) => q.id);
  assert.deepEqual(
    ids,
    ['q-res-1', 'q-res-2', 'q-res-3', 'q-role-1', 'q-role-2'],
    'ids follow the stamped sequence across both lists'
  );
  assert.equal(new Set(ids).size, ids.length, 'ids are unique');
});

// ---------------------------------------------------------------------------
// 2. Resume/job grounding
// ---------------------------------------------------------------------------

test('default questions ground in resume evidence and job gaps (ACME/React/Docker)', async () => {
  const result = await generateQuestions(RESUME_A, JD_A, 'Mid', 5);
  assert.equal(result.source, RULE_BASED_SOURCE);
  const flat = JSON.stringify(result);
  assert.match(flat, /ACME/, 'resume employer appears in a question');
  assert.match(flat, /React/, 'resume/job skill appears in a question');
  assert.match(flat, /Docker/, 'the unevidenced job requirement appears as a gap question');
});

test('RESUME_B questions never mention ACME (no cross-resume leakage)', async () => {
  const result = await generateQuestions(RESUME_B, JD_A, 'Mid', 5);
  assert.equal(result.source, RULE_BASED_SOURCE);
  const flat = JSON.stringify(result);
  assert.doesNotMatch(flat, /ACME/, 'RESUME_B has no ACME anywhere in its questions');
  assert.match(flat, /Globex/, 'its own employer is used instead');
});

// ---------------------------------------------------------------------------
// 3. Determinism
// ---------------------------------------------------------------------------

test('identical inputs produce byte-identical question sets', () => {
  const first = buildInterviewQuestions({ resumeText: RESUME_A, jobDescription: JD_A, difficulty: 'Mid', total: 5 });
  const second = buildInterviewQuestions({ resumeText: RESUME_A, jobDescription: JD_A, difficulty: 'Mid', total: 5 });
  assert.equal(JSON.stringify(first), JSON.stringify(second), 'two runs over the same inputs match exactly');

  const other = buildInterviewQuestions({ resumeText: RESUME_A, jobDescription: JD_A, difficulty: 'Senior', total: 5 });
  assert.notEqual(
    JSON.stringify(first),
    JSON.stringify(other),
    'difficulty is an input to selection, so the sets can differ'
  );
});

test('selectInterviewQuestions honors an arbitrary 5+5 split', () => {
  const out = selectInterviewQuestions({
    resumeText: RESUME_A,
    jobDescription: JD_A,
    difficulty: 'Mid',
    resumeCount: 5,
    roleCount: 5
  });
  assert.equal(out.resumeBasedQuestions.length, 5);
  assert.equal(out.roleBasedQuestions.length, 5);
});

// ---------------------------------------------------------------------------
// 4. Contract: word caps, outline depth, difficulty prefix
// ---------------------------------------------------------------------------

test('every stamped question respects word caps, outline depth, and difficulty prefix', async () => {
  for (const difficulty of ['Junior', 'Mid', 'Senior']) {
    const result = buildInterviewQuestions({ resumeText: RESUME_A, jobDescription: JD_A, difficulty, total: 10 });
    for (const question of allQuestions(result)) {
      const label = `${difficulty}/${question.id}`;
      assert.ok(question.type.trim().length > 0, `${label}: type present`);
      assert.ok(wordCount(question.question) <= 35, `${label}: question <= 35 words`);
      assert.ok(wordCount(question.context) <= 25, `${label}: context <= 25 words`);
      assert.ok(question.sampleAnswerOutline.length >= 3, `${label}: at least 3 outline bullets`);
      for (const bullet of question.sampleAnswerOutline) {
        assert.ok(wordCount(bullet) <= 12, `${label}: outline bullet <= 12 words`);
      }
      assert.ok(
        question.evalCriteria.startsWith(`${difficulty} level. `),
        `${label}: evalCriteria carries the "${difficulty} level." prefix`
      );
      assert.ok(wordCount(question.evalCriteria) <= 25, `${label}: evalCriteria <= 25 words`);
    }
  }
});

// ---------------------------------------------------------------------------
// 5. Job-title inference and bank inventory
// ---------------------------------------------------------------------------

test('inferJobTitle extracts a clean title or falls back to "this role"', () => {
  assert.equal(
    inferJobTitle('Senior Frontend Engineer\nWe are hiring for our product team in the city with competitive pay.\n'),
    'Senior Frontend Engineer',
    'first line used as a title'
  );
  assert.equal(inferJobTitle('Backend Engineer\nRequirements:\nJava\n'), 'Backend Engineer', 'plain first line is the title');
  assert.equal(
    inferJobTitle('Backend Engineer.\nRequirements:\nJava\n'),
    'this role',
    'a sentence-like line (trailing period) is not a title'
  );
  assert.equal(
    inferJobTitle('We are hiring a frontend engineer.\nRequirements:\nReact\n'),
    'this role',
    'a sentence line is not a title'
  );
  assert.equal(
    inferJobTitle('We need a wonderful colleague who can do many different things for us daily\n'),
    'this role',
    'a first line longer than 10 words is not a title'
  );
  assert.equal(inferJobTitle(''), 'this role', 'empty input falls back');
});

test('the bank ships a substantial inventory on both sides', () => {
  const sizes = questionBankSizes();
  assert.ok(sizes.groups >= 10, 'at least 10 category groups');
  assert.ok(sizes.resumeEntries >= 20, 'at least 20 resume entries');
  assert.ok(sizes.roleEntries >= 20, 'at least 20 role entries');
});

// ---------------------------------------------------------------------------
// 6. Task-layer validation: invalid AI output -> bank, no extra call
// ---------------------------------------------------------------------------

test('Gemini content violates the question contract -> bank with no extra provider call', async () => {
  // Valid JSON, but wrong counts (1/0 instead of 3/2), blank question text,
  // and a hollow outline. The provider chain already succeeded, so the
  // contract check runs AFTER runAiTask and must NOT spend another call.
  const malformed = JSON.stringify({
    resumeBasedQuestions: [
      { id: 'r1', type: 'Technical', question: 'Short list?', context: 'Wrong counts', sampleAnswerOutline: ['a'], evalCriteria: 'x' }
    ],
    roleBasedQuestions: []
  });
  geminiHandler = () => geminiOk(malformed);
  groqHandler = () => {
    throw new Error('unexpected Groq call: invalid content must not cost another request');
  };

  const result = await generateQuestions(RESUME_A, JD_A, 'Mid', 5);
  assert.equal(result.source, RULE_BASED_SOURCE, 'invalid output is answered from the curated bank');
  assert.equal(result.resumeBasedQuestions.length, 3, 'bank supplies the 3 resume questions');
  assert.equal(result.roleBasedQuestions.length, 2, 'bank supplies the 2 role questions');
  const seen = counts();
  assert.equal(seen.gemini, 1, 'exactly one Gemini attempt');
  assert.equal(seen.groq, 0, 'no extra provider call for content-level violations');
  assert.match(JSON.stringify(result), /ACME/, 'bank output stays grounded in the resume');
});

test('Gemini emits unparseable JSON and Groq returns {} -> bank after exactly one attempt each', async () => {
  // Invalid generated JSON is an eligible provider failure, so Groq gets its
  // single attempt; its "{}" violates the question contract, so the wrapper
  // answers from the bank.
  geminiHandler = () => geminiOk('this is not JSON {');
  groqHandler = () => groqOk('{}');

  const result = await generateQuestions(RESUME_A, JD_A, 'Mid', 5);
  assert.equal(result.source, RULE_BASED_SOURCE, 'contract violation after the provider chain -> bank');
  assert.equal(result.resumeBasedQuestions.length, 3);
  assert.equal(result.roleBasedQuestions.length, 2);
  const seen = counts();
  assert.equal(seen.gemini, 1, 'exactly one Gemini attempt');
  assert.equal(seen.groq, 1, 'exactly one Groq attempt');
  assert.match(JSON.stringify(result), /Docker/, 'bank output stays grounded in the job');
});

test('valid well-formed Groq output passes validation untouched after a Gemini 429', async () => {
  const question = (i) => ({
    id: `g${i}`,
    type: 'Technical',
    question: `Question ${i} covers React architecture trade-offs in production systems?`,
    context: `Context for question ${i} covering the target role.`,
    sampleAnswerOutline: ['Point one here', 'Point two here', 'Point three here'],
    evalCriteria: 'Technical depth and trade-off reasoning.'
  });
  geminiHandler = () => geminiHttpError(429, 'RESOURCE_EXHAUSTED');
  groqHandler = () =>
    groqOk(
      JSON.stringify({
        resumeBasedQuestions: [question(1), question(2), question(3)],
        roleBasedQuestions: [question(4), question(5)]
      })
    );

  const result = await generateQuestions(RESUME_A, JD_A, 'Mid', 5);
  assert.equal(result.source, 'AI-generated (Groq fallback)', 'well-formed output keeps its provider label');
  assert.equal(result.resumeBasedQuestions.length, 3);
  assert.equal(result.roleBasedQuestions.length, 2);
  assert.equal(result.resumeBasedQuestions[0].id, 'g1', 'provider ids survive untouched');
  const seen = counts();
  assert.equal(seen.gemini, 1);
  assert.equal(seen.groq, 1);
});
