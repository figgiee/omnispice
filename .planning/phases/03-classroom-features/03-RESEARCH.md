# Phase 3: Classroom Features - Research

**Researched:** 2026-04-09
**Domain:** Full-stack classroom MVP (Clerk roles, Hono Worker routes, D1 schema with FKs, R2 blobs, TanStack Query, Zustand, markdown rendering, routing growth)
**Confidence:** HIGH (all gray areas locked in CONTEXT.md; research verified against Clerk, Hono, D1, TanStack Query official docs)

## Summary

Phase 3 layers a classroom MVP on top of the Phase 2 Clerk + D1 + R2 + Hono backbone. Every architectural choice is already locked in `03-CONTEXT.md` — this research document exists to (a) fill in the specific API details the planner needs (Clerk `publicMetadata` update path, Hono `createMiddleware`, D1 foreign-key behavior, TanStack Query v5 invalidation patterns), (b) make concrete recommendations in the areas marked "Claude's discretion" (markdown renderer, routing library, SubmissionViewer strategy), and (c) hand the planner a validation architecture that maps CLASS-01..05 to automated tests.

The dominant risk is **Clerk role propagation** — `publicMetadata` is writable only from the backend, and role changes don't appear in the Worker's `sessionClaims` until the client refreshes its JWT. Everything else is incremental work on proven Phase 2 patterns.

**Primary recommendation:** Follow Phase 2's R2-proxied Worker pattern verbatim. Surface the role via a Clerk JWT template custom claim (not an API round-trip). Use `marked` + `DOMPurify` for markdown. Keep the manual pathname router in `App.tsx` — 6 routes is still below the "introduce a router lib" threshold. `SubmissionViewer` should be a new component (not a variant prop on `SharedCircuitViewer`) because it needs a grading sidebar the shared viewer will never have.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Role Model**
- **D-01:** Roles stored in Clerk `publicMetadata.role: 'instructor' | 'student'`. Worker reads via Clerk JWT claim. Default on signup = `student`. "Become an Instructor" button in user menu flips the flag (no approval gate — pilot trust).
- **D-02:** Worker middleware `requireInstructor(c)` wraps `requireAuth` and throws 403 if role !== 'instructor'. Applied to all `/api/courses` and `/api/assignments` write routes.
- **D-03:** Frontend exposes role via `useRole()` reading `user.publicMetadata.role` from Clerk's `useUser()`. Dashboard branches on role.

**Data Model (D1 migration `0002_classroom.sql`)**
- **D-04:** `courses` — `id TEXT PK, instructor_id TEXT NOT NULL, name TEXT NOT NULL, term TEXT, join_code TEXT UNIQUE NOT NULL, created_at INTEGER, updated_at INTEGER`. Index on `instructor_id` and `join_code`.
- **D-05:** `enrollments` — `course_id TEXT, student_id TEXT, joined_at INTEGER, PRIMARY KEY (course_id, student_id)`. Index on `student_id`. FK to `courses(id)` ON DELETE CASCADE.
- **D-06:** `assignments` — `id TEXT PK, course_id TEXT NOT NULL, title TEXT NOT NULL, instructions TEXT, starter_r2_key TEXT NOT NULL, due_at INTEGER NULL, created_at INTEGER, updated_at INTEGER`. Index on `course_id`. FK to `courses` ON DELETE CASCADE.
- **D-07:** `submissions` — `id TEXT PK, assignment_id TEXT NOT NULL, student_id TEXT NOT NULL, r2_key TEXT NOT NULL, submitted_at INTEGER NOT NULL, grade INTEGER NULL, feedback TEXT NULL, graded_at INTEGER NULL, graded_by TEXT NULL, UNIQUE(assignment_id, student_id)`. Index on `assignment_id` and `student_id`. FK to `assignments` ON DELETE CASCADE.
- **D-08:** Join codes: 6-char uppercase alphanumeric excluding `0/O, 1/I/L`, generated via `crypto.getRandomValues` in Worker. Regenerate on collision. Stored uppercase, matched case-insensitively.

**R2 Keys**
- **D-09:** Starter → `assignments/{assignment_id}/starter.json` (copy-on-create).
- **D-10:** Submission → `submissions/{submission_id}.json` (overwrite on resubmit, no history).

**Enrollment**
- **D-11:** Instructor creates course → Worker generates `join_code` → shareable URL `/join/{CODE}`.
- **D-12:** `/join/{code}` → Clerk modal if logged out → `POST /api/courses/join` with `{ code }` → insert into `enrollments` → redirect. Idempotent.
- **D-13:** No email invites, no approval, no instructor-initiated enrollment.

**Assignment Authoring**
- **D-14:** Instructor creates assignment from course page. Modal: title, instructions (plain textarea, markdown rendered on student view), optional due date, starter circuit selector.
- **D-15:** Starter selection: (a) "Use current editor circuit" snapshot OR (b) "Upload from file" (.json or .asc via LTspice importer). Both serialize via `serializeCircuit()` and upload to `assignments/{id}/starter.json`.
- **D-16:** Editing starter after submissions is allowed but UI flags "N students submitted against previous starter." Not versioned.

**Student Workflow**
- **D-17:** Open assignment → fetch metadata → download starter → `deserializeCircuit()` → load editor → set `classroomStore` flags (`activeAssignmentId`, `activeSubmissionId`, `isSubmitted`).
- **D-18:** Classroom mode toolbar: instructions drawer, Submit button, Exit Assignment. Auto-save disabled.
- **D-19:** Submit → upload to R2 → `POST /api/assignments/:id/submit` → create/update row (UNIQUE constraint).
- **D-20:** Resubmit allowed after due. Late badge is `submitted_at > due_at`. No hard lock.
- **D-21:** After grade set, student sees grade + feedback, resubmit still technically allowed.

**Instructor Dashboard**
- **D-22:** Three levels: `/dashboard` (cards) → `/courses/:id` (Assignments + Students tabs) → `/assignments/:id` (submission table).
- **D-23:** Submission table: HTML `<table>`, sortable, filter chips (All / Ungraded / Graded / Late / Not submitted). "Not submitted" synthesized from enrollments left-join submissions.
- **D-24:** Clicking a row → `/submissions/:id` with read-only canvas + grading panel.

**Grading**
- **D-25:** Numeric grade (0–100, integer, nullable), feedback textarea (2000 char max), "Save Grade" → `PATCH /api/submissions/:id/grade` setting grade + feedback + graded_at + graded_by.
- **D-26:** No inline canvas annotations. "Open as Circuit" fork is a read-and-play tool, not grading.
- **D-27:** No rubrics, no weighted scoring.

**Routing**
- **D-28:** Extend manual pathname router in `src/App.tsx`. New routes: `/dashboard`, `/courses/:id`, `/assignments/:id`, `/submissions/:id`, `/join/:code`.
- **D-29:** Planner may introduce `wouter` (2KB) if complexity grows beyond ~6 routes. Default: stay manual.

**State**
- **D-30:** New Zustand slice `src/store/classroomStore.ts`: `{ activeCourse, activeAssignment, activeSubmission, isSubmitting, classroomMode }`. Does NOT hold list data.
- **D-31:** TanStack Query keys: `['courses']`, `['course', id]`, `['assignment', id]`, `['assignment', id, 'submissions']`, `['submission', id]`, `['mySubmission', assignmentId]`.
- **D-32:** Mutations invalidate relevant keys. Optimistic updates only for grade saves.

**Worker**
- **D-33:** Three new route files: `classroom.ts`, `assignments.ts`, `submissions.ts`.
- **D-34:** Permission matrix enforced in handlers (course write = owner; assignment write = parent course owner; submission create = enrolled student; submission read = owner OR course instructor; grade = course instructor).
- **D-35:** R2 always proxied through Worker, `Cache-Control: private, max-age=0` on submission responses.
- **D-36:** Migration `worker/migrations/0002_classroom.sql`.
- **D-37:** Clerk JWT = source of truth for role. No local users table.

**UX**
- **D-38/39:** Empty-state CTAs; no walkthrough.
- **D-40:** Due dates stored UTC, displayed via `toLocaleString()`. Late badge client-side.
- **D-41:** Delete requires typed-name confirmation. Cascades configured at DB level.

### Claude's Discretion
- Visual design of cards, table, grading panel (follow Phase 1/2 tokens).
- Markdown library (`marked` vs `markdown-it` vs custom) — **recommended below**.
- `SubmissionViewer` = new component or variant prop on `SharedCircuitViewer` — **recommended below**.
- Toast/notification reuse vs new — reuse Phase 2.
- Copy/labels.
- Test fixtures / seed data.

### Deferred Ideas (OUT OF SCOPE)
- Comparison mode (Phase 4 guided labs).
- Inline canvas annotations.
- Email notifications / invites.
- LMS integration / LTI / grade passback (Phase 4).
- Org/institution tenancy (Phase 4).
- Rubrics, weighted grading, multi-grader.
- Plagiarism detection.
- Real-time collab on submissions (Phase 5).
- Due-date auto-lock.
- Submission version history.
- CSV gradebook export.
- Instructor role approval gate.
- Bulk grading / keyboard shortcuts.
- Archive / term rollover.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLASS-01 | Instructor can create a course and invite students via link | `courses` table + `join_code` generator (D-04, D-08) + `/join/{code}` route (D-11, D-12). Clerk role gate via session JWT custom claim. |
| CLASS-02 | Instructor can create assignments with starter circuits and instructions | `assignments` table (D-06), starter copy-on-create to R2 (D-09, D-15), reuse `serializeCircuit` from `src/cloud/serialization.ts`, markdown rendering via `marked + DOMPurify`. |
| CLASS-03 | Student can submit a completed circuit to an assignment | `submissions` table with `UNIQUE(assignment_id, student_id)` (D-07), `POST /api/assignments/:id/submit` (D-19), `classroomStore` mode flag (D-17, D-30). |
| CLASS-04 | Instructor can view all student submissions | `GET /api/assignments/:id/submissions` (D-33), HTML table (D-23), left-join synthesizes "not submitted" rows, TanStack Query key `['assignment', id, 'submissions']` (D-31). |
| CLASS-05 | Instructor can annotate and grade student submissions | `PATCH /api/submissions/:id/grade` (D-25), grading panel on `/submissions/:id`, `SubmissionViewer` component with read-only canvas + sidebar. Phase 3 scope = numeric grade + textarea feedback; inline canvas annotations deferred (D-26). |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Package manager:** `pnpm` (never `npm`). Worker package has its own `pnpm install`.
- **Stack locked:** React 19, Vite 8, TypeScript 5.7+, `@xyflow/react` 12.10.x, `@tanstack/react-query` 5.96.x, Zustand 5.0.x, Hono 4.3+, Cloudflare D1 + R2 + Workers, Clerk.
- **Strict TypeScript** is mandatory — Claude-generated code must have no `any` leaks.
- **GSD workflow enforcement:** direct file edits outside a GSD command are forbidden.
- **No attribution:** never include "Co-Authored-By: Claude" or similar in commit messages or code comments.
- **Biome** is the lint + format tool (not ESLint / Prettier).
- **Testing:** Vitest for unit + integration; Playwright for E2E.
- **No SharedArrayBuffer / COOP-COEP.** Classroom routes must not introduce headers that would break iframe embeds in Phase 4 LMS work.

## Standard Stack

### Core (already installed — reuse verbatim)

| Library | Installed Version | Purpose | Why Standard |
|---------|------------------|---------|--------------|
| `@clerk/react` | 6.2.1 | Frontend auth, `useUser()`, role read | Already wired in Phase 2. v6 uses `<Show>` component for auth gating (not `<SignedIn>`). |
| `@clerk/backend` | 3.2.8 (worker) | Server-side Clerk API (needed if server-side `updateUser` required) | Already in worker deps. |
| `@hono/clerk-auth` | 3.1.1 | `clerkMiddleware()`, `getAuth()` — reads JWT claims in Worker | Phase 2 proved it works. `getAuth(c).sessionClaims` carries custom claims. |
| `hono` | 4.12.12 | Worker HTTP framework | Phase 2. Use `createMiddleware()` from `hono/factory` for `requireInstructor`. |
| `@tanstack/react-query` | 5.97.0 | Server state / caching / mutations | Phase 2 proven. v5 mutation + `invalidateQueries` pattern. |
| `zustand` | 5.0.12 | Client state slices | Phase 1/2 pattern: one store per domain. Add `classroomStore`. |
| `@xyflow/react` | 12.10.2 | Canvas (read-only mode for `SubmissionViewer`) | Same `nodesDraggable={false}` pattern as `SharedCircuitViewer`. |

### New (to add in Phase 3)

| Library | Version | Purpose | Why | Confidence |
|---------|---------|---------|-----|------------|
| `marked` | ^15.x | Markdown → HTML for assignment instructions | Fast, tiny, actively maintained. Does NOT sanitize — pair with DOMPurify. | HIGH |
| `dompurify` | ^3.2.x | XSS sanitizer | Industry standard. Run `DOMPurify.sanitize(marked.parse(md))` on every render. | HIGH |
| `@types/dompurify` | ^3.x | Types | DOMPurify ships without built-in types in older versions. | MEDIUM |

**Version verification step (planner must run before committing package.json):**
```bash
pnpm view marked version
pnpm view dompurify version
```
Training data for exact version numbers is stale. Confirm at install time.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `marked` | `markdown-it` | `markdown-it` is larger, more configurable, plugin ecosystem richer. For plain instructions with no math/diagrams, `marked` wins on size. Both require DOMPurify. |
| `marked + DOMPurify` | `react-markdown` | `react-markdown` is React-native and safer (no raw HTML by default), but pulls in `unified`, `remark`, `rehype` — larger bundle (~50KB) vs marked (~30KB) + dompurify (~20KB). Marginal win; stick with `marked` for consistency with rest of the stack which avoids React-specific wrappers. |
| Manual pathname router | `wouter` (2KB) | See "Routing growth decision" below. Recommendation: **stay manual** for Phase 3. |
| New `SubmissionViewer` | Variant prop on `SharedCircuitViewer` | See "SubmissionViewer strategy" below. Recommendation: **new component**. |

### Installation

```bash
pnpm add marked dompurify
pnpm add -D @types/dompurify
```

No worker-side additions — everything server-side is already in place.

## Architecture Patterns

### Recommended Project Structure (additions only)

```
src/
├── auth/
│   └── useRole.ts                     # new — reads publicMetadata.role
├── classroom/
│   ├── api.ts                         # fetch wrappers (mirror src/cloud/api.ts)
│   ├── hooks.ts                       # TanStack Query hooks
│   ├── types.ts                       # Course, Assignment, Submission types
│   └── __tests__/
│       └── api.test.ts
├── store/
│   └── classroomStore.ts              # new Zustand slice
├── components/
│   ├── dashboard/
│   │   └── ClassroomDashboard.tsx     # role-aware dashboard
│   ├── courses/
│   │   ├── CoursePage.tsx
│   │   ├── CourseCard.tsx
│   │   ├── CreateCourseModal.tsx
│   │   ├── JoinCoursePage.tsx
│   │   └── ShareJoinCodeBanner.tsx
│   ├── assignments/
│   │   ├── AssignmentPage.tsx          # student view — classroom mode wrapper
│   │   ├── CreateAssignmentModal.tsx
│   │   ├── InstructionsDrawer.tsx      # rendered markdown
│   │   └── SubmissionTable.tsx
│   ├── submissions/
│   │   ├── SubmissionViewer.tsx        # new — canvas + grading sidebar
│   │   └── GradingPanel.tsx
│   └── toolbar/
│       └── ClassroomToolbar.tsx        # classroom-mode toolbar wrapper
worker/
├── migrations/
│   └── 0002_classroom.sql              # CONTEXT.md D-04..D-07
└── src/
    ├── middleware/
    │   └── requireInstructor.ts        # new — wraps requireAuth
    ├── routes/
    │   ├── classroom.ts                 # /api/courses, /api/courses/join
    │   ├── assignments.ts               # /api/assignments + /api/courses/:id/assignments
    │   └── submissions.ts               # /api/submissions
    └── util/
        └── joinCode.ts                  # crypto.getRandomValues generator
```

### Pattern 1: Clerk Role via JWT Session Token Custom Claim (HIGH)

**Source:** Clerk docs — "Customize session token" + sessionClaims API.

The Clerk dashboard lets you add a custom claim to the session JWT. Set it up once in the dashboard under **Sessions → Customize session token**:

```json
{
  "role": "{{user.public_metadata.role}}"
}
```

After this is set, the Worker can read the role **from the JWT itself** — zero additional API calls:

```typescript
// worker/src/middleware/requireInstructor.ts
import { createMiddleware } from 'hono/factory';
import { getAuth } from '@hono/clerk-auth';
import { HTTPException } from 'hono/http-exception';

export const requireInstructor = createMiddleware(async (c, next) => {
  const auth = getAuth(c);
  if (!auth?.userId) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
  const role = (auth.sessionClaims as { role?: string } | null)?.role;
  if (role !== 'instructor') {
    throw new HTTPException(403, { message: 'Instructor role required' });
  }
  // Make userId available downstream without recalling requireAuth
  c.set('userId', auth.userId);
  await next();
});
```

**Critical gotcha:** session token size is capped at 4KB total; custom claims share a ~1.2KB budget. A single `role` string (`'student'` or `'instructor'`) is ~20 bytes — well within budget. Do not stuff the full `publicMetadata` object into the JWT.

**TypeScript declaration** (add to `src/types/clerk.d.ts` or similar):
```typescript
declare global {
  interface CustomJwtSessionClaims {
    role?: 'instructor' | 'student';
  }
}
export {};
```

**Role flip flow (D-01 "Become an Instructor" button):**
`publicMetadata` is **not writable from the frontend** — it must be set by the backend. Two viable approaches:

1. **Worker endpoint approach (recommended for Phase 3):** Add `POST /api/me/become-instructor` that calls the Clerk Backend SDK to set `publicMetadata.role = 'instructor'`:

   ```typescript
   // worker/src/routes/me.ts
   import { createClerkClient } from '@clerk/backend';

   me.post('/become-instructor', async (c) => {
     const auth = getAuth(c);
     if (!auth?.userId) throw new HTTPException(401);
     const clerk = createClerkClient({ secretKey: c.env.CLERK_SECRET_KEY });
     await clerk.users.updateUser(auth.userId, {
       publicMetadata: { role: 'instructor' },
     });
     return c.json({ ok: true });
   });
   ```

2. **Webhook approach (deferred):** Listen for `user.created` and default role to `'student'`. Over-engineering for Phase 3; the app can read `role ?? 'student'` on the frontend and fall through.

**Post-update propagation:** After `updateUser`, the **client must force-refresh its JWT** to pick up the new claim. Clerk's `useAuth().getToken({ skipCache: true })` achieves this. Expose as a helper:

```typescript
// src/auth/useRole.ts
import { useUser, useAuth } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';

export function useRole() {
  const { user } = useUser();
  const role = (user?.publicMetadata?.role as 'instructor' | 'student' | undefined) ?? 'student';
  return role;
}

export function useBecomeInstructor() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return async () => {
    // POST to /api/me/become-instructor (which calls updateUser server-side)
    const token = await getToken();
    await fetch(`${import.meta.env.VITE_API_URL}/api/me/become-instructor`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    // Reload publicMetadata from Clerk + force a new JWT
    await user?.reload();
    await getToken({ skipCache: true });
    // Invalidate all classroom-dependent queries
    queryClient.invalidateQueries({ queryKey: ['courses'] });
  };
}
```

### Pattern 2: Hono `createMiddleware` composition (HIGH)

**Source:** Hono 4 docs — Guides → Middleware + Helpers → Factory.

Use `createMiddleware` from `hono/factory` rather than plain async functions. It gives proper typing for `c.set` / `c.var` variables and composes cleanly with `app.use()`:

```typescript
// Applied per-route-group
app.use('/api/courses/*', clerkMiddleware());
const courses = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();

// Write routes require instructor
courses.post('/', requireInstructor, async (c) => {
  const userId = c.get('userId'); // set by requireInstructor
  // ... create course
});

// Read routes require only auth
courses.get('/', async (c) => {
  const userId = requireAuth(c); // existing helper, from Phase 2
  // ...
});
```

**Middleware stacking order** matters. Hono runs middleware in the order you register it. `clerkMiddleware()` must come first (populates `getAuth(c)`), then `requireAuth` / `requireInstructor`, then the handler.

**403 vs throwing HTTPException:** Phase 2's `requireAuth` throws `HTTPException(401)`. For consistency, `requireInstructor` should also throw `HTTPException(403)`. Hono's default error handler converts these to proper responses; no custom error handler needed.

### Pattern 3: D1 foreign keys with ON DELETE CASCADE (HIGH)

**Source:** Cloudflare D1 docs — SQL API → Foreign keys.

D1 **enforces foreign keys by default** — there is no need to issue `PRAGMA foreign_keys = on`. It behaves as if that pragma is set at the start of every transaction.

**Migration file format** (matching Phase 2's `0001_create_circuits.sql` style — plain SQL, idempotent where possible):

```sql
-- worker/migrations/0002_classroom.sql
-- OmniSpice classroom schema (Phase 3)
-- Run via: wrangler d1 migrations apply omnispice-db --local

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  instructor_id TEXT NOT NULL,
  name TEXT NOT NULL,
  term TEXT,
  join_code TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_courses_instructor_id ON courses(instructor_id);
CREATE INDEX IF NOT EXISTS idx_courses_join_code ON courses(join_code);

CREATE TABLE IF NOT EXISTS enrollments (
  course_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (course_id, student_id),
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON enrollments(student_id);

CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  title TEXT NOT NULL,
  instructions TEXT,
  starter_r2_key TEXT NOT NULL,
  due_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_assignments_course_id ON assignments(course_id);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  submitted_at INTEGER NOT NULL,
  grade INTEGER,
  feedback TEXT,
  graded_at INTEGER,
  graded_by TEXT,
  UNIQUE (assignment_id, student_id),
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON submissions(student_id);
```

**Migration apply:**
```bash
cd worker
pnpm exec wrangler d1 migrations apply omnispice-db --local   # local dev
pnpm exec wrangler d1 migrations apply omnispice-db --remote  # production
```

**Cascade behavior verification:** deleting a `courses` row will cascade to `enrollments`, `assignments`, and transitively `submissions`. **R2 blobs do NOT cascade** — the delete handler must manually enumerate R2 keys (assignment starters + submission blobs for every assignment in the course) and call `CIRCUIT_BUCKET.delete(key)` before the `DELETE FROM courses`. This is a non-obvious correctness trap — see Pitfall 3 below.

### Pattern 4: TanStack Query v5 invalidation + optimistic updates (HIGH)

**Source:** Phase 2 `02-04-PLAN.md` + TanStack Query v5 docs.

**Query key hierarchy** (matches D-31):
```typescript
// src/classroom/hooks.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useCourses() {
  const { getToken, isSignedIn } = useCurrentUser();
  return useQuery({
    queryKey: ['courses'],
    queryFn: () => listCourses(getToken),
    enabled: isSignedIn,
    staleTime: 30_000,
  });
}

export function useAssignment(assignmentId: string) {
  const { getToken } = useCurrentUser();
  return useQuery({
    queryKey: ['assignment', assignmentId],
    queryFn: () => getAssignment(assignmentId, getToken),
    enabled: !!assignmentId,
  });
}

// Optimistic grade update (D-32)
export function useSaveGrade(submissionId: string, assignmentId: string) {
  const { getToken } = useCurrentUser();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: { grade: number; feedback: string }) =>
      saveGrade(submissionId, input, getToken),
    onMutate: async (input) => {
      // Cancel in-flight list refetch
      await qc.cancelQueries({ queryKey: ['assignment', assignmentId, 'submissions'] });
      const previous = qc.getQueryData<Submission[]>(['assignment', assignmentId, 'submissions']);
      if (previous) {
        qc.setQueryData<Submission[]>(
          ['assignment', assignmentId, 'submissions'],
          previous.map((s) =>
            s.id === submissionId ? { ...s, grade: input.grade, feedback: input.feedback } : s
          )
        );
      }
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(['assignment', assignmentId, 'submissions'], ctx.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['assignment', assignmentId, 'submissions'] });
      qc.invalidateQueries({ queryKey: ['submission', submissionId] });
    },
  });
}
```

**Invalidation map** (each mutation lists which keys to invalidate `onSettled`):

| Mutation | Invalidates |
|----------|-------------|
| `createCourse` | `['courses']` |
| `joinCourse` | `['courses']` |
| `deleteCourse` | `['courses']`, `['course', id]` |
| `createAssignment` | `['course', courseId]` |
| `updateAssignment` | `['course', courseId]`, `['assignment', id]` |
| `deleteAssignment` | `['course', courseId]`, `['assignment', id]` |
| `submitAssignment` | `['mySubmission', assignmentId]`, `['assignment', assignmentId, 'submissions']` |
| `saveGrade` | `['submission', id]`, `['assignment', assignmentId, 'submissions']` (also optimistic) |

### Pattern 5: R2 proxy through Worker (mirrors Phase 2 circuit blob pattern)

**Source:** `worker/src/routes/circuits.ts` lines 49–65 (GET `:id`) and 107+.

Phase 2's canonical pattern for streaming an R2 blob back to the client through an auth boundary:

```typescript
// Load starter circuit for an assignment (any enrolled student OR owning instructor)
assignments.get('/:id/starter', async (c) => {
  const userId = requireAuth(c);
  const { id } = c.req.param();

  const row = await c.env.DB.prepare(
    `SELECT a.starter_r2_key, a.course_id, c.instructor_id
     FROM assignments a JOIN courses c ON c.id = a.course_id
     WHERE a.id = ?`
  ).bind(id).first<{ starter_r2_key: string; course_id: string; instructor_id: string }>();

  if (!row) return c.json({ error: 'Not found' }, 404);

  // Permission: instructor of course OR enrolled student
  const isInstructor = row.instructor_id === userId;
  if (!isInstructor) {
    const enrolled = await c.env.DB.prepare(
      'SELECT 1 FROM enrollments WHERE course_id = ? AND student_id = ?'
    ).bind(row.course_id, userId).first();
    if (!enrolled) return c.json({ error: 'Forbidden' }, 403);
  }

  const obj = await c.env.CIRCUIT_BUCKET.get(row.starter_r2_key);
  if (!obj) return c.json({ error: 'Circuit data missing' }, 500);

  return new Response(obj.body as ReadableStream, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, max-age=0', // D-35 — never cache submission/starter blobs publicly
    },
  });
});
```

**Reuse exactly:** `c.env.CIRCUIT_BUCKET` — same R2 bucket as Phase 2; the key prefix (`assignments/...`, `submissions/...`) distinguishes classroom blobs from user-saved circuits. Do **not** introduce a new R2 bucket binding.

### Pattern 6: Join code generator (HIGH)

**Source:** Web Crypto API (`crypto.getRandomValues`) + Cloudflare Workers runtime (native support).

```typescript
// worker/src/util/joinCode.ts
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // excludes 0, O, 1, I, L
const CODE_LENGTH = 6;

/** Generate a single 6-char join code. */
export function generateJoinCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

/** Generate a code guaranteed to be unique in the courses table. */
export async function generateUniqueJoinCode(
  db: D1Database,
  maxAttempts = 5
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateJoinCode();
    const existing = await db
      .prepare('SELECT 1 FROM courses WHERE join_code = ?')
      .bind(code)
      .first();
    if (!existing) return code;
  }
  throw new Error('Failed to generate unique join code after 5 attempts');
}
```

**Alphabet entropy:** 31 chars ^ 6 = ~887M codes. Collision probability remains negligible below ~10k active courses. `maxAttempts = 5` gives astronomical safety margin.

**Bias note:** `bytes[i] % 31` introduces a tiny modulo bias because 256 is not divisible by 31. For join codes (not cryptographic tokens), this is acceptable — the bias is ≤ 0.4% and does not affect uniqueness guarantees. Document the tradeoff in a comment.

**Case-insensitive matching on join (D-08):**
```typescript
const code = body.code.trim().toUpperCase();
await db.prepare('SELECT id FROM courses WHERE join_code = ?').bind(code).first();
```

### Pattern 7: Per-row authorization helper

**Source:** Phase 2 `requireAuth` pattern + standard Hono.

For the more complex permission checks in the matrix (D-34), use small local helpers inside each route file rather than a monolithic guard:

```typescript
// worker/src/routes/submissions.ts
async function assertCanReadSubmission(
  c: Context<{ Bindings: Bindings }>,
  submissionId: string,
  userId: string
): Promise<{ submission: SubmissionRow; course: { instructor_id: string; id: string } }> {
  const row = await c.env.DB.prepare(`
    SELECT s.*, a.course_id, c.instructor_id
    FROM submissions s
    JOIN assignments a ON a.id = s.assignment_id
    JOIN courses c ON c.id = a.course_id
    WHERE s.id = ?
  `).bind(submissionId).first<SubmissionRow & { course_id: string; instructor_id: string }>();

  if (!row) throw new HTTPException(404, { message: 'Not found' });

  const isOwner = row.student_id === userId;
  const isInstructor = row.instructor_id === userId;
  if (!isOwner && !isInstructor) {
    throw new HTTPException(403, { message: 'Forbidden' });
  }
  return { submission: row, course: { instructor_id: row.instructor_id, id: row.course_id } };
}
```

The join-in-one-query pattern avoids a roundtrip per authorization layer and is the standard D1 approach (D1 is optimized for in-transaction JOINs).

### Pattern 8: Markdown rendering (marked + DOMPurify)

**Source:** marked README + DOMPurify docs. Marked does NOT sanitize; pairing with DOMPurify is the documented pattern.

```typescript
// src/components/assignments/InstructionsDrawer.tsx
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useMemo } from 'react';

interface Props {
  markdown: string;
}

export function RenderedInstructions({ markdown }: Props) {
  const html = useMemo(
    () => DOMPurify.sanitize(marked.parse(markdown, { async: false }) as string),
    [markdown]
  );
  return (
    <div
      className="instructions-body"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized by DOMPurify
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
```

**Configuration:**
- `marked.parse(md, { async: false })` — forces sync return. Marked v15 defaults to async; TypeScript return type is `string | Promise<string>` unless `async: false` is set.
- DOMPurify default profile strips `<script>`, inline event handlers, `javascript:` URLs — all the standard XSS vectors. No custom config needed for Phase 3.

**Bundle impact:**
- `marked` ~30KB min + gz ~10KB
- `dompurify` ~60KB min + gz ~20KB
- Total ~30KB gzipped — acceptable for a classroom-only feature that doesn't affect the critical editor path.

### Anti-Patterns to Avoid

- **Storing role in the database and querying it per request** — The Clerk JWT custom claim eliminates the extra DB call. Falling back to a local `users` table is explicitly rejected by D-37.
- **Presigned R2 URLs** — D-35 forbids them; all R2 access goes through the Worker.
- **Calling `clerk.users.updateUser` from the frontend** — `publicMetadata` is backend-only. Always go through a Worker endpoint.
- **Treating `user.publicMetadata` as fresh after `updateUser`** — Must call `user.reload()` + `getToken({ skipCache: true })` to propagate.
- **Relying on D1 cascade to clean up R2** — R2 is a separate service. Enumerate R2 keys before deleting D1 parent rows.
- **Async markdown parsing in render** — `marked` v15 returns a Promise by default. Use `{ async: false }` or you'll render `[object Promise]`.
- **Using `SignedIn`/`SignedOut`** — Removed in `@clerk/react` v6. Use `<Show>` component or a `useUser().isSignedIn` check (Phase 2 decision, documented in STATE.md).
- **`edges={[]}` on the submission viewer** — same bug Phase 2 hit on `SharedCircuitViewer`. Always pass `circuitToEdges(circuit)`.
- **Synthesizing "not submitted" rows on the frontend** — do it in SQL via `LEFT JOIN`, otherwise pagination and filtering break.
- **Catching the `HTTPException` in middleware** — let Hono's default handler convert it. Catching it and returning `c.json(...)` loses status code fidelity.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT parsing / verification | Custom base64 decoder | `@hono/clerk-auth` `getAuth(c)` (already installed) | Clerk handles signature verification, expiry, audience. Rolling your own = CVE waiting to happen. |
| Role update to Clerk | Custom REST call to Clerk API | `@clerk/backend` `createClerkClient` | Backend SDK handles auth, retries, typing. |
| Markdown → HTML | Regex replacer for `**bold**` / `# heading` | `marked` | Every custom markdown parser misses edge cases (nested lists, code fences, links with parens). |
| HTML sanitization | `.replace(/<script>/g, '')` | `DOMPurify` | There are 100+ XSS vectors. DOMPurify is audited by the XSS research community. |
| Random code generation | `Math.random().toString(36)` | `crypto.getRandomValues` | `Math.random` is predictable and 48-bit; attackers can enumerate codes. |
| Per-user DB rows for enrollment lookup | Serialized JSON blob in a `user_classes` column | Normalized `enrollments` table with composite PK | JSON-in-cell breaks indexes, breaks joins, breaks foreign keys. |
| Submission conflict handling | "Check exists → insert" pattern | `UNIQUE(assignment_id, student_id)` + `ON CONFLICT DO UPDATE` | Race condition on concurrent submits. Let SQLite handle it atomically. |
| Router for 6 routes | `react-router-dom` (40KB) | Manual `window.location.pathname` match OR `wouter` (2KB) | See routing decision below. |
| Read-only canvas | New canvas component from scratch | Reuse `nodeTypes`, `edgeTypes`, `circuitToNodes`, `circuitToEdges` from `src/canvas/` | Phase 2 already extracted these into `src/canvas/circuitToFlow.ts`. |
| Toast notifications | New library | Whatever Phase 2 UI shell uses (likely inline state in `SaveButton`) | Consistency. |
| File upload for starter circuit | Multipart form data parsing | Reuse `FileReader` → `JSON.parse` (for .json) or LTspice importer (for .asc) — both client-side | Phase 2's `ImportMenu` already does this. |

**Key insight:** Phase 3 is "glue work, not new infra." Almost every wheel has already been invented — by Phase 2, by Clerk, by Hono, by D1. The planner's job is routing, wiring, and data-model discipline, not library selection.

## Runtime State Inventory

> This phase is additive (new tables, new routes, new components). No rename, no refactor, no migration of existing data. Nothing to inventory.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — verified by checking D1 schema (only `circuits` table exists) and R2 prefix use (only `circuits/` prefix). Phase 3 adds fresh tables and fresh R2 prefixes. | None |
| Live service config | None — Clerk dashboard requires ONE new change: the JWT session-token custom claim `role: {{user.public_metadata.role}}`. This is a dashboard config change, not code. **Planner must include a manual "Clerk dashboard setup" task** in Wave 0 before Worker code can verify role. | Manual Clerk dashboard step documented in plan |
| OS-registered state | None | None |
| Secrets / env vars | `CLERK_SECRET_KEY` already provisioned in Phase 2 — reused. `VITE_API_URL` already set. No new secrets. | None |
| Build artifacts | None — no package renames, no path changes. | None |

**Nothing found** in most categories, but the Clerk dashboard JWT template is a live-service config change and must be called out as an explicit task with a verification step (login as a test user, inspect the JWT at jwt.io, confirm `role` claim is present).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Cloudflare D1 | All data | ✓ (Phase 2) | existing | — |
| Cloudflare R2 | Starter / submission blobs | ✓ (Phase 2) | existing | — |
| Clerk session-token custom claim | Role enforcement in Worker | ⚠ Must be set manually in Clerk dashboard | dashboard config | Temporary: read `publicMetadata` via `clerk.users.getUser(userId)` in Worker (extra API call per request — only if dashboard step is blocked) |
| `marked` package | Markdown rendering | ✗ | — | `pnpm add marked` |
| `dompurify` package | XSS sanitization | ✗ | — | `pnpm add dompurify` + `@types/dompurify` |
| `@clerk/backend` | Role flip endpoint | ✓ | 3.2.8 | — |
| `wrangler d1 migrations apply` | Apply 0002 migration | ✓ (Phase 2) | 4.81.1 | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** `marked` and `dompurify` — install via pnpm. Clerk JWT template — fall back to per-request `getUser` API call if dashboard access is blocked.

## Common Pitfalls

### Pitfall 1: Role claim stale in JWT after `publicMetadata` update

**What goes wrong:** Instructor clicks "Become an Instructor." Server updates `publicMetadata`. User's JWT is still cached with `role: 'student'`. Worker returns 403 on the next "Create Course" call. User is confused.

**Why it happens:** JWTs are cached by Clerk's frontend. `publicMetadata` changes do not automatically invalidate the JWT.

**How to avoid:** After the server call succeeds, call `user.reload()` AND `getToken({ skipCache: true })` on the client to force a JWT refresh before enabling instructor UI.

**Warning signs:** 403 immediately after role flip; `role` claim missing in JWT inspected at jwt.io.

### Pitfall 2: D1 FK cascade does NOT cover R2 blobs

**What goes wrong:** Instructor deletes a course. D1 cascades delete `enrollments → assignments → submissions`. But the R2 bucket still holds `assignments/.../starter.json` and `submissions/....json` for every cascaded row — orphaned forever, accruing storage cost.

**Why it happens:** R2 is a separate service; D1 has no hook to delete external resources.

**How to avoid:** Before issuing `DELETE FROM courses WHERE id = ?`, enumerate R2 keys via a SELECT join, batch-delete them via `CIRCUIT_BUCKET.delete(key)`, then issue the D1 delete. Example:

```typescript
// Before DELETE FROM courses
const blobsToDelete = await c.env.DB.prepare(`
  SELECT starter_r2_key AS key FROM assignments WHERE course_id = ?
  UNION ALL
  SELECT s.r2_key FROM submissions s
    JOIN assignments a ON a.id = s.assignment_id
    WHERE a.course_id = ?
`).bind(courseId, courseId).all<{ key: string }>();

await Promise.all(
  blobsToDelete.results.map((row) => c.env.CIRCUIT_BUCKET.delete(row.key))
);
// Now safe to delete course
```

**Warning signs:** R2 storage cost climbs linearly even after courses are deleted.

### Pitfall 3: Submission UNIQUE constraint collides with resubmit

**What goes wrong:** Student submits once. Row inserted. Student clicks Submit again. INSERT fails with `SQLITE_CONSTRAINT_UNIQUE` because `UNIQUE(assignment_id, student_id)` blocks a second row.

**Why it happens:** D-20 allows resubmission, but the schema UNIQUE constraint rejects the second row.

**How to avoid:** Use `INSERT ... ON CONFLICT(assignment_id, student_id) DO UPDATE SET ...`:

```sql
INSERT INTO submissions (id, assignment_id, student_id, r2_key, submitted_at)
VALUES (?, ?, ?, ?, ?)
ON CONFLICT(assignment_id, student_id) DO UPDATE SET
  r2_key = excluded.r2_key,
  submitted_at = excluded.submitted_at,
  -- IMPORTANT: do NOT clear grade/feedback on resubmit; let instructor re-grade if they choose
  graded_at = graded_at,
  graded_by = graded_by
;
```

**Also:** Use the existing `id` when updating (SELECT first), OR accept that the `id` in D-07 may change on resubmit (bad — breaks `/submissions/:id` URLs). Recommendation: SELECT existing ID first, use UPSERT with preserved ID, overwrite R2 at `submissions/{existingId}.json`.

**Warning signs:** "UNIQUE constraint failed" error on the second submit.

### Pitfall 4: Markdown rendered as `[object Promise]`

**What goes wrong:** Planner uses `marked.parse(md)` without options; marked v15 returns a Promise. `DOMPurify.sanitize(promise)` coerces to string → `[object Promise]` in the UI.

**How to avoid:** Always pass `{ async: false }` to `marked.parse`, or `await` it. For a synchronous React render path, `{ async: false }` is the right answer.

**Warning signs:** Instructions drawer shows "[object Promise]".

### Pitfall 5: Clerk session token size budget exceeded

**What goes wrong:** Planner also puts `publicMetadata.orgId`, `publicMetadata.institutionId`, etc. in the JWT template "for future Phase 4." Token grows past 4KB. Clerk auth starts failing intermittently.

**How to avoid:** JWT template contains `role` **only**. Nothing else. ~20 bytes. Phase 4 concerns stay in Phase 4.

**Warning signs:** Clerk auth breaks after expanding JWT template; browser logs "cookie too large."

### Pitfall 6: Manual router regex breaks on trailing slash

**What goes wrong:** `/join/ABC123/` (trailing slash) doesn't match `^/join/([A-Z0-9]+)$`. User gets 404 from the frontend.

**How to avoid:** Either normalize trailing slashes before matching, or anchor with `^/join/([A-Z0-9]+)/?$`. Same fix for all new routes.

**Warning signs:** Sporadic 404s from users who typed URLs with trailing slashes.

### Pitfall 7: Permission check race on submission read

**What goes wrong:** `GET /api/submissions/:id` first checks ownership, then separately fetches the blob. Between the two queries, a student un-enrolls — permission check passes, blob read happens anyway.

**How to avoid:** Single JOIN query that returns both the permission fields and the R2 key in one shot. Phase 2's `circuits.ts` GET `:id` already does this. Mirror exactly.

## Code Examples

### Creating a course (Hono + D1 + join-code generator)

```typescript
// worker/src/routes/classroom.ts
import { Hono } from 'hono';
import { requireInstructor } from '../middleware/requireInstructor';
import { requireAuth } from '../middleware/auth';
import { generateUniqueJoinCode } from '../util/joinCode';
import type { Bindings } from '../index';

const classroom = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();

classroom.post('/', requireInstructor, async (c) => {
  const instructorId = c.get('userId');
  const body = await c.req.json<{ name: string; term?: string }>();
  const id = crypto.randomUUID();
  const joinCode = await generateUniqueJoinCode(c.env.DB);
  const now = Date.now();

  await c.env.DB.prepare(`
    INSERT INTO courses (id, instructor_id, name, term, join_code, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(id, instructorId, body.name, body.term ?? null, joinCode, now, now).run();

  return c.json({ id, joinCode, name: body.name, term: body.term });
});

classroom.get('/', async (c) => {
  const userId = requireAuth(c);
  // Return courses where user is either instructor OR enrolled student
  const { results } = await c.env.DB.prepare(`
    SELECT DISTINCT c.* FROM courses c
    LEFT JOIN enrollments e ON e.course_id = c.id
    WHERE c.instructor_id = ? OR e.student_id = ?
    ORDER BY c.updated_at DESC
  `).bind(userId, userId).all();
  return c.json(results);
});

classroom.post('/join', async (c) => {
  const studentId = requireAuth(c);
  const { code } = await c.req.json<{ code: string }>();
  const normalized = code.trim().toUpperCase();

  const course = await c.env.DB.prepare(
    'SELECT id FROM courses WHERE join_code = ?'
  ).bind(normalized).first<{ id: string }>();

  if (!course) return c.json({ error: 'Invalid code' }, 404);

  await c.env.DB.prepare(`
    INSERT OR IGNORE INTO enrollments (course_id, student_id, joined_at)
    VALUES (?, ?, ?)
  `).bind(course.id, studentId, Date.now()).run();

  return c.json({ courseId: course.id });
});

export { classroom as classroomRouter };
```

### Submitting an assignment (upsert pattern preserving ID)

```typescript
// worker/src/routes/assignments.ts
assignments.post('/:id/submit', async (c) => {
  const studentId = requireAuth(c);
  const assignmentId = c.req.param('id');
  const body = await c.req.json<{ circuit: string }>();

  // Verify enrollment in the parent course (single JOIN query)
  const context = await c.env.DB.prepare(`
    SELECT a.id AS assignment_id, a.course_id,
      (SELECT 1 FROM enrollments WHERE course_id = a.course_id AND student_id = ?) AS enrolled
    FROM assignments a WHERE a.id = ?
  `).bind(studentId, assignmentId).first<{ assignment_id: string; course_id: string; enrolled: number | null }>();

  if (!context) return c.json({ error: 'Not found' }, 404);
  if (!context.enrolled) return c.json({ error: 'Not enrolled' }, 403);

  // Find existing submission (preserve ID so URLs are stable)
  const existing = await c.env.DB.prepare(
    'SELECT id FROM submissions WHERE assignment_id = ? AND student_id = ?'
  ).bind(assignmentId, studentId).first<{ id: string }>();

  const submissionId = existing?.id ?? crypto.randomUUID();
  const r2Key = `submissions/${submissionId}.json`;
  const now = Date.now();

  await c.env.CIRCUIT_BUCKET.put(r2Key, body.circuit, {
    httpMetadata: { contentType: 'application/json' },
  });

  await c.env.DB.prepare(`
    INSERT INTO submissions (id, assignment_id, student_id, r2_key, submitted_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(assignment_id, student_id) DO UPDATE SET
      r2_key = excluded.r2_key,
      submitted_at = excluded.submitted_at
  `).bind(submissionId, assignmentId, studentId, r2Key, now).run();

  return c.json({ id: submissionId, submittedAt: now });
});
```

### Listing submissions with LEFT JOIN for "not submitted" rows

```typescript
assignments.get('/:id/submissions', requireInstructor, async (c) => {
  const instructorId = c.get('userId');
  const assignmentId = c.req.param('id');

  // Verify instructor owns parent course
  const ctx = await c.env.DB.prepare(`
    SELECT c.instructor_id, a.course_id FROM assignments a
    JOIN courses c ON c.id = a.course_id
    WHERE a.id = ?
  `).bind(assignmentId).first<{ instructor_id: string; course_id: string }>();
  if (!ctx || ctx.instructor_id !== instructorId) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Synthesize "not submitted" rows via LEFT JOIN from enrollments
  const { results } = await c.env.DB.prepare(`
    SELECT
      e.student_id,
      s.id AS submission_id,
      s.submitted_at,
      s.grade,
      s.feedback,
      s.graded_at,
      s.graded_by
    FROM enrollments e
    LEFT JOIN submissions s
      ON s.student_id = e.student_id AND s.assignment_id = ?
    WHERE e.course_id = ?
    ORDER BY s.submitted_at DESC NULLS LAST
  `).bind(assignmentId, ctx.course_id).all();

  return c.json(results);
});
```

### Frontend: extending the App.tsx pathname router

```typescript
// src/App.tsx
import { Layout } from './app/Layout';
import { SharedCircuitViewer } from './components/share/SharedCircuitViewer';
import { ClassroomDashboard } from './components/dashboard/ClassroomDashboard';
import { CoursePage } from './components/courses/CoursePage';
import { AssignmentPage } from './components/assignments/AssignmentPage';
import { SubmissionViewer } from './components/submissions/SubmissionViewer';
import { JoinCoursePage } from './components/courses/JoinCoursePage';
import { useOverlaySync } from './overlay/useOverlaySync';

function App() {
  useOverlaySync();
  const path = window.location.pathname;

  // /share/:token
  const shareMatch = path.match(/^\/share\/([a-zA-Z0-9_-]+)\/?$/);
  if (shareMatch?.[1]) return <SharedCircuitViewer token={shareMatch[1]} />;

  // /join/:code
  const joinMatch = path.match(/^\/join\/([A-Z0-9]+)\/?$/i);
  if (joinMatch?.[1]) return <JoinCoursePage code={joinMatch[1].toUpperCase()} />;

  // /dashboard
  if (path === '/dashboard' || path === '/dashboard/') return <ClassroomDashboard />;

  // /courses/:id
  const courseMatch = path.match(/^\/courses\/([a-zA-Z0-9-]+)\/?$/);
  if (courseMatch?.[1]) return <CoursePage courseId={courseMatch[1]} />;

  // /assignments/:id
  const assignmentMatch = path.match(/^\/assignments\/([a-zA-Z0-9-]+)\/?$/);
  if (assignmentMatch?.[1]) return <AssignmentPage assignmentId={assignmentMatch[1]} />;

  // /submissions/:id
  const submissionMatch = path.match(/^\/submissions\/([a-zA-Z0-9-]+)\/?$/);
  if (submissionMatch?.[1]) return <SubmissionViewer submissionId={submissionMatch[1]} />;

  return <Layout />;
}
```

## Recommended Discretionary Decisions

### 1. Markdown library: `marked` + `dompurify`

**Recommendation:** Use `marked` with `DOMPurify` sanitization. Reasons:
- Smallest bundle in the category (~30KB gzipped combined).
- `marked` is actively maintained; latest major version.
- DOMPurify is the industry-standard sanitizer; no React-specific wrapper needed.
- The React-specific `react-markdown` alternative pulls in `unified + remark + rehype` (~50KB), is slower, and adds a React-centric abstraction for a feature that only renders inside ONE drawer.

**Non-negotiable:** ALWAYS call `marked.parse(md, { async: false })`. Never pass user input directly to `dangerouslySetInnerHTML` without DOMPurify in between.

### 2. Routing: keep manual pathname router

**Recommendation:** Stay manual in `src/App.tsx`. Reasons:
- Phase 3 adds 5 new routes (dashboard, courses/:id, assignments/:id, submissions/:id, join/:code) for a total of 7.
- Each route is a simple regex against `window.location.pathname`, ~1 line each.
- No route nesting, no guards (auth state is handled inside each page component), no route-to-route data loading.
- Introducing `wouter` (2KB) is defensible but adds a new dependency for negligible gain at this scale.
- Phase 4 (LMS / LTI) may force a real router due to deep linking; defer that decision to Phase 4.

**Threshold for revisiting:** If Phase 3's scope grows past 10 routes, or if nested layouts emerge (e.g., a persistent classroom sidebar across `/courses/:id/*`), switch to `wouter` at that point.

### 3. `SubmissionViewer`: new component, not a variant prop

**Recommendation:** Create `src/components/submissions/SubmissionViewer.tsx` as a new component. Do NOT add a `variant` prop to `SharedCircuitViewer`. Reasons:
- `SharedCircuitViewer` has a specific purpose: anonymous read-only circuit viewing via a public token. Its auth model is "no auth required," its layout is "canvas fills screen with a minimal banner," and it has a forward-facing "Fork" CTA.
- `SubmissionViewer` has a different auth model (Bearer token + permission check), a different layout (canvas + grading sidebar), a different data source (`/api/submissions/:id/circuit`), and a different purpose (instructor grading workflow).
- Mashing them together via a `variant` prop creates a component with two mutually exclusive code paths — a classic maintenance trap.
- The **reusable pieces** are `nodeTypes`, `edgeTypes`, `circuitToNodes`, `circuitToEdges` from `src/canvas/circuitToFlow.ts`. Both components import these directly. That's the right kind of sharing — at the primitive level, not the component level.

**Exact files to touch for SubmissionViewer:**
- Create `src/components/submissions/SubmissionViewer.tsx` (canvas + layout)
- Create `src/components/submissions/GradingPanel.tsx` (sidebar; mutates via `useSaveGrade`)
- Import `nodeTypes` from `src/canvas/components/nodeTypes`
- Import `edgeTypes` from `src/canvas/edges/edgeTypes`
- Import `circuitToNodes`, `circuitToEdges` from `src/canvas/circuitToFlow`
- Import `deserializeCircuit` from `src/cloud/serialization`
- Use `useQuery({ queryKey: ['submission', id], ... })` for the fetch

### 4. Clerk auth gating component

**Recommendation:** Follow Phase 2's decision (per STATE.md) to use `@clerk/react` v6 `<Show>` component and `useUser().isSignedIn`. Do NOT use removed `<SignedIn>` / `<SignedOut>`.

### 5. Toast / notification reuse

**Recommendation:** Reuse Phase 2's inline success pattern (`setSavedBriefly` state + `setTimeout`) for Phase 3 mutations (grade saved, course created, etc.). Do not add a toast library. If the count of distinct notifications exceeds 6–8, revisit in Phase 4.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `<SignedIn>` / `<SignedOut>` components | `<Show>` component or `useUser().isSignedIn` check | `@clerk/react` v6 | Already adopted in Phase 2 — stay consistent. |
| `marked.parse(md)` sync default | `{ async: false }` required for sync | marked v15 | Must be explicit or render breaks. |
| `PRAGMA foreign_keys = ON` for SQLite | Automatic in D1 | D1 GA | No pragma needed; FKs always on. |
| Server-side JWT introspection via API call | JWT custom claim via session template | Clerk dashboard feature | Eliminates one API roundtrip per request. |
| `Math.random`-based codes | `crypto.getRandomValues` | always | `Math.random` is predictable; crypto.getRandomValues is the standard. |
| `react-router-dom` for SPAs | `wouter` or manual pathname matching | ecosystem shift | Full-featured router isn't needed for flat route tables. |

**Deprecated:**
- `@clerk/clerk-react` package (use `@clerk/react`) — already on the new package in this project.
- `SignedIn` / `SignedOut` JSX components in `@clerk/react` v6.

## Open Questions

1. **Does the Clerk free tier allow custom JWT templates / session-token customization?**
   - What we know: Custom claims via `user.public_metadata.role` are documented and supported.
   - What's unclear: Whether this feature is gated behind a paid plan in the current Clerk pricing.
   - Recommendation: Planner should have a fallback path ready (per-request `clerk.users.getUser(userId)` in the Worker) in case the JWT template requires a paid plan. One extra API call per protected request — acceptable for Phase 3 pilots.

2. **Should `graded_by` store the Clerk user ID or a denormalized name?**
   - What we know: Clerk user IDs are stable, opaque strings.
   - What's unclear: How the submission table UI displays "graded by X" — does it call Clerk to look up the name, or show the raw ID?
   - Recommendation: Store the user ID (stable FK-like string). For display, either (a) show "You" if it equals the current user, (b) show the first 8 chars of the ID, or (c) add a Worker endpoint that resolves IDs to names via `clerk.users.getUser`. Phase 3 scope: use option (a) — most grading happens by one instructor viewing their own grades.

3. **Collision probability math for join codes at scale?**
   - What we know: 31^6 = ~887M codes.
   - What's unclear: Whether the Phase 3 scope ever needs concurrent code generation at a rate that would force a different strategy.
   - Recommendation: The `maxAttempts = 5` retry loop handles realistic classroom scales (pilot = 5 professors, ~20 courses). Document `TODO(scale)`: revisit if active courses exceed 10k.

4. **Does Clerk's `user.reload()` reliably propagate `publicMetadata` changes?**
   - What we know: Docs describe `user.reload()` as refreshing the local user object.
   - What's unclear: How long JWT cache TTL is and whether `getToken({ skipCache: true })` is sufficient.
   - Recommendation: E2E test the role-flip flow explicitly. If propagation is unreliable, fall back to a hard page reload after the role flip API call.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1 (frontend + worker) + Playwright 1.59 (E2E) |
| Config files | `vitest.config.ts` (root, jsdom), `worker/vitest.config.ts` (node), `playwright.config.ts` |
| Quick run command | `pnpm test` (frontend) / `cd worker && pnpm exec vitest run` (worker) |
| Full suite command | `pnpm test && cd worker && pnpm exec vitest run && pnpm test:e2e` |
| Phase gate | Full suite green + Playwright Phase 3 E2E suite green before `/gsd:verify-work` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| **CLASS-01** | Instructor can create a course | unit (Worker) | `cd worker && pnpm exec vitest run src/__tests__/classroom.test.ts -t "creates course"` | ❌ Wave 0 |
| CLASS-01 | Join code is unique 6-char uppercase no-ambiguous | unit | `cd worker && pnpm exec vitest run src/__tests__/joinCode.test.ts` | ❌ Wave 0 |
| CLASS-01 | Student joins via `POST /api/courses/join` idempotently | unit (Worker) | `cd worker && pnpm exec vitest run src/__tests__/classroom.test.ts -t "joins course"` | ❌ Wave 0 |
| CLASS-01 | Non-instructor gets 403 on `POST /api/courses` | unit (Worker) | `cd worker && pnpm exec vitest run src/__tests__/classroom.test.ts -t "rejects student"` | ❌ Wave 0 |
| CLASS-01 | `/join/:code` E2E: visit → Clerk modal → redirect to course page | E2E | `pnpm test:e2e -- --grep "CLASS-01"` | ❌ Wave 0 |
| **CLASS-02** | Instructor creates assignment with starter | unit (Worker) | `cd worker && pnpm exec vitest run src/__tests__/assignments.test.ts -t "creates assignment"` | ❌ Wave 0 |
| CLASS-02 | Starter R2 blob written at `assignments/{id}/starter.json` | unit (Worker) | `cd worker && pnpm exec vitest run src/__tests__/assignments.test.ts -t "writes starter R2"` | ❌ Wave 0 |
| CLASS-02 | Markdown instructions render without XSS (dompurify strips `<script>`) | unit (frontend) | `pnpm test src/components/assignments/__tests__/InstructionsDrawer.test.tsx` | ❌ Wave 0 |
| CLASS-02 | E2E: instructor creates assignment → student sees it in assignment list | E2E | `pnpm test:e2e -- --grep "CLASS-02"` | ❌ Wave 0 |
| **CLASS-03** | Student submit creates submission row + R2 blob | unit (Worker) | `cd worker && pnpm exec vitest run src/__tests__/assignments.test.ts -t "submits"` | ❌ Wave 0 |
| CLASS-03 | Resubmit updates existing row (no UNIQUE violation) | unit (Worker) | `cd worker && pnpm exec vitest run src/__tests__/assignments.test.ts -t "resubmits"` | ❌ Wave 0 |
| CLASS-03 | Non-enrolled student gets 403 on submit | unit (Worker) | `cd worker && pnpm exec vitest run src/__tests__/assignments.test.ts -t "rejects non-enrolled"` | ❌ Wave 0 |
| CLASS-03 | `classroomStore` transitions to `classroomMode: 'student'` on open | unit (frontend) | `pnpm test src/store/__tests__/classroomStore.test.ts` | ❌ Wave 0 |
| CLASS-03 | E2E: student opens assignment → edits → submits → sees "Submitted" | E2E | `pnpm test:e2e -- --grep "CLASS-03"` | ❌ Wave 0 |
| **CLASS-04** | `GET /api/assignments/:id/submissions` returns all enrolled students (including "not submitted") | unit (Worker) | `cd worker && pnpm exec vitest run src/__tests__/assignments.test.ts -t "synthesizes not-submitted"` | ❌ Wave 0 |
| CLASS-04 | Non-owning instructor gets 403 | unit (Worker) | `cd worker && pnpm exec vitest run src/__tests__/assignments.test.ts -t "submission list permission"` | ❌ Wave 0 |
| CLASS-04 | Submission table filters by status | unit (frontend) | `pnpm test src/components/assignments/__tests__/SubmissionTable.test.tsx` | ❌ Wave 0 |
| CLASS-04 | E2E: instructor opens assignment → sees list of N submissions | E2E | `pnpm test:e2e -- --grep "CLASS-04"` | ❌ Wave 0 |
| **CLASS-05** | `PATCH /api/submissions/:id/grade` sets grade + feedback + graded_at + graded_by | unit (Worker) | `cd worker && pnpm exec vitest run src/__tests__/submissions.test.ts -t "saves grade"` | ❌ Wave 0 |
| CLASS-05 | Student (non-instructor) gets 403 on grade PATCH | unit (Worker) | `cd worker && pnpm exec vitest run src/__tests__/submissions.test.ts -t "rejects student grading"` | ❌ Wave 0 |
| CLASS-05 | Submission owner OR instructor can GET submission | unit (Worker) | `cd worker && pnpm exec vitest run src/__tests__/submissions.test.ts -t "permission matrix"` | ❌ Wave 0 |
| CLASS-05 | Optimistic update in TanStack Query mutation | unit (frontend) | `pnpm test src/classroom/__tests__/hooks.test.tsx -t "optimistic"` | ❌ Wave 0 |
| CLASS-05 | `SubmissionViewer` renders canvas with real edges (not `edges={[]}`) | unit (frontend) | `pnpm test src/components/submissions/__tests__/SubmissionViewer.test.tsx` | ❌ Wave 0 |
| CLASS-05 | E2E: instructor opens submission → enters grade + feedback → sees saved | E2E | `pnpm test:e2e -- --grep "CLASS-05"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm test -- --changed` (fast feedback on touched files only)
- **Per wave merge:** `pnpm test && cd worker && pnpm exec vitest run` (full unit + integration)
- **Phase gate:** `pnpm test && cd worker && pnpm exec vitest run && pnpm test:e2e` — all green before `/gsd:verify-work`

### Wave 0 Gaps (test infrastructure to create BEFORE implementation)

- [ ] `worker/src/__tests__/classroom.test.ts` — course CRUD + join
- [ ] `worker/src/__tests__/assignments.test.ts` — assignment CRUD + submit + submissions list
- [ ] `worker/src/__tests__/submissions.test.ts` — grade + permission matrix
- [ ] `worker/src/__tests__/joinCode.test.ts` — alphabet, length, uniqueness retry
- [ ] `worker/src/__tests__/requireInstructor.test.ts` — middleware allows/blocks based on sessionClaims.role
- [ ] `worker/src/__tests__/helpers.ts` — shared mocks for D1, R2, `getAuth` (extend Phase 2's mock pattern to include `sessionClaims.role`)
- [ ] `src/classroom/__tests__/api.test.ts` — fetch wrappers
- [ ] `src/classroom/__tests__/hooks.test.tsx` — TanStack Query hooks (including optimistic)
- [ ] `src/store/__tests__/classroomStore.test.ts` — Zustand slice transitions
- [ ] `src/components/assignments/__tests__/InstructionsDrawer.test.tsx` — marked + DOMPurify XSS tests
- [ ] `src/components/submissions/__tests__/SubmissionViewer.test.tsx` — edges rendered correctly
- [ ] `src/components/assignments/__tests__/SubmissionTable.test.tsx` — filter chips, sort
- [ ] `tests/e2e/classroom.spec.ts` — Playwright suite covering CLASS-01..05 happy paths (extend Phase 2 E2E infrastructure)
- [ ] **Manual step**: Clerk dashboard — set JWT session-token custom claim `role: {{user.public_metadata.role}}` (verified by logging in as test user and inspecting JWT at jwt.io)

## Confirmation / Amendment of the Suggested Plan Split

The 6-plan, 3-wave split suggested in the research prompt is sound given what's in the repo. One amendment:

**Suggested split (amended):**

- **Wave 0** (prerequisites — ~1 plan):
  - `03-00-PLAN.md` — Test infrastructure scaffolding + Clerk JWT template setup task + install `marked`/`dompurify`. All Wave 0 test files above (stubs that fail meaningfully). This is the Nyquist validation seed.

- **Wave 1** (backend + state layer — ~3 plans, parallelizable):
  - `03-01-PLAN.md` — D1 migration `0002_classroom.sql` + `requireInstructor` middleware + `joinCode.ts` util + `POST /api/me/become-instructor` route. Test: middleware + join-code unit tests green.
  - `03-02-PLAN.md` — `worker/src/routes/classroom.ts` (courses + join) + `worker/src/routes/assignments.ts` (assignment CRUD + submit + submissions list) + `worker/src/routes/submissions.ts` (get + grade). Tests: all worker unit tests green.
  - `03-03-PLAN.md` — `src/store/classroomStore.ts` + `src/classroom/api.ts` + `src/classroom/hooks.ts` + `src/classroom/types.ts` + `src/auth/useRole.ts` + `src/auth/useBecomeInstructor.ts`. Tests: store + hooks unit tests green. **Parallel with 03-02** — they share no files.

- **Wave 2** (UI — ~3 plans, parallelizable):
  - `03-04-PLAN.md` — `ClassroomDashboard.tsx` + `CoursePage.tsx` + `CreateCourseModal.tsx` + `JoinCoursePage.tsx` + `ShareJoinCodeBanner.tsx` + `App.tsx` route wire-up. Tests: render smoke tests.
  - `03-05-PLAN.md` — `AssignmentPage.tsx` (student classroom-mode wrapper) + `CreateAssignmentModal.tsx` + `InstructionsDrawer.tsx` (markdown + dompurify) + classroom-mode toolbar integration. **Parallel with 03-04**.
  - `03-06-PLAN.md` — `SubmissionTable.tsx` (filter chips) + `SubmissionViewer.tsx` + `GradingPanel.tsx` + optimistic grade mutation wiring. Tests: UI unit tests + SubmissionViewer edges test.

- **Wave 3** (verification — ~1 plan):
  - `03-07-PLAN.md` — Playwright E2E suite covering CLASS-01..05 happy paths + negative paths (non-instructor 403, non-enrolled submit 403). Final test-suite cleanup. Phase gate.

**Net: 7 plans across 4 waves** (including a Wave 0 for test infrastructure per Nyquist conventions), not 6 across 3. The addition is Wave 0 — which the research prompt's suggested structure folded into "Wave 1" but Nyquist validation expects as a discrete test-infra-first seed.

If the planner prefers to keep the original 3-wave split, fold Wave 0 into Wave 1 by having `03-01-PLAN.md` include "create failing test files + install markdown libs" as Task 0.

## Sources

### Primary (HIGH confidence)
- Clerk docs — Customize session token → `user.publicMetadata` custom claims: https://clerk.com/docs/backend-requests/making/custom-session-token (fetched 2026-04-09 — confirmed JWT template syntax, 4KB cookie limit, 1.2KB custom claim budget, `sessionClaims` read pattern)
- Cloudflare D1 docs — Foreign keys: https://developers.cloudflare.com/d1/sql-api/foreign-keys/ (fetched 2026-04-09 — confirmed default-on, `PRAGMA defer_foreign_keys` for migrations, `ON DELETE CASCADE` supported)
- Hono 4 docs — Middleware guides: https://hono.dev/docs/guides/middleware (fetched 2026-04-09 — confirmed `createMiddleware` from `hono/factory`, `app.use` registration patterns, `c.json` vs `HTTPException` for 403)
- marked v15 README: https://github.com/markedjs/marked (fetched 2026-04-09 — confirmed "does not sanitize" + DOMPurify-pair pattern, v15 async default behavior)
- Existing Phase 2 code: `worker/src/routes/circuits.ts`, `worker/src/middleware/auth.ts`, `worker/src/db/schema.sql`, `src/cloud/serialization.ts`, `src/App.tsx`, `src/components/share/SharedCircuitViewer.tsx`, `src/canvas/circuitToFlow.ts` — all read directly
- Phase 2 PLANs `02-03-PLAN.md` and `02-04-PLAN.md` — CRUD + dashboard UI patterns, verified directly
- `03-CONTEXT.md` — locked decisions (primary source of truth for scope)
- `CLAUDE.md` — project constraints, installed package versions

### Secondary (MEDIUM confidence)
- TanStack Query v5 mutation + invalidation patterns — based on Phase 2 `02-04-PLAN.md` code and widely-documented v5 API (not re-fetched for this research because Phase 2 already exercised it successfully)
- `@clerk/react` v6 `Show` component pattern — documented in STATE.md decision log as a Phase 2 workaround
- `crypto.getRandomValues` in Cloudflare Workers runtime — Web Crypto API is a standard Workers global; no issue fetching docs

### Tertiary (LOW confidence — flagged for validation)
- Clerk JWT template feature availability on free tier — unverified; **planner should confirm or provide fallback path** (per-request `getUser` API call)
- Exact `marked` v15.x current minor version — pending `pnpm view marked version` at install time
- Whether `user.reload()` reliably refreshes cached JWT — E2E test during implementation, not a static doc check

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all core libraries already installed and proven in Phase 2
- Architecture: HIGH — Phase 2 patterns extend straightforwardly; Worker + D1 + R2 layout is directly mirrored
- Clerk role propagation: MEDIUM — JWT template path documented but free-tier availability unverified; fallback documented
- Pitfalls: HIGH — five of seven are concrete gotchas observed in Phase 2 or D1 docs; two are logical corollaries of the schema
- Validation architecture: HIGH — every requirement has an explicit automated test command; Wave 0 gaps enumerated
- Discretionary picks (markdown, routing, SubmissionViewer): HIGH — each backed by concrete reasoning tied to Phase 3 scope

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (30 days — stable stack, but Clerk dashboard features can change; re-verify JWT template availability if Phase 3 start is delayed past then)
