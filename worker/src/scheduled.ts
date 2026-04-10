/**
 * Cron-triggered scheduled handler.
 *
 * Declared in `worker/wrangler.toml` as `[triggers] crons = ["*\/10 * * * *"]`.
 * Runs every 10 minutes. Responsibilities:
 *
 *   1. Drain `lti_score_log` — re-issue any pending AGS score posts that
 *      need retrying. Exponential backoff lives in `./lti/scoreRetry.ts`.
 *   2. Purge expired nonces — delete rows from `lti_nonces` whose
 *      `expires_at` has passed so the table doesn't grow unbounded.
 *
 * Both tasks are wrapped in `ctx.waitUntil` so the runtime keeps the
 * isolate alive until they finish, but a failure in one task does not
 * block the other.
 */

import { drainScoreRetryQueue, type ScoreRetryRow } from './lti/scoreRetry';
import { postScore, getPlatformTokenFromD1 } from './lti/ags';
import { purgeExpiredNonces } from './lti/nonce';
import type { Bindings } from './index';

/**
 * Workers `scheduled` export. The Workers runtime invokes this with the
 * Cron event, the env bindings, and the execution context. We fan out to
 * the drain + nonce purge in parallel.
 */
export async function scheduled(
  _event: ScheduledController,
  env: Bindings,
  ctx: ExecutionContext,
): Promise<void> {
  ctx.waitUntil(runScoreDrain(env));
  ctx.waitUntil(runNoncePurge(env));
}

async function runScoreDrain(env: Bindings): Promise<void> {
  try {
    const summary = await drainScoreRetryQueue(env, {
      postScore: (row: ScoreRetryRow) =>
        postScore({
          lineItemUrl: row.lineitem_url,
          userId: row.user_sub,
          scoreGiven: row.score_given,
          scoreMaximum: row.score_maximum,
          activityProgress: 'Completed',
          gradingProgress: 'FullyGraded',
          timestamp: new Date().toISOString(),
          iss: row.iss,
          clientId: row.client_id,
          fetch: globalThis.fetch,
          getPlatformToken: async () => {
            // Look up the platform token endpoint from lti_platforms so we
            // know where to mint the client_credentials bearer against.
            const platform = await env.DB.prepare(
              `SELECT auth_token_url FROM lti_platforms WHERE iss = ? AND client_id = ?`,
            )
              .bind(row.iss, row.client_id)
              .first<{ auth_token_url: string }>();
            if (!platform?.auth_token_url) {
              throw new Error(
                `Platform auth_token_url missing for ${row.iss}/${row.client_id}`,
              );
            }
            return getPlatformTokenFromD1({
              db: env.DB,
              iss: row.iss,
              clientId: row.client_id,
              scope:
                'https://purl.imsglobal.org/spec/lti-ags/scope/score',
              tokenUrl: platform.auth_token_url,
              toolPrivateKey: env.LTI_PRIVATE_KEY,
              toolKid: env.LTI_PUBLIC_KID,
              fetch: globalThis.fetch,
            });
          },
        }),
    });
    console.log(
      `[cron/score-drain] drained=${summary.drained} ok=${summary.ok} pending=${summary.pending} failed=${summary.failed}`,
    );
  } catch (err) {
    console.error('[cron/score-drain] fatal:', err);
  }
}

async function runNoncePurge(env: Bindings): Promise<void> {
  try {
    const purged = await purgeExpiredNonces(env.DB);
    console.log(`[cron/nonce-purge] purged=${purged}`);
  } catch (err) {
    console.error('[cron/nonce-purge] fatal:', err);
  }
}
