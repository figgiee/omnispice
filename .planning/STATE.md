---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: verifying
stopped_at: Completed 06-circuit-crdt 06-04-PLAN.md
last_updated: "2026-04-15T08:30:22.177Z"
last_activity: 2026-04-15
progress:
  total_phases: 6
  completed_phases: 5
  total_plans: 42
  completed_plans: 41
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-09)

**Core value:** Students can simulate circuits accurately in a modern, intuitive interface that helps them understand circuits — not just compute them.
**Current focus:** Phase 05 — collaboration-and-polish

## Current Position

Phase: 05 (collaboration-and-polish) — EXECUTING
Plan: 11 of 11
Status: Phase complete — ready for verification
Last activity: 2026-04-15

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: none yet
- Trend: —

*Updated after each plan completion*
| Phase 01 P05 | 3min | 1 tasks | 6 files |
| Phase 01 P07 | 8min | 2 tasks | 8 files |
| Phase 01-core-simulator P08 | 90 | 3 tasks | 27 files |
| Phase 02-cloud-and-compatibility P01 | 12 | 2 tasks | 9 files |
| Phase 02-cloud-and-compatibility P02-02 | session | 3 tasks | 22 files |
| Phase 02-cloud-and-compatibility P03 | 3 | 2 tasks | 13 files |
| Phase 02-cloud-and-compatibility P04 | 314s | 2 tasks | 10 files |
| Phase 03 P02 | 2 | 2 tasks | 10 files |
| Phase 03 P03-03 | 18 minutes | 2 tasks | 6 files |
| Phase 03 P06 | 360 | 2 tasks | 13 files |
| Phase 04 P01 | 1h | 6 tasks | 40 files |
| Phase 04-institutional-features P02 | 60min | 4 tasks | 22 files |
| Phase 04-institutional-features P04 | 25min | 3 tasks | 15 files |
| Phase 04-institutional-features P03 | 35min | 5 tasks | 12 files |
| Phase 04-institutional-features P06 | 90min | 4 tasks | 14 files |
| Phase 04-institutional-features P05 | session | 4 tasks | 20 files |
| Phase 05-collaboration-and-polish P04 | 40min | 4 tasks | 12 files |
| Phase 05-collaboration-and-polish P06 | 19min | 5 tasks | 22 files |
| Phase 05-collaboration-and-polish P01 | 45min | 7 tasks | 15 files |
| Phase 05-collaboration-and-polish P10 | 45min | 5 tasks | 18 files |
| Phase 05-collaboration-and-polish P05 | 40min | 5 tasks | 14 files |
| Phase 05-collaboration-and-polish P07 | 45min | 6 tasks | 22 files |
| Phase 05-collaboration-and-polish P03 | 21min | 5 tasks | 20 files |
| Phase 05-collaboration-and-polish P11 | 9 | 5 tasks | 10 files |
| Phase 06-circuit-crdt P01 | 25 | 3 tasks | 3 files |
| Phase 06-circuit-crdt P03 | 15m | 1 tasks | 4 files |
| Phase 06-circuit-crdt P04 | 327 | 3 tasks | 5 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Research]: React Flow chosen over tldraw — tldraw requires $6,000/yr commercial license; React Flow is MIT
- [Research]: No SharedArrayBuffer anywhere — single-threaded ngspice in Web Worker to avoid COOP/COEP headers breaking LMS embeds
- [Research]: ngspice pipe-mode vs shared-library API unresolved — must spike in Phase 1 week 1
- [Phase 01]: Three separate Zustand stores (circuit, simulation, UI) to avoid monolithic state anti-pattern
- [Phase 01]: zundo temporal middleware for undo/redo with 100-step limit and partialize
- [Phase 01]: uPlot lifecycle managed via React useEffect with ResizeObserver for responsive chart sizing
- [Phase 01]: Measurement functions are pure math on Float64Array for testability; cursor state via React hooks not uPlot plugin
- [Phase 01-core-simulator]: react-resizable-panels v4 uses Group/Panel/Separator API (not PanelGroup/PanelResizeHandle from v1)
- [Phase 01-core-simulator]: D-21 highlight uses global CSS class omnispice-node-highlighted (not CSS Modules) to avoid string|undefined TS error
- [Phase 01-core-simulator]: Test files excluded from tsconfig for build; vitest handles test type checking independently
- [Phase 02-cloud-and-compatibility]: Use Clerk v6 Show component instead of removed SignedIn/SignedOut for auth-gated rendering
- [Phase 02-cloud-and-compatibility]: Pin html-to-image to 1.11.13 via pnpm overrides; SignInButton mode=modal keeps user on canvas
- [Phase 02-cloud-and-compatibility]: overlayStore uses Record<string,number> not Map; branchCurrents key lookup uses toLowerCase() to match ngspice output; html-to-image pinned to 1.11.13 for React Flow export compatibility
- [Phase 02-cloud-and-compatibility]: vi.mock hoisted before app import: ESM module mocking requires mock before import in Vitest for correct getAuth stubbing in worker tests
- [Phase 02-cloud-and-compatibility]: Worker vitest uses node environment (not jsdom): Worker tests exercise Hono fetch() API with Request/Response, not browser DOM
- [Phase 02-cloud-and-compatibility]: Clerk v6 Show component used instead of removed SignedIn/SignedOut for auth gating
- [Phase 02-cloud-and-compatibility]: circuitToNodes/circuitToEdges extracted to src/canvas/circuitToFlow.ts shared utility
- [Phase 02]: ImportMenu co-located in src/ltspice/ (not src/components/toolbar/) to keep the ltspice module self-contained
- [Phase 02]: setCircuit resets refCounters to {} to prevent ref designator collisions on import
- [Phase 04]: LTI 1.3 self-hosted on jose + Web Crypto inside existing Hono Worker; ltijs rejected (pulls Express/Mongoose/jsonwebtoken, none run on Workers)
- [Phase 04]: /lti/* routes mount BEFORE Clerk middleware (LMS callers have no Clerk session); /api/lti/* admin routes stay Clerk-gated
- [Phase 04]: Canvas + Moodle are first-class LTI targets; Blackboard/D2L compatible-but-not-certified (deferred to post-revenue)
- [Phase 04]: LTI launch mints Clerk session via clerkClient.signInTokens.createSignInToken with externalId = lti|{iss}|{sub}, ticket redeemed client-side via signIn.create({strategy:'ticket'})
- [Phase 04]: AGS score POST MUST use Content-Type application/vnd.ims.lis.v1.score+json (application/json returns 415)
- [Phase 04]: Guided labs use declarative Zod predicates (node_voltage, branch_current, waveform_match, circuit_contains, ac_gain_at); pure-TS evaluator over existing VectorData shape, NO eval/Function
- [Phase 04]: Reference waveforms generated browser-side at lab-save time via existing ngspice Web Worker, uploaded as CSV to R2
- [Phase 04]: PDF report via jsPDF.html autoPaging + KaTeX pre-rasterized to PNG (spiked in 04-01); LaTeX export via JSZip client-side only, no server-side compile
- [Phase 04]: lab Zod schema duplicated between src/labs/schema.ts and worker/src/lab/schema.ts until a shared workspace package lands in Phase 5
- [Phase 04]: lti_oidc_states stored in lti_nonces with 'state:' key prefix rather than a separate table (short-term, flag for Phase 5 cleanup)
- [Phase 04]: react-hook-form introduced in 04-05 as the first form library in the stack (used only by Lab Editor)
- [Phase 04]: KaTeX to PDF uses pre-rasterize-to-PNG via html-to-image toPng (Approach B); Approach A rejected per Pitfall 2, Approach C rejected because jsPDF cannot render html-to-image foreignObject SVG
- [Phase 04]: LTI router mounts at /lti BEFORE any Clerk middleware — LMSes have no Clerk session; sessions minted via signInTokens ticket inside the launch handler
- [Phase 04]: All Phase 4 D1 tables ship in a single migration 0003_lti_and_labs.sql (10 tables + submissions.lti_launch_id ALTER); downstream plans assume whole schema exists
- [Phase 04]: Playwright @phase4-lti project uses testMatch AND default chromium project uses testIgnore on phase-04/ so committed describe.skip blocks cannot run under default suite
- [Phase 04]: AGS score retry uses wrangler.toml Cron trigger */10 * * * * not Cloudflare Queues (Queues add binding+billing without improving retry guarantee)
- [Phase 04-institutional-features]: [Phase 04]: verifyLaunch takes injected platformLookup/fetchJwks/nonceStore for hermetic unit tests; d1NonceStore + fetchRemoteJwks wire live D1/fetch in the route handler
- [Phase 04-institutional-features]: [Phase 04]: mintClerkTicket module lives at worker/src/lti/mintClerkTicket.ts with mintClerkTicketForLtiLaunch({iss,sub,email,name,secretKey}) — matches 04-01 RED stub path exactly
- [Phase 04-institutional-features]: [Phase 04]: LtiLaunchBootstrap uses history.replaceState + popstate (not location.assign) because location.assign is a no-op in jsdom and breaks the pathname assertion
- [Phase 04-institutional-features]: [Phase 04]: useSignIn() cast to LegacySignInHook structural interface because Clerk v6 ships two parallel API shapes and the ticket strategy flow targets the legacy surface
- [Phase 04-institutional-features]: [Phase 04]: E2E lti-launch-no-login spec gates on RUN_LTI_E2E=1 and auto-skips in CI; per-developer Clerk test secrets + wrangler dev documented in SUMMARY auth gates
- [Phase 04-institutional-features]: [Phase 04]: Lab schema follows RED test fixtures verbatim (flat checkpoints with kind/at/expected/branch/component) not the plan draft nested-predicate wrapper
- [Phase 04-institutional-features]: [Phase 04]: waveformMatch maxAbs walks BOTH student AND reference grids to catch divergence spikes between reference samples; single-pass is insufficient
- [Phase 04-institutional-features]: [Phase 04]: LabRunner is a standalone component (no Clerk/QueryClient deps) split from LabRunnerPage so tests can render it directly without provider wrappers
- [Phase 04-institutional-features]: [Phase 04]: AC complex vectors stored as alternating (real,imag) Float64Array pairs; ac_gain_at evaluator computes magnitude via Math.hypot per frequency bin
- [Phase 04-institutional-features]: [Phase 04]: Deep Linking response JWT uses setAudience([platformIss]) array form; launchId acts as capability token for pre-Clerk /lti/deeplink/response; per-course ownership check permissive when instructor_id undefined
- [Phase 04-institutional-features]: [Phase 04]: AGS postScore Content-Type hardcoded in exactly one SCORE_CONTENT_TYPE constant; getPlatformToken cache is injectable Map; drainScoreRetryQueue backoff table in seconds; scheduled fans out via ctx.waitUntil
- [Phase 04-institutional-features]: [Phase 04]: worker/src/index.ts default export refactored to {fetch: app.fetch, scheduled} for Workers module shape; existing tests still call app.fetch(req, env) against the object shape; mockPlatform 204 response bug (Response('') invalid) fixed to Response(null)
- [Phase 04-institutional-features]: KaTeX Approach B (html-to-image PNG pre-rasterize) confirmed shipped in 04-06; all formulas reach jsPDF as img src, no live KaTeX DOM
- [Phase 04-institutional-features]: lab Zod schema mirrored between src/labs/schema.ts and worker/src/lab/schema.ts; flagged as Phase 5 dedup target via shared workspace package
- [Phase 04-institutional-features]: ReportData shape nested under sections.{schematic,waveforms,measurements,annotations} per 04-01 red tests, overriding flat PLAN.md draft (test-is-canonical)
- [Phase 04-institutional-features]: @dnd-kit/utilities added as explicit runtime dep for StepList CSS.Transform.toString; sortable attributes bound to a dedicated drag-handle button, not the parent li, to avoid role=button collision and give keyboard users a real focus target
- [Phase 04-institutional-features]: jsdom fallback paths in rasterizeKatex (16x16 white PNG) + exportReportAsPdf (splitTextToSize pagination) are first-class; browser path remains Approach B + doc.html autoPaging
- [Phase 04-institutional-features]: R2 CIRCUIT_BUCKET.put() called with two args only (key + body); content-type inferred from Hono Request headers rather than a third options arg, to match labs.test.ts arity assertion
- [Phase 04-institutional-features]: Report visual regression limited to on-screen ReportLayout DOM; PDF pixel regression deferred to manual HUMAN-UAT per VALIDATION.md
- [Phase 05-collaboration-and-polish]: TieredSimulationController owns a single Worker with per-request correlation via requestId; main-side + worker-side circuit-hash caches at two levels
- [Phase 05-collaboration-and-polish]: SimCommand/SimResponse extended in backwards-compatible way (optional fields) so legacy controller.ts + controller.test.ts keep passing unchanged
- [Phase 05-collaboration-and-polish]: AC debounce: 60ms sliding window + 500ms max-deferral; Math.min(debounce, remainingDeferral) computed per schedule call for deterministic starvation protection
- [Phase 05-collaboration-and-polish]: simulationOrchestrator uses single-arg useCircuitStore.subscribe + lastCircuit ref compare (circuitStore is NOT wrapped with subscribeWithSelector); identical semantics, no middleware churn
- [Phase 05-collaboration-and-polish]: DC/AC/transient failures are debug-logged silently by the orchestrator (never toasted) per RESEARCH 3.7 anti-pattern guidance on live-simulator vomit
- [Phase 05-collaboration-and-polish]: controller.ts tagged @deprecated rather than refactored; Plan 05-07 deletes it when F5 manual-run path migrates through simulationOrchestrator
- [Phase 05-collaboration-and-polish]: [Phase 05]: Focus-based Ctrl+K disambiguation via data-surface attribute + document.activeElement.closest() — sidebar library claims shortcut when focused, global CommandPalette claims it otherwise (locked decision #3 implementation)
- [Phase 05-collaboration-and-polish]: [Phase 05]: Bundled circuit templates ship as static JSON imports (Vite bundler moduleResolution) so the palette can list them synchronously; portNames reference COMPONENT_LIBRARY keys verbatim with authoring-time validation in insertTemplate
- [Phase 05-collaboration-and-polish]: [Phase 05]: commandPaletteActions uses window CustomEvents (omnispice:run-simulation, omnispice:export-png, omnispice:export-pdf) as a dispatch bus so the registry never imports Toolbar/SimulationController directly — avoids circular deps
- [Phase 05-collaboration-and-polish]: [Phase 05]: useTypeToPlace keydown listener attaches in capture phase so it runs BEFORE react-hotkeys-hook's R-rotate shortcut; selection-guard lets R still rotate when a component is selected
- [Phase 05-collaboration-and-polish]: [Phase 05]: circuitStore.addComponentsAndWires({components, wires, refCounters?}) merges both maps in one set() so zundo captures template insertion as a single undo step
- [Phase 05-collaboration-and-polish]: [Phase 05]: src/test/setup.ts polyfills ResizeObserver + Element.prototype.scrollIntoView for jsdom — Radix Dialog (cmdk Command.Dialog wrapper) refuses to mount in tests without them
- [Phase 05-collaboration-and-polish]: React Flow panActivationKeyCode='Space' used in parallel with uiStore.tempPanActive — built-in handles drag activation, store drives cursor hints and selectionOnDrag toggle
- [Phase 05-collaboration-and-polish]: Framing math extracted to src/canvas/framing.ts as pure helpers (computeSelectionBbox, fitZoomForBbox) for unit testing without React Flow runtime
- [Phase 05-collaboration-and-polish]: phase5 Playwright project pinned to port 5174 separate from shared 5173 dev server so parallel worktree executors don't collide
- [Phase 05-collaboration-and-polish]: y-durableobjects spike shipped as scaffold-only with live 4-step hibernation measurement deferred to Plan 05-09 Task 1 preflight; default recommendation use-y-durableobjects
- [Phase 05-collaboration-and-polish]: Middleware order locked as temporal(persist(storeBody)) — persist wraps store body, temporal wraps persist, so rehydrated state flows through temporal and is undoable; enforced by circuitStoreOfflinePersist.test.ts
- [Phase 05-collaboration-and-polish]: Plan 05-10 uses Zustand 5 createJSONStorage(getStorage, {replacer, reviver}) native option pair, not a bespoke mapAwareStorage wrapper
- [Phase 05-collaboration-and-polish]: Plan 05-10 phase5-offline Playwright project targets pnpm preview on port 4173 because vite-plugin-pwa only emits sw.js in production builds; devOptions.enabled=false so dev mode never registers a SW (would break HMR + WASM worker init)
- [Phase 05-collaboration-and-polish]: Plan 05-10 src/test/setup.ts adds global vi.mock('idb-keyval') stub — any test that indirectly imports circuitStore would crash with 'indexedDB is not defined' otherwise, and per-test mocks get shadowed by module caching
- [Phase 05-collaboration-and-polish]: [Phase 05]: Inline parameter chip mounts inside ReactFlowProvider (Layout.tsx) not App.tsx — chip uses useStore(transform) which requires the provider above it; InlineParameterChipController is a sibling effect component that bridges selectedComponentIds → chipTargetId
- [Phase 05-collaboration-and-polish]: [Phase 05]: useParameterScrub never mutates store directly — Pointer Lock hook calls opts.onChange(newValue) and dispatches omnispice:scrub-committed on pointerup; Escape reverts via onChange(startValue) with NO committed event so Plan 05-04 orchestrator skips the transient re-run on cancel
- [Phase 05-collaboration-and-polish]: [Phase 05]: src/circuit/units.ts engineering notation parser uses longest-first suffix match so 'Meg' beats 'm' — matches ngspice convention (M=milli, Meg=mega); formatEngineeringNotation targets mantissa in [1,1000) with trailing-zero strip
- [Phase 05-collaboration-and-polish]: [Phase 05]: circuitStore.updateComponentParam routes paramName==='value' back through the existing .value slot so undo/redo keeps capturing resistor value edits identically pre/post chip; non-value paramNames go to parameters[paramName]
- [Phase 05-collaboration-and-polish]: [Phase 05]: setSweepParam writes parameters.__sweep as CSV 'min,max,steps' with steps hardcoded to 10; consumer (waveform fan-out rendering) deferred to Plan 05-07
- [Phase 05-collaboration-and-polish]: Plan 05-07: OKLab wire colouring via culori@4 (MIT, 0.2KB gzipped); mixer built once at module load, WireEdge useMemo keyed on [selected,netName,simStatus,voltage] keeps per-frame cost to the wires whose net voltage actually changed
- [Phase 05-collaboration-and-polish]: Plan 05-07: wireVoltages keyed by SPICE net name (not wire id) and simStatus transitions (not-run/computing/live/stale/error) live on overlayStore; orchestrator emits both alongside edgeVoltages so WireEdge + HoverTooltip read the same source of truth
- [Phase 05-collaboration-and-polish]: Plan 05-07: rejected @floating-ui/react (plan referenced it as 'already installed' but it never was); HoverTooltip uses fixed-position div + delegated document mouseover/mouseout listeners filtered by .react-flow__node data-id for zero-per-node-prop overhead
- [Phase 05-collaboration-and-polish]: Plan 05-07: window.matchMedia jsdom polyfill added to src/test/setup.ts — fixes pre-existing AssignmentPage.test.tsx crash that went latent when WaveformViewer started importing SweepFanOut and transitively pulling uPlot into the test graph
- [Phase 05-collaboration-and-polish]: Plan 05-03: Subcircuits use per-instance exposed pin derivation from boundary wires; currentSubcircuitId lives in uiStore (never in zundo) because descending is a view operation not an undoable mutation
- [Phase 05-collaboration-and-polish]: Plan 05-03: .subckt internal nets are namespaced {subref}_net_N; formal parameters use exposed-port names so block header and X{ref} line up pin-for-pin; nested subcircuits throw at netlister (defense-in-depth beyond UI guard)
- [Phase 05-collaboration-and-polish]: ChangeCalloutLayer mounted inside Canvas.tsx (inside ReactFlowProvider) so useStore(s => s.transform) is available — same pattern as PresenceLayer
- [Phase 05-collaboration-and-polish]: dispatchChangeCallout lives in circuitStore (not uiStore) to avoid circular dependency — ChangeCalloutLayer listens via window event
- [Phase 06-circuit-crdt]: JSON strings in Y.Map<string> over nested Y.Maps — simpler hydration + cleanup, last-write-wins conflict resolution adequate for circuit editor
- [Phase 06-circuit-crdt]: store.setState() bypasses zundo for remote edits — prevents remote changes from polluting local undo stack
- [Phase 06-circuit-crdt]: bindCircuitToYjs takes StoreApi parameter (not singleton) to enable isolated test stores
- [Phase 06-circuit-crdt]: collabActive is a module-level flag (not Zustand state) to avoid circular dependency between store and collab layer
- [Phase 06-circuit-crdt]: IDB key circuit-${circuitId} for y-indexeddb vs omnispice-circuit for Zustand persist ensures no slot collision
- [Phase 06-circuit-crdt]: activeYDoc state (not ref) drives useYIndexedDB and useCollabUndoManager reactively in useCollabProvider
- [Phase 06-circuit-crdt]: bindCircuitToYjs called inside provider sync event to ensure server state wins before local writes propagate
- [Phase 06-circuit-crdt]: useCollabProvider returns { providerRef, docRef } so Canvas accesses Y.Doc for onNodeDragStop without a context

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1]: ngspice WASM build reproducibility with ngspice 45.x + current Emscripten — unvalidated, budget 1-2 week spike
- [Phase 1]: React Flow orthogonal wire routing with T-junctions — needs proof-of-concept before full schematic editor build
- [Phase 2]: Clerk SSO/SAML pricing for university IdPs — verify before Phase 2 implementation begins
- [Phase 4]: Canvas test tenant provisioning is a hard prerequisite for 04-01 — must register at canvas.instructure.com before execution
- [Phase 4]: KaTeX→PDF rendering quality is unvalidated; 04-01-06 spike chooses between pre-rasterize-to-PNG and SVG-embed before 04-06 starts
- [Phase 4]: Clerk users.getUserList({externalId}) filter support must be confirmed live before 04-02-02 (fallback is publicMetadata.ltiSub query)
- [Phase 4]: wrangler dev --test-scheduled flag availability determines Cron retry E2E path in 04-03-05
- [Phase 4]: Third-party-cookie behavior for Clerk inside LMS iframe must hold in Chrome/Safari/Firefox — ticket-based bootstrap sidesteps cookies, but manual cross-browser check required pre-ship

## Session Continuity

Last session: 2026-04-15T08:30:22.174Z
Stopped at: Completed 06-circuit-crdt 06-04-PLAN.md
Resume file: None
