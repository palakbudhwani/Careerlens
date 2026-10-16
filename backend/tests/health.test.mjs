// The health endpoint is the frontend's "is the backend up yet?" probe, so it
// must answer instantly with zero Gemini/Groq traffic.
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

// Configured providers (dummy keys) so ai.enabled reflects a real setup.
process.env.AI_PROVIDER = 'gemini';
process.env.AI_FALLBACK_PROVIDER = 'groq';
process.env.GEMINI_API_KEY = 'AIza_dummy_health_test_key_not_real';
process.env.GROQ_API_KEY = 'gsk_dummy_health_test_key_not_real';

const realFetch = globalThis.fetch;
const providerCalls = [];
globalThis.fetch = async (url) => {
  providerCalls.push(String(url));
  throw new Error(`unexpected fetch during health check: ${url}`);
};

const { app } = await import('../server.js');

test('health endpoint answers on both routes without any AI provider call', async () => {
  const server = app.listen(0);
  await once(server, 'listening');
  const { port } = server.address();
  try {
    for (const path of ['/health', '/api/v1/health']) {
      const response = await realFetch(`http://127.0.0.1:${port}${path}`);
      assert.equal(response.status, 200, `${path} must answer 200`);

      const body = await response.json();
      assert.equal(body.status, 'ok');
      assert.equal(body.service, 'careerlens-backend');
      assert.equal(typeof body.timestamp, 'string');
      assert.equal(typeof body.uptimeSeconds, 'number');

      // Provider routing is reported from configuration only.
      assert.deepEqual(body.ai, { primary: 'gemini', fallback: 'groq', enabled: true });
    }

    assert.equal(providerCalls.length, 0, 'health checks must never call an AI provider');
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
});

test('the frontend default health URL matches this route', async () => {
  // Mirrors src/lib/api-config.ts: API_BASE_URL + '/health'.
  const frontendHealthPath = '/api/v1/health';
  const server = app.listen(0);
  await once(server, 'listening');
  const { port } = server.address();
  try {
    const response = await realFetch(`http://127.0.0.1:${port}${frontendHealthPath}`);
    assert.equal(response.status, 200);
    assert.equal(providerCalls.length, 0);
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
});
