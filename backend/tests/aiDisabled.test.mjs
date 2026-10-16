// Test AI disabled scenario: deterministic fallback without any provider calls
import test from 'node:test';
import assert from 'node:assert/strict';

// Set environment before importing modules
process.env.AI_PROVIDER = 'none';
// Ensure no API keys are set
delete process.env.GEMINI_API_KEY;
delete process.env.GROQ_API_KEY;

const { analyzeMatch } = await import('../llm.js');

const RESUME = 'Experienced software engineer with React and Node.js skills. Worked at ACME Corp.';
const JOB = 'Looking for a frontend engineer experienced in React and TypeScript.';

// No fetch should be called; we can stub global fetch to throw if called
globalThis.fetch = () => {
  throw new Error('fetch should not be called when AI is disabled');
};

test('analyzeMatch deterministic when AI disabled', async () => {
  const result = await analyzeMatch(RESUME, JOB);
  // Should have source from ruleBasedFallback
  assert.equal(result.source, 'Rule-based fallback');
  // Should have numeric atsScore from deterministic analysis
  assert.equal(typeof result.atsScore, 'number');
  // Ensure summary is present
  assert.ok(result.summary && result.summary.length > 0);
});
