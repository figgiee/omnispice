# Phase 3: Classroom Features - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-09
**Phase:** 03-classroom-features
**Mode:** `--auto` / yolo — recommended picks auto-selected (no interactive AskUserQuestion)
**Areas discussed:** Role model, Data model, Enrollment flow, Assignment authoring, Student workflow, Dashboard navigation, Grading UI, Routing, State & data, Backend structure, Permissions, UX details

---

## Role Model

| Option | Description | Selected |
|---|---|---|
| Clerk publicMetadata.role | Store role in Clerk user metadata; read via JWT claim in Worker | ✓ |
| Separate users table in D1 | Maintain local `users(id, role)` mirror of Clerk | |
| Self-declare per-session | UI toggle, no persistence | |

**Rationale:** Clerk is already the identity source of truth (Phase 2 D-01..D-03). Adding a local users table duplicates state and creates sync bugs. JWT-embedded claims are zero-latency to verify server-side.

## Data Model

| Option | Description | Selected |
|---|---|---|
| Separate tables (courses, enrollments, assignments, submissions) | Normalized relational schema | ✓ |
| Single "classroom_items" polymorphic table | Fewer migrations, harder to query | |
| Embed in existing circuits table | Abuse description field — rejected outright | |

**Rationale:** Normalized schema matches the conceptual model. D1 supports FKs + cascades. 4 small tables are easier to reason about and migrate than one fat one.

## Enrollment Flow

| Option | Description | Selected |
|---|---|---|
| Join-by-code (Kahoot-style) | 6-char uppercase code; student enters or clicks link | ✓ |
| Email invites | Instructor enters student emails; system sends invites | |
| CSV roster upload | Instructor uploads enrolled student list | |
| Instructor pushes enrollment | Instructor manually adds student IDs | |

**Rationale:** Codes are self-serve (no email infra), familiar mental model, and work for drop-in demos with pilot professors. Email/CSV belong in Phase 4 with LMS integration.

## Assignment Starter Circuit Storage

| Option | Description | Selected |
|---|---|---|
| Copy-on-create to dedicated R2 key | `assignments/{id}/starter.json` — snapshot immutable for students | ✓ |
| Reference existing circuit by circuit_id | Shared pointer; mutations affect all students | |
| Template registry | Pre-built templates curated by OmniSpice | |

**Rationale:** Copy-on-create eliminates footguns where instructor edits break in-progress student work. Storage cost is negligible.

## Submission Workflow

| Option | Description | Selected |
|---|---|---|
| One submission row, overwritten on resubmit | UNIQUE(assignment_id, student_id); latest wins | ✓ |
| Append-only submission history | Every submit creates a new row | |
| One-shot submission (locked after submit) | No resubmission allowed | |

**Rationale:** Google Classroom model — low friction, matches instructor expectations. History can be added later without schema break (add `version` column + UNIQUE adjustment).

## Grading UI

| Option | Description | Selected |
|---|---|---|
| Numeric grade + text feedback | Simple input + textarea alongside read-only canvas | ✓ |
| Inline canvas annotations | Draw/comment directly on schematic | |
| Rubric-based grading | Weighted criteria with per-item scores | |
| Voice/video feedback | Audio or video comments | |

**Rationale:** Inline annotations and rubrics are 2–4x the work for unknown pilot value. Ship thin, measure professor usage, upgrade after validation.

## Dashboard Navigation

| Option | Description | Selected |
|---|---|---|
| 3-level: Dashboard → Course → Assignment → Submission | Standard LMS hierarchy | ✓ |
| Flat list with filters | All assignments in one view | |
| Kanban by status | Columns for not-submitted / submitted / graded | |

**Rationale:** Matches how instructors already think about classes. Kanban is a v2 power-user view.

## Frontend Routing

| Option | Description | Selected |
|---|---|---|
| Extend Phase 2 manual pathname routing | No new dependencies | ✓ |
| Add `wouter` (2KB hook router) | Cleaner when routes grow | |
| Add `react-router-dom` | Heavier, convention-heavy | |

**Rationale:** Phase 2 set the manual-routing precedent. Stay with it until it hurts; wouter is the escape hatch if Phase 3 touches >6 routes in practice.

## State Management Split

| Option | Description | Selected |
|---|---|---|
| New `classroomStore` Zustand slice + TanStack Query for lists | Mirrors Phase 2 pattern | ✓ |
| Store everything in TanStack Query cache | No local slice | |
| Extend circuitStore with classroom fields | Pollutes core domain | |

**Rationale:** Matches existing Zustand-per-domain convention. Query owns list data; store owns UI/session state like "which assignment is active right now."

## R2 Access Pattern

| Option | Description | Selected |
|---|---|---|
| Proxy all R2 blobs through Worker | Auth always enforced at Worker edge | ✓ |
| Presigned URLs for R2 | Direct browser → R2, no Worker hop | |

**Rationale:** Phase 2 precedent. Submissions are sensitive (student work); auth must be checked on every fetch. Presigned URLs leak broad access if the URL escapes.

## Due Date Enforcement

| Option | Description | Selected |
|---|---|---|
| Soft deadlines (late badge, no lock) | Nullable `due_at`; late computed in UI | ✓ |
| Hard lock at due_at | Block submission after deadline | |
| Configurable per assignment | Instructor picks hard or soft | |

**Rationale:** Simpler scope. Instructors can manually address lateness via grade + feedback. Hard locks invite edge cases (timezones, browser clock drift).

## Comparison Mode (roadmap phase title mentions it)

| Option | Description | Selected |
|---|---|---|
| Include in Phase 3 | Build side-by-side canvas + waveform diff | |
| Defer to Phase 4 | Align with guided labs reference-behavior concept | ✓ |

**Rationale:** Not in CLASS-01..05 requirements. Guided labs in Phase 4 formalize "reference behavior," which is the natural home for comparison. Keeping Phase 3 focused on the revenue unlock.

## Claude's Discretion

- Markdown renderer library for instructions (marked vs markdown-it)
- Exact visual design / table styling
- Whether SubmissionViewer is a new component or a variant of SharedCircuitViewer
- Test fixtures and seed data
- Toast library reuse

## Deferred Ideas

- Inline canvas annotations → post-Phase 3 polish
- Rubrics, weighted grades → post-Phase 3 polish
- Email notifications → post-Phase 3 polish
- Submission version history → post-Phase 3 polish
- Plagiarism detection → post-Phase 3 polish
- CSV gradebook export → post-Phase 3 polish (precursor to LMS)
- Comparison mode → Phase 4
- LMS integration / grade passback → Phase 4
- Institution/org tenancy → Phase 4
- Real-time co-editing of submissions → Phase 5
