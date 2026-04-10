/**
 * Join code generator — 6-char uppercase alphanumeric, excluding ambiguous
 * characters 0/O, 1/I/L per D-08. Uses crypto.getRandomValues (Workers runtime native).
 * Alphabet entropy: 31^6 ≈ 887M codes. Collision probability negligible below ~10k courses.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 31 chars — no 0/O/1/I/L
const CODE_LENGTH = 6;

/** Generate a single 6-char join code. */
export function generateJoinCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    // Modulo bias ≤ 0.4% — acceptable for non-crypto join codes.
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

/** Generate a join code guaranteed unique in the courses table. Retries up to maxAttempts. */
export async function generateUniqueJoinCode(
  db: D1Database,
  maxAttempts = 5
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateJoinCode();
    const existing = await db
      .prepare('SELECT 1 FROM courses WHERE join_code = ?')
      .bind(code)
      .first();
    if (!existing) return code;
  }
  throw new Error('Failed to generate unique join code after 5 attempts');
}
