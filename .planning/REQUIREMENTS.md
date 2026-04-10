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

- **LMS-01**: OmniSpice supports LTI 1.3 Deep Linking for embedding assignments in Canvas, Blackboard, and Moodle
- **LMS-02**: Completed assignments pass grades back to LMS gradebook via LTI AGS
- [x] **LMS-03**: Students launch OmniSpice assignments directly from their LMS without separate login — _completed in Phase 04 Plan 02_

### Guided Labs

- [ ] **LAB-01**: Instructor can author a guided lab with step-by-step instructions and circuit checkpoints
- [x] **LAB-02**: Student progresses through a guided lab with automatic checkpoint verification
- [x] **LAB-03**: Guided lab compares student waveforms against reference waveforms with tolerance

### Collaboration

- **COLLAB-01**: Two users can edit the same circuit simultaneously with real-time sync
- **COLLAB-02**: Collaborators see each other's cursors and selections
- **COLLAB-03**: Offline edits sync automatically when the user reconnects

### Circuit Insights

- **INSIGHT-01**: User can click any node and get a plain-language explanation of how that voltage was determined (Kirchhoff's laws walkthrough)
- **INSIGHT-02**: User can ask "why is this value X?" and get a deterministic circuit analysis explanation

### Advanced Simulation

- **ADVSIM-01**: User can run parametric sweep (vary component value across simulation runs)
- **ADVSIM-02**: User can run Monte Carlo analysis (component tolerance simulation)
- **ADVSIM-03**: User can run noise analysis

### Export and Reporting

- **RPT-01**: User can export a lab report PDF with schematic, waveforms, annotations, and measurements
- **RPT-02**: Lab report export supports LaTeX format for academic submission

### Offline Support

- **OFFLINE-01**: App works offline via PWA service worker after first load
- **OFFLINE-02**: Offline edits sync to cloud when connectivity is restored

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
| LMS-01 | Phase 4 — Institutional Features | v2 |
| LMS-02 | Phase 4 — Institutional Features | v2 |
| LMS-03 | Phase 4 — Institutional Features | Completed (04-02) |
| LAB-01 | Phase 4 — Institutional Features | v2 |
| LAB-02 | Phase 4 — Institutional Features | Completed (04-04) |
| LAB-03 | Phase 4 — Institutional Features | Completed (04-04) |
| RPT-01 | Phase 4 — Institutional Features | v2 |
| RPT-02 | Phase 4 — Institutional Features | v2 |
| COLLAB-01 | Phase 5 — Collaboration and Polish | v2 |
| COLLAB-02 | Phase 5 — Collaboration and Polish | v2 |
| COLLAB-03 | Phase 5 — Collaboration and Polish | v2 |
| INSIGHT-01 | Phase 5 — Collaboration and Polish | v2 |
| INSIGHT-02 | Phase 5 — Collaboration and Polish | v2 |
| OFFLINE-01 | Phase 5 — Collaboration and Polish | v2 |
| OFFLINE-02 | Phase 5 — Collaboration and Polish | v2 |
| ADVSIM-01 | v2 — unscheduled | v2 |
| ADVSIM-02 | v2 — unscheduled | v2 |
| ADVSIM-03 | v2 — unscheduled | v2 |

---
*Requirements defined: 2026-04-09*
*Last updated: 2026-04-09 — traceability expanded after roadmap creation*
