import { jwtVerify, importJWK, type JWK, type KeyLike } from 'jose';
import { LtiLaunchClaimsSchema, type LtiLaunchPayload } from './claims';

/**
 * LTI 1.3 id_token verification with dependency injection.
 *
 * The test suite (worker/tests/lti/verify.test.ts) exercises this function
 * directly with stub lookups rather than going through D1 / real network.
 * The route handler in worker/src/routes/lti.ts wires the real implementations
 * of platformLookup / fetchJwks / nonceStore.
 *
 * Implements Pattern 2 from 04-RESEARCH.md but extracts the I/O as injected
 * collaborators so unit tests can be hermetic.
 */

export interface PlatformRow {
  iss: string;
  client_id: string;
  jwks_uri: string;
  auth_token_url?: string;
}

export interface NonceStore {
  /** Return true if this (iss, nonce) has been observed before (replay). */
  seen(nonce: string, iss: string): Promise<boolean>;
  /** Persist the nonce with its TTL so the next seen() returns true. */
  mark(nonce: string, iss: string): Promise<void>;
}

export interface VerifyLaunchOptions {
  /**
   * Look up the platform row for a given `(iss, client_id)` tuple.
   * Return null if the platform is not registered.
   */
  platformLookup: (iss: string, clientId: string) => Promise<PlatformRow | null>;
  /**
   * Fetch the platform's JWKS document. Tests provide a fixture; the real
   * handler uses the platform's jwks_uri via `fetch`.
   */
  fetchJwks: (jwksUri: string) => Promise<{ keys: JWK[] }>;
  /**
   * Single-use nonce guard.
   */
  nonceStore: NonceStore;
}

/**
 * Verify an LTI 1.3 launch id_token.
 *
 * Pipeline:
 *  1. Peek at `iss` + `aud` without verifying (base64url decode payload)
 *  2. Look up the registered platform by `(iss, client_id=aud)`
 *  3. Fetch the platform JWKS, pick the key matching the JWT's `kid`
 *  4. `jwtVerify` with issuer + audience constraints
 *  5. Zod-parse the claim payload
 *  6. Reject if nonce has already been seen, otherwise mark it
 */
export async function verifyLaunch(
  idToken: string,
  options: VerifyLaunchOptions,
): Promise<LtiLaunchPayload> {
  // 1. Peek
  const peek = decodeJwtPayload(idToken);
  const peekIss = typeof peek.iss === 'string' ? peek.iss : '';
  const peekAud = pickAud(peek.aud);
  if (!peekIss || !peekAud) {
    throw new Error('Invalid id_token: missing iss or aud');
  }

  // 2. Platform lookup
  const platform = await options.platformLookup(peekIss, peekAud);
  if (!platform) {
    throw new Error(`Unknown platform (unregistered iss/client_id): ${peekIss}`);
  }

  // 3. JWKS fetch + key selection
  const jwks = await options.fetchJwks(platform.jwks_uri);
  if (!jwks.keys || jwks.keys.length === 0) {
    throw new Error('Platform JWKS is empty');
  }

  const header = decodeJwtHeader(idToken);
  const kid = typeof header.kid === 'string' ? header.kid : undefined;
  const jwk =
    (kid ? jwks.keys.find((k) => k.kid === kid) : undefined) ?? jwks.keys[0];
  if (!jwk) {
    throw new Error('Signature verification failed: no matching JWK kid');
  }

  const publicKey = (await importJWK(jwk, jwk.alg ?? 'RS256')) as KeyLike;

  // 4. jose verification — signature, exp, iss, aud
  let payload: Record<string, unknown>;
  try {
    const result = await jwtVerify(idToken, publicKey, {
      issuer: platform.iss,
      audience: platform.client_id,
    });
    payload = result.payload as Record<string, unknown>;
  } catch (err) {
    // jose throws discriminated error classes; normalise messages so tests
    // can match on /exp|expired|aud|audience|signature|verify/i.
    const msg = (err as Error).message || String(err);
    if (/exp|expir/i.test(msg)) throw new Error(`id_token expired: ${msg}`);
    if (/aud/i.test(msg)) throw new Error(`audience mismatch: ${msg}`);
    if (/iss/i.test(msg)) throw new Error(`issuer mismatch: ${msg}`);
    throw new Error(`signature verification failed: ${msg}`);
  }

  // 5. Typed claim validation
  const parsed = LtiLaunchClaimsSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(
      `LTI claim validation failed: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
    );
  }
  const claims = parsed.data;

  // 6. Single-use nonce check
  const replayed = await options.nonceStore.seen(claims.nonce, claims.iss);
  if (replayed) {
    throw new Error(`nonce replay detected: ${claims.nonce}`);
  }
  await options.nonceStore.mark(claims.nonce, claims.iss);

  return claims;
}

/**
 * Build a NonceStore backed by the D1 lti_nonces table.
 */
export function d1NonceStore(db: D1Database): NonceStore {
  return {
    async seen(nonce: string): Promise<boolean> {
      const row = await db
        .prepare('SELECT nonce FROM lti_nonces WHERE nonce = ?')
        .bind(nonce)
        .first();
      return row !== null;
    },
    async mark(nonce: string, iss: string): Promise<void> {
      await db
        .prepare('INSERT INTO lti_nonces (nonce, iss, expires_at) VALUES (?, ?, ?)')
        .bind(nonce, iss, Date.now() + 10 * 60 * 1000)
        .run();
    },
  };
}

/**
 * Fetch JWKS from a remote URL — used by the live handler.
 * Tests inject their own fetchJwks so this is only exercised in production.
 */
export async function fetchRemoteJwks(jwksUri: string): Promise<{ keys: JWK[] }> {
  const res = await fetch(jwksUri, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`Failed to fetch JWKS from ${jwksUri}: ${res.status}`);
  }
  return (await res.json()) as { keys: JWK[] };
}

// ---------- helpers ----------

function base64UrlDecode(input: string): string {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  // atob is available in Workers + Node 18+
  return atob(b64 + pad);
}

function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const parts = jwt.split('.');
  if (parts.length < 2) throw new Error('Invalid JWT: missing payload');
  try {
    return JSON.parse(base64UrlDecode(parts[1] ?? ''));
  } catch {
    throw new Error('Invalid JWT: payload is not valid JSON');
  }
}

function decodeJwtHeader(jwt: string): Record<string, unknown> {
  const parts = jwt.split('.');
  if (parts.length < 1) throw new Error('Invalid JWT: missing header');
  try {
    return JSON.parse(base64UrlDecode(parts[0] ?? ''));
  } catch {
    throw new Error('Invalid JWT: header is not valid JSON');
  }
}

function pickAud(aud: unknown): string {
  if (typeof aud === 'string') return aud;
  if (Array.isArray(aud) && typeof aud[0] === 'string') return aud[0];
  return '';
}
