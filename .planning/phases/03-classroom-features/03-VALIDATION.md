---
phase: 3
slug: classroom-features
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-09
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from 03-RESEARCH.md §Validation Architecture. Planner/executor may refine.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend + worker unit), Playwright (E2E) |
| **Config file** | `vitest.config.ts`, `playwright.config.ts` (Phase 2) |
| **Quick run command** | `pnpm vitest run --changed` |
| **Full suite command** | `pnpm vitest run && pnpm playwright test` |
| **Estimated runtime** | ~90 seconds (vitest ~20s + playwright ~70s) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run --changed`
- **After every plan wave:** Run full vitest suite (`pnpm vitest run`)
- **Before `/gsd:verify-work`:** Full suite (vitest + playwright) must be green
- **Max feedback latency:** 30 seconds for quick, 120 seconds for full

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-* | 01 | 1 | CLASS-01..05 | migration | `pnpm wrangler d1 migrations apply DB --local` | ❌ W0 | ⬜ pending |
| 03-02-* | 02 | 1 | CLASS-01, CLASS-02 | integration | `pnpm vitest run worker/test/classroom.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-* | 03 | 1 | CLASS-03, CLASS-04 | integration | `pnpm vitest run worker/test/assignments.test.ts worker/test/submissions.test.ts` | ❌ W0 | ⬜ pending |
| 03-04-* | 04 | 2 | CLASS-01..05 | unit | `pnpm vitest run src/store/classroomStore.test.ts src/cloud/classroomHooks.test.ts` | ❌ W0 | ⬜ pending |
| 03-05-* | 05 | 2 | CLASS-01, CLASS-02 | unit+E2E | `pnpm vitest run src/pages/Dashboard.test.tsx` | ❌ W0 | ⬜ pending |
| 03-06-* | 06 | 3 | CLASS-03 | unit+E2E | `pnpm vitest run src/pages/AssignmentPage.test.tsx` | ❌ W0 | ⬜ pending |
| 03-07-* | 07 | 3 | CLASS-04, CLASS-05 | unit+E2E | `pnpm vitest run src/pages/SubmissionViewer.test.tsx` | ❌ W0 | ⬜ pending |
| 03-E2E  | --  | 4 | CLASS-01..05 | E2E | `pnpm playwright test tests/e2e/classroom.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Bootstrap test files that later waves populate:

- [ ] `worker/test/classroom.test.ts` — stubs for course CRUD + join flow (CLASS-01, CLASS-02)
- [ ] `worker/test/assignments.test.ts` — stubs for assignment CRUD + starter R2 (CLASS-03)
- [ ] `worker/test/submissions.test.ts` — stubs for submit + grade (CLASS-04, CLASS-05)
- [ ] `worker/test/helpers/clerk-mock.ts` — shared Clerk JWT mock with role claim
- [ ] `worker/test/helpers/d1-fixture.ts` — in-memory D1 with 0001+0002 migrations applied
- [ ] `src/store/classroomStore.test.ts` — stub
- [ ] `src/cloud/classroomHooks.test.ts` — TanStack Query hook stubs
- [ ] `src/pages/Dashboard.test.tsx` — stub
- [ ] `src/pages/AssignmentPage.test.tsx` — stub
- [ ] `src/pages/SubmissionViewer.test.tsx` — stub
- [ ] `tests/e2e/classroom.spec.ts` — empty Playwright spec with CLASS-01..05 placeholder tests
- [ ] `tests/e2e/fixtures/classroom-users.ts` — test user pair (instructor + student) with Clerk role pre-set

*If the classroom test files already exist from Phase 2 scaffolding, Wave 0 simply extends them.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| "Become an Instructor" toggle JWT refresh timing | CLASS-01 | Clerk JWT cache propagation depends on session token TTL; timing-sensitive, hard to assert in E2E | Log in → flip role in menu → verify dashboard shows instructor empty state within 2s without a page reload |
| Visual design of dashboard cards, grading panel, submission table | CLASS-01..05 | Subjective layout/typography per Phase 1/2 design tokens | Manual visual QA against design system — compare spacing, color, type scale |
| Clerk dashboard JWT template configuration | CLASS-01 | Dashboard-side config (not code) — must set `role` custom claim on session token template before backend role reads work | Clerk dashboard → Sessions → Customize session token → add `role: {{user.public_metadata.role}}` |
| Cross-browser canvas read-only rendering in SubmissionViewer | CLASS-04 | React Flow + CSS layers visual diff not worth automating | Open a submission in Chrome/Firefox/Safari, confirm no interaction affordances |

---

## Per-Requirement Validation (from RESEARCH.md §Validation Architecture)

### CLASS-01 — Instructor creates course + shares join link
- **Unit:** join-code generator produces 6-char uppercase excluding ambiguous chars (100 iterations)
- **Integration:** `POST /api/courses` as instructor creates row, returns `join_code`; non-instructor gets 403
- **E2E:** Instructor logs in → creates course → sees share URL → copies code

### CLASS-02 — Student enrolls + opens starter
- **Unit:** `useRole()` hook branches correctly on Clerk metadata
- **Integration:** `POST /api/courses/join` idempotent; wrong code → 404
- **E2E:** Student opens `/join/{CODE}` → lands on course page → sees assignment list

### CLASS-03 — Student submits modified circuit
- **Unit:** `classroomStore` classroom mode state transitions
- **Integration:** `POST /api/assignments/:id/submit` creates/updates row (UPSERT preserves ID); blob round-trip through R2 proxy
- **E2E:** Student opens assignment → modifies → submits → sees confirmation toast with timestamp

### CLASS-04 — Instructor sees all submissions in dashboard
- **Integration:** `GET /api/assignments/:id/submissions` returns enrollments left-join submissions (including "Not submitted" rows); permission check rejects other instructors
- **E2E:** Instructor opens assignment → table shows rows for all enrolled students including not-yet-submitted

### CLASS-05 — Instructor grades submission
- **Unit:** grade validator rejects non-integer, out-of-range 0–100
- **Integration:** `PATCH /api/submissions/:id/grade` sets `grade`, `feedback`, `graded_at`, `graded_by`; non-owning instructor gets 403
- **E2E:** Instructor opens submission viewer → enters grade + feedback → saves → student sees grade on their assignment page

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s (quick) / 120s (full)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
