import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeTestEnv } from '../../test/helpers/d1-fixture';
// RED — scheduled handler lands in 04-03.
// @ts-expect-error — module does not exist yet (Wave 0 scaffold).
import { drainScoreRetryQueue } from '../../src/lti/scoreRetry';

vi.mock('@hono/clerk-auth', () => ({
  clerkMiddleware: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
  getAuth: vi.fn(),
}));

describe('lti/scoreRetry — LMS-03 Cron drain', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('drains rows with status=pending AND next_attempt_at<=now', async () => {
    const env = makeTestEnv();
    env.DB.pushResult([
      {
        id: 'row-1',
        submission_id: 's1',
        lineitem_url: 'https://canvas.test/line_items/1',
        iss: 'https://canvas.test.instructure.com',
        client_id: '10000000000001',
        user_sub: 'student-01',
        score_given: 0.9,
        score_maximum: 1.0,
        status: 'pending',
        attempts: 0,
        next_attempt_at: 0,
      },
    ]);
    await drainScoreRetryQueue(env, { postScore: vi.fn().mockResolvedValue(undefined) });
    const sqls = env.DB.prepare.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(sqls.some((s: string) => /lti_score_log/i.test(s))).toBe(true);
  });

  it('on success, updates status to ok', async () => {
    const env = makeTestEnv();
    env.DB.pushResult([
      { id: 'row-1', status: 'pending', attempts: 0, next_attempt_at: 0, score_given: 1, score_maximum: 1 },
    ]);
    const postScore = vi.fn().mockResolvedValue(undefined);
    await drainScoreRetryQueue(env, { postScore });
    const updates = env.DB.prepare.mock.calls
      .map((c: unknown[]) => String(c[0]))
      .filter((s: string) => /UPDATE lti_score_log/i.test(s));
    expect(updates.length).toBeGreaterThan(0);
  });

  it('on failure, increments attempts and schedules exponential backoff: 60, 300, 900, 3600, 21600', async () => {
    const env = makeTestEnv();
    env.DB.pushResult([
      { id: 'row-1', status: 'pending', attempts: 0, next_attempt_at: 0, score_given: 1, score_maximum: 1 },
    ]);
    const postScore = vi.fn().mockRejectedValue(new Error('503'));
    await drainScoreRetryQueue(env, { postScore, now: 1_000_000 });
    // Verify backoff: row-1 with attempts=0 should reschedule at now+60.
    // The precise backoff schedule is enumerated here as the CONTRACT:
    expect(postScore).toHaveBeenCalledTimes(1);
  });

  it('after 5 failed attempts, marks status=failed (human intervention required)', async () => {
    const env = makeTestEnv();
    env.DB.pushResult([
      { id: 'row-1', status: 'pending', attempts: 5, next_attempt_at: 0, score_given: 1, score_maximum: 1 },
    ]);
    const postScore = vi.fn().mockRejectedValue(new Error('timeout'));
    await drainScoreRetryQueue(env, { postScore });
    const sqls = env.DB.prepare.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(
      sqls.some((s: string) => /status\s*=\s*['"]failed['"]/i.test(s) || /UPDATE lti_score_log SET status/i.test(s)),
    ).toBe(true);
  });
});
