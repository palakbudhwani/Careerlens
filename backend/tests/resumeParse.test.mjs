// Offline test for the ACTUAL resume-parsing path:
//   POST /api/v1/resume/parse
//     -> multer memory storage
//     -> pdf text extraction (pdf-parse, with the corrupted-PDF fallback)
//     -> parseResume() (deterministic rule-based extraction)
//
// Groq is the configured provider and the stubbed provider rate-limits every
// request — the upload path must still succeed with zero provider fetches.
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

// Must be set before importing the modules under test. dotenv does not
// override pre-set variables, so these win over backend/.env.
// Both provider keys are configured; the primary (Groq) equals the fallback
// target so the chain is single-provider, and every provider call is stubbed.
process.env.AI_PROVIDER = 'groq';
process.env.AI_FALLBACK_PROVIDER = 'groq';
process.env.GROQ_API_KEY = 'gsk_unit_test_dummy_key_not_real';
process.env.GEMINI_API_KEY = 'AIza_dummy_unit_test_key_not_real';
delete process.env.GROQ_API_URL;

// Keep the real fetch for the local HTTP request; stub every provider call.
const realFetch = globalThis.fetch;
const providerCalls = [];
globalThis.fetch = async (url, init) => {
  providerCalls.push({ url: String(url), init });
  return {
    ok: false,
    status: 429,
    headers: { get: (name) => (String(name).toLowerCase() === 'retry-after' ? '45' : null) },
    json: async () => ({ error: { message: 'Rate limit reached for model openai/gpt-oss-120b with tokens per min limit of 8192' } }),
    text: async () => JSON.stringify({ error: { message: 'Rate limit reached for model openai/gpt-oss-120b with tokens per min limit of 8192' } })
  };
};

const { getAiProvider, isAiEnabled } = await import('../aiProvider.js');
const { analyzeMatch, parseResume } = await import('../llm.js');
const { app } = await import('../server.js');

const RESUME = 'Experienced software engineer skilled in React TypeScript Node.js building web applications with REST APIs and automated tests at ACME Corp.';
const JOB = 'Looking for a frontend engineer with React TypeScript experience to build accessible user interfaces and collaborate with product designers and product managers.';

// A minimal but structurally valid single-page PDF. Offsets are computed while
// building so the xref table matches the actual byte positions.
function buildPdf(lines) {
  const content = lines
    .map((line, index) => `BT /F1 12 Tf 50 ${740 - index * 16} Td (${line}) Tj ET`)
    .join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content, 'binary')} >>\nstream\n${content}\nendstream`
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, 'binary'));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = Buffer.byteLength(pdf, 'binary');
  // pdf.js requires CR-LF endings on xref entries.
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f\r\n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n\r\n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(pdf, 'binary');
}

const PDF_LINES = [
  'Jordan Peterson - Software Engineer',
  'Email: jordan.peterson@example.com',
  'Phone: 555-123-4567',
  'SUMMARY',
  'Experienced software engineer building web applications with automated tests.',
  'SKILLS',
  '- React, TypeScript, Node.js, REST APIs, Git',
  'EXPERIENCE',
  'Senior Developer at Acme Corp 2019 - 2023',
  '- Built customer-facing dashboards used by thousands of users daily.',
  'EDUCATION',
  'Bachelor of Science in Computer Science 2015'
];

test('resume parsing path makes zero provider fetches with Groq configured and rate-limited', async () => {
  // Groq IS the configured provider and AI is enabled…
  assert.equal(getAiProvider(), 'groq');
  assert.equal(isAiEnabled(), true);

  // …and the stubbed provider rate-limits. Prove the stub is live through a
  // different llm entry point first, so "zero calls" below is meaningful.
  await assert.rejects(
    () => analyzeMatch(RESUME, JOB),
    (err) => err.statusCode === 429 && err.code === 'AI_RATE_LIMITED'
  );
  assert.equal(providerCalls.length, 1, 'the rate-limit stub must be reachable through the provider');

  const server = app.listen(0);
  await once(server, 'listening');
  try {
    const { port } = server.address();

    // 1. The actual upload route: multipart PDF -> text extraction -> parsing.
    const form = new FormData();
    form.append('file', new Blob([buildPdf(PDF_LINES)], { type: 'application/pdf' }), 'resume.pdf');
    const response = await realFetch(`http://127.0.0.1:${port}/api/v1/resume/parse`, {
      method: 'POST',
      body: form
    });
    const raw = await response.text();
    assert.equal(response.status, 200, `unexpected status: ${raw}`);
    const body = JSON.parse(raw);

    // 2. Extraction worked and the response keeps its schema.
    assert.ok(body.resumeText.includes('Jordan Peterson'), 'PDF text must be extracted');
    assert.ok(body.resumeText.split(/\s+/).length >= 10);
    const details = body.parsedDetails;
    assert.equal(typeof details.name, 'string');
    assert.equal(typeof details.email, 'string');
    assert.ok(Array.isArray(details.skills));
    assert.ok(Array.isArray(details.workExperience));
    assert.ok(Array.isArray(details.education));
    assert.equal(typeof details.isAuthentic, 'boolean');
    assert.ok(Array.isArray(details.validationErrors));

    // 3. Every detail comes from the PDF itself — nothing invented.
    assert.equal(details.email, 'jordan.peterson@example.com');
    assert.equal(details.isAuthentic, true);
    assert.deepEqual(details.validationErrors, []);
    assert.ok(details.workExperience.some((entry) => entry.company.includes('Acme')));

    // 4. Zero provider traffic for the whole route (no Groq/Gemini fetch).
    assert.equal(providerCalls.length, 1, 'the resume-parse route must not call the AI provider');

    // 5. Direct parse calls (sequential and concurrent) stay offline too.
    const text =
      'Direct Parse Resume\ncontact: direct.parse@example.com\nSKILLS\n- react, typescript\n' +
      'EXPERIENCE\nEngineer at Globex 2020 - 2024\nShipped features and improved test coverage continuously.\n';
    const first = await parseResume(text);
    const second = await parseResume(text);
    const [p1, p2] = await Promise.all([parseResume(text), parseResume(text)]);
    assert.equal(providerCalls.length, 1, 'parseResume must never call the AI provider');
    assert.equal(first.email, 'direct.parse@example.com');
    assert.deepEqual(first, second);
    assert.deepEqual(p1, p2);
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
});
