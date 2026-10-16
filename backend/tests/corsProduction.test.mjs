// Production CORS is allow-list only: no localhost escape hatch, no wildcard.
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

process.env.NODE_ENV = 'production';
process.env.CORS_ORIGINS = 'https://app.example.com';

const { app } = await import('../server.js');

let server;
let baseUrl;

test.before(async () => {
  server = app.listen(0);
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => {
  server?.closeAllConnections?.();
  server?.close();
});

async function getWithOrigin(origin) {
  const headers = origin ? { Origin: origin } : {};
  const response = await fetch(`${baseUrl}/health`, { headers });
  const raw = await response.text();
  return { status: response.status, raw, header: response.headers.get('access-control-allow-origin') };
}

test('production allows the configured origin plus the documented local origins', async () => {
  for (const origin of ['https://app.example.com', 'http://localhost:5173']) {
    const result = await getWithOrigin(origin);
    assert.equal(result.status, 200, `${origin} must be allowed`);
    assert.equal(result.header, origin);
  }
});

test('production rejects every other origin, including other localhost ports', async () => {
  for (const origin of [
    'https://evil.example.com',
    'http://localhost:9999',
    'http://127.0.0.1:5174',
    'https://app.example.com.evil.net'
  ]) {
    const result = await getWithOrigin(origin);
    assert.equal(result.status, 400, `${origin} must be rejected`);
    assert.equal(result.header, null);
  }
});
