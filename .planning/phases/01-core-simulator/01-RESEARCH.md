# Phase 1: Core Simulator - Research

**Researched:** 2026-04-09
**Domain:** Browser-based SPICE circuit simulator -- schematic editor, ngspice WASM engine, waveform viewer
**Confidence:** HIGH (stack locked, architecture patterns well-documented, reference implementations exist)

## Summary

Phase 1 builds a fully functional offline circuit simulator: a React Flow-based schematic editor with custom SVG circuit component nodes, orthogonal wire routing via custom edges, a component library sidebar with fuzzy search, an ngspice WASM simulation engine running in a Web Worker via pipe mode, an interactive uPlot-based waveform viewer, and human-readable error translation. No accounts, no cloud, no collaboration -- pure client-side.

The highest-risk item is the ngspice WASM build. The pipe mode approach (danchitnis/ngspice, concord-consortium/build-ngspice-js) requires modifying ngspice's main loop to work with Emscripten's non-blocking event model. The shared library API has documented compatibility issues with Emscripten. A Docker-based build process exists and should be reproduced early. The second risk is orthogonal wire routing with T-junctions in React Flow -- the `@jalez/react-flow-smart-edge` package provides A*-based pathfinding that avoids node intersections with a `SmartStepEdge` component, but T-junction rendering requires custom edge logic.

**Primary recommendation:** Start with the ngspice WASM build spike and a React Flow custom node/edge proof-of-concept in parallel. These are the two highest-risk unknowns. Everything else in Phase 1 is well-trodden React/TypeScript territory.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Magnetic snap -- dragging a component near a wire/pin auto-connects with visual feedback (glow/highlight on valid connection points)
- **D-02:** Grid-based layout with snap-to-grid for component placement (configurable grid size, default 10px)
- **D-03:** Standard selection model -- click to select, shift+click for multi-select, drag for marquee selection
- **D-04:** Zoom via scroll wheel, pan via middle-click drag or spacebar+drag (Figma-style)
- **D-05:** Copy/paste/delete via standard keyboard shortcuts (Ctrl+C, Ctrl+V, Delete)
- **D-06:** Standard IEEE/IEC electrical engineering symbols -- resistor zigzag, capacitor parallel plates, inductor loops, etc. NOT flowchart rectangles
- **D-07:** Component values display inline next to the symbol (e.g., "10k ohm" next to resistor)
- **D-08:** Click on component value to edit inline -- no modal dialog for simple value changes
- **D-09:** Component rotation via R key when selected or during drag
- **D-10:** Orthogonal wire routing -- wires route at 90-degree angles only (standard EE schematic convention)
- **D-11:** Auto-routing between pins when user clicks source pin then destination pin
- **D-12:** Manual bend placement -- user can click intermediate points to force wire path
- **D-13:** T-junctions rendered with a filled dot at the intersection point
- **D-14:** Wire segments are individually selectable and movable
- **D-15:** Explicit "Run Simulation" button (not auto-simulate on circuit change)
- **D-16:** Analysis type selector dropdown: DC Operating Point, Transient, AC Analysis, DC Sweep
- **D-17:** Each analysis type has a compact parameter panel (e.g., transient: stop time, timestep; AC: start freq, stop freq, points)
- **D-18:** Progress indicator during simulation (spinner + elapsed time)
- **D-19:** Cancel button visible during simulation run
- **D-20:** Errors display in a bottom panel (collapsible) with human-readable messages
- **D-21:** Clicking an error highlights the problematic component/node on the schematic canvas with a red outline
- **D-22:** Pre-simulation validation runs automatically before ngspice -- catches floating nodes, missing ground, disconnected components
- **D-23:** Validation warnings display inline on the schematic as yellow warning icons on problem components
- **D-24:** Waveform panel is a resizable split pane below or beside the schematic (user can drag divider)
- **D-25:** Click on a signal name in the legend to toggle visibility
- **D-26:** Click on the waveform to place a cursor -- displays exact time/value at that point
- **D-27:** Two-cursor mode for measuring delta (time difference, voltage difference)
- **D-28:** One-click auto-measurements: Vpp, frequency, RMS, rise time -- displayed as overlays on the waveform
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

### Deferred Ideas (OUT OF SCOPE)
- Dark mode toggle -- Phase 2 or later (pick a default now, add toggle later)
- Keyboard shortcut customization -- future phase
- Circuit template/example gallery -- Phase 2 (shareable circuits)
- Multi-page schematics -- future phase if needed
- Undo history panel (visual undo tree) -- future phase
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCHEM-01 | Drag components from library panel onto infinite canvas | React Flow + native HTML DnD API (official example pattern), @dnd-kit/core as fallback for touch support |
| SCHEM-02 | Connect components with wires that snap to pins and route with bends/junctions | React Flow custom edges with orthogonal routing, @jalez/react-flow-smart-edge SmartStepEdge, custom T-junction rendering |
| SCHEM-03 | Select, move, rotate, copy, delete components and wire segments | React Flow built-in selection + react-hotkeys-hook for keyboard shortcuts |
| SCHEM-04 | Edit component values inline with single click | React Flow custom node with inline input (nodrag class pattern) |
| SCHEM-05 | Undo/redo all schematic edits | Zundo middleware for Zustand (v2.3.0, <700B, supports Zustand 5) |
| SCHEM-06 | Pan and zoom canvas with scroll wheel and trackpad | React Flow built-in viewport controls |
| SCHEM-07 | Proper EE symbols (not flowchart boxes) | Custom React Flow nodes with SVG rendering per UI-SPEC symbol specs |
| SCHEM-08 | Ground, voltage reference, and port symbols | Custom React Flow nodes with single-pin handles |
| COMP-01 | Core passives (R, C, L, transformer) | Custom node types with IEEE/IEC SVG symbols, SPICE model mappings |
| COMP-02 | Diodes (generic, Zener, Schottky) with default SPICE models | Curated .model lines bundled with app, loaded into Emscripten MEMFS |
| COMP-03 | BJTs (NPN, PNP) with default SPICE models | Pre-bundled models (2N2222, 2N3904, 2N3906) |
| COMP-04 | MOSFETs (NMOS, PMOS) with default SPICE models | Pre-bundled BSIM3/4 level-1 models |
| COMP-05 | Op-amps (ideal and real: uA741, LM741) | Subcircuit models for real op-amps, behavioral model for ideal |
| COMP-06 | Independent voltage/current sources (DC, AC, pulse, sin, PWL) | SPICE source syntax mapping in netlister |
| COMP-07 | Fuzzy search component library | cmdk command palette integration |
| COMP-08 | Import third-party SPICE models (.mod/.lib) | File reader + Emscripten MEMFS dynamic loading |
| SIM-01 | DC operating point analysis | ngspice `.op` command, parse stdout for node voltages |
| SIM-02 | Transient analysis with configurable params | ngspice `.tran` command, parse vector data |
| SIM-03 | AC analysis (frequency sweep) | ngspice `.ac` command, complex number handling for Bode plots |
| SIM-04 | DC sweep analysis | ngspice `.dc` command |
| SIM-05 | Web Worker (non-blocking UI) | Dedicated Worker with postMessage protocol |
| SIM-06 | Progress indicator during simulation | Worker sends progress messages, main thread renders elapsed time |
| SIM-07 | Cancel running simulation | Worker.terminate() + spawn fresh worker |
| ERR-01 | Human-readable error messages | Error translation map from ngspice patterns to plain English |
| ERR-02 | Convergence failure guidance | Pattern matching on "singular matrix", "no DC path", "timestep too small" |
| ERR-03 | Pre-simulation validation | Graph traversal for floating nodes, missing ground, source loops |
| ERR-04 | Component-specific error identification | Reference designator extraction from ngspice error output |
| WAVE-01 | Time-domain waveform plots | uPlot with Float64Array data, time on x-axis |
| WAVE-02 | Bode plots (magnitude + phase vs frequency) | uPlot dual y-axis config, log scale x-axis |
| WAVE-03 | Toggle signal visibility and assign colors | uPlot series show/hide, color assignment from UI-SPEC palette |
| WAVE-04 | Zoom and pan waveform view | uPlot wheel zoom plugin + custom pan handler |
| WAVE-05 | Cursor readout at any point | uPlot cursor plugin with value display |
| WAVE-06 | Auto-measurements (Vpp, freq, RMS, rise time) | Custom measurement functions over raw Float64Array data |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Package manager:** pnpm (never npm)
- **Stack:** React 19 + Vite 8 + TypeScript 5.7+ (strict mode)
- **Canvas:** React Flow (@xyflow/react), NOT tldraw
- **Charts:** uPlot
- **State:** Zustand 5.x
- **WASM:** ngspice via Emscripten, pipe mode (NOT shared library API)
- **No SharedArrayBuffer:** Single-threaded ngspice in Web Worker only
- **No AI attribution:** No Co-Authored-By, no "Generated with Claude" anywhere
- **Styling:** CSS Modules + CSS custom properties (from UI-SPEC -- no Tailwind, no CSS-in-JS)
- **Linting:** Biome (not ESLint + Prettier)
- **Testing:** Vitest (unit/integration) + Playwright (E2E)
- **Platform:** Must work on Chromebooks (4GB RAM constraint)
- **GSD workflow:** All changes through GSD commands

## Standard Stack

### Core (Phase 1 only -- no cloud/auth/collab needed)

| Library | Verified Version | Purpose | Why Standard |
|---------|-----------------|---------|--------------|
| react | 19.2.5 | UI framework | Project constraint. useTransition for non-blocking sim updates. |
| react-dom | 19.2.5 | DOM rendering | Peer dependency |
| vite | 8.0.8 | Build tool | Project constraint. Native WASM support via plugin. |
| typescript | 6.0.2 | Type safety | Project constraint. Strict mode. |
| @xyflow/react | 12.10.2 | Schematic canvas | Locked decision. Nodes = components, edges = wires. MIT. |
| uplot | 1.6.32 | Waveform viewer | Locked decision. 166k points in 25ms. 20KB gzipped. |
| zustand | 5.0.12 | Client state | Locked decision. Slices for circuit/sim/UI state. |
| zundo | 2.3.0 | Undo/redo | <700B middleware for Zustand 5. Temporal state tracking. |

### Supporting

| Library | Verified Version | Purpose | When to Use |
|---------|-----------------|---------|-------------|
| vite-plugin-wasm | 3.6.0 | WASM imports | Loading ngspice.wasm in Vite dev + build |
| react-hotkeys-hook | 5.2.4 | Keyboard shortcuts | All hotkeys (Ctrl+Z, R, W, Delete, etc.) |
| @dnd-kit/core | 6.3.1 | Drag and drop | Component library drag-to-canvas (touch support) |
| cmdk | 1.1.1 | Command palette | Fuzzy search component library (Ctrl+K) |
| @jalez/react-flow-smart-edge | 4.0.0 | Smart edge routing | Orthogonal wire routing that avoids node intersection |
| @fontsource-variable/inter | 5.2.8 | UI font | Variable font, per UI-SPEC |
| @fontsource-variable/jetbrains-mono | (latest) | Mono font | Component values, measurements, per UI-SPEC |
| lucide-react | 1.8.0 | Icons | Tree-shakeable stroke icons, per UI-SPEC |

### Development

| Library | Verified Version | Purpose |
|---------|-----------------|---------|
| @biomejs/biome | 2.4.11 | Lint + format (replaces ESLint/Prettier) |
| vitest | 4.1.4 | Unit + integration tests |
| playwright | (latest) | E2E browser testing |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @dnd-kit/core | Native HTML DnD API | Native API is simpler for basic sidebar-to-canvas; @dnd-kit adds touch support and collision detection. React Flow official example uses native DnD. Use native DnD first, add @dnd-kit only if touch support needed. |
| @jalez/react-flow-smart-edge | Custom SVG path edge | Smart-edge uses A* pathfinding on a grid. Custom edge gives full control but requires implementing pathfinding from scratch. Start with smart-edge, replace if routing quality insufficient. |
| zundo | zustand-travel | zustand-travel uses JSON patches (more memory efficient for large state). Zundo is simpler and smaller. Use zundo unless circuit state becomes very large. |

**Installation:**
```bash
pnpm add react react-dom @xyflow/react uplot zustand zundo vite-plugin-wasm react-hotkeys-hook @dnd-kit/core cmdk @jalez/react-flow-smart-edge @fontsource-variable/inter @fontsource-variable/jetbrains-mono lucide-react
pnpm add -D typescript vite @biomejs/biome vitest @types/react @types/react-dom
```

## Architecture Patterns

### Recommended Project Structure

```
src/
  app/                    # App shell, layout, routing
    App.tsx
    Layout.tsx
  canvas/                 # Schematic editor (React Flow)
    components/           # Custom nodes (one per component type)
      ResistorNode.tsx
      CapacitorNode.tsx
      OpAmpNode.tsx
      GroundNode.tsx
      ...
    edges/                # Custom edge types
      OrthogonalEdge.tsx
      WireEdge.tsx
    hooks/
      useCanvasInteractions.ts
      useMagneticSnap.ts
    Canvas.tsx             # Main React Flow wrapper
  circuit/                # Circuit data model (pure TypeScript, no UI)
    types.ts              # Circuit, Component, Wire, Net, Port interfaces
    graph.ts              # Graph operations (union-find for nets)
    netlister.ts          # Circuit -> SPICE netlist string
    validator.ts          # Pre-simulation validation
    componentLibrary.ts   # Component definitions and metadata
  simulation/             # ngspice WASM integration
    worker/
      simulation.worker.ts  # Web Worker entry point
      ngspice-wrapper.ts    # WASM module loader + pipe mode interface
    controller.ts          # Main-thread simulation controller
    protocol.ts            # Message types (SimCommand, SimResponse)
    errorTranslator.ts     # ngspice error -> human-readable
    parser.ts              # Parse ngspice stdout for results
  waveform/               # Waveform viewer (uPlot)
    WaveformViewer.tsx
    BodePlot.tsx
    hooks/
      useCursor.ts
      useMeasurements.ts
    measurements.ts        # Vpp, freq, RMS, rise time calculations
  store/                  # Zustand stores
    circuitStore.ts       # Circuit state slice
    simulationStore.ts    # Simulation state slice
    uiStore.ts            # UI state slice
    index.ts              # Combined store
  ui/                     # Shared UI components
    Toolbar.tsx
    Sidebar.tsx
    BottomPanel.tsx
    ErrorPanel.tsx
    PropertyPanel.tsx
  styles/                 # CSS Modules + variables
    variables.css         # CSS custom properties from UI-SPEC
    global.css
  assets/                 # Static assets
    wasm/                 # ngspice.wasm + ngspice.js (built output)
    models/               # Bundled SPICE model files
```

### Pattern 1: Custom React Flow Node for Circuit Components

**What:** Each circuit component (resistor, capacitor, etc.) is a custom React Flow node that renders IEEE/IEC SVG symbols with typed handles at pin locations.

**When to use:** Every circuit component in the library.

**Example:**
```typescript
// Source: React Flow custom nodes docs (reactflow.dev/learn/customization/custom-nodes)
import { Handle, Position, type NodeProps } from '@xyflow/react';

interface ResistorData {
  refDesignator: string;  // "R1"
  value: string;          // "10k"
  rotation: number;       // 0, 90, 180, 270
}

export function ResistorNode({ data, selected }: NodeProps<ResistorData>) {
  return (
    <div
      className={styles.componentNode}
      style={{ transform: `rotate(${data.rotation}deg)` }}
    >
      {/* SVG zigzag resistor symbol per UI-SPEC: 60x24 viewBox */}
      <svg viewBox="0 0 60 24" width={60} height={24}>
        <path
          d="M0,12 L8,12 L12,2 L20,22 L28,2 L36,22 L44,2 L48,12 L60,12"
          stroke="var(--text-primary)"
          strokeWidth={2}
          fill="none"
        />
      </svg>

      {/* Pin handles */}
      <Handle type="target" position={Position.Left} id="pin1" />
      <Handle type="source" position={Position.Right} id="pin2" />

      {/* Ref designator label */}
      <span className={styles.refLabel}>{data.refDesignator}</span>

      {/* Editable value label (D-08: click to edit inline) */}
      <span className={styles.valueLabel}>{data.value}</span>
    </div>
  );
}
```

### Pattern 2: Orthogonal Wire Edge with T-Junction Support

**What:** Custom React Flow edge that renders orthogonal (90-degree) wire paths with filled dots at T-junctions.

**When to use:** All wire connections between components.

**Example:**
```typescript
// Custom edge combining SmartStepEdge pathfinding with T-junction rendering
import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react';

export function WireEdge({
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  style, markerEnd,
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
    borderRadius: 0,  // Sharp 90-degree corners
  });

  return (
    <>
      <BaseEdge
        path={edgePath}
        style={{
          ...style,
          stroke: 'var(--accent-primary)',
          strokeWidth: 2,
        }}
      />
      {/* T-junction dots rendered separately based on intersection detection */}
    </>
  );
}
```

**Note:** For full orthogonal routing that avoids node intersections, use `@jalez/react-flow-smart-edge`'s `SmartStepEdge` as a starting point. For T-junction dots (D-13), implement a post-processing pass that detects wire-wire intersections at connection points and renders filled SVG circles at those coordinates.

### Pattern 3: Web Worker Communication Protocol

**What:** Typed message protocol between main thread and ngspice WASM worker.

**When to use:** All simulation operations.

**Example:**
```typescript
// src/simulation/protocol.ts
export type SimCommand =
  | { type: 'INIT' }
  | { type: 'LOAD_CIRCUIT'; netlist: string }
  | { type: 'RUN'; analysis: string }
  | { type: 'CANCEL' }
  | { type: 'LOAD_MODEL'; filename: string; content: string };

export type SimResponse =
  | { type: 'READY' }
  | { type: 'PROGRESS'; elapsed: number }
  | { type: 'RESULT'; vectors: VectorData[] }
  | { type: 'ERROR'; message: string; raw: string }
  | { type: 'STDOUT'; text: string }
  | { type: 'CANCELLED' };

export interface VectorData {
  name: string;        // 'time', 'v(out)', 'i(R1)'
  data: Float64Array;
  unit: string;        // 'V', 'A', 's', 'Hz'
  isComplex: boolean;  // true for AC (mag/phase pairs)
}
```

```typescript
// src/simulation/worker/simulation.worker.ts
let ngspiceModule: NgspiceModule | null = null;

self.onmessage = async (event: MessageEvent<SimCommand>) => {
  const cmd = event.data;
  switch (cmd.type) {
    case 'INIT':
      // Load ngspice WASM module
      // Set up pipe mode via FS.init with stdin/stdout callbacks
      // Pre-load bundled model files into MEMFS
      ngspiceModule = await loadNgspice();
      self.postMessage({ type: 'READY' });
      break;
    case 'LOAD_CIRCUIT':
      // Write netlist to MEMFS, feed to ngspice via stdin
      break;
    case 'RUN':
      // Feed analysis command via stdin
      // Collect stdout/stderr output
      // Parse results into VectorData arrays
      // Post results back
      break;
    case 'CANCEL':
      // Cannot gracefully cancel ngspice mid-run
      // Main thread will terminate this worker and spawn a new one
      break;
  }
};
```

### Pattern 4: Zustand Store Slices with Undo/Redo

**What:** Separated state slices for circuit, simulation, and UI concerns, with temporal middleware on the circuit slice for undo/redo.

**When to use:** All application state.

**Example:**
```typescript
// src/store/circuitStore.ts
import { create } from 'zustand';
import { temporal } from 'zundo';
import type { Circuit, Component, Wire } from '../circuit/types';

interface CircuitState {
  circuit: Circuit;
  addComponent: (component: Component) => void;
  removeComponent: (id: string) => void;
  updateComponent: (id: string, props: Partial<Component>) => void;
  addWire: (wire: Wire) => void;
  removeWire: (id: string) => void;
}

export const useCircuitStore = create<CircuitState>()(
  temporal(
    (set) => ({
      circuit: { components: new Map(), wires: new Map(), nets: new Map() },
      addComponent: (component) =>
        set((state) => {
          const components = new Map(state.circuit.components);
          components.set(component.id, component);
          return { circuit: { ...state.circuit, components } };
        }),
      // ... other actions
    }),
    {
      limit: 100,  // Cap undo history at 100 steps
      partialize: (state) => ({
        circuit: state.circuit,  // Only track circuit data, not actions
      }),
    }
  )
);

// Undo/redo access:
// useCircuitStore.temporal.getState().undo()
// useCircuitStore.temporal.getState().redo()
```

### Pattern 5: Netlist Generation (Pure Function)

**What:** Convert React Flow graph state to a valid SPICE netlist string.

**When to use:** Before every simulation run.

**Example:**
```typescript
// src/circuit/netlister.ts
export function generateNetlist(
  circuit: Circuit,
  analysisConfig: AnalysisConfig
): string {
  const lines: string[] = ['* OmniSpice Generated Netlist'];

  // 1. Compute nets via union-find on connected ports
  const nets = computeNets(circuit.wires, circuit.components);

  // 2. Emit component lines
  for (const [id, comp] of circuit.components) {
    lines.push(componentToSpiceLine(comp, nets));
  }

  // 3. Emit .include directives for any external models
  for (const model of getRequiredModels(circuit.components)) {
    lines.push(`.include ${model.filename}`);
  }

  // 4. Emit analysis directive
  lines.push(analysisToDirective(analysisConfig));

  // 5. Emit .save for output vectors
  lines.push(generateSaveDirective(circuit, analysisConfig));

  lines.push('.end');
  return lines.join('\n');
}

// Example SPICE lines:
// R1 net_1 net_2 10k
// C1 net_2 0 100n
// V1 net_1 0 dc 5
// .tran 1u 10m
// .save v(net_2) i(V1)
// .end
```

### Pattern 6: Error Translation

**What:** Map ngspice raw error patterns to human-readable messages with component identification.

**When to use:** After every simulation failure.

**Example:**
```typescript
// src/simulation/errorTranslator.ts
interface TranslatedError {
  message: string;           // Human-readable
  suggestion: string;        // How to fix
  componentRef?: string;     // "R1", "net_3", etc.
  severity: 'error' | 'warning';
  raw: string;               // Original ngspice output
}

const ERROR_PATTERNS: Array<{
  pattern: RegExp;
  translate: (match: RegExpMatchArray, netMap: Map<string, string>) => TranslatedError;
}> = [
  {
    pattern: /singular matrix.*node (\w+)/i,
    translate: (match, netMap) => ({
      message: `Node "${netMap.get(match[1]) || match[1]}" has a problem in the circuit.`,
      suggestion: 'Check for floating nodes (components not connected to anything) or short circuits across voltage sources.',
      componentRef: match[1],
      severity: 'error',
      raw: match[0],
    }),
  },
  {
    pattern: /no dc path to ground.*node (\w+)/i,
    translate: (match, netMap) => ({
      message: `Node "${netMap.get(match[1]) || match[1]}" is not connected to ground.`,
      suggestion: 'Every node needs a path to ground (node 0). Add a ground connection or a large resistor (1M ohm) to ground.',
      componentRef: match[1],
      severity: 'error',
      raw: match[0],
    }),
  },
  {
    pattern: /timestep too small/i,
    translate: (match) => ({
      message: 'The simulation is having trouble converging.',
      suggestion: 'Try increasing the maximum timestep, simplifying your circuit, or adding small parasitic capacitances to high-impedance nodes.',
      severity: 'error',
      raw: match[0],
    }),
  },
];
```

### Anti-Patterns to Avoid

- **WASM on main thread:** Never load ngspice WASM outside a Web Worker. Even short simulations cause dropped frames. If ngspice crashes, it takes the entire tab down.
- **Monolithic state store:** Do not merge React Flow internal state with Zustand. React Flow owns canvas state (node positions, viewport). Zustand owns circuit semantics (component values, net connectivity, simulation results). Bridge them with event listeners.
- **Direct string concatenation for netlists:** Always go through the typed circuit data model. String manipulation cannot detect floating nodes, missing ground, or source loops.
- **Parsing ngspice file output:** Use pipe mode stdin/stdout, not raw file parsing. File parsing has undocumented format quirks across analysis types.
- **Auto-simulation on circuit change:** User decision D-15 explicitly requires manual "Run Simulation" button. Auto-sim would waste resources and confuse users during editing.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Undo/redo | Custom history stack | zundo (2.3.0) | Edge cases: partial state tracking, history limits, memory leaks. Zundo handles all of these in <700B. |
| Fuzzy search | Custom string matching | cmdk (1.1.1) | cmdk handles scoring, ranking, keyboard navigation, and accessibility. Fuzzy matching has surprising edge cases. |
| Keyboard shortcuts | addEventListener management | react-hotkeys-hook (5.2.4) | Handles scope, priority, enabled/disabled states, and conflicts between multiple shortcut targets. |
| Wire pathfinding | Custom A* implementation | @jalez/react-flow-smart-edge (4.0.0) | A* on a grid with node avoidance is non-trivial. Smart-edge provides SmartStepEdge with configurable grid ratio and node padding. |
| Canvas viewport controls | Custom zoom/pan | React Flow built-in | React Flow handles scroll wheel zoom, pan, minimap, viewport fitting, zoom limits. All built-in. |
| SVG icon system | Custom icon components | lucide-react (1.8.0) | Tree-shakeable, consistent 24x24 stroke icons. Over 1500 icons available. |
| Data downsampling for charts | Custom decimation | uPlot built-in paths | uPlot has optimized rendering for large datasets. For extreme cases, use Largest-Triangle-Three-Bucket algorithm. |
| CSS variable theming | Custom theme system | CSS custom properties on :root | Browser-native, zero runtime cost, works with CSS Modules. Per UI-SPEC decision. |

## Common Pitfalls

### Pitfall 1: ngspice WASM Memory Exhaustion on Real Circuits

**What goes wrong:** Simple RC circuits work fine during development. When students run 50-200 node circuits with BSIM4 MOSFET models, WASM memory exceeds initial allocation. Without ALLOW_MEMORY_GROWTH, the simulation crashes silently with "memory access out of bounds."

**Why it happens:** Developers test with toy circuits. Real university assignments are significantly more complex.

**How to avoid:** Set `INITIAL_MEMORY=256MB` and `ALLOW_MEMORY_GROWTH=1` with `MAXIMUM_MEMORY=2GB` in the Emscripten build. For Chromebooks with 4GB RAM, monitor memory usage and warn at 70% consumption. Test with large circuits in CI.

**Warning signs:** "simulation failed" with no error message. Works on desktop Chrome but fails on Chromebooks.

### Pitfall 2: Emscripten MEMFS for SPICE Model Loading

**What goes wrong:** ngspice `.include` directives reference filesystem paths. In WASM, there is no filesystem. Model files must be pre-loaded into Emscripten's MEMFS before simulation runs. Forgetting this means any netlist with `.include` fails silently or with cryptic errors.

**Why it happens:** Simple test circuits use inline model definitions. Real circuits reference external .model and .lib files.

**How to avoid:** Pre-populate MEMFS with bundled model files (2N2222, 2N3904, LM741, standard CMOS models) during worker initialization. Intercept `.include` directives in the netlister to verify model availability before sending to ngspice. For user-uploaded models (COMP-08), load into MEMFS dynamically via the worker.

**Warning signs:** Simulations work with inline models but fail when components reference .model files.

### Pitfall 3: Pipe Mode Blocking I/O in Emscripten

**What goes wrong:** ngspice uses an infinite loop with blocking stdin reads. In Emscripten, this hangs the browser. Emscripten doesn't support non-blocking streams -- returning null/undefined marks the stream as EOF permanently.

**Why it happens:** ngspice was designed for terminal interaction, not event-driven JavaScript.

**How to avoid:** Follow the concord-consortium pattern: modify ngspice main.c to call `emscripten_set_main_loop`, return from the main loop on newline input when no data is available. Use `FS.init` with JS-defined stdin/stdout callbacks. The danchitnis/ngspice Docker build handles this -- use it as the starting point rather than building from scratch.

**Warning signs:** Browser tab freezes when simulation starts. ngspice reads EOF and stops accepting commands.

### Pitfall 4: React Flow + Zustand Double-Render on State Sync

**What goes wrong:** Syncing React Flow's internal node state to Zustand on every change causes double-renders and performance degradation with many components.

**Why it happens:** React Flow uses its own reactive store. Mirroring it to Zustand creates two state update cycles per user action.

**How to avoid:** Do NOT mirror React Flow state to Zustand in real-time. Instead: (1) React Flow owns visual state (positions, viewport). (2) Zustand owns semantic state (component values, simulation config, results). (3) Extract circuit semantics from React Flow only when needed -- specifically, when the user clicks "Run Simulation" or when undo/redo needs to snapshot. Use `onNodesChange` and `onEdgesChange` callbacks sparingly.

**Warning signs:** Laggy canvas interactions with 50+ components. Double state update cycles visible in React DevTools profiler.

### Pitfall 5: ngspice Output Format Differences Across Analysis Types

**What goes wrong:** Parser works for transient analysis but breaks for AC analysis (complex numbers), DC sweep (different variable naming), or DC operating point (single-point data format).

**Why it happens:** Developers test with `.tran`, ship, then discover `.ac` output has real/imaginary pairs the parser doesn't handle.

**How to avoid:** Build parser test fixtures for ALL four analysis types from day one. AC analysis returns complex numbers that must be decomposed into magnitude (dB) and phase (degrees) for Bode plots. DC operating point returns a single data point per node, not vectors. Test all formats before claiming "simulation works."

**Warning signs:** Waveform viewer shows garbage for AC analysis. DC operating point crashes the parser. NaN values in displayed data.

### Pitfall 6: Simulation Cancellation by Worker Termination

**What goes wrong:** ngspice running in pipe mode cannot be interrupted gracefully mid-simulation. The only reliable cancellation is `Worker.terminate()`. But terminating the worker destroys the loaded WASM module, requiring a full re-initialization (WASM load + model pre-load) for the next simulation.

**Why it happens:** ngspice's pipe mode main loop doesn't check for cancellation signals between simulation steps.

**How to avoid:** Accept the worker termination pattern. On cancel: (1) call `worker.terminate()`, (2) spawn a fresh worker, (3) lazily re-initialize WASM on next simulation request (not immediately -- user may not run another sim right away). Show "Loading engine..." briefly on next run if worker was cancelled. This is the pattern EEcircuit uses.

**Warning signs:** Slow cancel (waiting for simulation to finish). Or: fast cancel but next simulation takes extra seconds to start.

## Code Examples

### SPICE Netlist Format Reference

```
* Title line (comment, always first line)
R1 net_1 net_2 10k
C1 net_2 0 100n
V1 net_1 0 dc 5
.model NMOS1 NMOS (VTO=0.7 KP=110u)
.include models/LM741.lib
.tran 1u 10m
.ac dec 100 1 1MEG
.dc V1 0 5 0.1
.op
.save v(net_2) i(V1)
.end
```

Key syntax rules:
- First letter of component name determines type: R=resistor, C=capacitor, L=inductor, V=voltage source, I=current source, D=diode, Q=BJT, M=MOSFET, X=subcircuit
- Node "0" is always ground
- Analysis directives start with a dot
- `.tran TSTEP TSTOP` -- transient analysis
- `.ac TYPE NPOINTS FSTART FSTOP` -- AC analysis (TYPE: dec/lin/oct)
- `.dc SRCNAME VSTART VSTOP VINCR` -- DC sweep
- `.op` -- DC operating point

### uPlot Configuration for Waveform Viewer

```typescript
// Source: uPlot docs (github.com/leeoniya/uPlot)
import uPlot from 'uplot';

const SIGNAL_COLORS = [
  '#4fc3f7', '#ffa726', '#66bb6a', '#f06292',
  '#ba68c8', '#ffee58', '#26c6da', '#ef5350',
];

function createWaveformOptions(
  signals: { name: string; unit: string }[],
  analysisType: 'tran' | 'ac'
): uPlot.Options {
  return {
    width: 800,
    height: 400,
    cursor: {
      show: true,
      x: true,
      y: true,
      drag: { x: true, y: false },  // Zoom on x-axis drag
    },
    scales: {
      x: {
        time: analysisType === 'tran',  // Time formatting for transient
        distr: analysisType === 'ac' ? 3 : 1,  // Log scale for AC
      },
    },
    axes: [
      {
        stroke: '#9fa8c4',
        grid: { stroke: '#1e2d52' },
        ticks: { stroke: '#2a3f6e' },
      },
      {
        stroke: '#9fa8c4',
        grid: { stroke: '#1e2d52' },
        label: signals[0]?.unit || 'V',
      },
    ],
    series: [
      { label: analysisType === 'tran' ? 'Time (s)' : 'Frequency (Hz)' },
      ...signals.map((sig, i) => ({
        label: sig.name,
        stroke: SIGNAL_COLORS[i % SIGNAL_COLORS.length],
        width: 2,
        show: true,
      })),
    ],
  };
}
```

### Pre-Simulation Circuit Validation

```typescript
// src/circuit/validator.ts
export interface ValidationError {
  type: 'floating_node' | 'no_ground' | 'source_loop' | 'disconnected';
  message: string;
  componentIds: string[];  // For highlighting on canvas
  severity: 'error' | 'warning';
}

export function validateCircuit(circuit: Circuit): ValidationError[] {
  const errors: ValidationError[] = [];

  // 1. Check for ground connection
  const hasGround = [...circuit.components.values()]
    .some(c => c.type === 'ground');
  if (!hasGround) {
    errors.push({
      type: 'no_ground',
      message: 'No ground connection. Every circuit needs a ground (node 0).',
      componentIds: [],
      severity: 'error',
    });
  }

  // 2. Check for floating nodes (pins not connected to any wire)
  for (const [id, comp] of circuit.components) {
    for (const port of comp.ports) {
      if (!port.netId) {
        errors.push({
          type: 'floating_node',
          message: `${comp.refDesignator} pin "${port.name}" is not connected.`,
          componentIds: [id],
          severity: 'warning',
        });
      }
    }
  }

  // 3. Check for voltage source loops (two voltage sources in parallel)
  // ... graph cycle detection with voltage sources only

  return errors;
}
```

### Drag-and-Drop from Library to Canvas

```typescript
// Source: reactflow.dev/examples/interaction/drag-and-drop
// Using native HTML DnD API (React Flow's recommended approach)

// In Sidebar component:
function onDragStart(event: DragEvent, componentType: string) {
  event.dataTransfer?.setData('application/omnispice-component', componentType);
  event.dataTransfer!.effectAllowed = 'move';
}

// In Canvas component (React Flow wrapper):
const { screenToFlowPosition } = useReactFlow();

const onDrop = useCallback((event: DragEvent) => {
  event.preventDefault();
  const type = event.dataTransfer?.getData('application/omnispice-component');
  if (!type) return;

  const position = screenToFlowPosition({
    x: event.clientX,
    y: event.clientY,
  });

  // Snap to grid (D-02: 10px default)
  position.x = Math.round(position.x / 10) * 10;
  position.y = Math.round(position.y / 10) * 10;

  const newNode = createComponentNode(type, position);
  addNode(newNode);  // Zustand action
}, [screenToFlowPosition]);

const onDragOver = useCallback((event: DragEvent) => {
  event.preventDefault();
  event.dataTransfer!.dropEffect = 'move';
}, []);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| tldraw for schematic canvas | React Flow (@xyflow/react) | Project decision 2026-04 | React Flow's node/edge model maps directly to circuit components/wires. No license cost. |
| ngspice shared library API | ngspice pipe mode (stdin/stdout) | Confirmed by multiple WASM builds | Shared library API has documented Emscripten compatibility issues. Pipe mode works reliably. |
| Custom undo/redo stack | zundo middleware | zundo 2.x (2024) | <700B, supports Zustand 5, handles partialize and limits |
| react-flow-smart-edge (tisoap) | @jalez/react-flow-smart-edge | 2025 fork | Maintained fork, updated for @xyflow/react v12+, zero security vulnerabilities |
| Manual WASM loading | vite-plugin-wasm | vite-plugin-wasm 3.x | Clean WASM imports in Vite without manual fetch/instantiate |

## Open Questions

1. **ngspice WASM build reproducibility on current Emscripten (4.x)**
   - What we know: danchitnis/ngspice and concord-consortium builds exist and work. Both use Docker.
   - What's unclear: Whether builds compile cleanly with Emscripten 4.x (vs older 3.x used in reference builds). ngspice 45.x may have source changes since these build scripts were last updated.
   - Recommendation: Budget 1-2 week spike. Use danchitnis/ngspice Docker build as starting point. If it fails, fall back to concord-consortium approach (more documented but includes fewer device types).

2. **SmartStepEdge performance with 100+ wires**
   - What we know: @jalez/react-flow-smart-edge uses A* pathfinding on a grid. Default gridRatio=10.
   - What's unclear: Whether A* pathfinding per-edge scales to 100+ simultaneous edges in a complex schematic without frame drops.
   - Recommendation: Prototype with 50+ wires early. If performance is insufficient, fall back to React Flow's built-in `smoothstep` edge type (which does orthogonal routing but does not avoid node intersection).

3. **ngspice stdout parsing reliability**
   - What we know: Pipe mode captures all stdout/stderr. Output format varies by analysis type.
   - What's unclear: Exact format of AC analysis complex number output and DC sweep multi-dataset output in pipe mode specifically (vs file output).
   - Recommendation: Build a comprehensive test harness that runs all four analysis types on known circuits and captures raw stdout. Parse from actual output, not documentation.

4. **Touch device support for drag-and-drop**
   - What we know: Native HTML DnD API does not work on touch devices. React Flow's official example uses native DnD.
   - What's unclear: Whether @dnd-kit integration with React Flow has been proven or if it causes conflicts.
   - Recommendation: Start with native DnD (works for desktop + Chromebook with keyboard/trackpad). Add @dnd-kit for touch support only if touch tablets are confirmed as a target platform.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build tooling (Vite, pnpm) | Yes | 25.8.1 | -- |
| pnpm | Package management | Yes | 10.32.1 | -- |
| Git | Version control | Yes | 2.53.0 | -- |
| Docker | ngspice WASM build | No | -- | Install Docker Desktop, or use pre-built WASM binary from reference project |
| Emscripten | ngspice WASM compilation | No | -- | Run via Docker (danchitnis/ngspice Dockerfile includes Emscripten) |

**Missing dependencies with no fallback:**
- None -- Docker handles the Emscripten/ngspice build toolchain

**Missing dependencies with fallback:**
- Docker: Not detected, but the ngspice WASM build runs inside Docker. If Docker cannot be installed, use a pre-built WASM binary from danchitnis/ngspice or wokwi/ngspice-wasm as a starting point, then set up Docker for custom builds later.
- Emscripten: Not needed on host -- contained within Docker build image.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 |
| Config file | none -- Wave 0 will create vitest.config.ts |
| Quick run command | `pnpm vitest run --reporter=verbose` |
| Full suite command | `pnpm vitest run && pnpm playwright test` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCHEM-01 | Drag component from library to canvas | E2E | `pnpm playwright test tests/e2e/drag-drop.spec.ts` | Wave 0 |
| SCHEM-02 | Wire routing and connection | E2E | `pnpm playwright test tests/e2e/wire-routing.spec.ts` | Wave 0 |
| SCHEM-03 | Select, move, rotate, copy, delete | E2E | `pnpm playwright test tests/e2e/canvas-interactions.spec.ts` | Wave 0 |
| SCHEM-04 | Inline value editing | E2E | `pnpm playwright test tests/e2e/inline-edit.spec.ts` | Wave 0 |
| SCHEM-05 | Undo/redo | unit | `pnpm vitest run tests/unit/undo-redo.test.ts` | Wave 0 |
| SCHEM-07 | EE symbol rendering | unit | `pnpm vitest run tests/unit/component-nodes.test.ts` | Wave 0 |
| COMP-01-06 | Component library completeness | unit | `pnpm vitest run tests/unit/component-library.test.ts` | Wave 0 |
| COMP-07 | Fuzzy search | unit | `pnpm vitest run tests/unit/component-search.test.ts` | Wave 0 |
| COMP-08 | SPICE model import | unit | `pnpm vitest run tests/unit/model-import.test.ts` | Wave 0 |
| SIM-01 | DC operating point | integration | `pnpm vitest run tests/integration/simulation-dc-op.test.ts` | Wave 0 |
| SIM-02 | Transient analysis | integration | `pnpm vitest run tests/integration/simulation-tran.test.ts` | Wave 0 |
| SIM-03 | AC analysis | integration | `pnpm vitest run tests/integration/simulation-ac.test.ts` | Wave 0 |
| SIM-04 | DC sweep | integration | `pnpm vitest run tests/integration/simulation-dc-sweep.test.ts` | Wave 0 |
| SIM-05 | Web Worker non-blocking | integration | `pnpm vitest run tests/integration/worker-isolation.test.ts` | Wave 0 |
| ERR-01 | Human-readable errors | unit | `pnpm vitest run tests/unit/error-translator.test.ts` | Wave 0 |
| ERR-02 | Convergence guidance | unit | `pnpm vitest run tests/unit/error-translator.test.ts` | Wave 0 |
| ERR-03 | Pre-sim validation | unit | `pnpm vitest run tests/unit/circuit-validator.test.ts` | Wave 0 |
| ERR-04 | Component error ID | unit | `pnpm vitest run tests/unit/error-translator.test.ts` | Wave 0 |
| WAVE-01 | Time-domain plots | E2E | `pnpm playwright test tests/e2e/waveform-viewer.spec.ts` | Wave 0 |
| WAVE-02 | Bode plots | E2E | `pnpm playwright test tests/e2e/bode-plot.spec.ts` | Wave 0 |
| WAVE-05 | Cursor readout | E2E | `pnpm playwright test tests/e2e/waveform-cursor.spec.ts` | Wave 0 |
| WAVE-06 | Auto-measurements | unit | `pnpm vitest run tests/unit/measurements.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm vitest run --reporter=verbose`
- **Per wave merge:** `pnpm vitest run && pnpm playwright test`
- **Phase gate:** Full suite green before verification

### Wave 0 Gaps

- [ ] `vitest.config.ts` -- Vitest configuration with TypeScript and path aliases
- [ ] `playwright.config.ts` -- Playwright configuration for local browser testing
- [ ] `tests/unit/` directory structure
- [ ] `tests/integration/` directory structure
- [ ] `tests/e2e/` directory structure
- [ ] `tests/fixtures/` -- Sample circuits and expected netlists for test data
- [ ] Framework install: `pnpm add -D vitest @vitest/ui playwright @playwright/test`

## Sources

### Primary (HIGH confidence)
- [React Flow Custom Nodes](https://reactflow.dev/learn/customization/custom-nodes) -- custom node component pattern, Handle API, TypeScript types
- [React Flow Custom Edges](https://reactflow.dev/examples/edges/custom-edges) -- SVG path rendering, BaseEdge component, getSmoothStepPath
- [React Flow Drag and Drop](https://reactflow.dev/examples/interaction/drag-and-drop) -- native HTML DnD pattern with screenToFlowPosition
- [React Flow Handles](https://reactflow.dev/learn/customization/handles) -- unique handle IDs for multi-pin components
- [uPlot GitHub](https://github.com/leeoniya/uPlot) -- performance benchmarks, API via dist/uPlot.d.ts, cursor/zoom configuration
- [Emscripten Compiler Settings](https://emscripten.org/docs/tools_reference/settings_reference.html) -- INITIAL_MEMORY, ALLOW_MEMORY_GROWTH, MAXIMUM_MEMORY
- [Emscripten Filesystem API](https://emscripten.org/docs/api_reference/Filesystem-API.html) -- MEMFS for model file loading

### Secondary (MEDIUM confidence)
- [danchitnis/ngspice GitHub](https://github.com/danchitnis/ngspice) -- Docker-based WASM build process, pipe mode architecture
- [concord-consortium/build-ngspice-js](https://github.com/concord-consortium/build-ngspice-js) -- Detailed pipe mode implementation: FS.init callbacks, emscripten_set_main_loop modification, stdin newline workaround
- [EEcircuit GitHub](https://github.com/eelab-dev/EEcircuit) -- Reference browser SPICE simulator architecture
- [@jalez/react-flow-smart-edge](https://github.com/Jalez/react-flow-smart-edge) -- SmartStepEdge for orthogonal routing, A* pathfinding, @xyflow/react v12+ compatible
- [zundo GitHub](https://github.com/charkour/zundo) -- temporal middleware API, Zustand 5 support, partialize/limit configuration
- [ngspice Shared Library API](https://ngspice.sourceforge.io/shared.html) -- callback functions (SendChar, SendData, SendStat)
- [SPICE Netlist Syntax](https://web.stanford.edu/class/ee133/handouts/general/spice_ref.pdf) -- component line format, analysis directives

### Tertiary (LOW confidence)
- ngspice pipe mode vs shared library compatibility with Emscripten 4.x -- based on community discussion threads, not official documentation. Needs validation during WASM build spike.
- SmartStepEdge performance at scale (100+ edges) -- no published benchmarks found. Needs empirical testing.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages are locked decisions from CLAUDE.md with verified npm versions
- Architecture: HIGH -- data flow pattern (schematic -> netlist -> WASM -> waveform) is proven by EEcircuit and other reference implementations
- ngspice WASM build: MEDIUM -- reference builds exist but reproducibility with current Emscripten unverified
- Wire routing: MEDIUM -- SmartStepEdge exists but T-junction support and performance at scale unverified
- Pitfalls: HIGH -- documented by Emscripten docs, ngspice forums, and reference project issues

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (30 days -- stack is stable, no fast-moving dependencies)
