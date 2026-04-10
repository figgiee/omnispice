import { importPKCS8, exportJWK, type KeyLike, type JWK } from 'jose';
import type { Bindings } from '../index';

/**
 * Tool private key loader + public JWKS derivation.
 *
 * Per-isolate in-module cache keyed by the PEM string itself so key rotation
 * (a new wrangler secret put) invalidates the cache automatically.
 *
 * Anti-pattern reminder (Pitfall, 04-RESEARCH.md): never store private key
 * material in D1 or R2. Use `wrangler secret put LTI_PRIVATE_KEY`.
 */

const privateKeyCache = new Map<string, KeyLike>();
const jwksCache = new Map<string, { keys: JWK[] }>();

/**
 * Import the tool's PKCS8 private key from the Workers env.
 * Cached per-isolate keyed by the PEM string hash-of-content (the PEM itself).
 */
export async function getToolPrivateKey(env: Bindings): Promise<KeyLike> {
  const pem = normalisePem(env.LTI_PRIVATE_KEY);
  const cached = privateKeyCache.get(pem);
  if (cached) return cached;

  const key = (await importPKCS8(pem, 'RS256')) as KeyLike;
  privateKeyCache.set(pem, key);
  return key;
}

/**
 * Derive the public JWKS from the tool's private key.
 * Returns { keys: [ { kty, n, e, kid, use, alg } ] } for serving at
 * GET /lti/.well-known/jwks.json.
 */
export async function getToolPublicJwks(env: Bindings): Promise<{ keys: JWK[] }> {
  const pem = normalisePem(env.LTI_PRIVATE_KEY);
  const cacheKey = `${pem}::${env.LTI_PUBLIC_KID}`;
  const cached = jwksCache.get(cacheKey);
  if (cached) return cached;

  const privateKey = await getToolPrivateKey(env);
  const jwk = await exportJWK(privateKey);
  // exportJWK for a private key returns the private JWK — strip private fields
  // so we only publish the public parameters.
  const publicJwk: JWK = {
    kty: jwk.kty,
    n: jwk.n,
    e: jwk.e,
    kid: env.LTI_PUBLIC_KID,
    use: 'sig',
    alg: 'RS256',
  };

  const jwks = { keys: [publicJwk] };
  jwksCache.set(cacheKey, jwks);
  return jwks;
}

/**
 * `wrangler secret put` stores PEMs with literal `\n` escape sequences rather
 * than real newlines. `jose.importPKCS8` requires real newlines, so we unescape.
 */
function normalisePem(raw: string): string {
  if (!raw) return raw;
  if (raw.includes('\\n')) {
    return raw.replace(/\\n/g, '\n');
  }
  return raw;
}
