# Architecture Patterns

**Domain:** Browser-based SPICE circuit simulator
**Researched:** 2026-04-09

## Recommended Architecture

### High-Level System Diagram

```
+------------------------------------------------------------------+
|                        Browser (Client)                          |
|                                                                  |
|  +------------------+    +----------------+    +---------------+ |
|  |  Schematic       |    |  Simulation    |    |  Waveform     | |
|  |  Editor          |--->|  Controller    |--->|  Viewer       | |
|  |  (tldraw)        |    |  (Main Thread) |    |  (uPlot)      | |
|  +--------+---------+    +-------+--------+    +---------------+ |
|           |                      |                               |
|           v                      v                               |
|  +------------------+    +----------------+                      |
|  |  Netlisting      |    |  WASM Worker   |                      |
|  |  Engine          |    |  (ngspice)     |                      |
|  +------------------+    +----------------+                      |
|           |                                                      |
|           v                                                      |
|  +------------------+    +----------------+                      |
|  |  Collaboration   |    |  State Store   |                      |
|  |  Layer (Yjs)     |<-->|  (Zustand)     |                      |
|  +--------+---------+    +----------------+                      |
|           |                                                      |
+-----------+------------------------------------------------------+
            | WebSocket
            v
+------------------------------------------------------------------+
|                    Cloudflare Edge                                |
|                                                                  |
|  +------------------+    +----------------+    +---------------+ |
|  |  Workers         |    |  Durable       |    |  R2 / D1      | |
|  |  (API + Auth)    |--->|  Objects       |--->|  (Storage)    | |
|  +------------------+    |  (Yjs Rooms)   |    +---------------+ |
|                          +----------------+                      |
+------------------------------------------------------------------+
```

### Core Data Flow: Schematic to Waveform

```
Schematic Canvas (tldraw shapes)
       |
       | User places/connects components
       v
Circuit Data Model (Zustand store)
       |
       | Serializable graph: nodes + edges + component params
       v
Netlisting Engine (pure TypeScript)
       |
       | Traverses graph, resolves nets, generates SPICE text
       v
SPICE Netlist (text string)
       |
       | postMessage to Web Worker
       v
ngspice WASM (Web Worker)
       |
       | ngSpice_Circ() -> ngSpice_Command("run") -> SendData callback
       v
Raw Simulation Data (vectors: time/frequency + values)
       |
       | postMessage back to main thread
       v
Waveform Store (Zustand)
       |
       | Transformed for plotting
       v
uPlot Waveform Viewer
```

## Component Boundaries

### 1. Schematic Editor (tldraw-based)

**Responsibility:** Visual circuit creation and editing.

**Boundary:** Owns the canvas, shape rendering, user interactions (drag, connect, select). Does NOT know about SPICE syntax or simulation. Communicates only through the circuit data model.

**Key decisions:**
- Use tldraw (not React Flow). tldraw is an infinite canvas SDK with custom shapes, spatial indexing (only renders visible shapes), and built-in collaboration support. React Flow is node-graph oriented, which maps poorly to circuit schematics where wires are first-class entities with bends, junctions, and routing. tldraw's freeform canvas model better matches schematic drawing.
- Define custom tldraw shapes for each component type (resistor, capacitor, MOSFET, etc.) with connection ports at fixed positions.
- Wire routing as a custom tldraw tool that creates polyline shapes snapping between ports.
- Component property editing via tldraw's shape property panel system.

**Confidence:** HIGH (tldraw docs confirm custom shapes, tools, and property panels are first-class features)

### 2. Circuit Data Model

**Responsibility:** Authoritative representation of the circuit as a typed graph.

**Boundary:** Pure TypeScript data structures. No UI dependencies. No SPICE knowledge. This is the single source of truth that both the editor and netlister read/write.

**Data structure:**

```typescript
// Core circuit graph
interface Circuit {
  id: string;
  name: string;
  components: Map<string, Component>;
  wires: Map<string, Wire>;
  nets: Map<string, Net>;        // computed from wires
  parameters: CircuitParameters;  // .param definitions
}

interface Component {
  id: string;
  type: ComponentType;           // 'resistor' | 'capacitor' | 'mosfet' | ...
  refDesignator: string;         // R1, C2, M3
  ports: Port[];                 // connection points
  properties: Record<string, string>; // value, model, etc.
  position: { x: number; y: number };
  rotation: number;
}

interface Wire {
  id: string;
  points: { x: number; y: number }[];
  startPortId: string;
  endPortId: string;
}

interface Net {
  id: string;
  name: string;                  // user-assigned or auto (net_0, net_1)
  connectedPorts: string[];      // port IDs
}

interface Port {
  id: string;
  componentId: string;
  name: string;                  // 'pin1', 'gate', 'drain', 'source'
  position: { x: number; y: number }; // relative to component
  netId: string | null;
}
```

**Synchronization:** This model is what gets synced via Yjs for collaboration. Each field maps to a Y.Map or Y.Array.

**Confidence:** HIGH (standard graph representation for circuit data, validated by EEcircuit's similar parser.ts/simulationLink.ts pattern)

### 3. Netlisting Engine

**Responsibility:** Converts the circuit data model into a valid ngspice netlist string.

**Boundary:** Pure function: `(circuit: Circuit, analysisConfig: AnalysisConfig) => string`. No side effects. No UI. No WASM. Fully testable in isolation.

**Process:**
1. Compute nets from wire connectivity (union-find algorithm for connected ports)
2. Assign net names (ground = 0, user-labeled nets keep names, others auto-named)
3. Emit component lines: `R1 net_1 net_2 10k`
4. Emit model includes: `.include NMOS_3p3.mod`
5. Emit analysis directive: `.tran 1u 10m` or `.ac dec 100 1 1MEG`
6. Emit output directives: `.save v(out) i(R1)`
7. Return complete netlist string

**Key insight from EEcircuit:** Their `parser.ts` + `simulationLink.ts` separation confirms this two-stage approach: first parse/resolve the circuit topology, then generate the netlist text.

**Confidence:** HIGH (SPICE netlist format is standardized, well-documented)

### 4. Simulation Engine (ngspice WASM in Web Worker)

**Responsibility:** Execute SPICE simulation and return result vectors.

**Boundary:** Runs in a dedicated Web Worker. Communicates via `postMessage` only. The main thread NEVER loads the WASM module directly.

**Architecture pattern (from EEcircuit's useWorker.ts):**

```typescript
// Main thread: SimulationController
class SimulationController {
  private worker: Worker;
  private pendingRequests: Map<string, { resolve, reject }>;

  async runSimulation(netlist: string): Promise<SimulationResult> {
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });
      this.worker.postMessage({ type: 'RUN', requestId, netlist });
    });
  }

  // Handle progress callbacks for long simulations
  onProgress(callback: (percent: number) => void) { ... }
}

// Web Worker: simulation.worker.ts
// 1. Load ngspice WASM module on worker init
// 2. Register callbacks: SendChar, SendData, SendStat
// 3. On 'RUN' message:
//    a. ngSpice_Circ(netlistLines)    // load circuit
//    b. ngSpice_Command('run')         // execute simulation
//    c. Collect data via SendData callback
//    d. postMessage back results
```

**ngspice shared library API (exposed via Emscripten):**
- `ngSpice_Init(SendChar, SendStat, ControlledExit, SendData, SendInitData, BGThreadRunning, userData)` -- initialize with callbacks
- `ngSpice_Circ(netlistArray)` -- load circuit from string array
- `ngSpice_Command(command)` -- execute commands ('run', 'op', 'ac dec 100 1 1meg')
- Callbacks push data back: `SendData` fires at each simulation point with vector data
- `SendChar` captures stdout/stderr for error messages

**Critical pattern:** The Web Worker isolates the WASM module completely. If ngspice crashes or hangs, terminate the worker and spawn a new one. The main thread UI never freezes.

**Confidence:** HIGH (ngspice shared library API is well-documented; EEcircuit's useWorker.ts confirms this pattern works)

### 5. Waveform Viewer (uPlot)

**Responsibility:** High-performance rendering of simulation result traces.

**Boundary:** Receives typed arrays of simulation data. Renders time-domain and frequency-domain plots. Supports cursors, measurements, zoom/pan. Does NOT know about circuits or SPICE.

**Data interface:**

```typescript
interface SimulationResult {
  analysisType: 'tran' | 'ac' | 'dc' | 'op';
  vectors: {
    name: string;        // 'time', 'v(out)', 'i(R1)'
    data: Float64Array;  // raw values
    unit: string;        // 'V', 'A', 's', 'Hz'
    isComplex: boolean;  // true for AC analysis (mag/phase)
  }[];
}
```

**Why uPlot:** Handles millions of points at 60fps via Canvas2D. EEcircuit uses webgl-plot for similar reasons, but uPlot has a larger ecosystem (10k stars), better documentation, and easier React integration. WebGL-based plotting is overkill unless rendering >10M points simultaneously.

**Confidence:** MEDIUM (uPlot capability is well-documented; the 10M point threshold for needing WebGL is an estimate)

### 6. State Management (Zustand)

**Responsibility:** Application-wide state that doesn't belong to tldraw's internal store.

**Boundary:** Manages simulation state, UI state, user preferences, and acts as the bridge between components. tldraw manages its own canvas state internally.

**Store slices (following Zustand slice pattern):**

```typescript
// Circuit slice - bridges tldraw shapes to circuit data model
interface CircuitSlice {
  circuit: Circuit;
  selectedComponentId: string | null;
  updateComponent: (id: string, props: Partial<Component>) => void;
}

// Simulation slice
interface SimulationSlice {
  status: 'idle' | 'running' | 'complete' | 'error';
  progress: number;
  results: SimulationResult | null;
  error: string | null;
  analysisConfig: AnalysisConfig;
  runSimulation: () => Promise<void>;
  cancelSimulation: () => void;
}

// UI slice
interface UISlice {
  activePanel: 'schematic' | 'waveform' | 'split';
  componentLibraryOpen: boolean;
  // ...
}
```

**Key pattern:** Zustand stores are NOT the source of truth for canvas state (tldraw owns that). Zustand manages the derived circuit model and simulation lifecycle. Changes flow: tldraw shape change -> sync to circuit model in Zustand -> available for netlisting.

**Confidence:** HIGH (EEcircuit uses Zustand per their ZUSTAND_IMPLEMENTATION.md; Zustand slice pattern is well-documented for complex apps)

### 7. Collaboration Layer (Yjs + tldraw sync)

**Responsibility:** Real-time multiplayer editing of circuits.

**Boundary:** Sits between the data model and the network. Handles conflict resolution, awareness (cursor positions), and offline support.

**Architecture decision: tldraw sync vs. raw Yjs**

tldraw has its own sync engine (`tldraw-sync-cloudflare`) that uses Durable Objects and works out of the box. However, OmniSpice needs to sync MORE than just canvas shapes -- simulation config, waveform annotations, and lab progress also need sync. Two options:

**Recommended approach: Yjs as the universal sync layer.**

- Use `y-tldraw` (or implement a thin adapter) to bind tldraw's store to a Y.Doc
- Use additional Y.Map/Y.Array instances in the same Y.Doc for simulation config, component properties, and lab state
- Use `y-websocket` or `y-webrtc` as the network provider
- Backend: Cloudflare Durable Object holds the Y.Doc, persists to R2

**Why not tldraw-sync-cloudflare directly:** It only syncs tldraw's internal state. OmniSpice needs to sync circuit metadata, simulation parameters, and educational features that live outside tldraw. Building on Yjs gives a single sync primitive for everything.

**Room model (from tldraw-sync-cloudflare pattern):**
- Each circuit document = one Durable Object = one "room"
- Durable Object holds Y.Doc in memory, persists snapshots to R2
- ~50 concurrent collaborators per room (Durable Object limit)
- Awareness CRDT handles cursors, selections, user presence

**Confidence:** MEDIUM (Yjs + tldraw integration exists as community POC but not official; the adapter layer needs validation)

## Anti-Patterns to Avoid

### Anti-Pattern 1: WASM on Main Thread
**What:** Loading ngspice WASM directly in the main thread.
**Why bad:** A transient analysis of a moderately complex circuit can take 2-10 seconds. This freezes the entire UI. Even short simulations cause dropped frames during interaction.
**Instead:** Always run ngspice in a Web Worker. Use `postMessage` for communication. Consider `SharedArrayBuffer` + `Atomics` for streaming intermediate results during long simulations.

### Anti-Pattern 2: Monolithic State Store
**What:** Putting tldraw canvas state, simulation results, and UI state in one Zustand store.
**Why bad:** tldraw has its own reactive store optimized for canvas performance. Duplicating canvas state in Zustand causes double-renders and sync bugs.
**Instead:** Let tldraw own canvas state. Zustand owns everything else. Bridge them with a thin synchronization layer that extracts circuit semantics from tldraw shapes.

### Anti-Pattern 3: Direct SPICE String Manipulation
**What:** Building netlist strings by concatenating component lines without a proper circuit graph.
**Why bad:** Net resolution (which pins are connected?) requires graph traversal. String manipulation can't detect floating nodes, short circuits, or missing ground.
**Instead:** Always go through the circuit data model. Netlisting is a pure function over the graph.

### Anti-Pattern 4: Tight Coupling Between Editor and Simulator
**What:** The schematic editor directly calls ngspice functions or knows about SPICE syntax.
**Why bad:** Makes testing impossible without WASM. Prevents swapping simulation engines. Blocks UI during simulation.
**Instead:** Clean separation: Editor -> Data Model -> Netlister -> Simulation Controller -> Results Store -> Waveform Viewer. Each boundary is a typed interface.

### Anti-Pattern 5: Syncing Raw Canvas Coordinates
**What:** Using Yjs to sync pixel-level shape positions as the source of truth for circuit connectivity.
**Why bad:** Circuit connectivity is topological (what's connected to what), not geometric (where things are on screen). Syncing only geometry means re-deriving connectivity on every change, which is fragile.
**Instead:** Sync both the visual state (tldraw shapes) AND the circuit model (component graph with net assignments). Derive one from the other on change, but persist both.

## Patterns to Follow

### Pattern 1: Command-Based Simulation Interface
**What:** All simulation operations go through a command queue.
**When:** Always -- this is the primary pattern for WASM worker communication.
**Example:**
```typescript
type SimCommand =
  | { type: 'INIT' }
  | { type: 'LOAD_CIRCUIT'; netlist: string }
  | { type: 'RUN'; analysis: string }
  | { type: 'STOP' }
  | { type: 'GET_VECTOR'; name: string };

type SimResponse =
  | { type: 'READY' }
  | { type: 'PROGRESS'; percent: number }
  | { type: 'DATA'; vectors: VectorData[] }
  | { type: 'ERROR'; message: string; line?: number }
  | { type: 'STDOUT'; text: string };
```

### Pattern 2: Shape-to-Model Synchronization
**What:** A reactive bridge between tldraw shapes and the circuit data model.
**When:** Every time a tldraw shape changes, derive the circuit model update.
**Example:**
```typescript
// Listen to tldraw store changes
editor.store.listen((entry) => {
  for (const record of Object.values(entry.changes.added)) {
    if (isCircuitComponent(record)) {
      circuitStore.addComponent(tldrawShapeToComponent(record));
    }
  }
  for (const record of Object.values(entry.changes.updated)) {
    const [before, after] = record;
    if (isCircuitComponent(after)) {
      circuitStore.updateComponent(after.id, tldrawShapeToComponent(after));
    }
  }
  // Handle removed, etc.
});
```

### Pattern 3: Error Message Translation
**What:** Intercept ngspice's cryptic error messages and translate to student-friendly language.
**When:** On every `SendChar` callback that contains an error.
**Example:**
```typescript
const ERROR_TRANSLATIONS: Record<string, (ctx: ErrorContext) => string> = {
  'singular matrix': (ctx) =>
    `Your circuit has a problem at ${ctx.node}: check for floating nodes ` +
    `(components not connected to anything) or short circuits across voltage sources.`,
  'no DC path to ground': (ctx) =>
    `Node "${ctx.node}" isn't connected to ground. Every node needs a path to ` +
    `ground (node 0). Add a ground connection or a large resistor to ground.`,
  'timestep too small': (ctx) =>
    `The simulation is having trouble converging. Try increasing the maximum ` +
    `timestep or simplifying your circuit near ${ctx.node}.`,
};
```

### Pattern 4: Lazy WASM Loading
**What:** Don't load the ngspice WASM module until the user first clicks "Run Simulation."
**When:** Always -- the WASM module is ~5-10MB. Loading it upfront wastes bandwidth for users who are just drawing.
**Example:**
```typescript
class SimulationController {
  private worker: Worker | null = null;

  private async ensureWorker(): Promise<Worker> {
    if (!this.worker) {
      this.worker = new Worker(
        new URL('./simulation.worker.ts', import.meta.url),
        { type: 'module' }
      );
      await this.sendCommand({ type: 'INIT' });
    }
    return this.worker;
  }
}
```

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|-------------|-------------|-------------|
| Simulation compute | All client-side, no server load | Same -- WASM runs in browser | Same -- compute is always client-side |
| Collaboration rooms | Single Durable Object per room | Same -- rooms are independent | Shard by region, ~50 users/room |
| Circuit storage | D1 SQLite, trivial | D1 with read replicas | R2 for circuit files, D1 for metadata |
| WASM bundle delivery | Cloudflare CDN, ~5-10MB | Same CDN, cached at edge | Same -- static asset, caches well |
| Component library | Bundled JSON, ~100KB | Same | Consider lazy-loading model files |

**Key insight:** Because simulation runs entirely client-side, the server scaling story is remarkably simple. The backend only handles auth, storage, and collaboration sync. This is a massive architectural advantage.

## Suggested Build Order

Based on dependency analysis between components:

```
Phase 1: Foundation
  Circuit Data Model (types + core graph logic)
  ngspice WASM Worker (load, send netlist, get results)
  Basic netlisting (resistors, capacitors, sources)
  Minimal waveform display (uPlot with hardcoded data)

Phase 2: Schematic Editor
  tldraw custom shapes (components with ports)
  Wire routing tool
  Shape-to-model bridge
  Component property panel
  (Depends on: Circuit Data Model from Phase 1)

Phase 3: Simulation Pipeline
  Full netlisting engine (all component types)
  Simulation controller (run/stop/progress)
  Error message translation
  Waveform viewer (cursors, measurements, multi-trace)
  (Depends on: Phase 1 + Phase 2 integration)

Phase 4: Collaboration + Cloud
  Yjs integration with tldraw
  Cloudflare Durable Objects for rooms
  User auth + circuit save/load
  (Depends on: working editor from Phase 2-3)

Phase 5: Education Features
  Guided labs framework
  Circuit insights engine
  Comparison mode
  (Depends on: full simulation pipeline from Phase 3)
```

**Build order rationale:**
- The circuit data model is the foundation everything else depends on. Build it first and test it in isolation.
- The WASM worker can be developed in parallel with the editor since they communicate only through the data model.
- The schematic editor depends on the data model but not on simulation -- users should be able to draw before they can simulate.
- Collaboration wraps existing functionality; it should not be designed into the core but layered on top via Yjs bindings.
- Education features are pure application logic on top of a working simulator.

## Sources

- [EEcircuit GitHub](https://github.com/eelab-dev/EEcircuit) - Reference architecture for ngspice-wasm circuit simulator
- [tldraw Custom Shapes Docs](https://tldraw.dev/features/customization/custom-shapes-and-tools) - Custom shape and tool system
- [tldraw Collaboration Docs](https://tldraw.dev/docs/collaboration) - Sync architecture and Yjs compatibility
- [tldraw-sync-cloudflare](https://github.com/tldraw/tldraw-sync-cloudflare) - Durable Objects sync pattern
- [ngspice Shared Library API](https://ngspice.sourceforge.io/shared.html) - ngSpice_Init, ngSpice_Command, ngSpice_Circ callbacks
- [ngspice sharedspice.h](https://github.com/ngspice/ngspice/blob/master/src/include/ngspice/sharedspice.h) - C API header
- [danchitnis/ngspice](https://github.com/danchitnis/ngspice) - ngspice WASM compilation via Emscripten
- [wokwi/ngspice-wasm](https://github.com/wokwi/ngspice-wasm) - Alternative WASM build
- [circuitjs1](https://github.com/pfalstad/circuitjs1) - GWT-based browser simulator (anti-reference for architecture)
- [Yjs Documentation](https://docs.yjs.dev/) - CRDT shared data types and awareness
- [React Flow](https://reactflow.dev) - Considered and rejected for schematic use
- [Zustand Architecture Patterns](https://brainhub.eu/library/zustand-architecture-patterns-at-scale) - Slice pattern for complex apps
- [WASM + Web Workers](https://www.sitepen.com/blog/using-webassembly-with-web-workers) - Off-main-thread WASM pattern
