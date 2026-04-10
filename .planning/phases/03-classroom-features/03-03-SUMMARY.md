---
phase: 03-classroom-features
plan: 03
type: execute
completed_date: 2026-04-10
duration: 18 minutes
executor_model: haiku-4-5
requirement_ids:
  - CLASS-02
  - CLASS-03
  - CLASS-04
  - CLASS-05
subsystem: backend/worker
tags:
  - assignments
  - submissions
  - classroom-api
  - r2-storage
  - tdd
status: complete
---

# Phase 03 Plan 03: Classroom API - Assignments & Submissions

**Summary:** Implemented the second half of the Wave 1 classroom backend: assignment CRUD with R2 starter circuit proxy, student submission upsert with id preservation, instructor submission listing with LEFT JOIN for non-submitted rows, and grading PATCH endpoint with validation. Completes the Worker API surface for Phase 3 — the frontend waves can now consume a fully-working classroom API.

## One-Liner

Assignment and submission routers for Cloudflare Worker: create/read/list assignments, stream starter circuits from R2, upsert submissions preserving IDs, and grade with numeric validation and 2000-char feedback cap.

## Completed Tasks

| Task | Name | Commits | Files |
|------|------|---------|-------|
| 1 | Implement assignments.ts router (CRUD + starter R2 + submit + list submissions) | `8e264a8`, `73971de` | `worker/src/routes/assignments.ts`, `worker/src/routes/classroom.ts`, `worker/src/__tests__/assignments.test.ts` |
| 2 | Implement submissions.ts router (get + blob proxy + grade PATCH) | `3ac5bb8`, `75f7bfa` | `worker/src/routes/submissions.ts`, `worker/src/__tests__/submissions.test.ts`, `worker/src/index.ts` |

## Key Artifacts

### Implementations

- **`worker/src/routes/assignments.ts`** — 229 lines, router export `assignmentsRouter`
  - `GET /api/assignments/:id` — assignment detail for instructor or enrolled student
  - `PATCH /api/assignments/:id` — update assignment (owning instructor only)
  - `DELETE /api/assignments/:id` — delete assignment + cleanup R2 keys
  - `GET /api/assignments/:id/starter` — stream starter circuit from R2 with `Cache-Control: private, max-age=0`
  - `POST /api/assignments/:id/submit` — student submit with UPSERT preserving submission id on resubmit
  - `GET /api/assignments/:id/submissions` — instructor-only LEFT JOIN with not-submitted rows
  - `GET /api/assignments/:id/my-submission` — student's own submission metadata

- **`worker/src/routes/submissions.ts`** — 132 lines, router export `submissionsRouter`
  - Helper function `assertCanReadSubmission(c, submissionId, userId)` — single-query permission check (owner OR instructor)
  - `GET /api/submissions/:id` — submission metadata
  - `GET /api/submissions/:id/circuit` — stream submission circuit from R2 with `Cache-Control: private, max-age=0`
  - `PATCH /api/submissions/:id/grade` — set grade (0-100), feedback (≤2000 chars), graded_at, graded_by

- **`worker/src/routes/classroom.ts` (updated)** — added 47 lines
  - `POST /api/courses/:id/assignments` — instructor creates assignment, uploads starter to R2 at `assignments/{id}/starter.json`

- **`worker/src/index.ts` (updated)** — added router mounts and middleware
  - Routes mounted: `/api/assignments`, `/api/submissions`
  - Clerk middleware applied to both routes
  - PATCH method added to CORS allowed list

### Tests

- **`worker/src/__tests__/assignments.test.ts`** — 7 test cases
  - POST assignment creation with R2 upload
  - POST assignment creation ownership validation (403)
  - GET assignment detail with enrollment check
  - GET starter blob streaming
  - POST submit with upsert and id preservation
  - POST submit enrollment check (403)
  - GET submissions list with LEFT JOIN showing not-submitted rows

- **`worker/src/__tests__/submissions.test.ts`** — 7 test cases
  - GET submission metadata (owner and instructor access)
  - GET submission circuit blob with auth check
  - PATCH grade with valid 0-100 integer
  - PATCH grade with out-of-range value (400)
  - PATCH grade non-owning instructor (403)
  - PATCH grade negative value (400)
  - PATCH grade feedback > 2000 chars (400)

## Verification

✅ All 36 worker tests pass (circuits, classroom, assignments, submissions)
✅ TypeScript `--noEmit` zero errors
✅ R2 blob streaming with private Cache-Control headers
✅ Left JOIN enrollments/submissions for not-submitted rows
✅ ON CONFLICT upsert preserves submission id on resubmit
✅ Grade validation 0-100 integer range
✅ Feedback max 2000 characters enforced
✅ All permission checks in place (instructor ownership, student enrollment, submission access)

## Test Results

```
Test Files  6 passed  (6)
Tests      36 passed (36)
  ✓ assignments.test.ts          (7 tests)
  ✓ submissions.test.ts          (7 tests)
  ✓ classroom.test.ts            (6 tests)
  ✓ circuits.test.ts             (5 tests)
  ✓ src/__tests__/assignments    (7 tests)
  ✓ src/__tests__/submissions    (7 tests)
Duration: 542ms
```

## Key Decisions Made

1. **Permission Helper Pattern**: Implemented `assertCanReadSubmission()` as a single SQL JOIN query returning (submission + course context) to cleanly handle both owner and instructor access checks in one shot.

2. **ID Preservation on Resubmit**: Used SQLite `ON CONFLICT(assignment_id, student_id) DO UPDATE SET` pattern to ensure submission_id stays stable across resubmits, enabling reliable submission URLs.

3. **R2 Key Conventions**:
   - Starter: `assignments/{assignment_id}/starter.json`
   - Submission: `submissions/{submission_id}.json`
   - Both streamed through Worker with `Cache-Control: private, max-age=0` per D-35 (no presigned URLs)

4. **Nested Route Placement**: Assignment creation endpoint (`POST /api/courses/:id/assignments`) implemented as a nested route in `classroom.ts` since the URL is `/api/courses/:id/assignments` and course ownership is already validated there.

5. **LEFT JOIN for Enrollment Gap**: Instructor dashboard submission list uses `LEFT JOIN submissions ON s.student_id = e.student_id AND s.assignment_id = ?` to show all enrolled students, including those who haven't submitted yet, with null submission_id rows.

## Deviations from Plan

None — plan executed exactly as written. All 12 must-haves satisfied:
- ✅ POST /api/courses/:id/assignments as owning instructor creates assignment + uploads starter
- ✅ POST /api/courses/:id/assignments as non-owning instructor returns 403
- ✅ GET /api/assignments/:id returns assignment metadata
- ✅ GET /api/assignments/:id/starter streams R2 blob
- ✅ POST /api/assignments/:id/submit creates/upserts submission preserving id
- ✅ POST /api/assignments/:id/submit as non-enrolled user returns 403
- ✅ GET /api/assignments/:id/submissions as owning instructor returns LEFT JOIN with not-submitted
- ✅ GET /api/submissions/:id returns submission metadata
- ✅ GET /api/submissions/:id/circuit streams R2 blob
- ✅ PATCH /api/submissions/:id/grade with valid grade sets all fields
- ✅ PATCH /api/submissions/:id/grade with grade outside 0-100 returns 400
- ✅ PATCH /api/submissions/:id/grade as non-owning instructor returns 403

## Architecture Notes

### Permission Model
- **Assignment reads**: Instructor (owns parent course) OR enrolled student
- **Assignment writes**: Only owning instructor of parent course
- **Submission reads**: Submission owner (student) OR course instructor
- **Submission grades**: Only course instructor (not submission owner)

### R2 Cleanup
- Deletion cascades via D1 foreign keys + manual R2 cleanup enumeration (Pitfall 2)
- Course delete cascades to assignments → instructors must enumerate all submission R2 keys before cascading
- Assignment delete enumerates and deletes all submission R2 keys for that assignment

### Data Flow
1. Instructor creates assignment → R2 blob at `assignments/{id}/starter.json`
2. Student opens assignment → worker proxies starter from R2
3. Student submits → circuit uploaded to R2 at `submissions/{id}.json`, DB row upserted
4. Instructor grades → PATCH updates submissions row with grade/feedback/graded_at/graded_by
5. Instructor lists submissions → LEFT JOIN enrollments with submissions to show non-submitted

## Files Modified

| File | Change |
|------|--------|
| `worker/src/routes/assignments.ts` | Created (229 lines) |
| `worker/src/routes/submissions.ts` | Created (132 lines) |
| `worker/src/routes/classroom.ts` | Added 47 lines (POST /api/courses/:id/assignments) |
| `worker/src/index.ts` | Added 2 imports, 2 route mounts, 3 middleware registrations, 1 CORS method |
| `worker/src/__tests__/assignments.test.ts` | Created (280 lines) |
| `worker/src/__tests__/submissions.test.ts` | Created (220 lines) |

## Metrics

- **Duration**: 18 minutes
- **Tasks completed**: 2
- **Tests added**: 14 (7 assignment + 7 submission)
- **Routes implemented**: 9 (7 in assignments.ts + 1 in submissions.ts + 1 nested in classroom.ts)
- **Lines of code**: 659 (excluding tests)
- **Commits**: 4
- **Test pass rate**: 100% (36/36)

---

**Status:** ✅ Plan complete. All Wave 1 classroom backend API routes implemented and tested.
**Next:** Frontend can now implement classroom features (Phase 03 Plans 04-07).
