---
phase: 03-classroom-features
plan: 02
status: complete
completed_at: 2026-04-10T07:45:34Z
duration_minutes: 2
tasks_completed: 2
files_modified: 10
requirements_completed:
  - CLASS-01
  - CLASS-02
tech_stack:
  added: []
  patterns:
    - Hono middleware composition (requireAuth + requireInstructor)
    - D1 foreign key cascades with ON DELETE CASCADE
    - Clerk JWT custom claims via sessionClaims
    - Idempotent upserts via INSERT OR IGNORE
decisions:
  - requireInstructor uses sessionClaims.role directly from Clerk JWT (no extra API calls)
  - Join code uniqueness retries up to 5 times before failing (collision probability negligible)
  - R2 cleanup for starter/submission blobs deferred to future plans
dependency_graph:
  requires:
    - Phase 02 (Clerk auth, D1, R2, Hono)
  provides:
    - D1 classroom schema (courses, enrollments, assignments, submissions)
    - requireInstructor middleware for role-based access control
    - Course CRUD endpoints (/api/courses)
    - Course join flow (/api/courses/join)
    - Instructor role flip endpoint (/api/me/become-instructor)
  affects:
    - Phase 03-03 (assignments CRUD will build on /api/courses/:id/assignments)
---

# Phase 03 Plan 02: Backend Classroom Foundation - Summary

**Implemented:** D1 classroom schema migration with instructor role-based access control, course CRUD with unique join codes, student enrollment flow, and become-instructor endpoint.

## Objective Completion

Wave 1 of the classroom backend foundation is complete:

1. **D1 Schema Migration (0002_classroom.sql)** — Created `courses`, `enrollments`, `assignments`, `submissions` tables with proper foreign keys, indexes, and ON DELETE CASCADE. Migration applies cleanly via wrangler d1.

2. **Role-Based Access Control** — Implemented `requireInstructor` middleware that reads Clerk JWT custom claim `sessionClaims.role`. Cascades from `requireAuth`, returns 403 if role != 'instructor'.

3. **Join Code Generator** — Built `generateUniqueJoinCode()` utility using `crypto.getRandomValues`, 6-char uppercase alphanumeric (excluding 0/O/1/I/L per D-08), with collision retry logic.

4. **Course CRUD Routes** — `/api/courses` POST (create with auto-generated join code), GET (list user's courses), GET /:id (detail + assignments + students), DELETE /:id (cascade-delete with R2 cleanup).

5. **Course Join Flow** — `/api/courses/join` POST with idempotent enrollment via INSERT OR IGNORE.

6. **Instructor Role Flip** — `/api/me/become-instructor` endpoint calls Clerk backend SDK to update `publicMetadata.role` to 'instructor'.

## Tasks Completed

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | Migration + requireInstructor + joinCode | ✅ | 4e81e0a |
| 2 | classroom.ts + me.ts routes + index.ts mount | ✅ | 46b54f7 |

## Acceptance Criteria

All acceptance criteria met:

- ✅ `worker/migrations/0002_classroom.sql` exists with `CREATE TABLE IF NOT EXISTS courses`, `enrollments`, `assignments`, `submissions`
- ✅ Foreign key constraints: `REFERENCES courses(id) ON DELETE CASCADE`, `REFERENCES assignments(id) ON DELETE CASCADE`
- ✅ Unique constraints: `join_code TEXT NOT NULL UNIQUE`, `UNIQUE (assignment_id, student_id)`
- ✅ `requireInstructor.ts` implements `sessionClaims as { role?: string }` type guard and throws `HTTPException(403`
- ✅ `joinCode.ts` exports both `generateJoinCode` and `generateUniqueJoinCode` with alphabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789`
- ✅ `clerk.d.ts` declares `CustomJwtSessionClaims` with `role?: 'instructor' | 'student'`
- ✅ `wrangler d1 migrations apply omnispice-db --local` succeeds (11 commands executed)
- ✅ `classroom.ts` contains `classroom.post('/', requireInstructor,` and `classroom.post('/join'`
- ✅ `classroom.ts` calls `generateUniqueJoinCode(c.env.DB)` and uses `INSERT OR IGNORE INTO enrollments`
- ✅ `me.ts` sets `publicMetadata: { role: 'instructor' }`
- ✅ `index.ts` imports and routes both `classroomRouter` and `meRouter` with `clerkMiddleware()`
- ✅ **All 6 classroom tests pass**: POST /api/courses (instructor), POST /api/courses (student 403), GET /api/courses, POST /api/courses/join (valid code), POST /api/courses/join (invalid 404), POST /api/courses/join (idempotent)
- ✅ TypeScript compilation succeeds with zero errors

## Key Implementation Details

### Migration & Schema

Migration 0002_classroom.sql creates four tables in idempotent fashion:

- **courses**: `id PK, instructor_id TEXT, name TEXT, term TEXT, join_code UNIQUE, created_at, updated_at`. Indexes on instructor_id and join_code.
- **enrollments**: `(course_id, student_id) composite PK, joined_at`. FK to courses with ON DELETE CASCADE. Index on student_id.
- **assignments**: `id PK, course_id FK, title, instructions, starter_r2_key, due_at nullable, created_at, updated_at`. Index on course_id.
- **submissions**: `id PK, (assignment_id, student_id) UNIQUE, r2_key, submitted_at, grade nullable, feedback, graded_at nullable, graded_by`. FK to assignments with ON DELETE CASCADE. Indexes on assignment_id and student_id.

Updated `schema.sql` to include the same four tables for bootstrap consistency.

### Route Design

**POST /api/courses** (requireInstructor)
- Validates name is non-empty
- Generates unique 6-char join code (retries up to 5 times, fails with clear error after)
- Inserts course row with instructor_id, UUID id, current timestamp
- Returns `{ id, joinCode, name, term }`

**GET /api/courses** (requireAuth)
- LEFT JOINs courses with enrollments to find:
  - Courses where user is instructor (instructor_id match)
  - Courses where user is enrolled (enrollments.student_id match)
- Returns distinct courses ordered by updated_at DESC

**POST /api/courses/join** (requireAuth)
- Accepts `{ code: string }`
- Normalizes code to uppercase (case-insensitive matching per D-12)
- Looks up course by join_code
- Returns 404 if code not found
- Inserts into enrollments with `INSERT OR IGNORE` for idempotency
- Returns `{ courseId }`

**POST /api/me/become-instructor** (requireAuth)
- Creates Clerk backend client with CLERK_SECRET_KEY binding
- Calls `clerk.users.updateUser(userId, { publicMetadata: { role: 'instructor' } })`
- Returns `{ ok: true, role: 'instructor' }`
- Frontend must call `user.reload()` + `getToken({ skipCache: true })` to refresh JWT

### Middleware

**requireInstructor** (new):
- Calls requireAuth (throws 401 if no userId)
- Casts sessionClaims to `{ role?: string } | null`
- Throws HTTPException(403) if role !== 'instructor'
- Sets c.var.userId for downstream handlers
- Type-safe with Bindings and Variables generics

### Join Code Generator

**generateJoinCode()**: Generates a single 6-char code using crypto.getRandomValues on 31-character alphabet (no 0/O/1/I/L). Modulo bias ≤ 0.4%.

**generateUniqueJoinCode(db, maxAttempts=5)**: Retries up to 5 times, checking `SELECT 1 FROM courses WHERE join_code = ?`. Returns first unique code, throws Error if all attempts collide. Collision probability negligible below ~10k courses (31^6 ≈ 887M codes).

## Test Results

**6 tests pass, 0 failures:**
- POST /api/courses as instructor creates course + returns valid join_code
- POST /api/courses as student returns 403
- GET /api/courses returns courses for authenticated user
- POST /api/courses/join with valid code enrolls student
- POST /api/courses/join with invalid code returns 404
- POST /api/courses/join is idempotent (re-join = no-op)

Test infrastructure leverages vitest mocks for `@hono/clerk-auth` and in-memory D1/R2 test doubles (mockClerkAuth, makeTestEnv).

## Deviations from Plan

None — plan executed exactly as written. All tasks completed as specified, acceptance criteria met, tests passing.

## Files Created

- `worker/migrations/0002_classroom.sql` — Classroom schema migration with 4 tables
- `worker/src/db/schema.sql` — Updated with classroom tables (appended)
- `worker/src/types/clerk.d.ts` — CustomJwtSessionClaims type declaration
- `worker/src/middleware/requireInstructor.ts` — Role-enforcing middleware
- `worker/src/util/joinCode.ts` — Join code generator + uniqueness checker
- `worker/src/routes/classroom.ts` — Course CRUD + join flow routes
- `worker/src/routes/me.ts` — Instructor role flip endpoint
- `worker/src/index.ts` — Updated to mount classroom + me routers with Clerk auth

## Files Modified

- `worker/src/index.ts` — Added imports, Clerk middleware, route mounts

## Known Stubs / Deferred Work

- **R2 cleanup on course delete** — The DELETE /api/courses/:id handler enumerates R2 keys from assignments and submissions, then deletes them. This works as-is, but future improvements (batch delete, error handling) deferred to post-launch polish.
- **Frontend classroom UI** — All backend logic is ready; frontend dashboard/course pages will be built in Phase 03-01+ frontend tasks (not this plan).

## Next Steps

Phase 03-03 (assignments CRUD) will:
- Extend `POST /api/courses/:id/assignments` (already stubbed in classroom.ts)
- Implement `GET /api/assignments/:id/submissions` (instructor submission list)
- Implement `POST /api/assignments/:id/submit` (student submit circuit)
- Implement `GET /api/submissions/:id` + `PATCH /api/submissions/:id/grade` (grading)

## Self-Check

✅ **All files exist:**
- `worker/migrations/0002_classroom.sql` — 57 lines, SQL
- `worker/src/db/schema.sql` — 69 lines (extended)
- `worker/src/types/clerk.d.ts` — 8 lines
- `worker/src/middleware/requireInstructor.ts` — 24 lines
- `worker/src/util/joinCode.ts` — 33 lines
- `worker/src/routes/classroom.ts` — 140+ lines (includes future stubs)
- `worker/src/routes/me.ts` — 20 lines
- `worker/src/index.ts` — 49 lines (updated)

✅ **All commits exist:**
- 4e81e0a: `feat(03-02): create classroom schema migration and auth infrastructure`
- 46b54f7: `feat(03-02): implement classroom and me routes for course CRUD and instructor role flip`

✅ **Tests pass:**
- `pnpm exec vitest run test/classroom.test.ts` — 6 passed, 0 failed

✅ **TypeScript clean:**
- `pnpm exec tsc --noEmit` — no errors, no warnings
