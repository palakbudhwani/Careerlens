// Tests against the four REAL resume PDFs in the repository's Resume/ folder.
//
// The actual files are run through the real local upload route
// (POST /api/v1/resume/parse → multer → pdf.js extraction → deterministic
// parseResume) and through every AI entry point with STUBBED providers.
// Gemini is primary, Groq is fallback; both keys are configured, yet resume
// parsing must produce zero provider traffic. Resume contents are never
// printed — assertions only check structure, counts, and booleans.
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pdfParse from 'pdf-parse';

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

const realFetch = globalThis.fetch;
const providerEvents = [];
const geminiRequestBodies = [];
let geminiHandler = null;
let groqHandler = null;

globalThis.fetch = async (url, init) => {
  const u = String(url);
  const provider = u.includes('generativelanguage.googleapis.com') ? 'gemini' : 'groq';
  providerEvents.push(provider);
  if (provider === 'gemini') {
    geminiRequestBodies.push(JSON.parse(init.body));
    return geminiHandler(u, init);
  }
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

const failHandler = () => {
  throw new Error('unexpected live AI call during resume parsing');
};

const { getAiProvider, getFallbackProvider, clearAiResultCache, clearProviderCooldowns } = await import('../aiProvider.js');
const { analyzeMatch, generateQuestions, evaluateAnswer, parseResume } = await import('../llm.js');
const { analyzeSkillGaps, generateCareerGrowthPlan } = await import('../skillGapLlm.js');
const { generateMockQuestions, evaluateMockAnswer, generateFinalScorecard } = await import('../mockInterviewLlm.js');
const { app } = await import('../server.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESUME_DIR = path.resolve(__dirname, '..', '..', 'Resume');

const EXPECTED_FILES = [
  'CareerLens_Test_Resume_01_AI_FullStack.pdf',
  'CareerLens_Test_Resume_02_Frontend.pdf',
  'CareerLens_Test_Resume_03_ML_AI.pdf',
  'CareerLens_Test_Resume_04_Simple.pdf'
];

const JOB =
  'Frontend engineer role requiring React, TypeScript, accessibility knowledge, testing experience, and collaboration with product designers.';

const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const extract = (buffer) => pdfParse(new Uint8Array(buffer)).then((doc) => doc.text);

const resumes = EXPECTED_FILES.map((name) => ({
  name,
  buffer: readFileSync(path.join(RESUME_DIR, name))
}));

let server = null;
let baseUrl = '';

test.before(async () => {
  server = app.listen(0);
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => {
  server?.closeAllConnections?.();
  server?.close();
});

test.beforeEach(() => {
  providerEvents.length = 0;
  geminiRequestBodies.length = 0;
  clearAiResultCache();
  clearProviderCooldowns();
  geminiHandler = failHandler;
  groqHandler = failHandler;
});

async function upload(buffer) {
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: 'application/pdf' }), 'resume.pdf');
  const response = await realFetch(`${baseUrl}/api/v1/resume/parse`, { method: 'POST', body: form });
  const raw = await response.text();
  assert.equal(response.status, 200, `upload failed: ${raw.slice(0, 200)}`);
  return JSON.parse(raw);
}

test('the Resume folder contains exactly the four expected PDF files', () => {
  const onDisk = readdirSync(RESUME_DIR).filter((n) => n.toLowerCase().endsWith('.pdf')).sort();
  assert.deepEqual(onDisk, EXPECTED_FILES, 'exactly the four provided resumes, none skipped or renamed');
  for (const { name, buffer } of resumes) {
    assert.equal(buffer.subarray(0, 5).toString('latin1'), '%PDF-', `${name} must be a real PDF`);
    assert.ok(buffer.includes(Buffer.from('xref')), `${name} must contain a PDF xref table`);
    assert.ok(buffer.length > 10_000, `${name} must be non-trivial in size`);
  }
});

test('all four resumes upload and parse with zero provider calls and a preserved schema', async () => {
  assert.equal(getAiProvider(), 'gemini');
  assert.equal(getFallbackProvider(), 'groq');
  assert.ok(process.env.GEMINI_API_KEY && process.env.GROQ_API_KEY, 'both keys are configured');

  const results = [];
  for (const { name, buffer } of resumes) {
    const body = await upload(buffer);

    // Response contract.
    assert.equal(typeof body.resumeText, 'string');
    assert.ok(body.resumeText.split(/\s+/).filter(Boolean).length >= 150, `${name}: extracted text must be substantial`);
    const details = body.parsedDetails;
    assert.equal(typeof details.name, 'string');
    assert.ok(details.name.length >= 3, `${name}: a person-like name must be extracted`);
    assert.ok(emailPattern.test(details.email), `${name}: a valid email must be extracted`);
    assert.ok(Array.isArray(details.skills) && details.skills.length >= 10, `${name}: skills must be extracted`);
    assert.ok(Array.isArray(details.workExperience) && details.workExperience.length >= 1, `${name}: experience must be extracted`);
    assert.ok(Array.isArray(details.education) && details.education.length >= 1, `${name}: education must be extracted`);
    assert.equal(details.isAuthentic, true, `${name}: the real resume must pass authenticity validation`);
    assert.deepEqual(details.validationErrors, []);

    // The response corresponds to THIS file's own text — a fresh local
    // extraction of the same bytes must produce identical details (no state
    // from a previously uploaded resume can leak in). JSON round-trip matches
    // the wire format, which omits undefined-valued keys.
    const localDetails = await parseResume(await extract(buffer));
    assert.deepEqual(JSON.parse(JSON.stringify(details)), JSON.parse(JSON.stringify(localDetails)),
      `${name}: parsed details must match this file's own text`);

    results.push(body);
  }

  // Sequential uploads: four distinct extractions, in order.
  const texts = results.map((r) => r.resumeText);
  assert.equal(new Set(texts).size, 4, 'every resume must produce its own distinct extraction');

  // THE headline guarantee: zero Gemini/Groq traffic for all four uploads.
  assert.equal(providerEvents.length, 0, 'resume parsing must make zero provider calls with both keys configured');
});

test('every AI entry point uses each resume as representative input with Gemini primary and Groq fallback', async () => {
  const entries = [
    ['match analysis', (text) => analyzeMatch(text, JOB), (r) => typeof r.atsScore === 'number'],
    ['skill-gap analysis', (text) => analyzeSkillGaps(text, ['React'], 'Frontend Engineer', JOB), (r) => typeof r.readinessScore === 'number'],
    ['career growth', (text) => generateCareerGrowthPlan(['Docker'], 'Frontend Engineer', text), (r) => typeof r.targetRole === 'string'],
    [
      'interview questions',
      (text) => generateQuestions(text, JOB, 'Mid', 5),
      (r) => r.resumeBasedQuestions.length === 3 && r.roleBasedQuestions.length === 2
    ],
    ['answer evaluation', (text) => evaluateAnswer('Describe a challenging project.', text.slice(0, 200)), (r) => typeof r.score === 'number'],
    ['mock questions', (text) => generateMockQuestions(text, JOB, 'Frontend Developer'), (r) => Array.isArray(r.round1)],
    ['mock evaluation', (text) => evaluateMockAnswer('What is a closure?', text.slice(0, 120), 2), (r) => typeof r.score === 'number'],
    [
      'scorecard',
      (text) =>
        generateFinalScorecard({
          targetRole: 'Frontend Developer',
          violationCount: 0,
          status: 'COMPLETED',
          answers: { q1: { userAnswerText: text.slice(0, 80), score: 8, feedback: 'solid', evaluatedCriteria: {} } }
        }),
      (r) => typeof r.overallScore === 'number'
    ]
  ];

  for (const { name, buffer } of resumes) {
    const text = await extract(buffer);
    // Mirror clipForPrompt's normalization so the snippet matches what the
    // provider request actually contains.
    const promptSnippet = text
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, 30);
    const rawPromptOf = (req) => {
      const contents = (req?.contents || []).map((c) => (c.parts || []).map((p) => p.text || '').join('')).join('\n');
      const system = (req?.systemInstruction?.parts || []).map((p) => p.text || '').join('\n');
      return `${system}\n${contents}`;
    };

    for (const [label, run, validate] of entries) {
      providerEvents.length = 0;
      geminiRequestBodies.length = 0;
      geminiHandler = () =>
        geminiOk(
          label === 'interview questions'
            ? JSON.stringify({
                resumeBasedQuestions: [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }],
                roleBasedQuestions: [{ id: 'o1' }, { id: 'o2' }]
              })
            : '{}'
        );
      groqHandler = failHandler;

      const result = await run(text);
      assert.ok(validate(result), `${name} / ${label}: result must satisfy its schema`);
      assert.equal(providerEvents.filter((p) => p === 'gemini').length, 1, `${name} / ${label}: Gemini first`);
      assert.equal(providerEvents.filter((p) => p === 'groq').length, 0, `${name} / ${label}: no Groq on success`);

      // The real resume text was the prompt input (checked in memory only).
      // Some prompts embed content via JSON.stringify, so accept the raw
      // snippet or its JSON-escaped form.
      const promptText = rawPromptOf(geminiRequestBodies.at(-1));
      const variants = [promptSnippet, JSON.stringify(promptSnippet).slice(1, -1)];
      assert.ok(
        variants.some((v) => promptText.includes(v)),
        `${name} / ${label}: prompt must carry the resume text`
      );
      assert.ok(!promptText.includes(process.env.GEMINI_API_KEY), 'captured request must not include the API key');
    }
  }

  // One eligible-failure cycle per resume: Gemini 429 → exactly one Groq call.
  for (const { name, buffer } of resumes) {
    const text = await extract(buffer);
    providerEvents.length = 0;
    geminiHandler = () => geminiHttpError(429, 'RESOURCE_EXHAUSTED: quota exceeded');
    groqHandler = () => groqOk('{"matchId":"fallback-match","atsScore":66}');

    const result = await analyzeMatch(text, JOB);
    assert.equal(result.matchId, 'fallback-match', `${name}: the fallback result must be served`);
    assert.equal(providerEvents.filter((p) => p === 'gemini').length, 1, `${name}: one Gemini attempt`);
    assert.equal(providerEvents.filter((p) => p === 'groq').length, 1, `${name}: one Groq fallback`);
  }
});

test('when both providers fail for a real resume the response is an honest rule-based result, never fabricated data', async () => {
  const { buffer } = resumes[0];
  const text = await extract(buffer);

  providerEvents.length = 0;
  geminiHandler = () => geminiHttpError(429, 'RESOURCE_EXHAUSTED: quota exceeded');
  groqHandler = () => ({
    ok: false,
    status: 500,
    headers: { get: () => null },
    json: async () => ({ error: { message: 'Internal error' } }),
    text: async () => '{}'
  });

  // Both failures are eligible availability problems, so the entry point
  // computes a deterministic result from THIS resume's own text and labels
  // it — the request never surfaces an error page or stale/mock content.
  const result = await analyzeMatch(text, JOB);
  assert.equal(result.source, 'Rule-based fallback');
  assert.equal(typeof result.atsScore, 'number');
  assert.ok(result.summary.length > 0);
  assert.ok(Array.isArray(result.atsFeedback.formattingNotes));

  // Exactly one attempt per provider: no retry loops.
  assert.equal(providerEvents.filter((p) => p === 'gemini').length, 1);
  assert.equal(providerEvents.filter((p) => p === 'groq').length, 1);
});
