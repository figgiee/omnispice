# Phase 1: Core Simulator - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Functional offline circuit simulator: schematic editor with drag-and-drop components, wire connections, component library with fuzzy search, ngspice WASM simulation engine (DC, AC, transient, DC sweep), interactive waveform viewer with cursors and measurements, and human-readable error messages. No accounts, no cloud, no collaboration — pure client-side simulation in the browser.

</domain>

<decisions>
## Implementation Decisions

### Schematic Canvas Interaction
- **D-01:** Magnetic snap — dragging a component near a wire/pin auto-connects with visual feedback (glow/highlight on valid connection points)
- **D-02:** Grid-based layout with snap-to-grid for component placement (configurable grid size, default 10px)
- **D-03:** Standard selection model — click to select, shift+click for multi-select, drag for marquee selection
- **D-04:** Zoom via scroll wheel, pan via middle-click drag or spacebar+drag (Figma-style)
- **D-05:** Copy/paste/delete via standard keyboard shortcuts (Ctrl+C, Ctrl+V, Delete)

### Component Symbol Rendering
- **D-06:** Standard IEEE/IEC electrical engineering symbols — resistor zigzag, capacitor parallel plates, inductor loops, etc. NOT flowchart rectangles
- **D-07:** Component values display inline next to the symbol (e.g., "10kΩ" next to resistor)
- **D-08:** Click on component value to edit inline — no modal dialog for simple value changes
- **D-09:** Component rotation via R key when selected or during drag

### Wire Routing
- **D-10:** Orthogonal wire routing — wires route at 90-degree angles only (standard EE schematic convention)
- **D-11:** Auto-routing between pins when user clicks source pin then destination pin
- **D-12:** Manual bend placement — user can click intermediate points to force wire path
- **D-13:** T-junctions rendered with a filled dot at the intersection point
- **D-14:** Wire segments are individually selectable and movable

### Simulation Workflow
- **D-15:** Explicit "Run Simulation" button (not auto-simulate on circuit change)
- **D-16:** Analysis type selector dropdown: DC Operating Point, Transient, AC Analysis, DC Sweep
- **D-17:** Each analysis type has a compact parameter panel (e.g., transient: stop time, timestep; AC: start freq, stop freq, points)
- **D-18:** Progress indicator during simulation (spinner + elapsed time)
- **D-19:** Cancel button visible during simulation run

### Error Presentation
- **D-20:** Errors display in a bottom panel (collapsible) with human-readable messages
- **D-21:** Clicking an error highlights the problematic component/node on the schematic canvas with a red outline
- **D-22:** Pre-simulation validation runs automatically before ngspice — catches floating nodes, missing ground, disconnected components
- **D-23:** Validation warnings display inline on the schematic as yellow warning icons on problem components

### Waveform Viewer
- **D-24:** Waveform panel is a resizable split pane below or beside the schematic (user can drag divider)
- **D-25:** Click on a signal name in the legend to toggle visibility
- **D-26:** Click on the waveform to place a cursor — displays exact time/value at that point
- **D-27:** Two-cursor mode for measuring delta (time difference, voltage difference)
- **D-28:** One-click auto-measurements: Vpp, frequency, RMS, rise time — displayed as overlays on the waveform

### Component Library Panel
- **D-29:** Left sidebar panel with categorized component list (Passives, Semiconductors, Sources, Op-Amps)
- **D-30:** Search bar at top of library with fuzzy search (typing "741" finds uA741/LM741)
- **D-31:** Drag from library to canvas to place a component
- **D-32:** Each component shows a small preview icon and name in the library

### Claude's Discretion
- Exact color palette and theme (dark mode vs light mode default)
- Loading states and skeleton screens
- Keyboard shortcut overlay/help panel design
- Exact spacing, font sizes, and typography
- Empty state design when no circuit is open
- Component info tooltip content and styling
- SPICE model import flow UI details

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Research
- `.planning/research/STACK.md` — Technology stack decisions: React Flow for canvas, ngspice-wasm, uPlot for waveforms, Zustand for state
- `.planning/research/ARCHITECTURE.md` — Component boundaries, data flow pipeline (schematic → netlist → SPICE → waveform), Web Worker pattern
- `.planning/research/FEATURES.md` — Table stakes features, competitor analysis, education differentiators
- `.planning/research/PITFALLS.md` — WASM memory issues, convergence error handling, SharedArrayBuffer prohibition, Emscripten filesystem gotchas
- `.planning/research/SUMMARY.md` — Synthesized findings, conflict resolution (React Flow over tldraw), build order

### Requirements
- `.planning/REQUIREMENTS.md` — Full v1 requirement IDs (SCHEM-01–08, COMP-01–08, SIM-01–07, ERR-01–04, WAVE-01–06)
- `.planning/ROADMAP.md` §Phase 1 — Success criteria, key risks, dependency chain

### External References
- EEcircuit (github.com/eelab-dev/EEcircuit) — Closest competitor architecture reference, TypeScript + ngspice-wasm
- React Flow docs (reactflow.dev) — Custom nodes, custom edges, handles, connection validation
- uPlot docs (github.com/leeoniya/uPlot) — Chart configuration, cursor plugins, series options
- ngspice manual — Pipe-mode interface, command syntax, output format

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing codebase

### Established Patterns
- None yet — Phase 1 establishes the foundational patterns:
  - React Flow custom node/edge pattern for all circuit components
  - Zustand store slices for circuit state, simulation state, UI state
  - Web Worker message protocol for ngspice communication
  - uPlot configuration pattern for waveform rendering

### Integration Points
- No existing system to integrate with — Phase 1 creates the foundation that Phase 2+ builds on

</code_context>

<specifics>
## Specific Ideas

- Canvas interaction should feel like Figma — smooth zoom, natural pan, magnetic snaps
- Error messages should feel like ESLint in VS Code — inline annotations with clickable navigation to the problem
- Waveform viewer should feel like a modern oscilloscope — cursors, measurements, signal toggling
- Component library should feel like Figma's component panel — searchable, categorized, drag-to-place
- Reference: Desmos for making a technical tool feel intuitive and delightful

</specifics>

<deferred>
## Deferred Ideas

- Dark mode toggle — Phase 2 or later (pick a default now, add toggle later)
- Keyboard shortcut customization — future phase
- Circuit template/example gallery — Phase 2 (shareable circuits)
- Multi-page schematics — future phase if needed
- Undo history panel (visual undo tree) — future phase

</deferred>

---

*Phase: 01-core-simulator*
*Context gathered: 2026-04-09*
