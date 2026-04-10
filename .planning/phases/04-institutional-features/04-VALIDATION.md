---
phase: 4
slug: institutional-features
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-10
updated: 2026-04-10
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Populated from 04-RESEARCH.md `## Validation Architecture` section and finalized with the real task IDs from 04-01..04-06 PLANs.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x (client + worker node env) + Playwright 1.x (E2E, Phase 3 baseline) |
| **Config file** | `vitest.config.ts` (client, jsdom), `worker/vitest.config.ts` (node), `playwright.config.ts` |
| **Quick run command** | `pnpm test --run --reporter=dot` |
| **Full suite command** | `pnpm test --run && pnpm --filter worker test --run && pnpm test:e2e:phase4` |
| **Estimated runtime** | ~90 s quick, ~6 min full (E2E dominates) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test --run --reporter=dot` scoped to the touched package (client OR worker)
- **After every plan wave:** Run the full suite (`pnpm test --run && pnpm --filter worker test --run && pnpm test:e2e:phase4`)
- **Before `/gsd:verify-work`:** Full suite green AND `pnpm build` + `pnpm --filter worker build` + `wrangler deploy --dry-run` must succeed
- **Max feedback latency:** 90 seconds (quick run)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 04-01-01 | 04-01 | 0 | ALL | infra | `pnpm --filter worker exec wrangler d1 migrations list omnispice-db --local \| grep 0003_lti_and_labs` | ⬜ pending |
| 04-01-02 | 04-01 | 0 | ALL | infra | `ls worker/tests/fixtures/lti/` (jwks.json + tool-keypair.json present) | ⬜ pending |
| 04-01-03 | 04-01 | 0 | LMS-01/02/03 | worker unit (red stubs) | `pnpm --filter worker test --run --reporter=dot` (9 files enumerated, all RED) | ⬜ pending |
| 04-01-04 | 04-01 | 0 | LAB/RPT | client unit (red stubs) | `pnpm test --run --reporter=dot` (10 files enumerated, all RED) | ⬜ pending |
| 04-01-05 | 04-01 | 0 | ALL | E2E scaffold | `pnpm exec playwright test --list --project=@phase4-lti` (4 specs listed) | ⬜ pending |
| 04-01-06 | 04-01 | 0 | RPT-01 | spike artifact | `test -f .planning/phases/04-institutional-features/04-KATEX-SPIKE.md && grep -q "pre-rasterize" .planning/phases/04-institutional-features/04-KATEX-SPIKE.md` | ⬜ pending |
| 04-02-01 | 04-02 | 1 | LMS-03 | worker unit | `pnpm --filter worker test worker/tests/routes/ltiAdmin.test.ts --run` | ⬜ pending |
| 04-02-02 | 04-02 | 1 | LMS-03 | worker unit | `pnpm --filter worker test worker/tests/lti/verify.test.ts worker/tests/lti/oidc.test.ts worker/tests/clerk/mintTicket.test.ts --run` | ⬜ pending |
| 04-02-03 | 04-02 | 1 | LMS-03 | client unit | `pnpm test src/lti/__tests__/launchBootstrap.test.ts --run` | ⬜ pending |
| 04-02-04 | 04-02 | 1 | LMS-03 | E2E | `pnpm test:e2e:phase4 --grep "launch-no-login"` | ⬜ pending |
| 04-03-01 | 04-03 | 2 | LMS-01 | worker unit | `pnpm --filter worker test worker/tests/lti/deepLink.test.ts --run` | ⬜ pending |
| 04-03-02 | 04-03 | 2 | LMS-02 | worker unit | `pnpm --filter worker test worker/tests/lti/ags.test.ts --run` | ⬜ pending |
| 04-03-03 | 04-03 | 2 | LMS-02 | worker unit | `pnpm --filter worker test worker/tests/routes/submissions.lti.test.ts --run` | ⬜ pending |
| 04-03-04 | 04-03 | 2 | LMS-02 | worker unit | `pnpm --filter worker test worker/tests/lti/scoreRetry.test.ts --run` | ⬜ pending |
| 04-03-05 | 04-03 | 2 | LMS-01/02 | E2E | `pnpm test:e2e:phase4 --grep "LMS-01\|LMS-02"` | ⬜ pending |
| 04-04-01 | 04-04 | 2 | LAB-02/03 | client unit | `pnpm test src/labs/__tests__/schema.test.ts src/labs/__tests__/evaluator.test.ts src/labs/__tests__/waveformMatch.test.ts --run` | ⬜ pending |
| 04-04-02 | 04-04 | 2 | LAB-02 | client compile | `pnpm build` (ensures labStore + labsApi + labsHooks strict TS) | ⬜ pending |
| 04-04-03 | 04-04 | 2 | LAB-02 | client integration | `pnpm test src/labs/__tests__/runner/LabRunner.test.tsx --run` | ⬜ pending |
| 04-05-01 | 04-05 | 3 | LAB-01 | worker unit | `pnpm --filter worker test worker/tests/routes/labs.test.ts --run` | ⬜ pending |
| 04-05-02 | 04-05 | 3 | LAB-01 | client unit | `pnpm test src/labs/__tests__/editor/StepList.test.tsx --run` | ⬜ pending |
| 04-05-03 | 04-05 | 3 | LAB-01 | client compile | `pnpm test src/labs --run && pnpm build` | ⬜ pending |
| 04-05-04 | 04-05 | 3 | LAB-01 | human | Human checkpoint: authoring round trip (instructor creates lab, adds steps, reorders, saves, reference runner uploads CSVs, student opens runner and sees chips evaluate) | ⬜ manual |
| 04-06-01 | 04-06 | 3 | RPT-01 | client unit | `pnpm test src/report/__tests__/katexRasterize.test.ts --run` | ⬜ pending |
| 04-06-02 | 04-06 | 3 | RPT-01 | client compile | `pnpm build` (ReportLayout + sections strict TS) | ⬜ pending |
| 04-06-03 | 04-06 | 3 | RPT-01/02 | client unit | `pnpm test src/report/__tests__/exportPdf.test.ts src/report/__tests__/exportLatex.test.ts --run` | ⬜ pending |
| 04-06-04 | 04-06 | 3 | RPT-01 | E2E visual | `pnpm test:e2e:phase4 --grep "RPT-01"` | ⬜ pending |
| 04-06-05 | 04-06 | 3 | RPT-01/02 | human | Human checkpoint: PDF academic quality + LaTeX .tex inspection (see manual-only row below) | ⬜ manual |

**Nyquist compliance:** Every code-producing task has an `<automated>` command or a justified manual checkpoint. No 3 consecutive tasks lack automated verification. Wave 0 (04-01) scaffolds every test file so subsequent waves implement against pre-existing failing tests.

---

## Wave 0 Requirements

Owned by 04-01 (Wave 0 / foundations plan):

- [ ] `worker/tests/fixtures/lti/canvas-id-token.json` — Canvas id_token claim fixture (unsigned, signed at test time via helper)
- [ ] `worker/tests/fixtures/lti/moodle-id-token.json` — Moodle id_token claim fixture (DeepLinkingRequest message type, no email claim)
- [ ] `worker/tests/fixtures/lti/jwks.json` — Mock platform JWKS paired with mock-platform-private.pem
- [ ] `worker/tests/fixtures/lti/mock-platform-private.pem` — Private PEM matching jwks.json (test-only)
- [ ] `worker/tests/fixtures/lti/tool-keypair.json` — Tool keypair committed as fixture (production rotates via wrangler secrets)
- [ ] `worker/tests/helpers/ltiTestSigner.ts` — signFixtureIdToken helper
- [ ] `worker/tests/helpers/mockPlatform.ts` — in-memory LTI platform responding to JWKS + token-service + scores requests
- [ ] `worker/migrations/0003_lti_and_labs.sql` — all Phase 4 tables in a single migration (lti_platforms, lti_deployments, lti_nonces, lti_launches, lti_line_items, lti_platform_tokens, lti_score_log, labs, lab_attempts, lab_checkpoint_results) + ALTER submissions ADD COLUMN lti_launch_id
- [ ] `tests/labs/fixtures/sample-result.json` — canonical ngspice VectorData result
- [ ] `tests/labs/fixtures/reference-waveform.csv` — reference CSV for waveform_match metric tests
- [ ] `tests/report/fixtures/sample-report.html` — deterministic DOM for PDF visual regression baseline
- [ ] Worker test stubs: verify.test.ts, oidc.test.ts, deepLink.test.ts, ags.test.ts, scoreRetry.test.ts, clerk/mintTicket.test.ts, routes/labs.test.ts, routes/submissions.lti.test.ts, routes/ltiAdmin.test.ts (all RED)
- [ ] Client test stubs: src/labs/__tests__/{schema,evaluator,waveformMatch}.test.ts, src/labs/__tests__/editor/StepList.test.tsx, src/labs/__tests__/runner/LabRunner.test.tsx, src/lti/__tests__/launchBootstrap.test.ts, src/report/__tests__/{exportPdf,exportLatex,katexRasterize}.test.ts (all RED)
- [ ] E2E specs: tests/e2e/phase-04/{lti-deeplink,lti-launch-no-login,lab-runner,report-pdf-visual}.spec.ts (describe.skip initially)
- [ ] Install worker deps: `pnpm --filter worker add jose zod`
- [ ] Install client deps: `pnpm add zod jspdf@3.0.2 html2canvas katex jszip` (+ `@types/katex` dev)
- [ ] `wrangler secret put LTI_PRIVATE_KEY` documented in `.dev.vars.example` (local) + production stub
- [ ] `worker/wrangler.toml` Cron trigger `[triggers] crons = ["*/10 * * * *"]`
- [ ] `worker/wrangler.toml` var `LTI_PUBLIC_KID`
- [ ] `/lti/.well-known/jwks.json` route stub in worker/src/routes/lti.ts (empty keys array — filled by 04-02)
- [ ] Playwright project `@phase4-lti` in playwright.config.ts
- [ ] `tests/e2e/fixtures/mock-lms/platform.ts` mock LMS route interceptor helper
- [ ] `04-CANVAS-SETUP.md` — manual Canvas test tenant provisioning steps
- [ ] `04-KATEX-SPIKE.md` — documented spike outcome (pre-rasterize PNG vs SVG embed decision)

---

## Manual-Only Verifications

| Behavior | Requirement | Plan | Why Manual | Test Instructions |
|----------|-------------|------|------------|-------------------|
| Real Canvas sandbox deep link round-trip + grade passback | LMS-01, LMS-02 | 04-03 | Requires live Canvas test tenant credentials; not reproducible in CI without secrets | 1. Deploy worker to preview env. 2. In Canvas test tenant, create a Developer Key (LTI 1.3 key) pointing at preview URLs (see 04-CANVAS-SETUP.md). 3. Add OmniSpice to a test course as an external tool. 4. Create an assignment using Deep Linking. 5. Impersonate a student, submit. 6. Verify grade appears in Canvas gradebook within 60 s. |
| Real Moodle launch | LMS-01, LMS-03 | 04-02/04-03 | Requires a Moodle instance (Docker or moodle.net test site) | Same flow as Canvas with a Moodle External Tool registration. |
| PDF academic quality — "looks like a real lab report" | RPT-01 | 04-06 | Subjective, final sign-off by a human | Export the canonical sample lab report via /reports/sample "Export PDF"; open in Preview/Acrobat; verify schematic is sharp, math renders with KaTeX typography (not fallback), page breaks sensible, metadata correct. |
| LaTeX zip compiles cleanly with pdflatex | RPT-02 | 04-06 | We are NOT shipping server-side LaTeX compilation; a local `pdflatex` run is the only way to confirm the emitted .tex is valid | Download the zip, unzip, run `pdflatex report.tex` twice, confirm exit 0 and visual parity with the PDF export. |
| Clerk session mint inside LMS iframe across browsers | LMS-03 | 04-02 | Third-party cookie behavior differs between Chrome/Safari/Firefox and can silently fail | Launch from Canvas test tenant in Chrome, Safari, Firefox — verify SPA boots pre-authenticated and student actions are attributed to the correct Clerk user in all three. |
| Lab authoring round trip (instructor creates + saves + reference runner + student opens) | LAB-01 | 04-05 | Integration of editor UX, reference simulation pipeline, and runner is easiest validated by a human click-through | See 04-05 Task 4 human checkpoint instructions. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or justified manual checkpoints
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 90 s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending execution — validation map finalized 2026-04-10 against committed 04-01..04-06 PLANs.
