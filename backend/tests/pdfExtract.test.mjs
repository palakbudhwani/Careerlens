// Extraction + deterministic-parsing coverage for UNSEEN resumes.
//
// Fixtures live in tests/fixtures/ (never in Resume/):
//   unseen-textual.pdf  – text-layer PDF with a different layout/author
//   scanned-resume.pdf  – image-only PDF (no text layer) -> OCR path
//   empty.pdf           – structurally valid, zero content
//   corrupt.pdf         – %PDF magic bytes + garbage
//   plus a unicode parseResume unit input covering en-dash dates, bullet
//   glyphs, fullwidth colon, non-breaking spaces, ligatures, an international
//   phone number, a "Professional Experience" section header, and MM/YYYY
//   date ranges.
//
// Providers are configured but every provider fetch throws, so any AI traffic
// fails the test. Resume contents are synthetic fixtures; assertions only
// check structure, known fixture tokens, counts, and booleans.
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Must be set before importing the modules under test. dotenv does not
// override pre-set variables, so these win over backend/.env.
process.env.AI_PROVIDER = 'gemini';
process.env.AI_FALLBACK_PROVIDER = 'groq';
process.env.GEMINI_API_KEY = 'AIza_dummy_primary_key_not_real';
process.env.GROQ_API_KEY = 'gsk_dummy_fallback_key_not_real';
delete process.env.GEMINI_MODEL;
delete process.env.GROQ_API_URL;

const realFetch = globalThis.fetch;
const providerCalls = [];
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (/generativelanguage\.googleapis\.com|api\.groq\.com|groq\.com/i.test(u)) {
    providerCalls.push(u);
    throw new Error('unexpected live AI call during extraction tests');
  }
  return realFetch(url, init);
};

const { extractResumeText, MIN_TEXT_WORDS } = await import('../pdfExtract.js');
const { parseResume } = await import('../llm.js');
const { app } = await import('../server.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, 'fixtures');
const fixture = (name) => readFileSync(path.join(FIXTURES, name));

const ERRORS = {
  corrupt: 'This file could not be read as a PDF. It may be damaged — please re-export or re-save your resume and try again.',
  no_text: 'No readable text could be found in this PDF, even after OCR. Please upload a clearer scan or a text-based (non-photographed) PDF.'
};

const wordCount = (text) => text.split(/\s+/).filter(Boolean).length;

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

async function upload(buffer, filename = 'resume.pdf') {
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: 'application/pdf' }), filename);
  const response = await realFetch(`${baseUrl}/api/v1/resume/parse`, { method: 'POST', body: form });
  const raw = await response.text();
  return { status: response.status, body: JSON.parse(raw) };
}

test('text-layer fixture extracts through the fast path without OCR', async () => {
  const result = await extractResumeText(fixture('unseen-textual.pdf'));
  assert.equal(result.error, null);
  assert.equal(result.method, 'text');
  assert.ok(wordCount(result.text) >= 100, 'the unseen resume must yield substantial text');
  assert.equal(MIN_TEXT_WORDS, 10, 'quality gate stays at the historical threshold');
});

test('scanned fixture falls back to OCR and yields readable text', async () => {
  const result = await extractResumeText(fixture('scanned-resume.pdf'));
  assert.equal(result.error, null);
  assert.equal(result.method, 'ocr');
  assert.ok(wordCount(result.text) >= 50, 'OCR must recover a usable amount of text');
  assert.ok(/ELENA/i.test(result.text), 'OCR must recover the fixture name');
  assert.ok(/Data Engineer/i.test(result.text), 'OCR must recover the fixture headline');
  assert.equal(providerCalls.length, 0, 'extraction must not contact any AI provider');
});

test('empty and corrupt fixtures fail fast with typed, user-facing errors', async () => {
  const empty = await extractResumeText(fixture('empty.pdf'));
  assert.equal(empty.method, 'none');
  assert.equal(empty.error?.code, 'no_text');
  assert.equal(empty.error?.message, ERRORS.no_text);

  const corrupt = await extractResumeText(fixture('corrupt.pdf'));
  assert.equal(corrupt.method, 'none');
  assert.equal(corrupt.error?.code, 'corrupt');
  assert.equal(corrupt.error?.message, ERRORS.corrupt);
});

test('the parse route serves the unseen textual resume end to end', async () => {
  const { status, body } = await upload(fixture('unseen-textual.pdf'));
  assert.equal(status, 200, JSON.stringify(body).slice(0, 300));
  assert.ok(wordCount(body.resumeText) >= 100);

  const details = body.parsedDetails;
  assert.equal(details.name, 'TOMAS BERG');
  assert.equal(details.email, 'tomas.berg@example.com');
  assert.ok(details.phone, 'the unseen resume must yield a phone number');
  assert.ok(details.workExperience.length >= 1, 'experience must be extracted');
  assert.ok(details.education.length >= 1, 'education must be extracted');
  assert.ok(details.workExperience[0].highlights.length >= 1, 'dated entries must carry highlights');
  assert.equal(details.isAuthentic, true);
  assert.deepEqual(details.validationErrors, []);
  assert.equal(providerCalls.length, 0, 'the parse route must make zero provider calls');
});

test('the parse route OCRs a scanned resume instead of hanging or rejecting it', async () => {
  const { status, body } = await upload(fixture('scanned-resume.pdf'));
  assert.equal(status, 200, JSON.stringify(body).slice(0, 300));
  assert.ok(wordCount(body.resumeText) >= 50);

  const details = body.parsedDetails;
  assert.equal(details.name, 'ELENA RUIZ');
  assert.equal(details.email, 'elena.ruiz@example.com');
  assert.ok(Array.isArray(details.workExperience) && details.workExperience.length >= 1,
    'OCR text must still parse into structured experience');
  assert.equal(details.isAuthentic, true);
  assert.equal(providerCalls.length, 0, 'the OCR route must make zero provider calls');
});

test('the parse route rejects unreadable uploads with the exact guidance message', async () => {
  const empty = await upload(fixture('empty.pdf'));
  assert.equal(empty.status, 422);
  assert.equal(empty.body.message, ERRORS.no_text);

  const corrupt = await upload(fixture('corrupt.pdf'));
  assert.equal(corrupt.status, 422);
  assert.equal(corrupt.body.message, ERRORS.corrupt);

  assert.equal(providerCalls.length, 0, 'rejections must make zero provider calls');
});

test('parseResume handles unicode-heavy unseen resumes deterministically', async () => {
  const text = [
    'MARÍA JOSÉ – Resumé Specialist',
    'Email: maria.jose@example.com',
    'Phone: +49 170 1234567',
    'Location: Berlin, Germany',
    'PROFESSIONAL SUMMARY',
    'Senior engineer with 8 years of experience building ﬁnancial dashboards.',
    'SKILLS',
    '• React',
    '• TypeScript',
    '• Node.js',
    'PROFESSIONAL EXPERIENCE',
    'Senior Engineer： Globex Inc.   03/2021 – Present',
    '• Shipped features used by thousands\u00a0of users daily.',
    '• Improved test coverage from 40% to 90%.',
    'EDUCATION',
    'B.Sc. Computer Science (2015) Technical University of Munich'
  ].join('\n');

  const details = await parseResume(text);

  assert.equal(details.name, 'MARÍA JOSÉ');
  assert.equal(details.email, 'maria.jose@example.com');
  assert.equal(details.phone, '+49 170 1234567');

  // "PROFESSIONAL EXPERIENCE" is a section header, and the en-dash
  // MM/YYYY range must parse into a live entry.
  assert.equal(details.workExperience.length, 1);
  const entry = details.workExperience[0];
  assert.ok(entry.role.startsWith('Senior Engineer'), `unexpected role: ${entry.role}`);
  assert.ok(!entry.role.includes('\uFF1A'), 'fullwidth colon must be normalized');
  assert.equal(entry.start, '03/2021');
  assert.equal(entry.end, 'Present');
  assert.equal(entry.highlights.length, 2, 'bullet glyphs must become separate highlights');
  for (const highlight of entry.highlights) {
    assert.ok(!/[\u2022\u00b7]/.test(highlight), 'no raw bullet glyphs may survive');
    assert.ok(!highlight.includes('\u00a0'), 'non-breaking spaces must be normalized');
  }

  // Ligature ﬁ must be expanded in the summary text.
  assert.ok(details.summary.includes('financial dashboards'), 'ligatures must be expanded');

  assert.equal(details.education.length, 1);
  assert.equal(details.education[0].year, '2015', 'the year-parens form must still resolve');
  assert.ok(details.skills.includes('React'), 'bulleted skills must be collected');

  assert.equal(details.isAuthentic, true);
  assert.deepEqual(details.validationErrors, []);
  assert.equal(providerCalls.length, 0, 'parseResume must never contact an AI provider');

  // Determinism: identical input, identical output.
  const again = await parseResume(text);
  assert.deepEqual(again, details);
});
