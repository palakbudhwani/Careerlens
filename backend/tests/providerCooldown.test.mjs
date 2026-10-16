// Test provider cooldown behavior: after a rate-limited fallback, subsequent calls skip the fallback provider
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.AI_PROVIDER = 'gemini';
process.env.AI_FALLBACK_PROVIDER = 'groq';
process.env.GEMINI_API_KEY = 'dummy_gemini_key';
process.env.GROQ_API_KEY = 'dummy_groq_key';
process.env.AI_RESULT_CACHE_TTL_MS = '0'; // disable cache for deterministic behavior
process.env.AI_FALLBACK_BACKOFF_MS = '0'; // no backoff delay

let events = [];
let geminiHandler = null;
let groqHandler = null;

globalThis.fetch = async (url, init) => {
  const u = String(url);
  const provider = u.includes('generativelanguage.googleapis.com') ? 'gemini' : 'groq';
  events.push({ provider, url: u, body: init?.body ? JSON.parse(init.body) : null });
  if (provider === 'gemini') return geminiHandler(u, init);
  return groqHandler(u, init);
};

const { analyzeMatch } = await import('../llm.js');

const RESUME = 'React developer with 5 years experience.';
const JOB = 'Frontend engineer needed with React and TypeScript.';

function geminiHttpError(status, message) {
  return { ok: false, status, statusText: 'Error', headers: new Headers({}), json: async () => ({ error: { message, code: status } }), text: async () => JSON.stringify({ error: { message } }) };
}
function groqHttpError(status, message) {
  return { ok: false, status, headers: { get: () => null }, json: async () => ({ error: { message } }), text: async () => JSON.stringify({ error: { message } }) };
}
function groqOk(content) {
  return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }), text: async () => '' };
}

function resetHandlers() {
  events = [];
  // First call: Gemini fails 503, Groq fails 429 with retry hint
  geminiHandler = () => geminiHttpError(503, 'Service unavailable');
  // Groq returns rate limit error with Retry-After header
  groqHandler = (url, init) => {
    const response = groqHttpError(429, 'RATE_LIMITED');
    // Simulate Retry-After header in response
    response.headers = { get: (name) => (name.toLowerCase() === 'retry-after' ? '2' : null) };
    return response;
  };
}

resetHandlers();

test('first request triggers primary failure and fallback rate limit, both eligible for local fallback', async () => {
  const result = await analyzeMatch(RESUME, JOB);
  // Should fall back to deterministic rule-based because both eligible
  assert.equal(result.source, 'Rule-based fallback');
  // Verify that both providers were called once each
  const counts = { gemini: events.filter(e => e.provider === 'gemini').length, groq: events.filter(e => e.provider === 'groq').length };
  assert.equal(counts.gemini, 1);
  assert.equal(counts.groq, 1);
});

// Next request: primary still fails 503, fallback should be cooling down and not called
resetHandlers(); // reset handlers to same failures, but now cooldown for Groq should be set from previous call

test('second request uses fallback cooldown and skips Groq call', async () => {
  const result = await analyzeMatch(RESUME, JOB);
  assert.equal(result.source, 'Rule-based fallback');
  const counts = { gemini: events.filter(e => e.provider === 'gemini').length, groq: events.filter(e => e.provider === 'groq').length };
  // Gemini should be called again, Groq should NOT be called due to cooldown
  assert.equal(counts.gemini, 1);
  assert.equal(counts.groq, 0);
});
