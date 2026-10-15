import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, generateKeyPairSync, sign } from 'node:crypto';
import { handler } from './authorizer.mjs';
process.env.NEXO_JWT_SECRET = 'test-only-32-byte-secret-never-use-in-cloud';
process.env.AZURE_API_CLIENT_ID = 'test-api';
const testTenant = '21a4bbb2-fc48-4053-a98e-b805aa2306cc';
const encode = (object) => Buffer.from(JSON.stringify(object)).toString('base64url');
const localClaims = () => ({ iss: 'nexo-local', aud: 'nexo-api', exp: Math.floor(Date.now() / 1000) + 300, roles: ['USER'] });
function local(claims, algorithm = 'HS256') {
  const data = `${encode({ alg: algorithm })}.${encode(claims)}`;
  return `${data}.${createHmac('sha256', process.env.NEXO_JWT_SECRET).update(data).digest('base64url')}`;
}
const check = (token) => handler({ headers: { authorization: `Bearer ${token}` } });
test('local JWT accepts a valid signature and rejects expiration, audience, algorithm and tampering', async () => {
  assert.equal((await check(local(localClaims()))).isAuthorized, true);
  assert.equal((await check(local({ ...localClaims(), exp: 1 }))).isAuthorized, false);
  assert.equal((await check(local({ ...localClaims(), aud: 'another-api' }))).isAuthorized, false);
  assert.equal((await check(local(localClaims(), 'none'))).isAuthorized, false);
  assert.equal((await check(local(localClaims()) + 'wrong')).isAuthorized, false);
  assert.equal((await handler({ headers: {} })).isAuthorized, false);
});
test('Entra JWT verifies RSA signature, configured issuer, audience and delegated scope', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const key = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key' };
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ keys: [key] }) });
  const entra = (extra = {}) => {
    const claims = { iss: `https://login.microsoftonline.com/${testTenant}/v2.0`, tid: testTenant, aud: 'test-api',
      exp: Math.floor(Date.now() / 1000) + 300, scp: 'access_as_user', ...extra };
    const input = `${encode({ alg: 'RS256', kid: 'test-key' })}.${encode(claims)}`;
    return `${input}.${sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url')}`;
  };
  try {
    assert.equal((await check(entra())).isAuthorized, true);
    assert.equal((await check(entra({ iss: 'https://evil.example' }))).isAuthorized, false);
    assert.equal((await check(entra({ tid: 'other-tenant' }))).isAuthorized, false);
    assert.equal((await check(entra({ scp: 'profile' }))).isAuthorized, false);
    assert.equal((await check(entra({ aud: 'other-app' }))).isAuthorized, false);
    assert.equal((await check(entra() + 'tampered')).isAuthorized, false);
  } finally { globalThis.fetch = original; }
});
