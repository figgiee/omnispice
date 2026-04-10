/**
 * D1-backed single-use nonce store for LTI 1.3.
 *
 * Pitfall 3 (04-RESEARCH.md): In-memory Sets don't coordinate across
 * Workers isolates. D1 is the only authoritative store.
 *
 * The lti_nonces table also doubles as the OIDC state store via a
 * `state:${state}` key prefix — documented short-term shortcut until a
 * dedicated `lti_oidc_states` table lands in Phase 5.
 */

const NONCE_TTL_MS = 10 * 60 * 1000; // 10 minutes per 1EdTech guidance

/**
 * Reject the nonce if it has been seen before (replay), otherwise persist it
 * with a 10-minute TTL. Throws `Error('nonce replay')` on collision.
 */
export async function checkAndStoreNonce(
  db: D1Database,
  nonce: string,
  iss: string,
): Promise<void> {
  const existing = await db
    .prepare('SELECT nonce FROM lti_nonces WHERE nonce = ?')
    .bind(nonce)
    .first();

  if (existing) {
    throw new Error('nonce replay');
  }

  await db
    .prepare('INSERT INTO lti_nonces (nonce, iss, expires_at) VALUES (?, ?, ?)')
    .bind(nonce, iss, Date.now() + NONCE_TTL_MS)
    .run();
}

/**
 * Purge nonces whose expires_at is in the past.
 * Called from the scheduled (Cron) handler every 10 minutes.
 */
export async function purgeExpiredNonces(db: D1Database): Promise<number> {
  const result = await db
    .prepare('DELETE FROM lti_nonces WHERE expires_at < ?')
    .bind(Date.now())
    .run();
  return (result.meta?.changes as number | undefined) ?? 0;
}

/**
 * Persist an OIDC state+nonce pair for the third-party login dance.
 * Uses lti_nonces with a 'state:' key prefix as documented in 04-01.
 * TTL is shorter (5 minutes) because OIDC state should round-trip fast.
 */
export async function storeOidcState(
  db: D1Database,
  state: string,
  nonce: string,
  iss: string,
): Promise<void> {
  const expiresAt = Date.now() + 5 * 60 * 1000;
  await db
    .prepare('INSERT INTO lti_nonces (nonce, iss, expires_at) VALUES (?, ?, ?)')
    .bind(`state:${state}:${nonce}`, iss, expiresAt)
    .run();
}
