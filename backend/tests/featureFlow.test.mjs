// Offline end-to-end tests for the two reported features, driven through the
// real Express app with a stubbed global fetch — no live Gemini/Groq request
// is made and no API key ever leaves the process.
//
// Covers: the AI-provider abstraction serving the displayed result, the exact
// resume + job description reaching the provider prompt, honest source labels,
// a rescued fallback after a rejected primary key (the verified misconfiguration
// on this machine), loud errors (never a formula) when both keys are rejected,
// labeled rule-based output after both providers rate-limit, the interview
// question contract, and prompt-level proof that a job switch sends the new
// job description without re-parsing the PDF.
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Must be set before importing server.js. dotenv does not override pre-set
// variables, so these win over backend/.env.
process.env.AI_PROVIDER = 'gemini';
process.env.AI_FALLBACK_PROVIDER = 'groq';
process.env.GEMINI_API_KEY = 'AIza_dummy_flow_test_key_not_real';
process.env.GROQ_API_KEY = 'gsk_dummy_flow_test_key_not_real';
process.env.AI_RESULT_CACHE_TTL_MS = '300000';
process.env.AI_FALLBACK_BACKOFF_MS = '0';
delete process.env.GEMINI_MODEL;
delete process.env.GROQ_MODEL;
delete process.env.GROQ_API_URL;

const realFetch = globalThis.fetch;
const events = [];
let geminiHandler = null;
let groqHandler = null;

globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (!u.includes('generativelanguage.googleapis.com') && !u.includes('api.groq.com')) {
    throw new Error(`unexpected non-provider fetch during the flow test: ${u}`);
  }
  const provider = u.includes('generativelanguage.googleapis.com') ? 'gemini' : 'groq';
  events.push({ provider, url: u, body: init?.body ? JSON.parse(init.body) : null });
  return provider === 'gemini' ? geminiHandler(u, init) : groqHandler(u, init);
};

const geminiOk = (content) => ({
  ok: true,
  status: 200,
  headers: new Headers({ 'content-type': 'application/json' }),
  json: async () => ({ candidates: [{ content: { role: 'model', parts: [{ text: content }] } }] }),
  text: async () => ''
});

const httpError = (status, message) => ({
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

const provider = await import('../aiProvider.js');
const { clearAiResultCache, clearProviderCooldowns } = provider;
const { app } = await import('../server.js');

const RESUME_MARKER = 'ZephyrDashboard';
const JOB_MARKER_A = 'Quanticorp';
const JOB_MARKER_B = 'HalcyonSystems';

const RESUME =
  `Alex Rivera
alex.rivera@example.com
SUMMARY
Full-stack engineer with five years of experience building dashboards and internal tools.
SKILLS
React, TypeScript, Node.js, REST APIs, PostgreSQL, Jest
EXPERIENCE
Software Engineer at Nimbus Labs 2021 - Present
- Built the ${RESUME_MARKER} analytics dashboard used by the whole product team
- Designed REST APIs and automated tests in Node.js and TypeScript
- Mentored two junior engineers and ran code reviews
EDUCATION
Bachelor of Technology in Computer Engineering, State University, 2020`;

const JOB_A =
  `${JOB_MARKER_A} is hiring a Senior Frontend Engineer to own our design system.
 Responsibilities include building accessible React and TypeScript interfaces, wiring REST APIs, improving performance, mentoring engineers, and partnering with product managers on delivery.
 Requirements: 4+ years of professional frontend development, strong React and TypeScript, testing experience with Jest or similar, excellent written communication, and a track record of shipping polished user interfaces.`;

const JOB_B =
  `${JOB_MARKER_B} seeks a Backend Engineer to scale our Node.js platform.
 Responsibilities include designing REST APIs, operating PostgreSQL at size, improving observability, and mentoring mid-level engineers.
 Requirements: 4+ years of backend development, deep Node.js and TypeScript knowledge, strong SQL skills, experience with automated testing, and clear communication with stakeholders.`;

const MATCH_RESPONSE = (matchId, score) =>
  JSON.stringify({
    matchId,
    atsScore: score,
    breakdown: { skillsMatchScore: score, experienceScore: score, educationScore: score, keywordDensityScore: score },
    summary: `Provider-served analysis for ${matchId}.`,
    matchingSkills: ['React', 'TypeScript'],
    missingSkills: ['Kubernetes'],
    gaps: [{ category: 'Skills', description: 'Kubernetes missing', impact: 'Medium', recommendation: 'Add a homelab cluster project.' }],
    atsFeedback: { formattingNotes: ['Clean single-column layout.'], actionVerbsCheck: 'Strong action verbs throughout.', keywordFrequency: [{ keyword: 'React', count: 4, status: 'Optimal' }] }
  });

const questionSet = (prefix) => {
  const q = (n) => ({
    id: `${prefix}-q${n}`,
    type: n % 2 === 0 ? 'Project-Based' : 'Technical',
    question: `${prefix} question ${n} referencing real context?`,
    context: `Context ${n} from the supplied inputs.`,
    sampleAnswerOutline: ['Point one.', 'Point two.', 'Point three.'],
    evalCriteria: `Criterion ${n}.`
  });
  return JSON.stringify({
    resumeBasedQuestions: [q(1), q(2), q(3)],
    roleBasedQuestions: [q(4), q(5)]
  });
};

const counts = () => ({
  gemini: events.filter((e) => e.provider === 'gemini').length,
  groq: events.filter((e) => e.provider === 'groq').length
});

// The @google/genai SDK serializes `contents` as an array of
// { parts: [{ text }] } objects, so flatten it the same way the request body
// actually looks rather than relying on Array.prototype.toString().
const promptText = (call) =>
  (call.body?.contents || [])
    .map((c) => (c.parts || []).map((p) => p.text || '').join(''))
    .join('\n');

function resetHandlers() {
  events.length = 0;
  clearAiResultCache();
  clearProviderCooldowns();
  geminiHandler = () => geminiOk(MATCH_RESPONSE('from-gemini', 81));
  groqHandler = () => groqOk(MATCH_RESPONSE('from-groq', 64));
}

const server = app.listen(0);
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;

process.on('exit', () => {
  server.closeAllConnections?.();
  server.close();
});

async function post(pathName, body) {
  const response = await realFetch(`${base}${pathName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return { status: response.status, json: await response.json() };
}

test.beforeEach(resetHandlers);

test('match analysis is served by the AI provider and carries its resume + job description in the prompt', async () => {
  const { status, json } = await post('/api/v1/match/analyze', {
    resumeText: RESUME,
    jobDescription: JOB_A,
    candidateId: 'candidate-001',
    jobId: 'job-a'
  });

  assert.equal(status, 200);
  assert.equal(json.atsScore, 81, 'the provider response (not the formula) must determine the displayed score');
  assert.equal(json.source, 'AI-generated (Gemini)');
  assert.equal(json.matchId, 'from-gemini');
  assert.equal(json.jobId, 'job-a', 'the existing response contract must be preserved');

  const call = events.find((e) => e.provider === 'gemini');
  assert.ok(call, 'exactly the primary provider must be called');
  const userText = promptText(call);
  assert.ok(userText.includes(RESUME_MARKER), 'the parsed resume text must reach the AI prompt');
  assert.ok(userText.includes(JOB_MARKER_A), 'the selected job description must reach the AI prompt');
  assert.equal(counts().groq, 0, 'no fallback attempt when the primary succeeds');
});

test('a rejected Gemini key is rescued by the Groq fallback and labeled honestly', async () => {
  geminiHandler = () => httpError(401, 'API key not valid');

  const { status, json } = await post('/api/v1/match/analyze', { resumeText: RESUME, jobDescription: JOB_A });

  assert.equal(status, 200);
  assert.equal(json.atsScore, 64, 'the fallback provider response must determine the score');
  assert.equal(json.source, 'AI-generated (Groq fallback)');
  assert.equal(counts().gemini, 1);
  assert.equal(counts().groq, 1);
});

test('both providers rate-limited: labeled rule-based result, never presented as AI', async () => {
  geminiHandler = () => httpError(429, 'RESOURCE_EXHAUSTED: quota exceeded');
  groqHandler = () => httpError(429, 'rate limit reached');

  const { status, json } = await post('/api/v1/match/analyze', { resumeText: RESUME, jobDescription: JOB_A });

  assert.equal(status, 200, 'the documented local fallback keeps the feature usable');
  assert.equal(json.source, 'Rule-based fallback', 'the result must identify itself as rule-based');
  assert.equal(typeof json.atsScore, 'number');
  assert.ok(json.summary.length > 0);
  assert.ok(json.breakdown, 'the response contract is preserved');
});

test('both providers rejecting the keys surfaces an error — a formula can never masquerade as AI', async () => {
  geminiHandler = () => httpError(401, 'API key not valid');
  groqHandler = () => httpError(401, 'Invalid API Key');

  const { status, json } = await post('/api/v1/match/analyze', { resumeText: RESUME, jobDescription: JOB_A });

  assert.equal(status, 503);
  assert.equal(json.code, 'AI_PROVIDERS_EXHAUSTED');
  assert.ok(!json.atsScore, 'no score may be invented when both providers reject the credentials');
});

test('interview questions are AI-generated with resume + job context and an honest source label', async () => {
  geminiHandler = () => geminiOk(questionSet('gem'));

  const { status, json } = await post('/api/v1/interview/questions', {
    resumeText: RESUME,
    jobDescription: JOB_A,
    difficulty: 'Mid',
    questionCount: 5
  });

  assert.equal(status, 200);
  assert.equal(json.resumeBasedQuestions.length, 3);
  assert.equal(json.roleBasedQuestions.length, 2);
  assert.equal(json.source, 'AI-generated (Gemini)');
  assert.ok(json.resumeBasedQuestions.every((q) => q.sampleAnswerOutline.length >= 3), 'the question contract must hold');

  const call = events.find((e) => e.provider === 'gemini');
  const userText = promptText(call);
  assert.ok(userText.includes(RESUME_MARKER), 'questions must be generated from the parsed resume');
  assert.ok(userText.includes(JOB_MARKER_A), 'questions must be generated from the selected job description');
});

test('non-conforming AI question output is answered from the bank and labeled rule-based (never as AI)', async () => {
  const hollow = JSON.stringify({
    resumeBasedQuestions: [{ id: 'only-one', type: 'Technical', question: 'Q?', context: 'C', sampleAnswerOutline: ['a'], evalCriteria: 'E' }],
    roleBasedQuestions: []
  });
  geminiHandler = () => geminiOk(hollow);

  const { status, json } = await post('/api/v1/interview/questions', {
    resumeText: RESUME,
    jobDescription: JOB_A,
    difficulty: 'Mid',
    questionCount: 5
  });

  assert.equal(status, 200);
  assert.equal(json.source, 'Rule-based fallback', 'a contract violation must never keep the AI label');
  assert.equal(json.resumeBasedQuestions.length + json.roleBasedQuestions.length, 5, 'the requested count is still served');
  assert.ok(json.resumeBasedQuestions.every((q) => q.sampleAnswerOutline.length >= 3), 'bank questions honor the same contract');
});

test('question generation fails loudly when both keys are rejected — no bank questions slip through', async () => {
  geminiHandler = () => httpError(401, 'API key not valid');
  groqHandler = () => httpError(401, 'Invalid API Key');

  const { status, json } = await post('/api/v1/interview/questions', {
    resumeText: RESUME,
    jobDescription: JOB_A,
    difficulty: 'Mid',
    questionCount: 5
  });

  assert.equal(status, 503);
  assert.equal(json.code, 'AI_PROVIDERS_EXHAUSTED');
  assert.ok(!json.resumeBasedQuestions, 'no questions may be invented on a credential failure');
});

test('a job switch sends the NEW job description in a fresh provider prompt (same resume, no re-upload)', async () => {
  const first = await post('/api/v1/match/analyze', { resumeText: RESUME, jobDescription: JOB_A });
  assert.equal(first.json.source, 'AI-generated (Gemini)');

  geminiHandler = () => geminiOk(MATCH_RESPONSE('from-gemini-job-b', 55));
  const second = await post('/api/v1/match/analyze', { resumeText: RESUME, jobDescription: JOB_B });
  assert.equal(second.json.matchId, 'from-gemini-job-b');

  const [callA, callB] = events.filter((e) => e.provider === 'gemini');
  const textA = promptText(callA);
  const textB = promptText(callB);
  assert.ok(textA.includes(JOB_MARKER_A) && !textA.includes(JOB_MARKER_B));
  assert.ok(textB.includes(JOB_MARKER_B) && !textB.includes(JOB_MARKER_A), 'the second request must carry the newly selected job');
  assert.ok(textB.includes(RESUME_MARKER), 'the parsed resume text is reused for the new job (client-side re-parse never reaches the provider layer)');
});

test('identical analysis requests are answered from the result cache with the original provider label', async () => {
  const body = { resumeText: RESUME, jobDescription: JOB_A };

  const first = await post('/api/v1/match/analyze', body);
  assert.equal(first.json.source, 'AI-generated (Gemini)');
  const afterFirst = counts();

  const second = await post('/api/v1/match/analyze', body);
  assert.deepEqual(second.json, first.json, 'a cache hit must return the same result, not a different one');
  assert.equal(second.json.source, 'AI-generated (Gemini)', 'the source label stays truthful on cache hits');
  assert.deepEqual(counts(), afterFirst, 'no additional provider traffic for an identical request');
});

test('the PDF fixture route still parses with zero provider calls', async () => {
  const fixturePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'unseen-textual.pdf');
  const bytes = readFileSync(fixturePath);
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: 'application/pdf' }), 'unseen-textual.pdf');

  const response = await realFetch(`${base}/api/v1/resume/parse`, { method: 'POST', body: form });
  const json = await response.json();

  assert.equal(response.status, 200, json.message || 'parse must succeed');
  assert.equal(typeof json.resumeText, 'string');
  assert.equal(counts().gemini + counts().groq, 0, 'resume parsing must never spend provider requests');
});
