// Offline tests for the DETERMINISTIC no-API fallback layer (requirement 9).
//
// Covered: every core AI feature produces a real rule-based result when BOTH
// providers fail with eligible errors; exact score/rubric calculations; five
// questions built from real resume data; no fabricated candidate details;
// honest source labels (AI Gemini / AI Groq fallback / Rule-based fallback);
// routing rules (ineligible errors and single-provider mode never fall back);
// result caching, jittered backoff, hint-based cooldowns, resume-parse
// isolation, cross-resume isolation, and end-to-end HTTP source propagation.
// Every provider call is stubbed — no live Gemini/Groq request is made.
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

// Must be set before importing the modules under test. dotenv does not
// override pre-set variables, so these win over backend/.env.
process.env.AI_PROVIDER = 'gemini';
process.env.AI_FALLBACK_PROVIDER = 'groq';
process.env.GEMINI_API_KEY = 'AIza_dummy_primary_key_not_real';
process.env.GROQ_API_KEY = 'gsk_dummy_fallback_key_not_real';
// Fast backoff for most tests; the backoff test raises it explicitly.
// The result cache stays ENABLED (default 5 min TTL) — this suite tests it.
process.env.AI_FALLBACK_BACKOFF_MS = '10';
delete process.env.GEMINI_MODEL;
delete process.env.GROQ_API_URL;

const events = [];
let geminiHandler = null;
let groqHandler = null;

// The real fetch is kept so HTTP helper calls in this file reach the local
// test server while provider traffic stays stubbed.
const realFetch = globalThis.fetch.bind(globalThis);

globalThis.fetch = async (url, init) => {
  const u = String(url);
  const isGemini = u.includes('generativelanguage.googleapis.com');
  const isGroq = u.includes('api.groq.com') || u.includes('groq');
  if (!isGemini && !isGroq) return realFetch(url, init);
  const provider = isGemini ? 'gemini' : 'groq';
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

const groqHttpError = (status, message, headers = {}) => ({
  ok: false,
  status,
  headers: { get: (name) => headers[String(name).toLowerCase()] ?? null },
  json: async () => ({ error: { message } }),
  text: async () => JSON.stringify({ error: { message } })
});

const provider = await import('../aiProvider.js');
const {
  generateStructured,
  AiProviderError,
  clearAiResultCache,
  clearProviderCooldowns,
  computeFallbackBackoffMs
} = provider;
const { analyzeMatch, generateQuestions, evaluateAnswer, parseResume } = await import('../llm.js');
const { analyzeSkillGaps, generateCareerGrowthPlan } = await import('../skillGapLlm.js');
const { generateMockQuestions, evaluateMockAnswer, generateFinalScorecard } = await import('../mockInterviewLlm.js');
const { RULE_BASED_SOURCE, aiSourceLabel, scoreAnswer, buildSkillGapAnalysis, scanSkills } = await import('../ruleBasedFallback.js');
const { app } = await import('../server.js');

// ---------------------------------------------------------------------------
// Fixtures: two DISTINCT resumes and a job description (hand-computable)
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

// The HTTP routes enforce a 50-word minimum on both inputs, so the
// end-to-end test uses padded variants of the same fixtures.
const RESUME_HTTP =
  RESUME_A +
  'ADDITIONAL\n' +
  'Consistently partners with teammates to deliver reliable work, documents key decisions, ' +
  'gathers feedback from users, and improves internal processes over time. Comfortable presenting ' +
  'updates to small groups and writing clear handoff notes for the next milestone. ' +
  'Enjoys breaking large efforts into small steps and reviewing results with the team.\n';

const JD_HTTP =
  JD_A +
  'About the role: This position collaborates with designers and engineers to ship ' +
  'customer-facing improvements each sprint. Responsibilities include reviewing work, participating ' +
  'in planning conversations, writing clear status updates, and helping teammates unblock tasks. ' +
  'The ideal candidate communicates clearly and takes ownership of outcomes.\n';

const SCORECARD_SESSION = {
  targetRole: 'Frontend Developer',
  violationCount: 0,
  status: 'COMPLETED',
  roundQuestions: { round1: [], round2: [], round3: [] },
  answers: { q1: { userAnswerText: 'short answer', score: 8, feedback: 'solid', evaluatedCriteria: {} } }
};

const failBoth = () => {
  geminiHandler = () => geminiHttpError(429, 'RESOURCE_EXHAUSTED: quota exceeded');
  groqHandler = () => groqHttpError(503, 'Service unavailable');
};

const counts = () => ({
  gemini: events.filter((e) => e.provider === 'gemini').length,
  groq: events.filter((e) => e.provider === 'groq').length
});

test.beforeEach(() => {
  events.length = 0;
  clearAiResultCache();
  clearProviderCooldowns();
  failBoth();
});

// ---------------------------------------------------------------------------
// 1. Every core feature falls back to real deterministic computation
// ---------------------------------------------------------------------------

test('every core AI feature returns a real rule-based result when BOTH providers fail', async () => {
  const entries = [
    ['match analysis', () => analyzeMatch(RESUME_A, JD_A), (r) => typeof r.atsScore === 'number'],
    [
      'skill-gap analysis',
      () => analyzeSkillGaps(RESUME_A, ['React'], 'Frontend Engineer', JD_A),
      (r) => typeof r.readinessScore === 'number'
    ],
    [
      'career growth',
      () => generateCareerGrowthPlan(['Docker'], 'Frontend Engineer', RESUME_A),
      (r) => typeof r.targetRole === 'string' && Array.isArray(r.courses) && Array.isArray(r.milestones)
    ],
    [
      'interview questions',
      () => generateQuestions(RESUME_A, JD_A, 'Mid', 5),
      (r) => r.resumeBasedQuestions.length === 3 && r.roleBasedQuestions.length === 2
    ],
    ['answer evaluation', () => evaluateAnswer('What is React?', 'React is a UI library.'), (r) => r.score === 54],
    [
      'mock questions',
      () => generateMockQuestions(RESUME_A, JD_A, 'Frontend Developer'),
      (r) => r.round1.length === 5 && r.round2.length === 3 && r.round3.length === 3
    ],
    [
      'mock answer evaluation',
      () => evaluateMockAnswer('What is a closure?', 'A closure captures its lexical scope.', 2),
      (r) => r.score === 5.5
    ],
    ['mock scorecard', () => generateFinalScorecard(SCORECARD_SESSION), (r) => r.overallScore === 80]
  ];

  for (const [label, run, validate] of entries) {
    events.length = 0;
    failBoth();
    const result = await run();
    assert.equal(result.source, RULE_BASED_SOURCE, `${label}: must be labelled as the rule-based fallback`);
    assert.ok(validate(result), `${label}: result must satisfy its schema/exact expectations`);
    const seen = counts();
    assert.equal(seen.gemini, 1, `${label}: exactly one primary attempt`);
    assert.equal(seen.groq, 1, `${label}: exactly one fallback attempt`);
  }
});

test('AI-disabled mode routes through the same deterministic engine with zero provider traffic', async () => {
  process.env.AI_PROVIDER = 'none';
  try {
    geminiHandler = () => {
      throw new Error('unexpected Gemini call while AI is disabled');
    };
    groqHandler = () => {
      throw new Error('unexpected Groq call while AI is disabled');
    };

    const match = await analyzeMatch(RESUME_A, JD_A);
    assert.equal(match.source, RULE_BASED_SOURCE);
    assert.equal(match.atsScore, 51);

    const questions = await generateQuestions(RESUME_A, JD_A, 'Mid', 5);
    assert.equal(questions.source, RULE_BASED_SOURCE);
    assert.equal(questions.resumeBasedQuestions.length, 3);

    const mock = await generateMockQuestions(RESUME_A, JD_A, 'Frontend Developer');
    assert.equal(mock.source, RULE_BASED_SOURCE);
    assert.equal(mock.round1.length, 5);

    assert.equal(events.length, 0, 'no provider traffic while AI is disabled');
  } finally {
    process.env.AI_PROVIDER = 'gemini';
  }
});

// ---------------------------------------------------------------------------
// 2. Exact score calculations (documented formulas)
// ---------------------------------------------------------------------------

test('match analysis scores follow the documented weighted formula exactly', async () => {
  const result = await analyzeMatch(RESUME_A, JD_A);

  // Required = React, TypeScript, Docker, Kubernetes (vocabulary ∩ JD).
  // evidenced = React, TypeScript → skills = round(100 * 2/4) = 50
  // experience = 1 entry → round(100 * (0.4*0.5 + 0.6*0.5)) = 50
  // keyword    = bands [80, 80, 0, 0] → 40      education = 75 (JD silent)
  assert.deepEqual(result.breakdown, {
    skillsMatchScore: 50,
    experienceScore: 50,
    educationScore: 75,
    keywordDensityScore: 40
  });
  const { skillsMatchScore, experienceScore, educationScore, keywordDensityScore } = result.breakdown;
  const expected = Math.round(0.4 * skillsMatchScore + 0.3 * experienceScore + 0.2 * keywordDensityScore + 0.1 * educationScore);
  assert.equal(result.atsScore, expected, 'atsScore must be the documented 40/30/20/10 blend');
  assert.equal(result.atsScore, 51);

  assert.deepEqual(result.matchingSkills, ['React', 'TypeScript']);
  assert.deepEqual(result.missingSkills, ['Docker', 'Kubernetes']);
  assert.ok(result.gaps.length > 0, 'missing requirements must surface as gaps');
});

test('skill-gap readiness is round(100 * matching / required)', async () => {
  const result = buildSkillGapAnalysis({ resumeText: RESUME_A, parsedSkills: [], targetRole: 'Frontend Engineer', jobDescription: JD_A });
  assert.deepEqual(result.requiredSkills, ['React', 'TypeScript', 'Docker', 'Kubernetes']);
  assert.deepEqual(result.matchingSkills, ['React', 'TypeScript']);
  assert.equal(result.readinessScore, Math.round((100 * 2) / 4));
  assert.equal(result.readinessScore, 50);
  assert.equal(result.missingSkills.length, 2);
  for (const missing of result.missingSkills) {
    assert.equal(missing.currentProficiency, 'None', 'missing skills have no resume evidence');
  }
});

test('answer evaluation uses the fixed 4x25 rubric and mock scores use 0.4/0.3/0.3', async () => {
  // Hand computation for question "What is React?" / answer "React is a UI library."
  // relevance = 25 (1/1 keyword), evidence = 0 (no markers), technical = 25
  // (React addressed), completeness = 4 (<15 words) → 54.
  const scored = scoreAnswer('What is React?', 'React is a UI library.');
  assert.equal(scored.score, 54);
  assert.deepEqual(
    { ...scored.dimensions },
    { relevance: 25, evidence: 0, technical: 25, completeness: 4 }
  );

  // Mock evaluation: ta = (25+0)/50*10 = 5, clarity = 4/25*10 = 1.6,
  // relevance = 10 → 0.4*5 + 0.3*1.6 + 0.3*10 = 5.48 → 5.5.
  const { buildMockEvaluation } = await import('../ruleBasedFallback.js');
  const mock = buildMockEvaluation({ question: 'What is React?', answer: 'React is a UI library.', roundId: 2 });
  assert.equal(mock.score, 5.5);
  assert.deepEqual(mock.evaluatedCriteria, { technicalAccuracy: 5, clarity: 1.6, relevanceToRole: 10 });

  // Scorecard: mean([8]) * 10 = 80 → Strong Hire; terminated sessions score 0.
  const card = await generateFinalScorecard(SCORECARD_SESSION);
  assert.equal(card.overallScore, 80);
  assert.equal(card.hiringRecommendation, 'Strong Hire');
  const terminated = await generateFinalScorecard({ ...SCORECARD_SESSION, status: 'TERMINATED' });
  assert.equal(terminated.overallScore, 0);
  assert.match(terminated.hiringRecommendation, /Not Recommended/);
});

// ---------------------------------------------------------------------------
// 3. Questions built from REAL resume data, correct counts, no fabrication
// ---------------------------------------------------------------------------

test('five questions are built from this resume (3 resume + 2 role) with caps honored', async () => {
  const questions = await generateQuestions(RESUME_A, JD_A, 'Mid', 5);
  assert.equal(questions.resumeBasedQuestions.length, 3);
  assert.equal(questions.roleBasedQuestions.length, 2);

  const flat = JSON.stringify(questions);
  assert.match(flat, /ACME/, 'resume questions must reference the real employer');
  assert.match(flat, /React/, 'resume questions must reference real skills');
  assert.match(flat, /Docker/, 'role questions must cover the detected gaps');

  for (const q of [...questions.resumeBasedQuestions, ...questions.roleBasedQuestions]) {
    assert.ok(q.question.length > 0);
    assert.ok(q.sampleAnswerOutline.length >= 3, 'every question keeps its answer outline');
    assert.ok(q.evalCriteria.length > 0);
  }

  // Caps: count 4 → 2+2, count 99 → clamped to 10 (5+5), count 1 → 2 (1+1).
  const four = await generateQuestions(RESUME_A, JD_A, 'Mid', 4);
  assert.equal(four.resumeBasedQuestions.length, 2);
  assert.equal(four.roleBasedQuestions.length, 2);
  const ten = await generateQuestions(RESUME_A, JD_A, 'Mid', 99);
  assert.equal(ten.resumeBasedQuestions.length, 5);
  assert.equal(ten.roleBasedQuestions.length, 5);
  const two = await generateQuestions(RESUME_A, JD_A, 'Mid', 1);
  assert.equal(two.resumeBasedQuestions.length, 1);
  assert.equal(two.roleBasedQuestions.length, 1);
});

test('nothing is fabricated: results only contain facts present in THIS resume or the JD', async () => {
  const a = await analyzeMatch(RESUME_A, JD_A);
  const b = await analyzeMatch(RESUME_B, JD_A);

  // Cross-resume isolation: distinct inputs produce distinct analyses…
  assert.notEqual(a.matchId, b.matchId);
  assert.notEqual(a.summary, b.summary);
  // …and resume B's analysis never mentions resume A's employer.
  assert.ok(!JSON.stringify(b).includes('ACME'), 'no cross-resume leakage');

  // Matching/missing skills can only come from the job description itself.
  const jdSkills = scanSkills(JD_A).map((s) => s.name);
  for (const skill of [...a.matchingSkills, ...a.missingSkills]) {
    assert.ok(jdSkills.includes(skill), `every reported skill must come from the JD: ${skill}`);
  }

  // A resume with NO education entry against a JD that requires a degree is
  // identified as missing — never invented. The same JD with resume A scores full.
  const resumeNoEdu = RESUME_A.replace(/\nEDUCATION[\s\S]*$/, '').trim();
  const eduJd = 'We need a React developer who holds a degree in computer science.';
  const noEdu = await analyzeMatch(resumeNoEdu, eduJd);
  assert.equal(noEdu.breakdown.educationScore, 30, 'missing education is scored down, never invented');
  assert.ok(
    noEdu.atsFeedback.formattingNotes.some((n) => /no degree entry was detected/i.test(n)),
    'the report explicitly says no degree entry was found'
  );
  const withEdu = await analyzeMatch(RESUME_A, eduJd);
  assert.equal(withEdu.breakdown.educationScore, 100, 'a real education entry scores full marks');

  // Questions for resume B must not reference resume A's employer either.
  const questionsB = await generateQuestions(RESUME_B, JD_A, 'Mid', 5);
  assert.ok(!JSON.stringify(questionsB).includes('ACME'));
});

// ---------------------------------------------------------------------------
// 4. Source labels on every path
// ---------------------------------------------------------------------------

test('source labels are honest on AI, fallback-AI, and rule-based paths', async () => {
  assert.equal(aiSourceLabel('gemini'), 'AI-generated (Gemini)');
  assert.equal(aiSourceLabel('groq'), 'AI-generated (Groq fallback)');
  assert.equal(aiSourceLabel(undefined), 'AI-generated (Gemini)');

  // Primary success.
  geminiHandler = () => geminiOk('{"matchId":"m-gem","atsScore":80}');
  const primary = await analyzeMatch(RESUME_A, JD_A);
  assert.equal(primary.source, 'AI-generated (Gemini)');

  // Fallback success after an eligible primary failure.
  events.length = 0;
  clearAiResultCache();
  geminiHandler = () => geminiHttpError(429, 'RESOURCE_EXHAUSTED');
  groqHandler = () => groqOk('{"matchId":"m-groq","atsScore":70}');
  const fallback = await analyzeMatch(RESUME_A, JD_A);
  assert.equal(fallback.source, 'AI-generated (Groq fallback)');
  assert.equal(counts().gemini, 1);
  assert.equal(counts().groq, 1);

  // Both-fail → rule-based (already covered per feature above, re-check label).
  clearAiResultCache();
  failBoth();
  const local = await analyzeMatch(RESUME_A, JD_A);
  assert.equal(local.source, 'Rule-based fallback');
});

// ---------------------------------------------------------------------------
// 5. Routing: ineligible errors and single-provider mode never fall back
// ---------------------------------------------------------------------------

test('validation/credential errors do NOT trigger the rule-based fallback', async () => {
  geminiHandler = () => geminiHttpError(400, 'INVALID_ARGUMENT: request schema was rejected');
  await assert.rejects(
    () => analyzeMatch(RESUME_A, JD_A),
    (err) => err instanceof AiProviderError && err.code === 'AI_BAD_REQUEST'
  );
  assert.equal(counts().groq, 0, 'an HTTP 400 must not fall back to Groq');
  assert.equal(counts().gemini, 1);

  events.length = 0;
  geminiHandler = () => geminiHttpError(401, 'API key not valid');
  await assert.rejects(
    () => analyzeSkillGaps(RESUME_A, ['React'], 'Frontend Engineer', JD_A),
    (err) => err instanceof AiProviderError && err.code === 'AI_UNAUTHORIZED'
  );
  assert.equal(counts().groq, 0, 'credential errors must not fall back either');
});

test('single-provider mode (no fallback configured) propagates errors instead of silently falling back', async () => {
  process.env.AI_FALLBACK_PROVIDER = 'none';
  try {
    await assert.rejects(
      () => analyzeMatch(RESUME_A, JD_A),
      (err) => {
        assert.equal(err.code, 'AI_RATE_LIMITED');
        assert.equal(err.localFallbackEligible, undefined, 'no fallback existed, so no local fallback is allowed');
        return true;
      }
    );
    assert.equal(counts().gemini, 1);
    assert.equal(counts().groq, 0);
  } finally {
    process.env.AI_FALLBACK_PROVIDER = 'groq';
  }
});

// ---------------------------------------------------------------------------
// 6. Caching, backoff, cooldown, concurrency controls
// ---------------------------------------------------------------------------

test('identical successful calls are cached (provider + source label preserved)', async () => {
  geminiHandler = () => geminiOk('{"matchId":"cached-1","atsScore":81}');

  const first = await analyzeMatch(RESUME_A, JD_A);
  assert.equal(first.matchId, 'cached-1');
  assert.equal(first.source, 'AI-generated (Gemini)');
  assert.equal(counts().gemini, 1);

  // Second identical call: served from cache, zero extra provider traffic.
  const second = await analyzeMatch(RESUME_A, JD_A);
  assert.equal(second.matchId, 'cached-1');
  assert.equal(second.source, 'AI-generated (Gemini)', 'cache hits keep the truthful provider label');
  assert.equal(counts().gemini, 1, 'a cache hit must not re-call the provider');
  assert.notEqual(first, second, 'callers receive independent copies');

  // After an explicit cache clear the provider is called again.
  clearAiResultCache();
  await analyzeMatch(RESUME_A, JD_A);
  assert.equal(counts().gemini, 2);

  // Failures are never cached.
  clearAiResultCache();
  failBoth();
  await analyzeMatch(RESUME_A, JD_A);
  await analyzeMatch(RESUME_A, JD_A);
  assert.equal(counts().gemini, 4, 'two both-fail runs → two attempts each');
  assert.equal(counts().groq, 2);
});

test('computeFallbackBackoffMs is jittered, capped, and disabled at base 0', () => {
  assert.equal(computeFallbackBackoffMs(0, 1500, () => 1), 0, 'base 0 disables the delay');
  assert.equal(computeFallbackBackoffMs(200, 1500, () => 1), 200, 'upper jitter bound = base');
  assert.equal(computeFallbackBackoffMs(200, 1500, () => 0), 100, 'lower jitter bound = 50% of base');
  assert.equal(computeFallbackBackoffMs(200, 1500, () => 0.5), 150);
  assert.equal(computeFallbackBackoffMs(100, 60, () => 1), 100, 'max below base never shrinks the base');
  assert.ok(computeFallbackBackoffMs(300, 1500) >= 150 && computeFallbackBackoffMs(300, 1500) <= 300);
});

test('an eligible transient failure waits the configured backoff before the fallback attempt', async () => {
  process.env.AI_FALLBACK_BACKOFF_MS = '150';
  process.env.AI_FALLBACK_BACKOFF_MAX_MS = '500';
  try {
    geminiHandler = () => geminiHttpError(503, 'The model is overloaded right now');
    groqHandler = () => groqOk('{"matchId":"after-backoff","atsScore":70}');
    const started = Date.now();
    const result = await analyzeMatch(RESUME_A, JD_A);
    const elapsed = Date.now() - started;
    assert.equal(result.matchId, 'after-backoff');
    // Jittered delay lands in [75ms, 150ms]; allow timer slack below 75.
    assert.ok(elapsed >= 60, `expected a backoff before the fallback, waited ${elapsed}ms`);
  } finally {
    process.env.AI_FALLBACK_BACKOFF_MS = '10';
    delete process.env.AI_FALLBACK_BACKOFF_MAX_MS;
  }
});

test('hint-based cooldowns skip a cooling primary and short-circuit a cooling fallback', async () => {
  // --- Part A: Groq primary rate-limits WITH a retry-after hint -------------
  process.env.AI_PROVIDER = 'groq';
  process.env.AI_FALLBACK_PROVIDER = 'gemini';
  try {
    groqHandler = () =>
      groqHttpError(429, 'Rate limit reached for model openai/gpt-oss-120b', { 'retry-after': '30' });
    geminiHandler = () => geminiOk('{"matchId":"gemini-kept-us-alive","atsScore":72}');

    const first = await analyzeMatch(RESUME_A, JD_A);
    assert.equal(first.matchId, 'gemini-kept-us-alive');
    assert.equal(counts().groq, 1, 'one rate-limited primary attempt');

    // The primary is now cooling down: the next call must skip it entirely.
    clearAiResultCache();
    const second = await analyzeMatch(RESUME_A, JD_A);
    assert.equal(second.matchId, 'gemini-kept-us-alive');
    assert.equal(counts().groq, 1, 'a cooling primary must be skipped (no new request)');
    assert.equal(counts().gemini, 2, 'the fallback serves directly');
  } finally {
    process.env.AI_PROVIDER = 'gemini';
    process.env.AI_FALLBACK_PROVIDER = 'groq';
    clearProviderCooldowns();
  }

  // --- Part B: the FALLBACK is cooling → synthetic rate-limit, no request ---
  events.length = 0;
  clearAiResultCache();
  clearProviderCooldowns();

  // First run: primary eligible failure + fallback 429 WITH hint → cooldown set.
  geminiHandler = () => geminiHttpError(503, 'upstream unavailable');
  groqHandler = () => groqHttpError(429, 'Rate limit reached', { 'retry-after': '30' });
  await assert.rejects(
    () => generateStructured({ prompt: 'cooldown-seed', systemInstruction: 's', schema: { type: 'OBJECT', properties: { a: { type: 'STRING' } }, required: ['a'] }, schemaName: 'cooldown_probe' }),
    (err) => err.code === 'AI_PROVIDERS_EXHAUSTED' && err.localFallbackEligible === true
  );
  assert.equal(counts().groq, 1);

  // Second run: primary fails again, but the fallback is cooling → no groq call.
  clearAiResultCache();
  geminiHandler = () => geminiHttpError(429, 'RESOURCE_EXHAUSTED');
  const result = await analyzeMatch(RESUME_A, JD_A);
  assert.equal(result.source, RULE_BASED_SOURCE, 'both failures stay eligible → deterministic result');
  assert.equal(counts().gemini, 2, 'one more primary attempt');
  assert.equal(counts().groq, 1, 'the cooling fallback must not be called at all');
});

// ---------------------------------------------------------------------------
// 7. Resume parsing stays offline; validation never fabricates
// ---------------------------------------------------------------------------

test('resume parsing makes zero provider calls even with both keys configured and both providers failing', async () => {
  geminiHandler = () => {
    throw new Error('unexpected Gemini call during resume parsing');
  };
  groqHandler = () => {
    throw new Error('unexpected Groq call during resume parsing');
  };

  const first = await parseResume(RESUME_A);
  const second = await parseResume(RESUME_A);
  const [p1, p2] = await Promise.all([parseResume(RESUME_A), parseResume(RESUME_A)]);

  assert.equal(events.length, 0, 'resume parsing must never touch a provider');
  assert.equal(first.name, 'Alex Rivera');
  assert.deepEqual(first, second);
  assert.deepEqual(p1, p2);
});

// ---------------------------------------------------------------------------
// 8. End-to-end HTTP propagation of the source label
// ---------------------------------------------------------------------------

test('HTTP responses carry the source label through the whole mock-interview flow', async () => {
  failBoth();
  const server = app.listen(0);
  await once(server, 'listening');
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const post = async (path, body) => {
      const response = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const raw = await response.text();
      assert.equal(response.status, 200, `${path} failed: ${raw.slice(0, 200)}`);
      return JSON.parse(raw);
    };
    const get = async (path) => {
      const response = await fetch(`${base}${path}`);
      const raw = await response.text();
      assert.equal(response.status, 200, `${path} failed: ${raw.slice(0, 200)}`);
      return JSON.parse(raw);
    };

    // 1. Match analysis over HTTP.
    const match = await post('/api/v1/match/analyze', { resumeText: RESUME_HTTP, jobDescription: JD_HTTP });
    assert.equal(match.source, RULE_BASED_SOURCE);
    assert.equal(typeof match.atsScore, 'number');
    assert.notEqual(match.isAuthentic, false, 'the fixture must pass resume authenticity checks');

    // 2. Interview questions over HTTP.
    const questions = await post('/api/v1/interview/questions', {
      resumeText: RESUME_HTTP,
      jobDescription: JD_HTTP,
      difficulty: 'Mid',
      questionCount: 5
    });
    assert.equal(questions.source, RULE_BASED_SOURCE);
    assert.equal(questions.resumeBasedQuestions.length, 3);

    // 3. Mock session: start → fetch round → submit answers → complete.
    const started = await post('/api/v1/mock-interview/start', {
      candidateId: 'cand-1',
      jobDescription: JD_HTTP,
      resumeText: RESUME_HTTP,
      targetRole: 'Frontend Developer'
    });
    const round1 = await get(`/api/v1/mock-interview/questions?sessionId=${started.sessionId}&roundId=1`);
    assert.equal(round1.source, RULE_BASED_SOURCE, 'round questions expose their source');
    assert.ok(round1.questions.length > 0);
    assert.equal(round1.questions[0].correctAnswerIndex, undefined, 'MCQ answers stay hidden from the client');

    // MCQ grading is deterministic — labelled "Rule-based" (never AI).
    const mcq = round1.questions[0];
    const mcqAnswer = await post('/api/v1/mock-interview/submit-answer', {
      sessionId: started.sessionId,
      roundId: 1,
      questionId: mcq.questionId,
      userAnswerText: '0'
    });
    assert.equal(mcqAnswer.source, 'Rule-based');

    // Free-text evaluation goes through the same both-fail path.
    const round2 = await get(`/api/v1/mock-interview/questions?sessionId=${started.sessionId}&roundId=2`);
    const free = round2.questions[0];
    const freeAnswer = await post('/api/v1/mock-interview/submit-answer', {
      sessionId: started.sessionId,
      roundId: 2,
      questionId: free.questionId,
      userAnswerText: 'I built dashboards with React and TypeScript for analytics.'
    });
    assert.equal(freeAnswer.source, RULE_BASED_SOURCE);
    assert.equal(typeof freeAnswer.score, 'number');

    // 4. Scorecard.
    const complete = await post('/api/v1/mock-interview/complete', { sessionId: started.sessionId });
    assert.equal(complete.source, RULE_BASED_SOURCE);
    assert.equal(typeof complete.overallScore, 'number');
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
});
