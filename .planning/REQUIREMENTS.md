# Requirements: OmniSpice

**Defined:** 2026-04-09
**Core Value:** Students can simulate circuits accurately in a modern, intuitive interface that helps them understand circuits — not just compute them.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Schematic Editor

- [x] **SCHEM-01**: User can drag components from a library panel onto an infinite canvas
- [x] **SCHEM-02**: User can connect components with wires that snap to component pins and route with bends/junctions
- [x] **SCHEM-03**: User can select, move, rotate, copy, and delete components and wire segments
- [ ] **SCHEM-04**: User can edit component values inline (resistance, capacitance, voltage, etc.) with a single click
- [x] **SCHEM-05**: User can undo/redo all schematic edits
- [x] **SCHEM-06**: User can pan and zoom the canvas with scroll wheel and trackpad gestures
- [x] **SCHEM-07**: Schematic renders cleanly with proper EE symbols (not flowchart boxes)
- [ ] **SCHEM-08**: User can add and connect ground, voltage reference, and port symbols

### Component Library

- [x] **COMP-01**: Library includes core passives (resistor, capacitor, inductor, transformer)
- [x] **COMP-02**: Library includes diodes (generic, Zener, Schottky) with default SPICE models
- [x] **COMP-03**: Library includes BJTs (NPN, PNP) with default SPICE models
- [x] **COMP-04**: Library includes MOSFETs (NMOS, PMOS) with default SPICE models
- [x] **COMP-05**: Library includes op-amps (ideal and real models including uA741, LM741)
- [x] **COMP-06**: Library includes independent voltage/current sources (DC, AC, pulse, sinusoidal, PWL)
- [x] **COMP-07**: User can search the component library by name, type, or value with fuzzy search
- [x] **COMP-08**: User can import third-party SPICE models (.mod / .lib files) for advanced components

### Simulation

- [ ] **SIM-01**: User can run DC operating point analysis and see node voltages and branch currents
- [ ] **SIM-02**: User can run transient analysis with configurable stop time and timestep
- [ ] **SIM-03**: User can run AC analysis (frequency sweep) with configurable range and points
- [ ] **SIM-04**: User can run DC sweep analysis with configurable source and range
- [ ] **SIM-05**: Simulation runs in a Web Worker (non-blocking — UI stays responsive)
- [ ] **SIM-06**: User sees a progress indicator while simulation is running
- [ ] **SIM-07**: User can cancel a running simulation

### Error Handling

- [x] **ERR-01**: Simulation errors display human-readable messages (not raw ngspice output)
- [x] **ERR-02**: Convergence failures include specific guidance ("Node X has no DC path to ground — add a ground connection")
- [x] **ERR-03**: Pre-simulation circuit validation catches common wiring mistakes before running ngspice (floating nodes, missing ground, short circuits)
- [x] **ERR-04**: Component model errors identify the specific component by name and value

### Waveform Viewer

- [x] **WAVE-01**: Simulation results display in a waveform panel with time-domain plots for transient analysis
- [x] **WAVE-02**: AC analysis results display as Bode plots (magnitude and phase vs frequency)
- [x] **WAVE-03**: User can toggle signal visibility and assign colors to individual signals
- [x] **WAVE-04**: User can zoom and pan within the waveform view
- [x] **WAVE-05**: User can place cursors and read exact values at any point on the waveform
- [x] **WAVE-06**: Auto-measurements overlay on waveform (Vpp, frequency, RMS, rise time) with one click

### Live Simulation Overlay

- [x] **LIVE-01**: After simulation completes, node voltages display inline on the schematic at each net
- [x] **LIVE-02**: After simulation completes, component current and power display on each component
- [x] **LIVE-03**: Live overlay values update automatically when the user re-runs simulation

### Cloud and Accounts

- [x] **CLOUD-01**: User can create an account with email and password
- [x] **CLOUD-02**: User session persists across browser refresh
- [x] **CLOUD-03**: User can save circuits to cloud storage and see a list of saved circuits
- [x] **CLOUD-04**: User can share a circuit via a read-only link that opens in any browser without login
- [x] **CLOUD-05**: User can duplicate any circuit (own or shared) to their own workspace

### LTspice Compatibility

- [x] **LTSP-01**: User can import an LTspice .asc schematic file and have it rendered on the canvas
- [x] **LTSP-02**: Imported LTspice circuits simulate correctly using the embedded netlist data

### Export

- [x] **EXP-01**: User can export the schematic as a PNG or SVG image
- [x] **EXP-02**: User can export simulation waveforms as PNG or CSV data
- [x] **EXP-03**: User can export the underlying SPICE netlist as a .cir / .net file

## v2 Requirements

Deferred to v2. Tracked but not in current roadmap.

### Classroom Management

- **CLASS-01**: Instructor can create a course and invite students via link or email
- **CLASS-02**: Instructor can create assignments with starter circuits and instructions
- **CLASS-03**: Student can submit a completed circuit to an assignment
- **CLASS-04**: Instructor can view all student submissions for an assignment
- **CLASS-05**: Instructor can annotate and grade student circuit submissions

### LMS Integration

- [x] **LMS-01**: OmniSpice supports LTI 1.3 Deep Linking for embedding assignments in Canvas, Blackboard, and Moodle — _completed in Phase 04 Plan 03_
- [x] **LMS-02**: Completed assignments pass grades back to LMS gradebook via LTI AGS — _completed in Phase 04 Plan 03_
- [x] **LMS-03**: Students launch OmniSpice assignments directly from their LMS without separate login — _completed in Phase 04 Plan 02_

### Guided Labs

- [x] **LAB-01**: Instructor can author a guided lab with step-by-step instructions and circuit checkpoints
- [x] **LAB-02**: Student progresses through a guided lab with automatic checkpoint verification
- [x] **LAB-03**: Guided lab compares student waveforms against reference waveforms with tolerance

### Editor Craft

Pillar decomposition for Phase 5 — the vision-ceiling target for the schematic editor. Each requirement addresses one observable capability. Details in `.planning/phases/05-collaboration-and-polish/05-VISION-CEILING.md`.

#### Pillar 1 — Schematic Honesty

- **EDIT-01**: Every pin carries a `pinType` (signal / power / ground / supply) and `direction` (in / out / inout); the 12 existing node components declare pin metadata statically and the netlister reads from it
- **EDIT-02**: Dragging a wire from a pin highlights every other visible pin with one of three compat states (`ok` green + pulse, `neutral` gray shrunk, `error` red with diagonal slash). Connection is never blocked — the slash is pedagogical feedback only
- **EDIT-03**: User can type a name while a wire is selected to drop a net label; label is a `net-label` node type; every wire in the same electrical net re-labels automatically
- **EDIT-04**: `Ctrl+G` collapses the current selection into a subcircuit node with auto-derived exposed pins; double-click descends with a breadcrumb; `Esc` or breadcrumb `Home` ascends. V1 ships single-level nesting only
- **EDIT-05**: Orthogonal wire routing produces readable schematics on a 20+ component reference circuit (Playwright visual-regression baseline); no wire overlaps a component body; all segments are H or V except explicit `Shift`-drag diagonals

#### Pillar 2 — Modelessness

- **EDIT-06**: Typing a letter on empty canvas opens the component-insert search at the cursor position; typing `R` + `Enter` places a resistor at the insert cursor; the word "mode" appears nowhere in editor UI
- **EDIT-07**: Clicking a component body shows a floating parameter chip (`@floating-ui/react`) above the node; clicking a value edits it inline; `Tab`/`Shift+Tab` cycles parameters; `Esc` deselects. PropertyPanel remains as a11y escape hatch
- **EDIT-08**: Clicking and horizontal-dragging a parameter value in the chip scrubs it continuously via Pointer Lock API; DC op-point updates live; transient commits on pointer release
- **EDIT-09**: `Space`-drag pans the canvas regardless of current context; `Shift+D` duplicates current selection preserving internal wires; double-click a node frames it via `setCenter`
- **EDIT-10**: `R` rotates when a selection exists; `R` on empty canvas with insert cursor filters the component search to the resistor family; full-session undo covers every editor action including parameter edits

#### Pillar 3 — Immediacy

- [x] **EDIT-11**: DC operating point runs automatically on every circuit-store change; results populate the overlay within 10ms on linear circuits; hover tooltip shows `DC op: computing…` while Newton iteration settles on non-linear circuits
- [x] **EDIT-12**: AC sweep runs when an AC probe is present, debounced to 60ms in the tiered controller; intermediate scrub ticks do not trigger AC
- [x] **EDIT-13**: Transient runs on scrub release (pointer-up); during scrub, previous transient result remains visible at `--wire-stale` opacity; scrub mid-transient discards the in-flight run
- [x] **EDIT-14**: `Shift`-scrub on a parameter value activates sweep gesture; chip shows `{min} ↔ {max}`; waveform fans out a family of curves from cached + interpolated sweep results; hover a curve runs the full precise sim for that point

#### Pillar 4 — Live Feedback

- **EDIT-15**: `Ctrl+K` with canvas focus opens a command palette modal (`cmdk` Command.Dialog) with groups `Actions`, `Circuits`, `Templates`, `Docs`; library search (Sidebar) continues to own `Ctrl+K` only when sidebar input has focus
- **EDIT-16**: Hovering any node shows a tooltip with `V`, `I`, `P`, and DC op-point status; wires render their stroke colored by instantaneous voltage via OKLab interpolation between `--wire-v-low` and `--wire-v-high`
- **EDIT-17**: `?` toggles a docked right-panel shortcut help overlay grouped by pillar; `<MiniMap/>` is always visible in the bottom-right; `F` / `A` / `0` frame selection / frame all / frame all; change callouts ("+ Added R3") render in a dedicated z-layer for 780ms

#### Pillar 5 — Pedagogy Folded In

- **EDIT-18**: Passive insight badges render on the waveform viewer and on schematic nodes when rules fire; each badge is a pill with a one-sentence summary; click expands to a card with optional KaTeX formula. Five v1 rules: `rc-time-constant`, `class-a-bias`, `op-amp-saturation`, `gain-bandwidth-product`, `voltage-divider-ratio`
- **EDIT-19**: Clicking a waveform peak/point opens a measurement callout populated from `useMeasurements`; user adds an optional note; callouts persist in `reportAnnotationsStore` and feed `ReportData.sections.annotations[]` so the Phase 4 PDF/LaTeX exporter renders them in the lab report
- **EDIT-20**: Circuit templates (bundled JSON under `src/templates/`) appear in the command palette's `Templates` group; selecting a template inserts its components at the cursor with auto-renumbered ref designators. V1 templates: voltage divider, RC low-pass, BJT common-emitter, op-amp inverting, op-amp non-inverting

### Collaboration

Phase 5 scope is **presence only** — awareness protocol via Yjs + `y-durableobjects`. Full CRDT state sync is explicitly deferred to Phase 6+. Circuit data stays in Zustand; Yjs carries only the `awareness` channel.

- **COLLAB-01**: Two users with the same circuit open see each other's live cursors rendered in their assigned presence color from `--presence-1..8`; cursors fade after 1500ms of idle
- **COLLAB-02**: Remote selection (components other users have selected) is rendered as a `1px` outline in the peer's color with a `10%` fill; overlays without replacing the local `--accent-primary` selection outline
- **COLLAB-03**: When a peer opens a parameter chip, a ghost chip renders in their color at 50% opacity, non-interactive; the presence list at top-right shows up to 8 distinct-colored avatars; clicking an avatar frames that user's viewport

### Circuit Insights

Phase 5 v1 ships a **deterministic rules engine** with passive badges. The older "click any node → plain-English Kirchhoff walkthrough" interpretation is deferred to a later phase.

- **INSIGHT-01**: After simulation, the insight rules engine evaluates `{ circuit, vectors, measurements }` and produces 0+ `Insight` objects; each badge is anchored to a `waveform-region`, `waveform-point`, `schematic-node`, or `schematic-net` and renders per UI-SPEC §7.9
- **INSIGHT-02**: Clicking an insight badge expands it into a card with summary, optional expanded explanation, and optional KaTeX-rendered formula; content is deterministic (no LLM); rules live in `src/insights/rules/*.ts`; users can dismiss a badge per session (not persisted)

### Advanced Simulation

- **ADVSIM-01**: User can run parametric sweep (vary component value across simulation runs)
- **ADVSIM-02**: User can run Monte Carlo analysis (component tolerance simulation)
- **ADVSIM-03**: User can run noise analysis

### Export and Reporting

- [x] **RPT-01**: User can export a lab report PDF with schematic, waveforms, annotations, and measurements — _completed in Phase 04 Plan 06_
- [x] **RPT-02**: Lab report export supports LaTeX format for academic submission — _completed in Phase 04 Plan 06_

### Offline Support

- **OFFLINE-01**: User can close the browser, reopen with no network, and see their circuit in the same state it was in; service worker precache includes the ngspice WASM binary via `vite-plugin-pwa` with `registerType: 'autoUpdate'` and `globPatterns` including `wasm`
- **OFFLINE-02**: User can keep editing while offline; on reconnect, the Yjs awareness layer re-publishes automatically; circuit state is authoritative from local Zustand (persisted via `idb-keyval`) — no CRDT merge required because no circuit state crosses the Yjs wire in Phase 5

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mobile native apps (iOS/Android) | Web-first with responsive design; native adds build complexity with no simulation advantage |
| PCB layout / routing | Different product category (EDA vs simulation); no overlap with learning goals |
| RF/microwave simulation (S-parameters, transmission lines) | Graduate-level; undergraduate courses don't need it for v1 |
| AI-generated circuit suggestions | Students need to learn by doing; AI-assistance undermines educational value |
| SharedArrayBuffer / WASM threading | Breaks Canvas/Blackboard/Moodle iframe embeds due to COOP/COEP headers |
| Manufacturing output (Gerber, BOM, STEP) | OmniSpice is a simulation tool, not a fabrication pipeline |
| Desktop app / Electron | Zero-install is a core competitive advantage; desktop negates it |
| Verilog / VHDL digital simulation | Different simulation domain; logisim-evolution covers this |

## Traceability

### v1 Requirements (47 total — all mapped)

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCHEM-01 | Phase 1 — Core Simulator | Complete |
| SCHEM-02 | Phase 1 — Core Simulator | Complete |
| SCHEM-03 | Phase 1 — Core Simulator | Complete |
| SCHEM-04 | Phase 1 — Core Simulator | Pending |
| SCHEM-05 | Phase 1 — Core Simulator | Complete |
| SCHEM-06 | Phase 1 — Core Simulator | Complete |
| SCHEM-07 | Phase 1 — Core Simulator | Complete |
| SCHEM-08 | Phase 1 — Core Simulator | Pending |
| COMP-01 | Phase 1 — Core Simulator | Complete |
| COMP-02 | Phase 1 — Core Simulator | Complete |
| COMP-03 | Phase 1 — Core Simulator | Complete |
| COMP-04 | Phase 1 — Core Simulator | Complete |
| COMP-05 | Phase 1 — Core Simulator | Complete |
| COMP-06 | Phase 1 — Core Simulator | Complete |
| COMP-07 | Phase 1 — Core Simulator | Complete |
| COMP-08 | Phase 1 — Core Simulator | Complete |
| SIM-01 | Phase 1 — Core Simulator | Pending |
| SIM-02 | Phase 1 — Core Simulator | Pending |
| SIM-03 | Phase 1 — Core Simulator | Pending |
| SIM-04 | Phase 1 — Core Simulator | Pending |
| SIM-05 | Phase 1 — Core Simulator | Pending |
| SIM-06 | Phase 1 — Core Simulator | Pending |
| SIM-07 | Phase 1 — Core Simulator | Pending |
| ERR-01 | Phase 1 — Core Simulator | Complete |
| ERR-02 | Phase 1 — Core Simulator | Complete |
| ERR-03 | Phase 1 — Core Simulator | Complete |
| ERR-04 | Phase 1 — Core Simulator | Complete |
| WAVE-01 | Phase 1 — Core Simulator | Complete |
| WAVE-02 | Phase 1 — Core Simulator | Complete |
| WAVE-03 | Phase 1 — Core Simulator | Complete |
| WAVE-04 | Phase 1 — Core Simulator | Complete |
| WAVE-05 | Phase 1 — Core Simulator | Complete |
| WAVE-06 | Phase 1 — Core Simulator | Complete |
| LIVE-01 | Phase 2 — Cloud and Compatibility | Complete |
| LIVE-02 | Phase 2 — Cloud and Compatibility | Complete |
| LIVE-03 | Phase 2 — Cloud and Compatibility | Complete |
| CLOUD-01 | Phase 2 — Cloud and Compatibility | Complete |
| CLOUD-02 | Phase 2 — Cloud and Compatibility | Complete |
| CLOUD-03 | Phase 2 — Cloud and Compatibility | Complete |
| CLOUD-04 | Phase 2 — Cloud and Compatibility | Complete |
| CLOUD-05 | Phase 2 — Cloud and Compatibility | Complete |
| LTSP-01 | Phase 2 — Cloud and Compatibility | Complete |
| LTSP-02 | Phase 2 — Cloud and Compatibility | Complete |
| EXP-01 | Phase 2 — Cloud and Compatibility | Complete |
| EXP-02 | Phase 2 — Cloud and Compatibility | Complete |
| EXP-03 | Phase 2 — Cloud and Compatibility | Complete |

**Coverage:**
- v1 requirements: 47 total
- Mapped to phases: 47
- Unmapped: 0

### v2 Requirements (planned phases 3-5)

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLASS-01 | Phase 3 — Classroom Features | v2 |
| CLASS-02 | Phase 3 — Classroom Features | v2 |
| CLASS-03 | Phase 3 — Classroom Features | v2 |
| CLASS-04 | Phase 3 — Classroom Features | v2 |
| CLASS-05 | Phase 3 — Classroom Features | v2 |
| LMS-01 | Phase 4 — Institutional Features | Completed (04-03) |
| LMS-02 | Phase 4 — Institutional Features | Completed (04-03) |
| LMS-03 | Phase 4 — Institutional Features | Completed (04-02) |
| LAB-01 | Phase 4 — Institutional Features | v2 |
| LAB-02 | Phase 4 — Institutional Features | Completed (04-04) |
| LAB-03 | Phase 4 — Institutional Features | Completed (04-04) |
| RPT-01 | Phase 4 — Institutional Features | Completed (04-06) |
| RPT-02 | Phase 4 — Institutional Features | Completed (04-06) |
| EDIT-01 | Phase 5 — Editor Craft and Collaboration | v2 (Plan 05-02) |
| EDIT-02 | Phase 5 — Editor Craft and Collaboration | v2 (Plan 05-02) |
| EDIT-03 | Phase 5 — Editor Craft and Collaboration | v2 (Plan 05-02) |
| EDIT-04 | Phase 5 — Editor Craft and Collaboration | v2 (Plan 05-03) |
| EDIT-05 | Phase 5 — Editor Craft and Collaboration | v2 (Plan 05-02) |
| EDIT-06 | Phase 5 — Editor Craft and Collaboration | v2 (Plan 05-06) |
| EDIT-07 | Phase 5 — Editor Craft and Collaboration | v2 (Plan 05-05) |
| EDIT-08 | Phase 5 — Editor Craft and Collaboration | v2 (Plan 05-05) |
| EDIT-09 | Phase 5 — Editor Craft and Collaboration | v2 (Plan 05-01) |
| EDIT-10 | Phase 5 — Editor Craft and Collaboration | v2 (Plan 05-06) |
| EDIT-11 | Phase 5 — Editor Craft and Collaboration | Completed (05-04) |
| EDIT-12 | Phase 5 — Editor Craft and Collaboration | Completed (05-04) |
| EDIT-13 | Phase 5 — Editor Craft and Collaboration | Completed (05-04 backbone; Plan 05-05 consumes the `omnispice:scrub-committed` event) |
| EDIT-14 | Phase 5 — Editor Craft and Collaboration | Completed (05-04 backbone; Plan 05-08 adds interpolation on cached sweep points) |
| EDIT-15 | Phase 5 — Editor Craft and Collaboration | v2 (Plan 05-06) |
| EDIT-16 | Phase 5 — Editor Craft and Collaboration | v2 (Plan 05-07) |
| EDIT-17 | Phase 5 — Editor Craft and Collaboration | v2 (Plans 05-01 + 05-11) |
| EDIT-18 | Phase 5 — Editor Craft and Collaboration | v2 (Plan 05-08) |
| EDIT-19 | Phase 5 — Editor Craft and Collaboration | v2 (Plan 05-08) |
| EDIT-20 | Phase 5 — Editor Craft and Collaboration | v2 (Plan 05-06) |
| COLLAB-01 | Phase 5 — Editor Craft and Collaboration | v2 (Plan 05-09) |
| COLLAB-02 | Phase 5 — Editor Craft and Collaboration | v2 (Plan 05-09) |
| COLLAB-03 | Phase 5 — Editor Craft and Collaboration | v2 (Plan 05-09) |
| INSIGHT-01 | Phase 5 — Editor Craft and Collaboration | v2 (Plan 05-08) |
| INSIGHT-02 | Phase 5 — Editor Craft and Collaboration | v2 (Plan 05-08) |
| OFFLINE-01 | Phase 5 — Editor Craft and Collaboration | v2 (Plan 05-10) |
| OFFLINE-02 | Phase 5 — Editor Craft and Collaboration | v2 (Plan 05-10) |
| ADVSIM-01 | v2 — unscheduled | v2 |
| ADVSIM-02 | v2 — unscheduled | v2 |
| ADVSIM-03 | v2 — unscheduled | v2 |

---
*Requirements defined: 2026-04-09*
*Last updated: 2026-04-11 — EDIT-01..EDIT-20 added via /gsd:plan-phase 5; COLLAB/INSIGHT/OFFLINE wording revised to match vision-ceiling scope*
