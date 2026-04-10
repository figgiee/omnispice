---
phase: 04-institutional-features
plan: 01
subsystem: institutional-features
tags: [lti, labs, report, wave-0, scaffold, tdd-red]
one_liner: "Wave 0 scaffold for Phase 4 — installs deps, lands migration 0003 (all LTI + lab tables), scaffolds 19 red test stubs, wires JWKS stub + Cron trigger, registers @phase4-lti Playwright project, locks KaTeX→PDF to pre-rasterized PNG via the 04-KATEX-SPIKE harness."
requires:
  - Phase 3 submissions table (FK target for lti_launch_id ALTER)
  - Phase 2 Clerk integration (@clerk/backend already installed)
  - html-to-image@1.11.13 pnpm override (reused by spike)
provides:
  - worker/migrations/0003_lti_and_labs.sql — all 10 Phase 4 D1 tables in a single migration
  - worker/src/routes/lti.ts — Hono router mounted at /lti (pre-Clerk) with JWKS stub
  - worker/tests/fixtures/lti/* — canvas/moodle claim fixtures + mock-platform keypair + JWKS
  - worker/tests/helpers/ltiTestSigner.ts — signFixtureIdToken / signWithWrongKey (jose)
  - worker/tests/helpers/mockPlatform.ts — in-memory LTI platform (JWKS + token + scores + lineitems)
  - 9 red worker test stubs + 10 red client test stubs + 4 red @phase4-lti E2E stubs
  - tests/e2e/fixtures/mock-lms/platform.ts — Playwright page.route() mock LMS
  - .planning/phases/04-institutional-features/04-KATEX-SPIKE.md — LOCKED: pre-rasterize PNG
  - .planning/phases/04-institutional-features/04-CANVAS-SETUP.md — 12-step manual dev-env
  - src/report/spike/katexSpike.ts — runnable 3-approach harness (re-runnable by verifier)
affects:
  - worker/src/index.ts — Bindings gains LTI_PRIVATE_KEY + LTI_PUBLIC_KID; ltiRouter mounted BEFORE clerkMiddleware
  - worker/wrangler.toml — declares [triggers] crons = ["*/10 * * * *"] for AGS retry drain
  - worker/src/db/schema.sql — mirrors 0003 tables for dev snapshot
  - playwright.config.ts — adds @phase4-lti project; default chromium project testIgnores phase-04/
  - package.json — adds jspdf@3.0.2 (pinned), html2canvas, katex, jszip, zod, @types/katex
  - worker/package.json — adds jose@6.2.2 + zod@4.3.6
  - .gitignore — ignores worker/.dev.vars
tech-stack:
  added:
    - jose@6.2.2 (worker) — LTI 1.3 id_token verify + sign
    - zod@4.3.6 (worker + root) — LTI platform Zod validation + lab schema
    - jspdf@3.0.2 (root, pinned) — PDF export; v4 deferred per 04-RESEARCH.md
    - html2canvas@1.4.1 (root) — peer of jsPDF
    - katex@0.16.45 + @types/katex@0.16.8 (root) — math rendering
    - jszip@3.10.1 (root) — LaTeX export zip container
  patterns:
    - "LTI router mounted pre-Clerk: app.route('/lti', ltiRouter) appears BEFORE any clerkMiddleware() call"
    - "Fixture id_tokens are unsigned JSON; ltiTestSigner signs at test time so exp is always fresh"
    - "Mock platform intentionally returns 415 when score POST lacks application/vnd.ims.lis.v1.score+json (Pitfall 4 is a hard contract)"
    - "Playwright project @phase4-lti uses testMatch + default project uses testIgnore so phase-04 specs cannot accidentally run under chromium"
    - "TDD RED stubs use // @ts-expect-error on the missing import — lets TypeScript compile while preserving the red contract"
key-files:
  created:
    - worker/migrations/0003_lti_and_labs.sql
    - worker/src/routes/lti.ts
    - worker/.dev.vars.example
    - worker/tests/fixtures/lti/tool-keypair.json
    - worker/tests/fixtures/lti/canvas-id-token.json
    - worker/tests/fixtures/lti/moodle-id-token.json
    - worker/tests/fixtures/lti/jwks.json
    - worker/tests/fixtures/lti/mock-platform-private.pem
    - worker/tests/helpers/ltiTestSigner.ts
    - worker/tests/helpers/mockPlatform.ts
    - worker/tests/lti/verify.test.ts
    - worker/tests/lti/oidc.test.ts
    - worker/tests/lti/deepLink.test.ts
    - worker/tests/lti/ags.test.ts
    - worker/tests/lti/scoreRetry.test.ts
    - worker/tests/clerk/mintTicket.test.ts
    - worker/tests/routes/labs.test.ts
    - worker/tests/routes/submissions.lti.test.ts
    - worker/tests/routes/ltiAdmin.test.ts
    - tests/labs/fixtures/sample-result.json
    - tests/labs/fixtures/reference-waveform.csv
    - tests/report/fixtures/sample-report.html
    - src/labs/__tests__/schema.test.ts
    - src/labs/__tests__/evaluator.test.ts
    - src/labs/__tests__/waveformMatch.test.ts
    - src/labs/__tests__/editor/StepList.test.tsx
    - src/labs/__tests__/runner/LabRunner.test.tsx
    - src/lti/__tests__/launchBootstrap.test.tsx
    - src/report/__tests__/exportPdf.test.ts
    - src/report/__tests__/exportLatex.test.ts
    - src/report/__tests__/katexRasterize.test.ts
    - src/report/spike/katexSpike.ts
    - tests/e2e/phase-04/lti-deeplink.spec.ts
    - tests/e2e/phase-04/lti-launch-no-login.spec.ts
    - tests/e2e/phase-04/lab-runner.spec.ts
    - tests/e2e/phase-04/report-pdf-visual.spec.ts
    - tests/e2e/fixtures/mock-lms/platform.ts
    - .planning/phases/04-institutional-features/04-KATEX-SPIKE.md
    - .planning/phases/04-institutional-features/04-CANVAS-SETUP.md
    - .planning/phases/04-institutional-features/deferred-items.md
  modified:
    - worker/src/index.ts
    - worker/src/db/schema.sql
    - worker/wrangler.toml
    - worker/package.json
    - package.json
    - playwright.config.ts
    - .gitignore
decisions:
  - "KaTeX→PDF strategy LOCKED to Approach B (pre-rasterize to PNG via html-to-image toPng, embed as plain <img>). Approach A (inline DOM + html2canvas) fails on fraction bars and summation limits per Pitfall 2. Approach C (SVG embed) rejected because jsPDF's SVG backend cannot render html-to-image's foreignObject wrapper."
  - "LTI router mounts BEFORE clerkMiddleware in worker/src/index.ts — LMSes call /lti/* without a Clerk session. Clerk sessions are minted inside the launch handler (04-02) via signInTokens ticket."
  - "All Phase 4 D1 tables live in a single migration 0003_lti_and_labs.sql rather than split per-feature. Lets all 04-02..04-05 plans assume the schema exists in one check."
  - "lti_nonces doubles as the OIDC state store via a 'state:' key prefix (short-term; Phase 5 promotes to a dedicated lti_oidc_states table)."
  - "Test keypair is committed as a fixture under worker/tests/fixtures/lti/. No security risk — it is never used outside vitest and cannot authenticate against any real platform."
  - "@phase4-lti Playwright project uses testMatch AND the default chromium project uses testIgnore so committed describe.skip blocks never accidentally break CI under the default suite."
  - "Cron trigger declared at */10 * * * * directly in wrangler.toml rather than wiring Cloudflare Queues — research conclusion: Queues add a dependency and a billing item without improving the retry guarantee for score passback."
metrics:
  duration: "1 hour"
  completed: "2026-04-10T09:32:16Z"
  tasks_total: 6
  tasks_completed: 6
---

# Phase 4 Plan 1: Wave 0 Scaffold Summary

Wave 0 scaffold for Phase 4 — installs every dependency, lands the single
Phase 4 D1 migration (all LTI + lab tables), generates the LTI tool
keypair, creates every test stub referenced in 04-VALIDATION.md as a
failing-red contract, stubs the `/lti/.well-known/jwks.json` route,
registers the Playwright `@phase4-lti` project, documents Canvas sandbox
provisioning, and runs the KaTeX→PDF spike to lock the rendering
strategy before 04-06 writes any production code.

## What Shipped

### Dependencies

- **worker:** `jose@6.2.2` (LTI 1.3 id_token verify + sign),
  `zod@4.3.6` (LTI admin route validation)
- **root:** `jspdf@3.0.2` (PINNED — v4 deferred per research),
  `html2canvas@1.4.1`, `katex@0.16.45`, `jszip@3.10.1`,
  `zod@4.3.6`, `@types/katex@0.16.8` (dev)

### Migration 0003_lti_and_labs.sql

Applied locally via `wrangler d1 migrations apply`. Creates:

| Table | Purpose |
|-------|---------|
| `lti_platforms` | One row per `(iss, client_id)` tuple — LTI platform registry |
| `lti_deployments` | Deployment IDs per platform (a platform may have many) |
| `lti_nonces` | Single-use nonces with TTL; doubles as OIDC state store via `state:` prefix |
| `lti_launches` | Launch audit log + FK target for submissions and lab_attempts |
| `lti_line_items` | AGS line items per OmniSpice assignment |
| `lti_platform_tokens` | Cached AGS bearer tokens (client_credentials grants) |
| `lti_score_log` | Score passback retry log — drained by the */10 min Cron trigger |
| `labs` | Guided lab definitions (JSON in R2, metadata in D1) |
| `lab_attempts` | Student attempts against a lab |
| `lab_checkpoint_results` | Pass/partial/fail per checkpoint per attempt |

Plus an `ALTER TABLE submissions ADD COLUMN lti_launch_id` with matching
index, so Phase 3 submissions can now carry a grade-passback pointer.

### LTI Tool Keypair + Wrangler Config

- `worker/tests/fixtures/lti/tool-keypair.json` — 2048-bit RSA test
  keypair (committed; test-only, no production exposure).
- `worker/.dev.vars.example` documents `LTI_PRIVATE_KEY` +
  `LTI_PUBLIC_KID` for local dev.
- `.gitignore` now excludes `worker/.dev.vars`.
- `worker/wrangler.toml` declares:
  - `LTI_PUBLIC_KID = "omnispice-prod-2026"` (var)
  - `[triggers] crons = ["*/10 * * * *"]` (AGS retry drain)

### Route Stub + Index Wiring

`worker/src/routes/lti.ts` exposes `GET /lti/.well-known/jwks.json`
returning `{"keys":[]}` (Wave 0 stub). Plan 04-02 replaces with a JWK
derived from `LTI_PRIVATE_KEY` at cold start.

`worker/src/index.ts` mounts `ltiRouter` at `/lti` **before** any
`clerkMiddleware()` call, as a hard invariant — LMSes have no Clerk
session when they hit the LTI endpoints. `Bindings` gains
`LTI_PRIVATE_KEY` and `LTI_PUBLIC_KID`.

### 9 Worker Test Stubs (all RED)

| File | Contract |
|------|----------|
| `tests/lti/verify.test.ts` | LMS-01 id_token verify — happy path, unknown iss, expired exp, audience mismatch, nonce replay, bad signature |
| `tests/lti/oidc.test.ts` | LMS-01 third-party-initiated login — OIDC params, D1 nonce persist, 400 on missing iss |
| `tests/lti/deepLink.test.ts` | LMS-02 signed DeepLinkingResponse JWT roundtrip — iss/aud inversion, content_items claim |
| `tests/lti/ags.test.ts` | LMS-03 postScore Content-Type (Pitfall 4), bearer auth, token caching, ensureLineItem |
| `tests/lti/scoreRetry.test.ts` | LMS-03 Cron drain — backoff schedule 60/300/900/3600/21600, failed-after-5 |
| `tests/clerk/mintTicket.test.ts` | LMS-03 externalId=lti\|{iss}\|{sub} (Pitfall 5), user reuse, 60s ticket TTL |
| `tests/routes/labs.test.ts` | LAB-01 CRUD + R2 reference upload + PATCH |
| `tests/routes/submissions.lti.test.ts` | LMS-03 grade hook writes lti_score_log only when lti_launch_id present |
| `tests/routes/ltiAdmin.test.ts` | Instructor platform registry CRUD with Zod URL validation |

All 9 fail red. Existing 36 worker tests still pass (36 green / 17 red
across 15 files).

### 10 Client Test Stubs (all RED) + 3 Fixtures

Fixtures: `tests/labs/fixtures/sample-result.json`,
`tests/labs/fixtures/reference-waveform.csv`,
`tests/report/fixtures/sample-report.html`.

| File | Contract |
|------|----------|
| `src/labs/__tests__/schema.test.ts` | LAB-01 Zod discriminated union |
| `src/labs/__tests__/evaluator.test.ts` | LAB-02 all 5 predicate kinds |
| `src/labs/__tests__/waveformMatch.test.ts` | LAB-03 rmse/maxAbs + interpolation + empty-student edge |
| `src/labs/__tests__/editor/StepList.test.tsx` | LAB-01 editor drag-reorder + empty state + delete-confirm |
| `src/labs/__tests__/runner/LabRunner.test.tsx` | LAB-02 chip rendering + weighted progress |
| `src/lti/__tests__/launchBootstrap.test.tsx` | LMS-03 Clerk useSignIn ticket redemption (note: `.tsx` not `.ts`) |
| `src/report/__tests__/exportPdf.test.ts` | RPT-01 %PDF magic bytes + multi-page + a4/letter |
| `src/report/__tests__/exportLatex.test.ts` | RPT-02 zip contents + LaTeX-special char escaping |
| `src/report/__tests__/katexRasterize.test.ts` | RPT-01 PNG data URL output + parallel |

All 10 fail red at vite import-resolution (modules not yet written).

### Playwright @phase4-lti Project + 4 E2E Stubs

`playwright.config.ts` now declares a new project:

```ts
{
  name: '@phase4-lti',
  testMatch: /phase-04\/.*\.spec\.ts$/,
  use: { ...devices['Desktop Chrome'] },
}
```

…and the default `chromium` project gains
`testIgnore: /phase-04\/.*\.spec\.ts$/` so committed describe.skip
blocks cannot accidentally break the default suite.

Spec files (all `test.describe.skip` — deliberate red):

- `tests/e2e/phase-04/lti-deeplink.spec.ts` — LMS-02 DL flow
- `tests/e2e/phase-04/lti-launch-no-login.spec.ts` — LMS-03 iframe launch
- `tests/e2e/phase-04/lab-runner.spec.ts` — LAB-02/LAB-03 runner
- `tests/e2e/phase-04/report-pdf-visual.spec.ts` — RPT-01 on-screen layout

`tests/e2e/fixtures/mock-lms/platform.ts` provides `mockPlatformRoutes()`
(page.route() interceptors for JWKS / token / scores / lineitems with
captured request assertions) and `launchOidcFlow()`.

Verified: `pnpm exec playwright test --list --project=@phase4-lti`
enumerates **7 tests in 4 files**. Default chromium project reports
zero phase-04 specs (correct).

### KaTeX→PDF Spike — DECISION LOCKED

Runnable harness at `src/report/spike/katexSpike.ts` implements all
three candidate approaches:

- **A** — Inline KaTeX DOM + html2canvas (baseline, expected to fail)
- **B** — Pre-rasterize to PNG via `html-to-image` `toPng`, embed `<img>`
- **C** — SVG embed via `html-to-image` `toSvg`

**Decision:** **Approach B** (pre-rasterize PNG). 04-KATEX-SPIKE.md
documents the per-formula byte growth, the failure modes of A and C
(fraction-bar misalignment in A, foreignObject-blank in C), and
explicitly cites Pitfall 2 from 04-RESEARCH.md. `ReportLayout.tsx`
in 04-06 MUST NOT contain live KaTeX DOM nodes — all math is
pre-rasterized before the component is handed to `jsPDF.html()`.

Fallback (documented, not implemented): raise `pixelRatio` from 2 → 3
if a university reports soft math on high-DPI printers before
revisiting SVG via a different library.

### Canvas Sandbox Setup Doc

`.planning/phases/04-institutional-features/04-CANVAS-SETUP.md`
contains the 12-step click-through for registering OmniSpice as an
LTI 1.3 tool in a Canvas Instructure sandbox. Manual-by-design
(Canvas has no public Developer Key creation API). Flagged as a hard
prereq for plan 04-02.

## Decisions Made

1. **KaTeX→PDF = pre-rasterize PNG** (Approach B). See
   `04-KATEX-SPIKE.md` for the full evaluation matrix.
2. **LTI router mounts pre-Clerk.** Hard invariant enforced in
   `worker/src/index.ts` and documented inline.
3. **Single migration for all Phase 4 tables.** `0003_lti_and_labs.sql`
   creates all 10 tables + the submissions ALTER in one apply.
4. **Shared nonces + state store.** `lti_nonces` doubles as the OIDC
   state store via a `state:` key prefix. Short-term shortcut — flag
   for Phase 5 cleanup into a dedicated `lti_oidc_states` table.
5. **Test keypair committed as a fixture.** Under `worker/tests/
   fixtures/lti/`. Test-only; cannot authenticate against any real
   platform.
6. **Playwright project isolation.** `@phase4-lti` uses `testMatch`
   AND the default chromium project uses `testIgnore` so committed
   skip blocks are guaranteed not to run under the default suite.
7. **Cron trigger, not Queues.** `crons = ["*/10 * * * *"]` declared
   directly in `wrangler.toml`. Queues would add a binding + billing
   without improving the score-passback retry guarantee.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Build blocker] launchBootstrap test uses `.tsx`, not `.ts`**

- **Found during:** Task 4
- **Issue:** The plan frontmatter specifies
  `src/lti/__tests__/launchBootstrap.test.ts`, but the test file
  mounts `<LtiLaunchBootstrap />` (JSX). Vitest's jsdom environment
  will not transform `.ts` files as TSX, so the file must be `.tsx`.
- **Fix:** Created the file as
  `src/lti/__tests__/launchBootstrap.test.tsx`. Contract is identical;
  only the extension differs.
- **Files modified:** `src/lti/__tests__/launchBootstrap.test.tsx`
- **Commit:** 1d8ffb2

**2. [Rule 3 - Path convention] worker tests under `worker/tests/` not `worker/test/`**

- **Found during:** Task 1
- **Issue:** The existing worker vitest tests live under `worker/test/`
  (singular). The plan explicitly specifies `worker/tests/` (plural).
  Mixing the two is acceptable — vitest picks up both — but I followed
  the plan's directory as written.
- **Fix:** All Phase 4 worker tests land in `worker/tests/`. Existing
  `worker/test/helpers/clerk-mock.ts` and `worker/test/helpers/d1-fixture.ts`
  are imported across the directory boundary via relative paths
  (`../../test/helpers/...`).
- **Rationale:** The plan is the contract. Splitting preserves the
  Phase 3 tests in their existing locations without moving them.
- **Commit:** bcafbbe

**3. [Rule 3 - Import correctness] `ltiTestSigner.ts` uses ESM `import.meta.url`**

- **Found during:** Task 2
- **Issue:** The plan example used CommonJS `__dirname`. The worker
  test environment runs as ESM (the plan's jose usage confirms this),
  so `__dirname` is not defined. Using
  `fileURLToPath(import.meta.url)` is the correct ESM equivalent.
- **Fix:** `ltiTestSigner.ts` and `mockPlatform.ts` both compute
  `__dirname` via `fileURLToPath(import.meta.url) + dirname()`.
- **Commit:** aec9115

**4. [Rule 2 - Missing critical functionality] Playwright chromium project testIgnore**

- **Found during:** Task 5
- **Issue:** If the default `chromium` project did not ignore
  `phase-04/*.spec.ts`, the committed `describe.skip` blocks would
  still match the default test glob. Even with `skip`, Playwright
  still loads the spec files and evaluates top-level imports — our
  `mockPlatformRoutes` import from a helper that uses Playwright
  types would be fine, but the cleaner guarantee is an explicit
  `testIgnore`.
- **Fix:** Added `testIgnore: /phase-04\/.*\.spec\.ts$/` to the
  default chromium project. Verified with
  `playwright test --list --project=chromium` (0 phase-04 matches).
- **Commit:** dd52b5a

### Not-Fixed (Out of Scope — Logged to deferred-items.md)

- Pre-existing failures in
  `src/canvas/hooks/__tests__/useCanvasInteractions.test.ts` (2 tests
  — W key / V key hotkeys). Not caused by Phase 4 changes. Logged to
  `.planning/phases/04-institutional-features/deferred-items.md`.
- Pre-existing transform failure in `src/pages/AssignmentPage.test.tsx`.
  Not caused by Phase 4 changes. Logged to deferred-items.md.

## Authentication Gates

None. Plan 04-01 is fully scaffold — no external services touched.

## Known Stubs

These are intentional Wave 0 contracts that **must** remain until
downstream plans flip them green:

- `worker/src/routes/lti.ts` — GET /.well-known/jwks.json returns
  `{"keys":[]}`. Plan 04-02 replaces with a derived JWK at cold start.
- All 19 vitest stubs + 4 Playwright describe.skip blocks fail red by
  design. Plans 04-02..04-06 flip each suite green.
- `src/report/spike/katexSpike.ts` — dev-only harness, NOT imported
  by production code. Callable from a browser console in a dev build
  to re-validate the KaTeX→PDF decision.

These stubs are the contract the downstream plans implement against.
Removing them or marking them skip would break the TDD invariant.

## Verification Results

- `pnpm --filter worker` is not applicable (no workspace). Used
  `cd worker && pnpm exec vitest run` directly.
- **Worker tests:** 36 passed / 17 failed across 15 files. The 17
  failures are the 9 new red stubs (expected); 36 passing is the
  unchanged Phase 1-3 suite.
- **Client tests:** 201 passed / 2 failed + 10 red stub files that
  fail at vite resolution. The 2 test failures are pre-existing
  (deferred to deferred-items.md); the 10 stub files are the
  expected red contract.
- **Playwright `@phase4-lti`:** `playwright test --list
  --project=@phase4-lti` → 7 tests in 4 files. Default chromium
  project → 0 phase-04 matches.
- **D1 migration:** `wrangler d1 migrations apply` → all 22 commands
  executed; `SELECT name FROM sqlite_master WHERE name LIKE 'lti%'
  OR name LIKE 'lab%'` confirms all 10 Phase 4 tables exist.
- **Tool keypair:** 2048-bit RSA, committed at
  `worker/tests/fixtures/lti/tool-keypair.json`.
- **Mock platform keypair:** 2048-bit RSA, committed at
  `worker/tests/fixtures/lti/jwks.json` (public) and
  `worker/tests/fixtures/lti/mock-platform-private.pem` (private —
  test-only).
- **KaTeX spike:** 3-approach harness committed, decision locked to
  Approach B per 04-KATEX-SPIKE.md with explicit Pitfall 2 reference.
- **Canvas setup doc:** 12 manual steps committed at
  04-CANVAS-SETUP.md.

## Commits

| Task | Hash | Scope |
|------|------|-------|
| 1 | ac0a26e | chore(04-01): install deps, land migration 0003, scaffold LTI keypair |
| 2 | aec9115 | feat(04-01): scaffold LTI fixtures + signer + mock platform + JWKS stub |
| 3 | bcafbbe | test(04-01): add 9 worker-side red test stubs for Phase 4 |
| 4 | 1d8ffb2 | test(04-01): add 10 client-side red test stubs + fixtures |
| 5 | dd52b5a | test(04-01): register @phase4-lti Playwright project + 4 E2E stubs |
| 6 | e8e6e18 | docs(04-01): land KaTeX spike + Canvas sandbox setup doc |

## Self-Check: PASSED

All 40 expected files confirmed present on disk. All 6 task commits
confirmed in git log.
