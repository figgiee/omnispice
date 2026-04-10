---
phase: 03-classroom-features
plan: 01
type: execute
tasks: 2
completed: 2
start_time: 2026-04-10T07:43:16Z
end_time: 2026-04-10T07:50:00Z
duration: 7 minutes
commits:
  - 9f3b255: feat(03-01): install marked+dompurify and scaffold worker test helpers+stubs
  - d60edfd: feat(03-01): scaffold frontend and E2E test stubs
tags:
  - test-infrastructure
  - wave-0
  - validation-seed
  - dependencies
subsystem: Classroom Features Test Infrastructure
tech_stack:
  added:
    - marked@^15.0.12 (markdown rendering)
    - dompurify@^3.3.3 (XSS sanitization)
    - "@types/dompurify@^3.2.0" (TypeScript definitions)
  patterns:
    - Vitest + vi.mock pattern for Clerk auth stubbing (mirrored from Phase 2)
    - Minimal test double factories (makeTestD1, makeTestR2, makeTestEnv) for D1/R2/Bindings
    - Mock role injection via sessionClaims for instructor/student differentiation
    - Playwright test.skip for stubs that will be implemented in Wave 2-3
key_files_created:
  - worker/test/helpers/clerk-mock.ts (26 lines)
  - worker/test/helpers/d1-fixture.ts (56 lines)
  - worker/test/classroom.test.ts (79 lines)
  - worker/test/assignments.test.ts (101 lines)
  - worker/test/submissions.test.ts (73 lines)
  - src/store/classroomStore.test.ts (43 lines)
  - src/cloud/classroomHooks.test.ts (20 lines)
  - src/pages/Dashboard.test.tsx (9 lines)
  - src/pages/AssignmentPage.test.tsx (9 lines)
  - src/pages/SubmissionViewer.test.tsx (9 lines)
  - tests/e2e/fixtures/classroom-users.ts (17 lines)
  - tests/e2e/classroom.spec.ts (31 lines)
  - .planning/phases/03-classroom-features/03-CLERK-SETUP.md (32 lines)
decisions: []
---

# Phase 03 Plan 01: Wave 0 Test Infrastructure Scaffold

**Wave 0 test infrastructure scaffold for Phase 3 classroom features.**

Creates every test stub referenced in 03-VALIDATION.md so subsequent waves can write implementations against pre-existing failing tests (Nyquist validation seed). Also installs markdown dependencies (marked, dompurify) and documents the manual Clerk dashboard JWT template configuration required for role-based Worker auth.

## Objective

Unblock all downstream plans (02..07) by ensuring every test file, helper, and dependency exists before implementation begins. Failing tests are the contract.

## Summary

Wave 0 completed successfully. All 12 test stub files created and committed. Dependencies installed. Manual setup documentation created.

### Task 1: Install marked + dompurify and scaffold Worker test helpers + stubs

**Status:** COMPLETE

**Files created:**
- `package.json` (updated with marked, dompurify, @types/dompurify)
- `pnpm-lock.yaml` (updated)
- `worker/test/helpers/clerk-mock.ts` — Shared Clerk JWT mock with role claim helper
- `worker/test/helpers/d1-fixture.ts` — In-memory D1/R2/Bindings test factories
- `worker/test/classroom.test.ts` — Course CRUD + join flow test stubs (CLASS-01, CLASS-02)
- `worker/test/assignments.test.ts` — Assignment CRUD + submit stubs (CLASS-02, CLASS-03)
- `worker/test/submissions.test.ts` — Submission list + grade stubs (CLASS-04, CLASS-05)
- `.planning/phases/03-classroom-features/03-CLERK-SETUP.md` — Manual Clerk dashboard JWT template setup

**Actions taken:**
1. Installed `marked@^15.0.12` for markdown rendering in assignment instructions
2. Installed `dompurify@^3.3.3` for XSS sanitization during markdown output
3. Installed `@types/dompurify@^3.2.0` for TypeScript support
4. Created `mockClerkAuth` helper that wraps `vi.mocked(getAuth)` with role support — null userId = unauthenticated, role defaults to 'student'
5. Created test double factories (`makeTestD1`, `makeTestR2`, `makeTestEnv`) for D1/R2/Worker Bindings
6. Scaffolded 7 Worker test files with failing test stubs matching the CLASS-01..05 requirements
7. Documented manual Clerk dashboard setup steps for JWT custom claim configuration

**Acceptance criteria:** ALL PASSED
- ✓ `worker/test/helpers/clerk-mock.ts` exists, contains `mockClerkAuth`
- ✓ `worker/test/helpers/d1-fixture.ts` exists, contains `makeTestD1`, `makeTestR2`, `makeTestEnv`
- ✓ `worker/test/classroom.test.ts` exists, contains `describe('classroom routes — CLASS-01`
- ✓ `worker/test/assignments.test.ts` exists, contains `describe('assignments routes — CLASS-03 submit`
- ✓ `worker/test/submissions.test.ts` exists, contains `describe('submissions routes — CLASS-05 grade`
- ✓ `package.json` has `"marked"` in dependencies and `"dompurify"` in dependencies
- ✓ `package.json` has `"@types/dompurify"` in devDependencies
- ✓ `.planning/phases/03-classroom-features/03-CLERK-SETUP.md` exists and contains `role: {{user.public_metadata.role}}`

**Commit:** `9f3b255`

---

### Task 2: Scaffold frontend + E2E test stubs

**Status:** COMPLETE

**Files created:**
- `src/store/classroomStore.test.ts` — Zustand state management test stub
- `src/cloud/classroomHooks.test.ts` — TanStack Query hooks export validation
- `src/pages/Dashboard.test.tsx` — Component export stub
- `src/pages/AssignmentPage.test.tsx` — Component export stub
- `src/pages/SubmissionViewer.test.tsx` — Component export stub
- `tests/e2e/fixtures/classroom-users.ts` — Test user credentials for E2E
- `tests/e2e/classroom.spec.ts` — E2E placeholder tests with test.skip

**Actions taken:**
1. Created `classroomStore.test.ts` with vitest unit tests for store actions (enterStudentMode, exitClassroomMode, setSubmitting)
2. Created `classroomHooks.test.ts` that validates all 11 hook exports exist as functions
3. Created three page component test stubs that import and validate component exports
4. Created `classroom-users.ts` fixture with INSTRUCTOR_USER and STUDENT_USER credentials pre-configured with roles
5. Created `classroom.spec.ts` with 5 Playwright test stubs using `test.skip` so they don't block green runs yet
6. All E2E tests reference CLASS-01 through CLASS-05 with TODO comments pointing to the plan that implements them (plan-07)

**Acceptance criteria:** ALL PASSED
- ✓ `src/store/classroomStore.test.ts` exists, contains `enterStudentMode`
- ✓ `src/cloud/classroomHooks.test.ts` exists, contains all 11 hook names
- ✓ `src/pages/Dashboard.test.tsx` exists, imports Dashboard from './Dashboard'
- ✓ `src/pages/AssignmentPage.test.tsx` exists, imports AssignmentPage from './AssignmentPage'
- ✓ `src/pages/SubmissionViewer.test.tsx` exists, imports SubmissionViewer from './SubmissionViewer'
- ✓ `tests/e2e/classroom.spec.ts` exists, contains exactly 5 `test.skip(` calls referencing CLASS-01..05
- ✓ `tests/e2e/fixtures/classroom-users.ts` exports `INSTRUCTOR_USER` and `STUDENT_USER`

**Commit:** `d60edfd`

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Validation

### Wave 0 Completion

All 12 test stub files from 03-VALIDATION.md Wave 0 Requirements now exist on disk:
- ✓ `worker/test/classroom.test.ts`
- ✓ `worker/test/assignments.test.ts`
- ✓ `worker/test/submissions.test.ts`
- ✓ `worker/test/helpers/clerk-mock.ts`
- ✓ `worker/test/helpers/d1-fixture.ts`
- ✓ `src/store/classroomStore.test.ts`
- ✓ `src/cloud/classroomHooks.test.ts`
- ✓ `src/pages/Dashboard.test.tsx`
- ✓ `src/pages/AssignmentPage.test.tsx`
- ✓ `src/pages/SubmissionViewer.test.tsx`
- ✓ `tests/e2e/classroom.spec.ts`
- ✓ `tests/e2e/fixtures/classroom-users.ts`

### Dependencies Installed

- ✓ `marked@^15.0.12` in dependencies
- ✓ `dompurify@^3.3.3` in dependencies
- ✓ `@types/dompurify@^3.2.0` in devDependencies

### Manual Verification

- ✓ `.planning/phases/03-classroom-features/03-CLERK-SETUP.md` created with Clerk dashboard setup steps
- ✓ Contains JWT template: `role: {{user.public_metadata.role}}`
- ✓ Includes manual verification and fallback instructions

---

## Test Status

All test stubs are red (expected) until implementations land in downstream waves:
- Worker tests fail with `app` import error (routes not yet created)
- Frontend tests fail with component import errors (modules not yet created)
- E2E tests are skipped with `test.skip` and won't run until Wave 2-3 un-skip them

This is intentional per the Nyquist validation seed pattern: downstream waves write implementations against pre-existing failing test contracts.

---

## Known Stubs

No stubs that prevent the plan's goal (test infrastructure scaffold) from being achieved. All created files are intentionally minimal/placeholder — they are the contract.

---

## Requirements Coverage

- ✓ CLASS-01 — Worker test stubs for course CRUD
- ✓ CLASS-02 — Worker test stubs for join flow + assignment CRUD
- ✓ CLASS-03 — Worker test stubs for assignment submit
- ✓ CLASS-04 — Worker test stubs for submission list
- ✓ CLASS-05 — Worker test stubs for submission grade

All requirements have pre-written failing tests ready for implementation.

---

## Next Steps (Downstream Waves)

1. **Wave 1 (Plans 02-03):** Implement Worker routes (classroom.ts, assignments.ts, submissions.ts) to make tests pass
2. **Wave 2 (Plans 04-05):** Implement Zustand store and TanStack Query hooks
3. **Wave 3 (Plans 06-07):** Implement frontend pages (Dashboard, AssignmentPage, SubmissionViewer) and un-skip E2E tests
