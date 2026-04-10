# Phase 3: Classroom Features - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning
**Mode:** `--auto` (yolo) — all gray areas auto-resolved with recommended picks

<domain>
## Phase Boundary

Classroom MVP to unlock university revenue: instructors create courses and assignments with starter circuits, students enroll via join code, open assignments in the editor, submit their modified circuit, and instructors grade submissions with written feedback and a numeric grade. Everything layers on the Phase 2 Clerk auth + D1/R2 backend.

**In scope (maps to CLASS-01..05):**
- Course creation + student enrollment (join-by-code)
- Assignment creation with starter circuit + instructions
- Student assignment view (opens starter, submit button)
- Submissions list dashboard per assignment
- Grading UI (numeric grade + text feedback, read-only canvas preview)

**Out of scope (deferred to later phases or post-Phase 3 polish):**
- Comparison mode (roadmap phase title mentions it but no CLASS requirement — defer to Phase 4 guided labs where reference behavior is formalized)
- Inline canvas annotations (complex UX — use text feedback field for Phase 3)
- Email notifications / invites
- LMS integration, grade passback (Phase 4)
- Institutional/org tenancy (Phase 4)
- Rubrics, weighted grading, multi-grader workflow
- Plagiarism / similarity detection
- Real-time collaboration on submissions (Phase 5)
- Due date enforcement / auto-lock (soft deadlines only)

</domain>

<decisions>
## Implementation Decisions

### Role Model
- **D-01:** Roles stored in Clerk `publicMetadata.role: 'instructor' | 'student'`. Worker reads via Clerk JWT claim. Default on signup = `student`. A "Become an Instructor" button in the user menu flips the flag (no approval gate — pilot trust model; add review later if abused).
- **D-02:** Worker middleware `requireInstructor(c)` wraps `requireAuth` and throws 403 if role !== 'instructor'. Used on all `/api/courses` write routes and `/api/assignments` write routes.
- **D-03:** Frontend exposes role via a `useRole()` hook reading `user.publicMetadata.role` from Clerk's `useUser()`. Dashboard branches on role.

### Data Model (D1 schema — migration `0002_classroom.sql`)
- **D-04:** `courses` table: `id TEXT PK, instructor_id TEXT NOT NULL, name TEXT NOT NULL, term TEXT, join_code TEXT UNIQUE NOT NULL, created_at INTEGER, updated_at INTEGER`. Index on `instructor_id` and `join_code`.
- **D-05:** `enrollments` table: `course_id TEXT, student_id TEXT, joined_at INTEGER, PRIMARY KEY (course_id, student_id)`. Index on `student_id` for "my courses" lookup. FK to `courses(id)` with ON DELETE CASCADE.
- **D-06:** `assignments` table: `id TEXT PK, course_id TEXT NOT NULL, title TEXT NOT NULL, instructions TEXT, starter_r2_key TEXT NOT NULL, due_at INTEGER NULL, created_at INTEGER, updated_at INTEGER`. Index on `course_id`. FK to `courses` ON DELETE CASCADE.
- **D-07:** `submissions` table: `id TEXT PK, assignment_id TEXT NOT NULL, student_id TEXT NOT NULL, r2_key TEXT NOT NULL, submitted_at INTEGER NOT NULL, grade INTEGER NULL, feedback TEXT NULL, graded_at INTEGER NULL, graded_by TEXT NULL, UNIQUE(assignment_id, student_id)`. Index on `assignment_id` and `student_id`. FK to `assignments` ON DELETE CASCADE.
- **D-08:** Join codes generated as 6-char uppercase alphanumeric (excluding ambiguous `0/O, 1/I/L`) via `crypto.getRandomValues` in the Worker. Regenerate on collision. Stored uppercase, matched case-insensitively on join.

### R2 Key Conventions
- **D-09:** Starter circuits → `assignments/{assignment_id}/starter.json`. Written when instructor creates assignment (copy-on-create, not referenced from a library — mutations of instructor's working circuit don't retroactively affect students).
- **D-10:** Submissions → `submissions/{submission_id}.json`. Overwritten on resubmit. Retention: keep only the latest version (no history in Phase 3; add versioning later if professors ask).

### Enrollment Flow
- **D-11:** Instructor creates course → Worker generates `join_code` → instructor sees code + shareable URL `https://omnispice.app/join/{CODE}`.
- **D-12:** Student visits `/join/{code}` (or pastes code on "Join a Course" page). If not logged in → Clerk modal. After auth, Worker `POST /api/courses/join` with `{ code }` → inserts into `enrollments` → redirects to course page. Idempotent (re-join is a no-op).
- **D-13:** No email invites in Phase 3. No self-signup approval. No instructor-initiated enrollment (student must act).

### Assignment Authoring
- **D-14:** Instructor creates assignment from within any course page via "New Assignment" button. Opens a modal with: title, instructions (plain textarea — markdown rendered on student view via a lightweight renderer, TBD by planner — likely `marked` or `markdown-it`), optional due date, and a "Starter circuit" selector.
- **D-15:** Starter circuit selection UX: two paths — (a) "Use current editor circuit" (snapshot the currently loaded circuit), or (b) "Upload from file" (.json OmniSpice format or .asc via existing LTspice importer). Both paths serialize via `serializeCircuit()` from Phase 2 and upload to R2 at `assignments/{id}/starter.json`.
- **D-16:** Editing an assignment's starter circuit after students have submitted is allowed but flagged in the UI ("3 students have submitted — their work is based on the previous starter"). Previous starter is not versioned.

### Student Assignment Workflow
- **D-17:** Student opens assignment → frontend fetches assignment metadata + downloads starter from R2 → loads into the editor via `deserializeCircuit()` → sets a "classroom mode" flag in a new `classroomStore` Zustand slice (`activeAssignmentId`, `activeSubmissionId`, `isSubmitted`).
- **D-18:** In classroom mode, toolbar shows: instructions panel toggle (right-side drawer with rendered instructions + due date), "Submit" button (primary), "Exit Assignment" (returns to dashboard). Standard save still works but auto-save is disabled — submission is the commit.
- **D-19:** "Submit" uploads the current circuit to R2 at `submissions/{id}.json` via `POST /api/assignments/:id/submit` → creates or updates the submissions row (UNIQUE constraint ensures one row per student per assignment). Shows a confirmation toast with timestamp.
- **D-20:** Resubmission allowed at any time (even after `due_at`). Late submissions are marked `submitted_at > due_at` and rendered as "Late" badge in instructor dashboard. No hard lock — instructors can enable/disable grading manually.
- **D-21:** Once an instructor has set a grade, students see the grade + feedback on the assignment page but resubmission is still technically allowed (instructor can re-grade). No workflow locks in Phase 3.

### Instructor Dashboard
- **D-22:** Three-level navigation:
  1. `/dashboard` — instructor sees "My Courses" (card grid); student sees "Enrolled Courses".
  2. `/courses/:id` — course page shows tabs: "Assignments" (list) and "Students" (enrolled list with submission counts). Instructor-only: "Share join code" header.
  3. `/assignments/:id` — instructor sees submission table (columns: Student, Submitted At, Status, Grade, Actions); student sees assignment description + "Open in Editor" button and their submission status.
- **D-23:** Submission table is a simple HTML table (no virtualization — classes are <200 students in pilots). Sortable by column. Filter chips: "All / Ungraded / Graded / Late / Not submitted". "Not submitted" rows synthesized from enrollments left-join submissions.
- **D-24:** Clicking a submission row opens `/submissions/:id` — a read-only canvas viewer (reuses `SharedCircuitViewer` component stripped down, or a new `SubmissionViewer` — planner to decide which is cleaner) + right-side grading panel.

### Grading UI
- **D-25:** Grading panel: numeric grade input (0–100, integer, nullable), multi-line feedback textarea (plain text, 2000 char max), "Save Grade" button. Saving sets `grade`, `feedback`, `graded_at = now()`, `graded_by = instructor user_id`. PATCH `/api/submissions/:id/grade`.
- **D-26:** No inline canvas annotations in Phase 3. Instructor can open the submission in edit mode via "Open as Circuit" (creates a fork in their own account for offline review) but that is not a grading mechanism — it's a read-and-play tool.
- **D-27:** No rubrics, no weighted scoring, no partial credit breakdown. Feedback is one textarea. Future phases can add rubric support.

### Frontend Routing
- **D-28:** Extend the Phase 2 manual pathname router in `src/App.tsx`. New routes:
  - `/` → editor (unchanged)
  - `/share/:token` → SharedCircuitViewer (unchanged)
  - `/dashboard` → `<Dashboard />` (role-aware)
  - `/courses/:id` → `<CoursePage />`
  - `/assignments/:id` → `<AssignmentPage />` (student: opens editor in classroom mode; instructor: submission table)
  - `/submissions/:id` → `<SubmissionViewer />` + grading panel (instructor only)
  - `/join/:code` → `<JoinCoursePage />`
- **D-29:** If routing complexity grows beyond ~6 routes, planner may introduce a minimal router library (`wouter` recommended — 2KB, hook-based, SPA-native), but the default path is stay manual until it hurts.

### State & Data
- **D-30:** New Zustand slice `src/store/classroomStore.ts`: `{ activeCourse, activeAssignment, activeSubmission, isSubmitting, classroomMode: 'student' | 'instructor' | null }`. Does NOT hold list data — that lives in TanStack Query cache.
- **D-31:** TanStack Query keys:
  - `['courses']` — instructor's courses OR student's enrolled courses (branch in query fn)
  - `['course', courseId]` — course detail + assignments + students
  - `['assignment', assignmentId]` — assignment detail
  - `['assignment', assignmentId, 'submissions']` — submission list (instructor only)
  - `['submission', submissionId]` — submission detail + circuit blob URL
  - `['mySubmission', assignmentId]` — current student's submission for an assignment
- **D-32:** Mutations invalidate the relevant keys. Optimistic updates only for grade saves (instant feedback in the table).

### Backend (Worker) Structure
- **D-33:** New Hono route groups in `worker/src/routes/`:
  - `classroom.ts` → `/api/courses` (CRUD for instructors, list for students), `/api/courses/:id`, `/api/courses/join`
  - `assignments.ts` → `/api/courses/:id/assignments` (list, create), `/api/assignments/:id` (get, update, delete), `/api/assignments/:id/submit` (student submit), `/api/assignments/:id/submissions` (instructor list), `/api/assignments/:id/starter` (GET starter R2 blob — proxied through Worker to preserve auth)
  - `submissions.ts` → `/api/submissions/:id` (get with auth check), `/api/submissions/:id/grade` (PATCH instructor only), `/api/submissions/:id/circuit` (GET submission R2 blob — proxied, auth-checked)
- **D-34:** Permission matrix enforced in route handlers:
  - Course write → instructor owns the course
  - Assignment write → instructor owns the parent course
  - Submission create → student is enrolled in the course
  - Submission read → submission owner OR instructor of the course
  - Submission grade → instructor of the course
- **D-35:** R2 access is ALWAYS proxied through the Worker. No presigned URLs in Phase 3. The Worker fetches from R2, streams to the client, and sets `Cache-Control: private, max-age=0` on submission responses.
- **D-36:** New D1 migration file `worker/migrations/0002_classroom.sql`. Run alongside `0001` via `wrangler d1 migrations apply`.
- **D-37:** Clerk JWT is the source of truth for `role` — Worker does NOT store a local user table. Users are identified by `userId` (Clerk ID) as a foreign-key-like string with no DB-side FK.

### UX Details
- **D-38:** Instructor onboarding: after flipping role to instructor, dashboard shows an empty state with a big "Create your first course" CTA. No tour/walkthrough in Phase 3.
- **D-39:** Student onboarding: empty dashboard shows "Join a course with a code" input + explanation. No auto-enroll magic.
- **D-40:** Due dates are UTC-stored, browser-local displayed via `toLocaleString()`. No timezone picker. Late badge computed client-side.
- **D-41:** Delete operations (course, assignment) require a typed-name confirmation modal. Cascades configured at the DB level.

### Claude's Discretion (planner/executor decides)
- Specific visual design of dashboard cards, table styling, and grading panel — follow Phase 1/2 design system tokens.
- Markdown rendering library for instructions (`marked` vs `markdown-it` vs custom) — pick based on bundle size and XSS safety.
- Whether `SubmissionViewer` is a new component or a prop-variant of `SharedCircuitViewer`.
- Toast/notification library reuse vs new (whatever Phase 2 landed on).
- Exact copy/labels.
- Test fixtures and seed data for manual testing.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Requirements
- `.planning/ROADMAP.md` §"Phase 3: Classroom Features" — Goal, requirements CLASS-01..05, success criteria
- `.planning/REQUIREMENTS.md` lines 89–93 — CLASS-01..05 requirement text
- `.planning/PROJECT.md` — Business model (site license), competitive context

### Prior Phase Context (patterns to follow)
- `.planning/phases/02-cloud-and-compatibility/02-CONTEXT.md` — Clerk auth, D1+R2 split, Hono route groups, serialization, manual routing patterns
- `.planning/phases/02-cloud-and-compatibility/02-03-PLAN.md` — Reference Worker + D1 + R2 CRUD implementation to mirror
- `.planning/phases/02-cloud-and-compatibility/02-04-PLAN.md` — Reference dashboard/list UI patterns

### Existing Code
- `src/App.tsx` — Current pathname-based routing (extend here)
- `src/cloud/serialization.ts` — `serializeCircuit` / `deserializeCircuit` (reuse for starter + submissions)
- `src/components/share/SharedCircuitViewer.tsx` — Read-only canvas viewer (reuse or fork for SubmissionViewer)
- `worker/src/middleware/auth.ts` — `requireAuth` pattern (add `requireInstructor`)
- `worker/src/routes/circuits.ts` — Reference CRUD handler style (Hono + D1 + R2)
- `worker/src/db/schema.sql` — Existing schema to extend
- `worker/migrations/0001_create_circuits.sql` — Migration format reference
- `src/store/` — Zustand slice conventions (add `classroomStore.ts`)

### External Docs (fetch via Context7 during research)
- Clerk: `publicMetadata` update API, server-side role claim verification in JWT, `useUser()` hook
- Hono 4: Route groups, middleware composition, error handling
- Cloudflare D1: Foreign keys + ON DELETE CASCADE support, migrations
- TanStack Query 5: Query key invalidation, optimistic updates for grade mutations

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Clerk auth stack** — `ClerkProvider` already wraps app; `requireAuth` middleware already in Worker. Phase 3 adds a thin `requireInstructor` on top.
- **Serialization helpers** — `serializeCircuit` / `deserializeCircuit` handle the Map-to-array conversion; starter and submission blobs reuse these verbatim.
- **R2 + D1 split pattern** — Phase 2 proved the pattern (metadata in D1, full circuit JSON in R2). Extend identically for starter/submission blobs.
- **Hono route group scaffolding** — `worker/src/routes/circuits.ts` shows the shape: router → middleware → D1 queries → R2 fetch → JSON response. Classroom routes mirror this.
- **TanStack Query setup** — Already integrated; adding new keys/mutations is zero-infrastructure work.
- **SharedCircuitViewer** — Read-only canvas with no toolbar; candidate parent for SubmissionViewer.
- **Manual pathname routing in App.tsx** — Simple `window.location.pathname.match(...)` pattern extends cleanly to 4-6 new routes.

### Established Patterns
- Zustand slices per domain (circuit, simulation, ui, overlay, cloud) — add `classroom` slice following the same shape
- R2 keys are always proxied through Worker (no presigned URLs) — preserves auth boundary
- Clerk JWT is source of truth for user identity; no local user table
- Migrations committed as `worker/migrations/000N_name.sql` files
- Serialize/deserialize at the JSON boundary, Maps become arrays

### Integration Points
- `src/main.tsx` — ClerkProvider + QueryClientProvider already set up; no infra changes
- `src/App.tsx` — Add pathname routes (`/dashboard`, `/courses/:id`, `/assignments/:id`, `/submissions/:id`, `/join/:code`)
- `worker/src/index.ts` — Mount new route groups (`classroom`, `assignments`, `submissions`)
- `worker/migrations/` — Add `0002_classroom.sql`
- Toolbar — Add "Submit" button conditionally when `classroomStore.classroomMode === 'student'`
- User menu — Add "Become an Instructor" toggle + "My Courses" link

</code_context>

<specifics>
## Specific Ideas

- **Revenue framing:** Phase 3 is the minimum feature set to price-test with 3–5 pilot professors. Ship thin, then watch what they actually use before adding rubrics/annotations/notifications.
- **Join code UX reference:** Kahoot-style 6-char codes are a familiar classroom mental model. Use that shape (uppercase alphanumeric, excluding ambiguous characters).
- **Resubmit policy:** Mirror Google Classroom's "always open" default — instructors can close manually if needed. Don't build lock mechanics in Phase 3.
- **"Fork to my account" action** (from Phase 2 deferred) — Not Phase 3. Note still.

</specifics>

<deferred>
## Deferred Ideas

### To Phase 4 (Institutional Features)
- Comparison mode (student vs reference circuit) — aligns with guided labs checkpoint semantics
- LMS integration / LTI 1.3 / grade passback
- Organization / institution tenancy above courses
- PDF lab report export

### To Phase 5 (Collaboration & Polish)
- Real-time co-editing of an assignment
- Offline submission queue

### Post-Phase 3 polish (no phase assigned)
- Inline canvas annotations (ink, sticky notes, voltage callouts)
- Rubrics & weighted grade breakdowns
- Email notifications on submission / grading
- Submission version history
- Plagiarism / similarity detection
- Bulk grading / next-submission keyboard shortcut
- CSV gradebook export (lightweight precursor to LMS passback)
- Instructor role approval gate (pilot currently uses self-declare)
- Late submission auto-lock based on due date
- Archive / term rollover

### Reviewed-but-not-folded todos
None — no pending todos matched Phase 3 scope at discussion time.

</deferred>

---

*Phase: 03-classroom-features*
*Context gathered: 2026-04-09 (--auto mode, recommended picks locked)*
