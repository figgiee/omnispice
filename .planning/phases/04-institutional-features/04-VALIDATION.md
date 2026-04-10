---
phase: 4
slug: institutional-features
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-10
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Populated from 04-RESEARCH.md `## Validation Architecture` section. Planner will finalize the Per-Task Verification Map once 04-01..04-06 PLANs exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x (client + worker node env) + Playwright 1.x (E2E, already set up in Phase 3) |
| **Config file** | `vitest.config.ts` (client, jsdom), `worker/vitest.config.ts` (node), `playwright.config.ts` |
| **Quick run command** | `pnpm test --run --reporter=dot` |
| **Full suite command** | `pnpm test --run && pnpm --filter worker test --run && pnpm test:e2e` |
| **Estimated runtime** | ~90 s quick, ~6 min full (E2E dominates) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test --run --reporter=dot` scoped to the touched package (client OR worker)
- **After every plan wave:** Run the full suite (`pnpm test --run && pnpm --filter worker test --run && pnpm test:e2e --grep @phase4`)
- **Before `/gsd:verify-work`:** Full suite must be green AND `pnpm build` + `pnpm --filter worker build` + `wrangler deploy --dry-run` must succeed
- **Max feedback latency:** 90 seconds (quick run)

---

## Per-Task Verification Map

*Planner fills this in during plan generation. Each task must map to either an automated check or an explicit Wave 0 dependency.*

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | 04-01..04-06 | 0..N | LMS-01/02/03, LAB-01/02/03, RPT-01/02 | unit + integration + E2E + visual regression | `pnpm test ...` | ⚠️ populated by planner | ⬜ pending |

---

## Wave 0 Requirements

Owned by 04-01 (Wave 0 / foundations plan):

- [ ] `worker/tests/fixtures/lti/canvas-id-token.json` — signed Canvas id_token fixture for launch tests
- [ ] `worker/tests/fixtures/lti/moodle-id-token.json` — signed Moodle id_token fixture
- [ ] `worker/tests/fixtures/lti/jwks.json` — mock platform JWKS paired with the fixture signing key
- [ ] `worker/tests/helpers/ltiTestSigner.ts` — shared helper to mint fixture id_tokens from a test keypair (so tests don't rely on live LMS roundtrips)
- [ ] `worker/tests/helpers/mockPlatform.ts` — in-memory LTI platform responding to JWKS + token-service requests
- [ ] `worker/migrations/0003_lti_and_labs.sql` — all Phase 4 tables (lti_platforms, lti_deployments, lti_nonces, lti_launches, lti_line_items, lti_score_log, labs, lab_submissions, lab_checkpoints_results)
- [ ] `tests/labs/fixtures/sample-result.json` — canonical ngspice VectorData result for predicate evaluator unit tests
- [ ] `tests/labs/fixtures/reference-waveform.csv` — reference CSV for waveform_match metric tests
- [ ] `tests/report/fixtures/sample-report.html` — snapshot DOM for PDF visual regression baseline
- [ ] Install: `pnpm -w add jose` in worker; `pnpm add zod jspdf html2canvas katex jszip` in client
- [ ] `wrangler secret put LTI_PRIVATE_KEY` local .dev.vars entry (PKCS8 PEM) + production stub
- [ ] `/lti/.well-known/jwks.json` route stub returning the tool's public JWKS
- [ ] Playwright project `@phase4-lti` with a stubbed LMS launcher page
- [ ] Canvas test tenant registered (manual task — dev environment dependency, documented in 04-01)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real Canvas sandbox deep link round-trip + grade passback | LMS-01, LMS-02 | Requires live Canvas test tenant credentials; not reproducible in CI without secrets | 1. Deploy worker to preview env. 2. In Canvas test tenant, create a Developer Key (LTI 1.3 key) pointing at preview URLs. 3. Add OmniSpice to a test course as an external tool. 4. Create an assignment using Deep Linking. 5. Impersonate a student, submit. 6. Verify grade appears in Canvas gradebook within 60 s. |
| Real Moodle launch | LMS-01, LMS-03 | Requires a Moodle instance (Docker or moodle.net test site) | Same flow as Canvas with a Moodle External Tool registration. |
| PDF academic quality — "looks like a real lab report" | RPT-01 | Subjective, final sign-off by a human | Export the canonical sample lab report; open in Preview/Acrobat; verify schematic is sharp, math renders, page breaks sensible, metadata correct. |
| LaTeX zip compiles cleanly with pdflatex | RPT-02 | We are NOT shipping server-side LaTeX compilation; a local `pdflatex` run is the only way to confirm the emitted .tex is valid | Download the zip, `tar -xf`, run `pdflatex report.tex` twice, confirm exit 0 and visual parity with the PDF export. |
| Clerk session mint inside LMS iframe across browsers | LMS-03 | Third-party cookie behavior differs between Chrome/Safari/Firefox and can silently fail | Launch from Canvas test tenant in Chrome, Safari, Firefox — verify SPA boots pre-authenticated and student actions are attributed to the correct Clerk user in all three. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90 s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
