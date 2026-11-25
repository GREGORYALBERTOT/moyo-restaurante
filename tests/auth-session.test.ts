import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthClient } from '@neon/auth';
import { BetterAuthVanillaAdapter } from '@neon/auth/vanilla/adapters';

// These fixtures exist only in memory. Every Auth request is intercepted; no
// users, verification emails, real sessions or database access are created.
const authUrl = 'https://offline-auth.example.invalid/moyo/auth';

test('Neon SDK returns the header JWT as the session bearer token without a /token request', async t => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);
  const payload = Buffer.from(JSON.stringify({
    sub: 'offline-user',
    exp: Math.floor(expiresAt.getTime() / 1000),
  })).toString('base64url');
  const headerJwt = `offline-header.${payload}.offline-signature`;
  const requests: Array<{ url: string; method: string; credentials?: RequestCredentials }> = [];

  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url === `${authUrl}/sign-out`) return Response.json({ success: true });
    requests.push({ url, method: init?.method || 'GET', credentials: init?.credentials });
    assert.equal(url, `${authUrl}/get-session`, 'Bearer retrieval must use the Managed Auth session endpoint.');
    return Response.json({
      session: {
        id: 'offline-session',
        userId: 'offline-user',
        token: 'opaque-cookie-session-token',
        expiresAt: expiresAt.toISOString(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
      user: {
        id: 'offline-user',
        name: 'Offline fixture',
        email: 'fixture@example.invalid',
        emailVerified: true,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    }, { headers: { 'set-auth-jwt': headerJwt } });
  });

  const client = createAuthClient(authUrl, {
    adapter: BetterAuthVanillaAdapter({ fetchOptions: { credentials: 'include' } }),
  });

  try {
    const result = await client.getSession();
    assert.equal(result.error, null);
    assert.equal(result.data?.user.emailVerified, true);
    assert.equal(result.data?.session.token, headerJwt, 'The SDK must replace the opaque session token with the JWT from set-auth-jwt.');
    assert.notEqual(result.data?.session.token, 'opaque-cookie-session-token');
    assert.deepEqual(requests, [{ url: `${authUrl}/get-session`, method: 'GET', credentials: 'include' }]);
  } finally {
    // The SDK session cache is shared within this process. Clear it while the
    // offline fetch mock is still installed so another test cannot reuse it.
    await client.signOut();
  }
});

test('Neon SDK exposes no identity or bearer token when the session is absent', async t => {
  const requests: string[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    const url = String(input);
    if (url === `${authUrl}/sign-out`) return Response.json({ success: true });
    requests.push(url);
    assert.equal(url, `${authUrl}/get-session`);
    return Response.json(null);
  });
  const client = createAuthClient(authUrl, {
    adapter: BetterAuthVanillaAdapter({ fetchOptions: { credentials: 'include' } }),
  });
  try {
    const result = await client.getSession();
    assert.equal(result.error, null);
    assert.equal(result.data, null);
    assert.deepEqual(requests, [`${authUrl}/get-session`]);
  } finally {
    await client.signOut();
  }
});
