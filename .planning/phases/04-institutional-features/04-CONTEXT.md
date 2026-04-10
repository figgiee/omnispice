# Phase 4: Institutional Features — Context

**Gathered:** 2026-04-10
**Status:** Ready for research → planning
**Source:** `/gsd:plan-phase 4` (yolo mode, interactive decisions)

<domain>
## Phase Boundary

Phase 4 turns OmniSpice into an institution-ready product by doing three things users can observe:

1. An instructor can embed an OmniSpice assignment in **Canvas** (and Moodle) via **LTI 1.3 Deep Linking**, students launch it without a separate login, and student grades post back to the LMS gradebook via LTI AGS.
2. An instructor can **author a guided lab** (steps + declarative checkpoints) in-app and assign it; a student can work through it and get **automatic pass/partial/fail feedback** at each checkpoint, including waveform-match checks against a reference.
3. A user can **export a lab report as a PDF** containing schematic, waveforms, measurements, and annotations formatted for academic submission. LaTeX export (RPT-02) is in-scope for Phase 4 as a dedicated later plan.

**Out of Phase 4 (explicit):**
- Real-time collaboration (Phase 5).
- Offline support (Phase 5).
- Circuit Insights plain-language explanations (Phase 5).
- Blackboard Learn and D2L Brightspace LTI certification — architecture must not preclude them, but certification and per-LMS bug-fixing is deferred until revenue justifies sandbox effort.

</domain>

<decisions>
## Implementation Decisions

### LTI 1.3 — LOCKED
- **Self-host LTI 1.3 Core + Deep Linking + AGS** inside the existing Cloudflare Worker (Hono). No managed LTI SaaS. Rationale: keeps the Cloudflare-only stack intact, no per-seat vendor fees, aligns with proprietary licensing.
- **First-class LMS targets: Canvas + Moodle.** Canvas-first because (a) largest US higher-ed share, (b) free Instructure-hosted test tenant, (c) cleanest LTI 1.3 reference implementation. Moodle second because (a) open source = instant self-hosted sandbox, (b) international/community college reach.
- **Blackboard Learn Ultra and D2L Brightspace: compatible, not certified.** Architecture must not hard-code Canvas/Moodle quirks, but Phase 4 does not budget for Blackboard/D2L sandbox work. Revisit post-revenue.
- **LTI endpoints live in the existing `worker/` Hono app.** New routes under `/lti/*`. No separate Worker.
- **Storage:** D1 stores LTI platform registrations, deployment IDs, iss/client_id/deployment_id tuples, JWKS cache, nonce store (TTL), line item → assignment mapping. R2 stores any binary artifacts if needed.

### LTI Auth Bridge to Clerk — LOCKED
- **LTI launch mints a Clerk session via Worker exchange.** Flow: LMS → `POST /lti/launch` → Worker verifies the id_token (JWKS fetch per-iss, nonce check, issuer/audience/deployment validation) → Worker calls Clerk Backend API to look up or create a user keyed by `sub@iss` → Worker mints a short-lived sign-in token → SPA boots pre-authenticated. Satisfies LMS-03 (no separate login).
- **One Clerk identity per (iss, sub) tuple.** Same student launching from two different LMSes gets two Clerk accounts unless they manually link — acceptable for Phase 4.
- **Claude's discretion on Clerk custom-token API specifics** — planner/researcher picks between Clerk's `signInTokens.createSignInToken` (server → short-lived ticket → SPA redeems) vs a JWT template, whichever is current in Clerk v6.

### LMS Grade Passback (AGS) — LOCKED
- LTI AGS (Assignment and Grade Services) is used for grade posting. A Phase 4 `LineItem` is created per assignment at deep-link time; submissions post a `Score` on grade. Scope claim: `https://purl.imsglobal.org/spec/lti-ags/scope/lineitem`, `.../score`.
- Grade sync is **triggered by the existing grade endpoint** (Phase 3 `PATCH /submissions/:id`) calling an `ltiAgsService.postScore()` helper iff the submission originated from an LTI launch. Non-LTI submissions are unchanged.
- Grade sync failures are recorded in D1 (`lti_score_log`) and retried in a Cron Worker — dropping a grade silently is unacceptable.

### Guided Lab Data Model — LOCKED
- **Structured JSON lab format**, authored in an in-app editor. A lab is versioned JSON stored in R2 with D1 metadata. Schema is owned by the OmniSpice codebase, not a third-party spec.
- **Declarative checkpoint predicates with tolerance and pass/partial/fail semantics.** No JS sandbox, no arbitrary expressions. Initial predicate kinds (planner may add more if research justifies):
  - `node_voltage` — `{node, at_time, expect, tol_pct | tol_abs}`
  - `branch_current` — `{element_ref, at_time, expect, tol_pct | tol_abs}`
  - `waveform_match` — `{probe, reference_ref, metric: 'rmse'|'max_abs', tol}` — reference is a CSV stored in R2
  - `circuit_contains` — `{kind, count_min, count_max}` e.g., "at least one op-amp"
  - `ac_gain_at` — `{probe, frequency, expect_db, tol_db}`
- **Partial credit:** checkpoints may be weighted; total = weighted sum of passed + 0.5 × partial.
- **Evaluation is pure TypeScript over the simulation result object.** No eval, no `new Function`, no dynamic code.
- **Reference waveforms** are generated by simulating an instructor-authored reference circuit at lab-save time, then stored in R2 as CSV. No live reference sim at checkpoint-time.

### Guided Lab Runtime UX — LOCKED
- Students see a side panel with the current step, instructions (rendered via marked+DOMPurify — same as Phase 3), and checkpoint status chips (✓ / ⚠ / ✗).
- Running a simulation auto-evaluates all checkpoints in the current step. Students can re-run freely until they pass.
- The lab editor and the lab runner are separate React routes under `/labs/*`.

### Lab Report Export — LOCKED
- **PDF-first** via jsPDF + html2canvas (already in the stack per the tech stack table). A dedicated React `ReportLayout` composes schematic PNG (from existing Phase 2 export utility), waveform images, KaTeX-rendered measurements, and instructor/student annotations.
- **LaTeX export** ships as its own Phase 4 plan after the PDF flow proves out. Approach: generate a `.tex` source client-side (no server-side Tectonic in Phase 4), bundle with a `figures/` folder, and download as `.zip`. Server-side compilation can come later.
- **Paper sizes:** US Letter and A4. Default derived from browser locale.

### Non-Goals for Phase 4 — LOCKED
- No cross-LMS "universal installer" UI beyond a docs page with the platform-required URLs/keys.
- No analytics dashboards for lab completion rates — visible nice-to-have but not a requirement in this phase.
- No authoring UI for AGS line-item editing inside the LMS (we just create line items at deep-link time).

### Claude's Discretion
- Exact Hono route structure under `/lti/*`.
- Specific LTI TypeScript library choice (or hand-rolled JOSE-based verification) — researcher must evaluate.
- D1 schema column names / nonce TTL durations within reasonable bounds.
- Lab editor UI component breakdown.
- Number of built-in predicate kinds beyond the seed list above (can expand if research justifies).
- Whether to use Cloudflare Queues or a Cron Worker for AGS retry.
- Paper size and font choices in the PDF report, within the "academic submission" bar.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### OmniSpice planning artifacts
- `.planning/PROJECT.md` — product thesis, constraints, key decisions log
- `.planning/REQUIREMENTS.md` — authoritative list for LMS-01/02/03, LAB-01/02/03, RPT-01/02
- `.planning/ROADMAP.md` — Phase 4 section with goal, success criteria, risks
- `.planning/STATE.md` — accumulated project decisions and current position
- `.planning/phases/03-classroom-features/03-CONTEXT.md` — Phase 3 conventions (Clerk v6 Show, marked+DOMPurify, classroomStore patterns) that Phase 4 must extend, not re-invent
- `.planning/phases/03-classroom-features/03-VERIFICATION.md` — outstanding Phase 3 items that might bleed into Phase 4

### OmniSpice source code touchpoints (researcher must map concretely)
- `worker/` — existing Hono app, D1 bindings, Clerk middleware patterns
- `worker/src/routes/classroom.ts`, `assignments.ts`, `submissions.ts` — Phase 3 API patterns Phase 4 follows
- `worker/migrations/` — D1 migration naming convention (next free number for Phase 4)
- `src/classroom/` — Phase 3 client slice, hooks, API patterns
- `src/ltspice/` — reference for self-contained sub-feature module layout
- `src/canvas/circuitToFlow.ts` — shared utility to reuse for report rendering
- `src/hooks/useOverlaySync.ts`, `src/state/overlayStore.ts` — live simulation overlay patterns relevant to lab checkpoints

### External specs (researcher must fetch via Context7 or WebFetch as applicable)
- **IMS Global LTI 1.3 Core spec** — `https://www.imsglobal.org/spec/lti/v1p3/`
- **LTI Deep Linking 2.0 spec** — `https://www.imsglobal.org/spec/lti-dl/v2p0/`
- **LTI Assignment and Grade Services 2.0** — `https://www.imsglobal.org/spec/lti-ags/v2p0/`
- **Canvas LTI 1.3 implementation notes** — Canvas-specific deep linking fields, test tenant docs
- **Moodle LTI 1.3 platform docs**
- **Clerk Backend API — Sign-in tokens / custom sessions** (via Context7 `/clerk/clerk-docs`)
- **jsPDF + html2canvas** for PDF layout (via Context7)
- **KaTeX** for measurement formula rendering

</canonical_refs>

<specifics>
## Specific Ideas

- Phase 4 should feel like the natural continuation of Phase 3's classroom module. Same store slicing pattern (`labStore`, `ltiStore`), same TanStack Query hook naming conventions, same `worker/routes/` organization.
- LTI launch and Clerk-session mint should be one round-trip from the SPA's perspective — the Worker handles the LMS post and returns HTML that bootstraps the SPA with the session already established (no flash of unauthenticated state).
- The lab editor should support "try it as a student" without leaving the editor — a toggle that simulates the student experience against the current draft.
- The PDF report layout should be the same DOM used for on-screen report preview, so WYSIWYG holds.
- Checkpoint evaluation runs as a pure function over the same simulation result object the waveform viewer already consumes — no new IPC.
- Every LTI platform registration must be a first-class D1 row; no hardcoded Canvas/Moodle keys.

</specifics>

<deferred>
## Deferred Ideas

- **Blackboard Learn Ultra and D2L Brightspace full certification** — architecture stays LMS-agnostic, but sandbox work is deferred until post-revenue.
- **LTI Names and Role Provisioning Services (NRPS)** — useful for roster sync; not required by LMS-01/02/03. Defer unless research shows it is a blocker for Canvas/Moodle pilots.
- **Server-side LaTeX → PDF compilation** (Tectonic/pdflatex in a Cloudflare Container) — RPT-02 ships as client-side `.tex` generation in Phase 4; server-side compile is a later phase.
- **Lab analytics dashboards** — visible-but-not-in-scope; move to a v2 polish phase.
- **Auto-generated lab report narrative from Circuit Insights** — depends on Phase 5 Insights engine.
- **Multi-language lab authoring** — Phase 4 ships English-only.

</deferred>

---

*Phase: 04-institutional-features*
*Context gathered: 2026-04-10 via /gsd:plan-phase yolo mode with interactive decisions*
