# Project Research Summary

**Project:** OmniSpice
**Domain:** Browser-based SPICE circuit simulator for university ECE/CPE programs
**Researched:** 2026-04-09
**Confidence:** MEDIUM-HIGH

## Executive Summary

OmniSpice is a browser-based SPICE circuit simulator targeting university electrical engineering programs. The product combines three hard technical problems: a schematic editor (interactive canvas with domain-specific shapes and wiring), a simulation engine (ngspice compiled to WASM), and a waveform viewer (high-performance plotting of simulation results). Experts in this domain build these tools by compiling ngspice to WebAssembly via Emscripten, running it in a Web Worker to avoid freezing the UI, and layering a React-based schematic editor on top. The closest open-source reference is EEcircuit (eelab-dev/EEcircuit), which validates this architecture end-to-end.

The recommended approach is to build on React 19 + Vite 8 + TypeScript (confirmed constraints), with React Flow for the schematic canvas, ngspice 45.x compiled to WASM via Emscripten for simulation, uPlot for waveform rendering, Zustand for state management, and Yjs for real-time collaboration backed by Cloudflare Durable Objects. The critical architectural decision is the clean separation between the schematic editor, the circuit data model (pure TypeScript graph), the netlisting engine (pure function), and the simulation worker. These four components communicate only through typed interfaces, making each independently testable and replaceable.

The top risks are: (1) ngspice WASM memory crashes on real-sized circuits that go undetected during development with toy examples, (2) convergence failures being perceived as application bugs rather than circuit errors destroying professor credibility, (3) over-engineering collaboration and education features before validating with actual professors, and (4) Emscripten virtual filesystem breaking .include-based model loading that professors depend on. Mitigation is straightforward if addressed from Phase 1: test with 100+ node circuits, build an error message translator, ship a minimal simulator to professors before building anything fancy, and pre-populate MEMFS with standard model libraries.

## Resolved Conflict: Canvas Library

The Stack and Architecture agents disagreed on React Flow vs. tldraw. After analysis:

**Decision: React Flow (@xyflow/react, MIT license).**

The Architecture agent correctly identified that tldraw's freeform canvas model maps more naturally to circuit schematics. However, the Stack agent correctly identified that tldraw requires a $6,000/year commercial license for production use (tldraw SDK 4.0 moved to a proprietary license for commercial applications; the Apache 2.0 license covers non-commercial use only). For a pre-revenue startup, this is disqualifying.

React Flow's limitations for circuit schematics are real but solvable:

- **T-junctions (3+ wires meeting at a point):** Model as invisible junction nodes. This is a standard pattern in graph-based EDA tools. When the user creates a T-junction, the system inserts a hidden zero-size node with 3+ handles.
- **Wire routing with bends:** Use custom edge components that render orthogonal polylines via SVG paths. React Flow's custom edge API gives full control over edge rendering and interaction.
- **Freeform wire drawing:** Implement a custom interaction mode where clicking on a component port starts a wire that follows the cursor with orthogonal snapping, then connects to a target port. This replaces React Flow's default drag-from-handle with a click-click-click polyline tool.
- **Wire-as-first-class-entity:** In the circuit data model, wires ARE first-class. React Flow edges are the rendering layer. The data model stores wire topology independently.

This approach costs engineering time (estimated 2-3 weeks of custom edge/handle work in Phase 1-2) but avoids a $6,000/year recurring cost and the risk of tldraw's license terms changing further.

**Architecture agent's ARCHITECTURE.md references to "tldraw" should be read as "React Flow" throughout.** The component boundaries, data flow, and patterns remain identical -- only the canvas library changes.

## Key Findings

### Recommended Stack

The stack is centered on React 19 + Vite 8 + TypeScript as confirmed constraints, with ngspice compiled to WASM as the simulation engine. Every technology choice was made to minimize operational complexity (Cloudflare-native backend, no server-side simulation compute) and maximize AI-assisted development velocity (TypeScript strict mode, simple API surfaces, well-documented libraries).

**Core technologies:**

| Technology | Purpose | Why |
|------------|---------|-----|
| React 19 + Vite 8 + TypeScript 5.7+ | Application framework | Confirmed constraints. React 19 useTransition for non-blocking sim updates. |
| ngspice 45.x (WASM via Emscripten) | SPICE simulation | Only viable option. 40+ years of validated models. Must compile from source using pipe-mode. Run in Web Worker. |
| React Flow (@xyflow/react) 12.10.x | Schematic editor canvas | MIT licensed. Node-and-edge graph model maps to components-and-wires. Custom nodes for components, custom edges for wire routing. |
| uPlot 1.6.32 | Waveform viewer | 166k points in 25ms, 20KB gzipped. Canvas 2D. Purpose-built for time-series at oscilloscope scale. |
| Zustand 5.0.x | Client state management | Under 1KB, hook-based, slice pattern for domain separation. |
| TanStack Query 5.96.x | Server state | Caching, deduplication for API calls (save/load circuits, user data). |
| Yjs 13.6.x | Real-time collaboration CRDT | Industry standard. Y.Map/Y.Array map to circuit data. Offline-first. |
| Cloudflare Workers + D1 + R2 + Durable Objects | Backend infrastructure | Confirmed constraint. Zero cold starts, Durable Objects for collaboration rooms, D1 for metadata, R2 for circuit files. |
| Hono 4.3+ | HTTP framework | Workers-native, TypeScript-first. Required for y-durableobjects. |
| Clerk | Authentication | SSO/SAML for university IdP integration. Workers-compatible. |

### Top 5 v1 Features (Table Stakes)

These cannot be skipped. Missing any one makes the product unusable for the target market.

1. **Schematic editor with drag-and-drop, snap-to-grid, orthogonal wiring** -- Every competitor has this. Students will not tolerate netlist-only input. This is the product's face.
2. **ngspice WASM integration (DC operating point, AC analysis, transient analysis)** -- These three analysis types cover 90%+ of undergraduate coursework. Without all three, the tool cannot replace LTspice for any course.
3. **Waveform viewer with cursors and measurements** -- Students must measure gain, bandwidth, rise time, etc. A plot without cursors is a picture, not a tool.
4. **Human-readable error messages** -- This is the single biggest UX win over every competitor. "Singular matrix at node 7" becomes "Node Vout has no DC path to ground -- connect it to ground through a resistor." This alone can drive professor adoption.
5. **Component library (50-100 essential components)** -- Resistors, capacitors, inductors, diodes, BJTs (2N2222, 2N3904), MOSFETs (NMOS/PMOS), op-amps (ideal + LM741), voltage/current sources. Must include ideal components for textbook circuits.

### Top 3 Differentiators (Competitive Advantage)

These are the reasons a professor chooses OmniSpice over LTspice.

1. **Zero-install browser access with SPICE accuracy** -- No competitor offers both. CircuitLab and Falstad are browser-based but lack full SPICE accuracy. LTspice and Multisim have SPICE accuracy but require desktop installation. OmniSpice is the only product that works on a Chromebook AND runs real ngspice. This eliminates IT department friction, the #1 blocker for university adoption.
2. **Real-time collaboration (Google Docs for circuits)** -- No circuit simulator offers true real-time co-editing of schematics. Two lab partners working on the same circuit simultaneously is a paradigm shift for EE education. Yjs + Cloudflare Durable Objects makes this technically feasible.
3. **Classroom management with LMS integration** -- Assignment creation/distribution/collection/grading with LTI 1.3 grade passback to Canvas/Blackboard/Moodle. Professors will not adopt tools that live outside their LMS. No circuit simulator currently does this. This unlocks site license revenue.

### Architecture Approach

The architecture is a clean pipeline: Schematic Canvas (React Flow) produces visual state, which syncs to a Circuit Data Model (pure TypeScript graph), which feeds the Netlisting Engine (pure function producing SPICE text), which posts to the Simulation Worker (ngspice WASM in a Web Worker), which returns typed results to the Waveform Viewer (uPlot). Each boundary is a typed TypeScript interface. No component knows about components upstream or downstream beyond its interface contract.

**Major components:**

1. **Schematic Editor (React Flow)** -- Visual circuit creation. Custom nodes for components with typed handles at pin positions. Custom edges for orthogonal wire routing. Owns canvas state.
2. **Circuit Data Model** -- Pure TypeScript graph: Circuit with components Map, wires Map, nets Map. Single source of truth for circuit topology. Synced via Yjs for collaboration.
3. **Netlisting Engine** -- Pure function: `(circuit, config) => string`. Traverses graph, resolves nets (union-find), emits SPICE text. Fully testable without UI or WASM.
4. **Simulation Worker** -- Web Worker loading ngspice WASM. Command-based interface via postMessage. Isolates WASM crashes from main thread. Lazy-loaded on first simulation run.
5. **Waveform Viewer (uPlot)** -- Receives SimulationResult with typed vector arrays. Renders traces with cursors, zoom, multi-axis. Knows nothing about circuits.
6. **Collaboration Layer (Yjs)** -- Universal sync layer binding React Flow state and circuit model to a Y.Doc. One Durable Object per circuit document.
7. **State Management (Zustand)** -- Owns simulation lifecycle, UI state, user preferences. Does NOT duplicate canvas state (React Flow owns that).

### Top 5 Pitfalls to Avoid

1. **WASM memory crashes on real circuits** -- ngspice defaults to small initial heap. A 100-node MOSFET circuit with BSIM4 models exhausts it. Set INITIAL_MEMORY=256MB, ALLOW_MEMORY_GROWTH=1, MAXIMUM_MEMORY=2GB from day one. Test with complex circuits in CI, not just RC filters.

2. **Convergence failures destroying credibility** -- Students build circuits with floating nodes and missing ground. ngspice correctly fails, but the error is "singular matrix at node 7." Students (and professors) blame OmniSpice, not their circuit. Build a pre-simulation validator (catch floating nodes, voltage source loops, missing ground BEFORE ngspice runs) and an error message translator that maps cryptic errors to plain English with "Fix it" suggestions.

3. **Over-engineering before professor validation** -- Building collaboration, LMS integration, and Circuit Insights before a single professor uses the basic simulator in a real class. Phase 1 must ship a functional simulator to 3-5 professors. Their feedback determines Phase 2+ priorities. EdTech adoption research is unambiguous: tools built without educator input fail.

4. **Emscripten virtual filesystem breaking model loading** -- ngspice `.include` directives reference filesystem paths that do not exist in WASM. Pre-populate MEMFS with standard models (BSIM3/4, 2N2222, LM741). Intercept `.include` directives and resolve against the built-in library. Support professor model uploads via IndexedDB persistence.

5. **Cross-Origin Isolation breaking OAuth and LMS embeds** -- SharedArrayBuffer requires COOP/COEP headers that break OAuth popups and LMS iframes. Do NOT use SharedArrayBuffer. ngspice single-threaded is fast enough for undergrad circuits. Design for no cross-origin isolation from day one.

## Implications for Roadmap

### Phase 1: Core Simulator Foundation

**Rationale:** Everything depends on the circuit data model and WASM integration. These are the highest-risk, highest-dependency components. If ngspice WASM does not work reliably, nothing else matters. The schematic editor and waveform viewer are visual proof that the engine works.

**Delivers:** A functional offline-capable circuit simulator that a professor can use for one real assignment. Schematic editor with basic components, ngspice simulation (DC/AC/transient), and waveform display with cursors.

**Features addressed:**
- Schematic editor with drag-and-drop, snap-to-grid, orthogonal wiring
- ngspice WASM integration (DC op, AC, transient)
- Waveform viewer with cursors and basic measurements
- Component library (50-100 essentials)
- Human-readable error messages (pre-sim validation + error translation)
- Save/load circuits (local storage initially)
- Export schematic as PNG/SVG
- Undo/redo

**Pitfalls to avoid:**
- WASM memory crashes (#1) -- test with 100+ node circuits
- Emscripten filesystem (#5) -- pre-populate model library
- Cross-origin isolation (#2) -- no SharedArrayBuffer
- Canvas performance (#6) -- profile with 200+ component schematics
- Output parsing (#7) -- use callback API, test all analysis types

### Phase 2: Cloud Infrastructure and Education Baseline

**Rationale:** After Phase 1 proves the simulator works, add cloud persistence and begin professor pilots. This phase delivers shareable circuits and the first education-specific features that differentiate from LTspice. User accounts are prerequisite for everything that follows.

**Delivers:** Cloud-hosted simulator with user accounts, shareable circuits, and the first features professors cannot get from LTspice (live values on schematic, DC sweep).

**Features addressed:**
- User accounts (Clerk) + cloud save (D1/R2)
- Shareable circuit URLs
- Live values on schematic (voltages/currents overlaid during simulation)
- DC sweep analysis
- Component library expansion to 200+
- LTspice netlist import (.cir/.sp)
- Print-quality PDF export

**Pitfalls to avoid:**
- Over-engineering before validation (#4) -- ship to professors, collect feedback
- Textbook mismatch (#10) -- validate component symbols with pilot professors
- Netlist import compatibility (#11) -- critical for professor adoption

### Phase 3: Classroom Features (Revenue Unlock)

**Rationale:** This phase delivers the features that justify a paid product. Individual professors can use Phase 1-2 for free. Phase 3 creates the instructor tools that departments will pay for. This is where OmniSpice stops being "free LTspice alternative" and becomes "classroom management platform."

**Delivers:** Assignment system, instructor dashboard, and comparison tools that enable structured coursework delivery through OmniSpice.

**Features addressed:**
- Instructor dashboard (create assignments, review student work)
- Assignment management (create, distribute, collect, grade)
- Comparison mode (student circuit vs. reference)
- Circuit restrictions / black-box problems
- Classroom management (invite students, manage sections)

**Pitfalls to avoid:**
- University sales cycle (#14) -- start outreach during Phase 2, not after Phase 3 ships

### Phase 4: Institutional Features (Site License Unlock)

**Rationale:** Site licenses require LMS integration. LTI 1.3 with grade passback is the technical prerequisite for department-wide adoption. Guided labs and Circuit Insights are the pedagogical features that make OmniSpice indispensable once adopted.

**Delivers:** LMS-integrated simulator with guided labs, automated circuit analysis explanations, and fault-finding exercises.

**Features addressed:**
- LMS integration via LTI 1.3 (Canvas, Blackboard, Moodle)
- Grade passback to LMS gradebook
- Guided labs with checkpoints
- Circuit Insights (deterministic, rule-based plain-language explanations)
- Fault-finding exercises
- Lab report export (PDF with schematics + waveforms + annotations)

**Pitfalls to avoid:**
- COOP/COEP breaking LMS embeds (#2) -- already mitigated in Phase 1

### Phase 5: Collaboration and Polish

**Rationale:** Real-time collaboration is technically impressive and a strong differentiator, but it is NOT a prerequisite for revenue or adoption. Professors adopted LTspice without collaboration. Build it after the product is generating revenue and has a stable user base.

**Delivers:** Real-time co-editing of circuits, offline support, and UX polish.

**Features addressed:**
- Real-time collaboration (Yjs + Cloudflare Durable Objects)
- Offline mode (Service Worker + IndexedDB)
- Dark mode
- LaTeX export
- Measurement annotations on waveforms

**Pitfalls to avoid:**
- CRDT/simulation state mismatch (#8) -- snapshot-based simulation, version-tagged results
- Stale WASM cache (#13) -- version-stamped binaries

### Phase Ordering Rationale

- **Phase 1 before everything**: The circuit data model is the dependency root. Every other component reads or writes it. The ngspice WASM build is the highest-risk integration. Retiring risk early is essential.
- **Phase 2 before Phase 3**: Cloud save and user accounts are prerequisites for classroom features. Professor pilots in Phase 2 determine Phase 3 priorities.
- **Phase 3 before Phase 4**: Assignment management is the prerequisite for LMS grade passback. You cannot integrate with an LMS without having assignments to grade.
- **Phase 4 before Phase 5**: Institutional features (LMS, guided labs) drive revenue. Collaboration is nice-to-have. Revenue pays for collaboration development.
- **Collaboration last**: Yjs integration wraps existing functionality. It should be layered on top, not designed into the core. The architecture supports adding it late because the circuit data model is already a serializable graph.

### Research Flags

Phases needing deeper research during planning:
- **Phase 1 (WASM build):** ngspice Emscripten compilation is poorly documented beyond a few GitHub repos. The pipe-mode vs. shared-library API decision needs hands-on validation. Budget a 1-2 week spike.
- **Phase 1 (Custom edges in React Flow):** Wire routing with orthogonal segments and T-junctions via custom React Flow edges needs a proof-of-concept before committing. Budget a 1-week spike.
- **Phase 4 (LTI 1.3):** LTI 1.3 Advantage with Assignment and Grading Services is complex. Canvas, Blackboard, and Moodle each have implementation quirks. Needs dedicated research.
- **Phase 5 (Yjs + React Flow):** Yjs integration with React Flow has community examples but no official support. The sync adapter between React Flow's internal store and a Y.Doc needs prototyping.

Phases with standard patterns (skip deep research):
- **Phase 2 (Auth + Cloud save):** Clerk + Cloudflare D1/R2 is well-documented. Standard CRUD patterns.
- **Phase 3 (Classroom features):** Application-level business logic on top of working infrastructure. No novel technical challenges.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All core technologies verified against npm, GitHub, and official docs. Version numbers confirmed. License terms checked. |
| Features | MEDIUM-HIGH | Based on analysis of 10+ competing products and academic course requirements. Not yet validated with actual professor interviews. |
| Architecture | HIGH | Core pipeline (editor -> model -> netlister -> worker -> viewer) is validated by EEcircuit reference implementation. |
| Pitfalls | HIGH | WASM memory, convergence errors, and COOP/COEP are well-documented failure modes with multiple sources confirming. |
| Canvas library resolution | MEDIUM | React Flow CAN work for circuits with custom edges and junction nodes, but the wire routing UX needs a proof-of-concept in Phase 1. This is the residual risk from the tldraw/React Flow tradeoff. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

1. **React Flow wire routing UX** -- Need a working proof-of-concept of orthogonal wire routing with T-junctions using custom edges and invisible junction nodes. If this proves unworkable, fall back to Konva with a custom graph layer (higher engineering cost, 4-6 weeks). Must validate in first week of Phase 1.

2. **ngspice WASM build reproducibility** -- The danchitnis/ngspice build scripts were last updated June 2025. Must verify they work with ngspice 45.x and current Emscripten. Budget a 1-2 week spike at start of Phase 1.

3. **Professor validation** -- Feature priorities are based on competitive analysis, not direct professor input. The top 3-5 professor pilot relationships should be established during Phase 1 development, with structured feedback sessions starting in Phase 2.

4. **Clerk pricing at scale** -- Clerk's pricing for SSO/SAML (required for university IdP) needs verification against projected user counts. If prohibitive, Better Auth (open-source, self-hosted on Workers) is the fallback. Verify before Phase 2.

5. **Chromebook performance baseline** -- The target of "50-node circuit in <5 seconds on 4GB Chromebook" needs validation with actual hardware or calibrated DevTools throttling. Must be a Phase 1 CI target.

6. **D1 suitability for circuit storage** -- D1 has a 10GB database limit. Need to model storage growth: how many circuits per student, average circuit size, how many universities before hitting limits. R2 may need to be primary storage with D1 as metadata index.

## Open Questions for Phase 1

1. **Pipe-mode vs. shared-library API for ngspice WASM** -- STACK.md recommends pipe-mode (stdin/stdout via FS.init) due to documented Emscripten compatibility issues with the shared library API. ARCHITECTURE.md describes the shared library API (ngSpice_Init, ngSpice_Command, SendData callbacks). These are contradictory. Must resolve with a hands-on spike. The shared library API is more capable (streaming results, progress callbacks) but may not compile cleanly with Emscripten. Pipe-mode is simpler but requires output parsing.

2. **React Flow custom edge performance at scale** -- Custom SVG path edges with orthogonal routing logic: what is the performance ceiling? React Flow's built-in viewport culling helps, but custom edge path calculations run on every render. Need to benchmark with 200+ wires.

3. **Component symbol rendering approach** -- SVG components rendered as React Flow custom nodes. Should these be hand-drawn SVGs, generated from a component description DSL, or imported from an existing open-source symbol library (e.g., KiCad symbols)? Impacts both visual quality and development speed.

4. **Initial WASM memory vs. Chromebook RAM** -- Pitfalls recommend 256MB initial allocation, but Chromebook mitigation suggests 64-128MB. These conflict. Need to profile actual memory usage of representative circuits to find the right tradeoff.

5. **Monorepo structure** -- With a React SPA frontend, Cloudflare Workers backend, and a shared circuit data model library, should this be a pnpm workspace monorepo? If so, what package boundaries? Decision needed before first `pnpm init`.

## Sources

### Primary (HIGH confidence)
- @xyflow/react npm -- v12.10.2, MIT license verified
- tldraw pricing (tldraw.dev/pricing) -- $6,000/yr commercial license confirmed
- ngspice shared library API (ngspice.sourceforge.io/shared.html) -- callback interface documentation
- Emscripten memory settings -- ALLOW_MEMORY_GROWTH, INITIAL_MEMORY
- Emscripten Filesystem API -- MEMFS documentation
- Cross-origin isolation web.dev -- COOP/COEP tradeoffs
- danchitnis/ngspice GitHub -- WASM build reference
- EEcircuit GitHub -- Reference architecture
- Yjs docs -- CRDT documentation
- Cloudflare Durable Objects docs -- Collaboration infrastructure

### Secondary (MEDIUM confidence)
- NI Multisim educational features -- Competitor feature analysis
- CircuitLab -- Web-based simulator reference
- DCACLab -- Assignment management reference
- Synergy Codes Yjs + React Flow ebook -- Collaboration integration
- y-durableobjects GitHub -- Cloudflare Yjs provider
- uPlot GitHub -- Performance benchmarks
- EdTech adoption research WGU Labs -- Adoption failure modes

### Tertiary (LOW confidence)
- tldraw custom shapes docs -- Referenced by architecture but not used (license rejected)
- wokwi/ngspice-wasm -- Alternative WASM build, 7 stars, unmaintained
- webgl-plot GitHub -- Rejected alternative, 395 stars

---
*Research completed: 2026-04-09*
*Ready for roadmap: yes*
