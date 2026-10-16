// CORS must stay closed to the world while still working for local development:
// any localhost port is accepted outside production (a shifted Vite port can
// never break the app), everything else is rejected.
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

process.env.NODE_ENV = 'development';
delete process.env.CORS_ORIGINS;

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

test('development accepts the standard Vite origins and any other localhost port', async () => {
  for (const origin of [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://localhost:5174',
    'http://127.0.0.1:4312'
  ]) {
    const result = await getWithOrigin(origin);
    assert.equal(result.status, 200, `${origin} must be allowed`);
    assert.equal(result.header, origin, `${origin} must be echoed in ACAO`);
  }
});

test('development still blocks non-localhost origins', async () => {
  for (const origin of ['https://evil.example.com', 'http://192.168.1.20:5173', 'null']) {
    const result = await getWithOrigin(origin);
    assert.equal(result.status, 400, `${origin} must be rejected`);
    assert.match(result.raw, /CORS/i, `${origin} rejection must say CORS`);
    assert.equal(result.header, null);
  }
});

test('requests without an Origin header (curl, server-to-server) still work', async () => {
  const result = await getWithOrigin(undefined);
  assert.equal(result.status, 200);
});
