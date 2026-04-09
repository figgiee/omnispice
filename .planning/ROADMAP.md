# Roadmap: OmniSpice

## Overview

OmniSpice ships in two v1 phases: the core simulator (the highest-risk work — schematic editor, ngspice WASM engine, and waveform viewer), then cloud infrastructure and compatibility (accounts, sharing, LTspice import, export). After v1 ships to professor pilots and revenue validates, three v2 phases add classroom management, institutional LMS features, and real-time collaboration. Every phase delivers a coherent, verifiable capability. No phase exists to organize code — each phase delivers something a user can observe and use.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Core Simulator** - Functional offline circuit simulator: schematic editor, ngspice WASM engine, waveform viewer, component library, and human-readable errors
- [ ] **Phase 2: Cloud and Compatibility** - User accounts, cloud save, shareable links, live schematic overlay, LTspice import, and export
- [ ] **Phase 3: Classroom Features** - Instructor dashboard, assignment management, and comparison mode — the revenue unlock
- [ ] **Phase 4: Institutional Features** - LMS integration, guided labs, lab report export — the site license unlock
- [ ] **Phase 5: Collaboration and Polish** - Real-time co-editing, offline support, and Circuit Insights

## Phase Details

### Phase 1: Core Simulator
**Goal**: A professor can open OmniSpice in a browser, draw a circuit, run a simulation, and read the results — with no install, no account, and no cryptic error messages.
**Depends on**: Nothing (first phase)
**Requirements**: SCHEM-01, SCHEM-02, SCHEM-03, SCHEM-04, SCHEM-05, SCHEM-06, SCHEM-07, SCHEM-08, COMP-01, COMP-02, COMP-03, COMP-04, COMP-05, COMP-06, COMP-07, COMP-08, SIM-01, SIM-02, SIM-03, SIM-04, SIM-05, SIM-06, SIM-07, ERR-01, ERR-02, ERR-03, ERR-04, WAVE-01, WAVE-02, WAVE-03, WAVE-04, WAVE-05, WAVE-06
**Success Criteria** (what must be TRUE):
  1. User can drag a resistor, capacitor, and voltage source onto the canvas, connect them with wires, and see a correctly rendered EE schematic
  2. User can run a transient simulation and see the output waveform plotted with time on x-axis, with zoom, pan, and cursor readout working
  3. User can run an AC analysis and see a Bode plot (magnitude and phase) for the circuit
  4. When a user submits a circuit with a floating node, they see a plain-English error message identifying the specific node and suggesting a fix — not raw ngspice output
  5. User can search the component library by typing "741" and find the LM741 op-amp, place it, and simulate with it
**Plans:** 3/8 plans executed

Plans:
- [x] 01-01-PLAN.md — Project scaffolding, design system CSS tokens, test infrastructure
- [x] 01-02-PLAN.md — Circuit data model, netlister, validator, error translator (pure TypeScript)
- [x] 01-03-PLAN.md — ngspice WASM build, Web Worker, simulation controller, output parser
- [ ] 01-04-PLAN.md — React Flow canvas, custom IEEE/IEC component SVG nodes
- [ ] 01-05-PLAN.md — Zustand state stores (circuit with undo/redo, simulation, UI)
- [ ] 01-06-PLAN.md — Wire routing, canvas interactions, keyboard shortcuts
- [ ] 01-07-PLAN.md — Waveform viewer (uPlot), Bode plots, cursors, measurements
- [ ] 01-08-PLAN.md — UI shell integration (sidebar, toolbar, bottom panel, layout wiring)

**Key risks**:
  - ngspice WASM build reproducibility with ngspice 45.x + current Emscripten (budget 1-2 week spike)
  - React Flow orthogonal wire routing with T-junctions needs proof-of-concept before committing (budget 1-week spike)
  - WASM memory exhaustion on large circuits — set INITIAL_MEMORY=256MB, ALLOW_MEMORY_GROWTH=1 from day one
  - No SharedArrayBuffer anywhere — single-threaded ngspice in Web Worker only
**UI hint**: yes

### Phase 2: Cloud and Compatibility
**Goal**: Users can save circuits to the cloud, share them via link, see live voltage/current values on the schematic, import LTspice circuits, and export their work.
**Depends on**: Phase 1
**Requirements**: LIVE-01, LIVE-02, LIVE-03, CLOUD-01, CLOUD-02, CLOUD-03, CLOUD-04, CLOUD-05, LTSP-01, LTSP-02, EXP-01, EXP-02, EXP-03
**Success Criteria** (what must be TRUE):
  1. User can create an account with email and password, log in, and find their saved circuits after refreshing the browser
  2. User can share a circuit via a link and a recipient can open it in a different browser with no login required
  3. After simulation completes, node voltages appear directly on the schematic wires and component currents appear on each component
  4. User can import an LTspice .asc file and see the circuit rendered on the canvas, then simulate it
  5. User can export the schematic as PNG and the waveform as CSV in one click
**Plans**: TBD
**Key risks**:
  - Clerk SSO/SAML pricing at scale for university IdPs — verify before implementation
  - D1 storage limits for circuits at scale — model storage growth, R2 may need to be primary
  - LTspice .asc parser completeness — test with real professor schematics, not toy examples
**UI hint**: yes

### Phase 3: Classroom Features
**Goal**: Instructors can create assignments with starter circuits, distribute them to students, collect submissions, and grade them — making OmniSpice a paid tool for departments.
**Depends on**: Phase 2
**Requirements**: CLASS-01, CLASS-02, CLASS-03, CLASS-04, CLASS-05
**Success Criteria** (what must be TRUE):
  1. Instructor can create a course, add an assignment with a starter circuit and instructions, and share an enrollment link with students
  2. Student can open an assignment, modify the starter circuit, and submit it to the instructor
  3. Instructor can view all student submissions for an assignment in a single dashboard view
  4. Instructor can annotate a student's circuit submission and assign a grade
**Plans**: TBD
**Key risks**:
  - University sales cycle is long — begin outreach during Phase 2, not after Phase 3 ships
  - Feature scope must be validated with 3-5 pilot professors before full build
**UI hint**: yes

### Phase 4: Institutional Features
**Goal**: Departments can embed OmniSpice in Canvas, Blackboard, or Moodle with automatic grade passback, and students can work through guided labs with automatic checkpoint verification.
**Depends on**: Phase 3
**Requirements**: LMS-01, LMS-02, LMS-03, LAB-01, LAB-02, LAB-03, RPT-01, RPT-02
**Success Criteria** (what must be TRUE):
  1. A Canvas instructor can embed an OmniSpice assignment as an LTI 1.3 deep link and see grades automatically appear in the Canvas gradebook when students submit
  2. Student can launch an OmniSpice assignment from Canvas without a separate login
  3. Student can work through a guided lab with step-by-step instructions and see automatic pass/fail feedback at each checkpoint
  4. User can export a complete lab report as a PDF with schematic, waveforms, measurements, and annotations formatted for academic submission
**Plans**: TBD
**Key risks**:
  - LTI 1.3 implementation has quirks across Canvas, Blackboard, Moodle — budget dedicated research and test accounts for each LMS
  - COOP/COEP headers must NOT be set — LMS iframes break with cross-origin isolation (already mitigated in Phase 1)
**UI hint**: yes

### Phase 5: Collaboration and Polish
**Goal**: Two students can edit the same circuit simultaneously in real time, the app works offline after first load, and Circuit Insights gives plain-language explanations of simulation results.
**Depends on**: Phase 4
**Requirements**: COLLAB-01, COLLAB-02, COLLAB-03, INSIGHT-01, INSIGHT-02, OFFLINE-01, OFFLINE-02
**Success Criteria** (what must be TRUE):
  1. Two users with the same circuit open can move components simultaneously and see each other's cursors and selections without conflicts
  2. User can close the browser, reopen offline, continue editing a circuit, then reconnect and see changes synced to cloud
  3. User can click any node after simulation and read a plain-English explanation of how that voltage was determined
**Plans**: TBD
**Key risks**:
  - Yjs + React Flow sync adapter has no official support — needs a prototyping spike before Phase 5 planning
  - CRDT and simulation state can diverge — use snapshot-based simulation with version-tagged results
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Simulator | 3/8 | In Progress|  |
| 2. Cloud and Compatibility | 0/TBD | Not started | - |
| 3. Classroom Features | 0/TBD | Not started | - |
| 4. Institutional Features | 0/TBD | Not started | - |
| 5. Collaboration and Polish | 0/TBD | Not started | - |
