import { createHmac, createPublicKey, timingSafeEqual, verify } from 'node:crypto';

let keyCache = { until: 0, keys: [] };
const decode = (value) => JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));

// A Lambda request authorizer preserves both Nexo local accounts and Entra authentication.
export async function handler(event) {
  try {
    const authorization = event.headers?.authorization ?? event.headers?.Authorization ?? '';
    if (!authorization.startsWith('Bearer ') || authorization.length > 18000) return { isAuthorized: false };
    const parts = authorization.slice(7).split('.');
    if (parts.length !== 3 || parts.some((part) => !part)) return { isAuthorized: false };
    const header = decode(parts[0]);
    const claims = decode(parts[1]);
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isFinite(claims.exp) || claims.exp <= now || (claims.nbf != null && (!Number.isFinite(claims.nbf) || claims.nbf > now + 30)))
      return { isAuthorized: false };
    const input = Buffer.from(`${parts[0]}.${parts[1]}`);
    const signature = Buffer.from(parts[2], 'base64url');
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (claims.iss === 'nexo-local') {
      if (header.alg !== 'HS256' || !audiences.includes('nexo-api')) return { isAuthorized: false };
      const secret = process.env.NEXO_JWT_SECRET ?? '';
      if (Buffer.byteLength(secret) < 32) return { isAuthorized: false };
      const expected = createHmac('sha256', secret).update(input).digest();
      if (expected.length !== signature.length || !timingSafeEqual(expected, signature)) return { isAuthorized: false };
      if (!Array.isArray(claims.roles) || !claims.roles.includes('USER')) return { isAuthorized: false };
    } else {
      const tenant = typeof claims.tid === 'string' ? claims.tid.toLowerCase() : '';
      const validTenantId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(tenant);
      const issuers = [`https://login.microsoftonline.com/${tenant}/v2.0`, `https://sts.windows.net/${tenant}/`];
      const api = process.env.AZURE_API_CLIENT_ID;
      if (!validTenantId || !api || header.alg !== 'RS256' || !issuers.includes(claims.iss)
          || !audiences.some((aud) => aud === api || aud === `api://${api}`)) return { isAuthorized: false };
      if (keyCache.until < Date.now() || !keyCache.keys.some((key) => key.kid === header.kid)) {
        const response = await fetch('https://login.microsoftonline.com/common/discovery/v2.0/keys',
          { signal: AbortSignal.timeout(5000) });
        if (!response.ok) return { isAuthorized: false };
        const data = await response.json();
        keyCache = { until: Date.now() + 600000, keys: Array.isArray(data.keys) ? data.keys : [] };
      }
      const key = keyCache.keys.find((candidate) => candidate.kid === header.kid && candidate.kty === 'RSA');
      if (!key || !verify('RSA-SHA256', input, createPublicKey({ key, format: 'jwk' }), signature)) return { isAuthorized: false };
      if (typeof claims.scp !== 'string' || !claims.scp.split(' ').includes('access_as_user')) return { isAuthorized: false };
    }
    return { isAuthorized: true, context: { provider: claims.iss === 'nexo-local' ? 'local' : 'entra' } };
  } catch {
    // Reject malformed tokens without logging credentials or claims.
    return { isAuthorized: false };
  }
}
