import { SignJWT, importPKCS8 } from 'jose';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const privatePem = readFileSync(
  resolve(__dirname, '../fixtures/lti/mock-platform-private.pem'),
  'utf8',
);

/**
 * Sign an unsigned LTI claim fixture with the mock platform's private key.
 *
 * Used by verify.test.ts, oidc.test.ts, deepLink.test.ts, ags.test.ts —
 * anywhere we need a real JWT that `jose.jwtVerify` can validate against
 * `worker/tests/fixtures/lti/jwks.json`.
 *
 * The fixture JSON files are intentionally unsigned (pure claims). We sign
 * them at test time so that `exp` can be refreshed and the signature
 * matches the key material under test.
 */
export async function signFixtureIdToken(
  claims: Record<string, unknown>,
  overrides: Partial<{ exp: number; iat: number; nonce: string; kid: string; alg: string }> = {},
): Promise<string> {
  const pk = await importPKCS8(privatePem, overrides.alg ?? 'RS256');
  const now = Math.floor(Date.now() / 1000);
  const payload: Record<string, unknown> = {
    ...claims,
    iat: overrides.iat ?? now,
    exp: overrides.exp ?? now + 600,
    nonce: overrides.nonce ?? String(claims.nonce ?? crypto.randomUUID()),
  };
  return await new SignJWT(payload)
    .setProtectedHeader({
      alg: overrides.alg ?? 'RS256',
      kid: overrides.kid ?? 'mock-platform-2026',
      typ: 'JWT',
    })
    .sign(pk);
}

/**
 * Sign an LTI claim set using an ALTERNATE RSA key (not the mock platform key).
 * Used to exercise the "signature mismatch" assertion in verify.test.ts.
 */
export async function signWithWrongKey(
  claims: Record<string, unknown>,
): Promise<string> {
  // Generate an ephemeral key so the signature cannot possibly verify.
  const { generateKeyPair, exportPKCS8 } = await import('jose');
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const pem = await exportPKCS8(privateKey);
  const pk = await importPKCS8(pem, 'RS256');
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({ ...claims, iat: now, exp: now + 600 })
    .setProtectedHeader({ alg: 'RS256', kid: 'mock-platform-2026', typ: 'JWT' })
    .sign(pk);
}
