/**
 * LTI score passback retry drain.
 *
 * Driven by the Cron trigger declared in `worker/wrangler.toml`
 * (`crons = ["*\/10 * * * *"]`). Selects up to N pending rows from
 * `lti_score_log`, attempts to POST each one to the LMS AGS endpoint,
 * and updates the row's status/attempts/next_attempt_at based on the
 * outcome.
 *
 * Exponential backoff schedule (in seconds):
 *   attempt 1 failure → retry in  60 s   (1 minute)
 *   attempt 2 failure → retry in 300 s   (5 minutes)
 *   attempt 3 failure → retry in 900 s   (15 minutes)
 *   attempt 4 failure → retry in 3600 s  (1 hour)
 *   attempt 5 failure → retry in 21600 s (6 hours)
 *   attempt 6 failure → status='failed' (human intervention required)
 *
 * Note: the delays are stored in SECONDS in this constant but multiplied
 * by 1000 when scheduling because the DB column uses `Date.now()` epoch
 * milliseconds. A row can live through at most 5 retries before being
 * marked `failed`.
 */

const BACKOFF_S = [60, 300, 900, 3600, 21600] as const;
const MAX_ATTEMPTS = 5;
const DRAIN_BATCH_SIZE = 50;

export interface ScoreRetryRow {
  id: string;
  submission_id: string;
  lineitem_url: string;
  iss: string;
  client_id: string;
  user_sub: string;
  score_given: number;
  score_maximum: number;
  status: string;
  attempts: number;
  next_attempt_at: number;
}

/**
 * PostScore function signature the drain calls for each pending row.
 * Tests pass a vi.fn() that either resolves or rejects; production passes
 * a wrapper that calls `postScore` from `./ags` with the tool private key.
 */
export type PostScoreFn = (row: ScoreRetryRow) => Promise<void>;

export interface DrainOptions {
  postScore: PostScoreFn;
  /** Override Date.now() — used by tests so timing is deterministic. */
  now?: number;
}

/**
 * Drain pending rows from `lti_score_log` in a single batch.
 *
 * The `env` arg only needs to expose `DB` so tests can hand in the
 * in-memory D1 fixture without building a full Bindings object.
 */
export async function drainScoreRetryQueue(
  env: { DB: D1Database },
  opts: DrainOptions,
): Promise<{ drained: number; ok: number; failed: number; pending: number }> {
  const now = opts.now ?? Date.now();

  const { results } = await env.DB.prepare(
    `SELECT id, submission_id, lineitem_url, iss, client_id, user_sub,
            score_given, score_maximum, status, attempts, next_attempt_at
     FROM lti_score_log
     WHERE status = 'pending' AND next_attempt_at <= ?
     LIMIT ?`,
  )
    .bind(now, DRAIN_BATCH_SIZE)
    .all<ScoreRetryRow>();

  const rows = results ?? [];

  let ok = 0;
  let failed = 0;
  let pending = 0;

  for (const row of rows) {
    try {
      await opts.postScore(row);
      await env.DB.prepare(
        `UPDATE lti_score_log SET status = 'ok', updated_at = ? WHERE id = ?`,
      )
        .bind(now, row.id)
        .run();
      ok += 1;
    } catch (err) {
      const nextAttempts = (row.attempts ?? 0) + 1;
      const exhausted = nextAttempts >= MAX_ATTEMPTS;
      const backoffSeconds =
        BACKOFF_S[Math.min(nextAttempts - 1, BACKOFF_S.length - 1)] ??
        BACKOFF_S[BACKOFF_S.length - 1] ??
        60;
      const nextAttemptAt = now + backoffSeconds * 1000;
      const nextStatus = exhausted ? 'failed' : 'pending';
      const lastError = String((err as Error)?.message ?? err).slice(0, 500);

      await env.DB.prepare(
        `UPDATE lti_score_log SET status = ?, attempts = ?, next_attempt_at = ?, last_error = ?, updated_at = ? WHERE id = ?`,
      )
        .bind(nextStatus, nextAttempts, nextAttemptAt, lastError, now, row.id)
        .run();

      if (exhausted) failed += 1;
      else pending += 1;
    }
  }

  return { drained: rows.length, ok, failed, pending };
}
