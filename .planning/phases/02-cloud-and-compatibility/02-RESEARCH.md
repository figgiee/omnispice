# Phase 2: Cloud and Compatibility - Research

**Researched:** 2026-04-09
**Domain:** Auth (Clerk), Cloud persistence (Cloudflare D1 + R2), LTspice import, canvas export, live simulation overlay
**Confidence:** HIGH (all major claims verified against official docs or npm registry)

---

## Summary

Phase 2 adds cloud persistence, sharing, LTspice import, export, and live simulation overlay to the existing Phase 1 simulator. The confirmed stack — Clerk, Cloudflare Workers + Hono, D1, R2 — is production-ready and well-documented. No research pivots are needed.

The most technically novel work is the live simulation overlay (LIVE-01 through LIVE-03), which maps ngspice output vectors back onto React Flow nodes by correlating net names. This is purely client-side and integrates cleanly with the existing `simulationStore` and `circuitStore`. The existing `parser.ts` already extracts `v(nodeName)` and `i(refDesignator)` from ngspice output — the overlay work is primarily a React Flow rendering concern.

The LTspice .asc parser must be written from scratch (no npm package exists). The format is well-understood from KiCad's importer docs and Wikipedia's canonical example. A hand-rolled recursive-descent text parser for 8–10 keywords covers 90%+ of real-world undergraduate schematics.

**Primary recommendation:** Build in this order: (1) Clerk auth + Hono API scaffold, (2) circuit CRUD (D1 + R2), (3) share links, (4) live overlay, (5) PNG/CSV/netlist export, (6) LTspice import. Export and import are independent; the overlay depends on Phase 1's real simulation being wired up.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIVE-01 | Node voltages display inline on schematic after simulation | React Flow node `data` field + `useReactFlow().setNodes`; ngspice `v(netName)` vectors already parsed in `parser.ts` |
| LIVE-02 | Component current and power display on each component | `i(refDesignator)` vectors from ngspice; same React Flow overlay mechanism |
| LIVE-03 | Overlay updates on re-run | Zustand `simulationStore.results` watch triggers `setNodes` update |
| CLOUD-01 | User accounts with email + password | Clerk `@clerk/react` v6.2.1; `<SignIn>` component handles all auth UI |
| CLOUD-02 | Save circuits to cloud | D1 (metadata) + R2 (circuit JSON blob); Hono POST `/api/circuits` |
| CLOUD-03 | Load saved circuits | Hono GET `/api/circuits/:id`; R2 body parsed as JSON |
| CLOUD-04 | Shareable read-only link, no login required | Short ID via `crypto.randomUUID()`, public GET endpoint, D1 `share_token` column |
| CLOUD-05 | Circuit list / dashboard | Hono GET `/api/circuits` with `userId` filter on D1 |
| LTSP-01 | Import LTspice .asc file and render on canvas | Hand-rolled line-oriented parser; SYMBOL → ComponentType mapping |
| LTSP-02 | Imported circuits simulate correctly | .asc SPICE directives embedded as TEXT lines; pass through to ngspice netlist builder |
| EXP-01 | Export schematic as PNG | `html-to-image` v1.11.13 + React Flow `getNodesBounds` + `getViewportForBounds` |
| EXP-02 | Export waveform as CSV | Pure client-side: transpose `VectorData[]` to CSV string, `Blob` download |
| EXP-03 | Export netlist as .cir | Already generated in Phase 1's netlist builder; add download button |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

- **Platform:** Browser-only SPA (React 19 + Vite 8 + TypeScript). No SSR.
- **Package manager:** pnpm exclusively.
- **Strict TypeScript:** Strict mode mandatory. All new modules must be fully typed.
- **Stack is locked:** React Flow, ngspice WASM, uPlot, Zustand, Cloudflare Workers + Hono, Clerk, D1, R2.
- **License:** Proprietary. Dependencies must be MIT/BSD-licensed.
- **No SharedArrayBuffer / WASM threading** (breaks iframe embeds).
- **No AI attribution in commits or code.**

---

## Standard Stack

### Core (all versions verified against npm registry 2026-04-09)

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| `@clerk/react` | 6.2.1 | React auth components + hooks (ClerkProvider, useUser, SignedIn/Out) | HIGH |
| `@clerk/backend` | 3.2.8 | Backend JWT verification; used by `@hono/clerk-auth` | HIGH |
| `@hono/clerk-auth` | 3.1.1 | Hono middleware that injects Clerk session into request context | HIGH |
| `hono` | 4.12.12 | HTTP framework for Cloudflare Workers | HIGH |
| `wrangler` | 4.81.1 | Cloudflare local dev (D1, R2, Workers) | HIGH |
| `@cloudflare/workers-types` | 4.20260410.1 | TypeScript types for Workers runtime | HIGH |
| `html-to-image` | 1.11.13 | PNG/SVG export of React Flow canvas (locked — newer versions broken) | HIGH |
| `nanoid` | 5.1.7 | URL-safe short ID generation (for share tokens) | HIGH |
| `@tanstack/react-query` | 5.97.0 | Server state (circuit CRUD, user circuits list) | HIGH |

### Not Required (already present)

- `zustand` 5.0.12 — already in project; extend with overlay store slice
- `@xyflow/react` 12.10.2 — already in project; use `useReactFlow().setNodes` for overlay updates

### Installation (new packages only)

```bash
# Frontend
pnpm add @clerk/react @tanstack/react-query html-to-image nanoid

# Backend (Cloudflare Workers — separate worker package)
pnpm add hono @hono/clerk-auth @clerk/backend
pnpm add -D wrangler @cloudflare/workers-types
```

**Note:** The Cloudflare Worker is a separate entry point, not bundled into the Vite SPA. It lives at `worker/src/index.ts` and has its own `wrangler.toml`.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── auth/                  # Clerk integration
│   ├── AuthProvider.tsx   # ClerkProvider wrapper
│   ├── AuthModal.tsx      # SignIn/SignUp modal overlay
│   └── useCurrentUser.ts  # Thin hook over useUser + useAuth
├── cloud/                 # Cloud persistence
│   ├── api.ts             # TanStack Query fetcher functions
│   ├── hooks.ts           # useCircuits, useSaveCircuit, useLoadCircuit
│   └── types.ts           # CircuitMeta, CircuitSnapshot
├── overlay/               # Live simulation overlay
│   ├── overlayStore.ts    # Zustand slice: Map<netName, voltage>
│   ├── useOverlaySync.ts  # Watches simulationStore, populates overlayStore
│   └── NodeVoltageLabel.tsx  # React component rendered inside custom nodes
├── ltspice/               # LTspice import
│   ├── parser.ts          # .asc text parser → AscCircuit IR
│   ├── mapper.ts          # AscCircuit → OmniSpice Circuit
│   └── types.ts           # AscSymbol, AscWire, AscFlag
└── export/
    ├── exportPng.ts       # html-to-image export
    ├── exportCsv.ts       # VectorData[] → CSV string
    └── exportNetlist.ts   # Thin wrapper over existing netlist builder

worker/                    # Cloudflare Worker (separate package)
├── src/
│   ├── index.ts           # Hono app + route registration
│   ├── middleware/
│   │   └── auth.ts        # clerkMiddleware() + requireAuth() helper
│   ├── routes/
│   │   ├── circuits.ts    # CRUD /api/circuits
│   │   └── share.ts       # Public /api/share/:token
│   └── db/
│       ├── schema.sql     # D1 migration
│       └── queries.ts     # Typed D1 query helpers
├── wrangler.toml
└── package.json
```

---

### Pattern 1: Clerk + React 19 SPA

**What:** Wrap app in `ClerkProvider`. Use `<SignedIn>` / `<SignedOut>` for conditional UI. No router integration required — Clerk works with pure conditional rendering.

**When to use:** App-wide auth gate. Cloud features are opt-in — show the editor to unauthenticated users, prompt login only on save/load.

```typescript
// src/main.tsx
import { ClerkProvider } from '@clerk/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
      <App />
    </ClerkProvider>
  </StrictMode>
);

// src/auth/AuthModal.tsx
import { SignedIn, SignedOut, SignIn, UserButton } from '@clerk/react';

export function AuthModal() {
  return (
    <>
      <SignedOut>
        <SignIn routing="hash" />
      </SignedOut>
      <SignedIn>
        <UserButton />
      </SignedIn>
    </>
  );
}
```

**Critical:** Use `routing="hash"` (not `routing="path"`) for SPAs without a router. This prevents Clerk from trying to redirect to `/sign-in` as a real route.

**useAuth for API tokens:**
```typescript
import { useAuth } from '@clerk/react';

function useBearerToken() {
  const { getToken } = useAuth();
  return async () => getToken(); // Returns JWT string or null
}
```

---

### Pattern 2: Hono + @hono/clerk-auth (Cloudflare Worker)

**What:** Apply Clerk middleware globally. `getAuth(c).userId` identifies the user. Protected routes return 401 when userId is null.

```typescript
// worker/src/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { clerkMiddleware, getAuth } from '@hono/clerk-auth';
import { circuitsRouter } from './routes/circuits';
import { shareRouter } from './routes/share';

type Bindings = {
  DB: D1Database;
  CIRCUIT_BUCKET: R2Bucket;
  CLERK_PUBLISHABLE_KEY: string;
  CLERK_SECRET_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors({ origin: ['https://omnispice.app', 'http://localhost:5173'] }));
app.use('/api/circuits/*', clerkMiddleware());

// Helper: require auth or 401
export function requireAuth(c: Context) {
  const auth = getAuth(c);
  if (!auth?.userId) throw new HTTPException(401, { message: 'Unauthorized' });
  return auth.userId;
}

app.route('/api/circuits', circuitsRouter);
app.route('/api/share', shareRouter); // No auth on share routes

export default app;
```

**Environment variables for the Worker (wrangler.toml):**
```toml
[vars]
CLERK_PUBLISHABLE_KEY = "pk_live_..."
# CLERK_SECRET_KEY goes in .dev.vars (local) and Worker Secrets (prod)
```

---

### Pattern 3: D1 + R2 Split Storage

**What:** Store circuit metadata in D1 (queryable, small), store circuit JSON in R2 (blob, potentially large).

**Why split:** D1 row max size is 2 MB. A complex circuit with hundreds of components could approach this limit. More importantly, D1 is optimized for queries (list by user, search by name); R2 is optimized for large object reads/writes. The pattern mirrors industry-standard "metadata in database, blobs in object storage."

**D1 schema:**
```sql
-- worker/src/db/schema.sql
CREATE TABLE circuits (
  id TEXT PRIMARY KEY,             -- crypto.randomUUID()
  user_id TEXT NOT NULL,           -- Clerk userId
  name TEXT NOT NULL DEFAULT 'Untitled Circuit',
  description TEXT,
  share_token TEXT UNIQUE,         -- NULL = not shared; populated on share
  r2_key TEXT NOT NULL,            -- R2 object key: "circuits/{id}.json"
  created_at INTEGER NOT NULL,     -- Unix timestamp (ms)
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_circuits_user_id ON circuits(user_id);
CREATE INDEX idx_circuits_share_token ON circuits(share_token);
```

**R2 object key convention:** `circuits/{circuitId}.json`

**Circuit CRUD pattern (Hono route):**
```typescript
// worker/src/routes/circuits.ts
import { Hono } from 'hono';
import { requireAuth } from '../index';

const circuits = new Hono<{ Bindings: Bindings }>();

// POST /api/circuits — create or upsert
circuits.post('/', async (c) => {
  const userId = requireAuth(c);
  const body = await c.req.json<{ id?: string; name: string; circuit: unknown }>();

  const id = body.id ?? crypto.randomUUID();
  const r2Key = `circuits/${id}.json`;
  const now = Date.now();

  // Write circuit JSON to R2
  await c.env.CIRCUIT_BUCKET.put(r2Key, JSON.stringify(body.circuit), {
    httpMetadata: { contentType: 'application/json' },
  });

  // Upsert metadata row in D1
  await c.env.DB.prepare(`
    INSERT INTO circuits (id, user_id, name, r2_key, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name, updated_at=excluded.updated_at
  `).bind(id, userId, body.name, r2Key, now, now).run();

  return c.json({ id });
});

// GET /api/circuits — list user's circuits
circuits.get('/', async (c) => {
  const userId = requireAuth(c);
  const rows = await c.env.DB.prepare(
    'SELECT id, name, share_token, created_at, updated_at FROM circuits WHERE user_id = ? ORDER BY updated_at DESC'
  ).bind(userId).all();
  return c.json(rows.results);
});

// GET /api/circuits/:id — load circuit data
circuits.get('/:id', async (c) => {
  const userId = requireAuth(c);
  const { id } = c.req.param();
  const meta = await c.env.DB.prepare(
    'SELECT * FROM circuits WHERE id = ? AND user_id = ?'
  ).bind(id, userId).first();
  if (!meta) return c.json({ error: 'Not found' }, 404);

  const obj = await c.env.CIRCUIT_BUCKET.get(meta.r2_key as string);
  if (!obj) return c.json({ error: 'Circuit data missing' }, 500);

  return new Response(obj.body, {
    headers: { 'Content-Type': 'application/json' },
  });
});

export { circuits as circuitsRouter };
```

---

### Pattern 4: Shareable Read-Only Links

**What:** When a user clicks "Share", the API writes a `share_token` to the D1 row and returns a URL. The public endpoint reads circuit data from R2 using only the token — no auth required.

**Share token generation (Worker — crypto.randomUUID() is available in Workers):**
```typescript
// POST /api/circuits/:id/share
circuits.post('/:id/share', async (c) => {
  const userId = requireAuth(c);
  const { id } = c.req.param();
  const token = crypto.randomUUID().replace(/-/g, '').slice(0, 16); // 16-char URL-safe token
  await c.env.DB.prepare(
    'UPDATE circuits SET share_token = ? WHERE id = ? AND user_id = ?'
  ).bind(token, id, userId).run();
  return c.json({ shareUrl: `https://omnispice.app/share/${token}` });
});

// GET /api/share/:token — PUBLIC, no auth
// worker/src/routes/share.ts
share.get('/:token', async (c) => {
  const { token } = c.req.param();
  const meta = await c.env.DB.prepare(
    'SELECT r2_key, name FROM circuits WHERE share_token = ?'
  ).bind(token).first();
  if (!meta) return c.json({ error: 'Not found' }, 404);

  const obj = await c.env.CIRCUIT_BUCKET.get(meta.r2_key as string);
  if (!obj) return c.json({ error: 'Circuit data missing' }, 500);

  return new Response(obj.body, {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

**Frontend routing (no React Router):** The SPA reads `window.location.pathname`. If it matches `/share/:token`, mount the read-only viewer instead of the editor. Use a simple route check in `App.tsx`:

```typescript
function App() {
  const shareMatch = window.location.pathname.match(/^\/share\/([a-zA-Z0-9]+)$/);
  if (shareMatch) {
    return <SharedCircuitViewer token={shareMatch[1]} />;
  }
  return <EditorLayout />;
}
```

---

### Pattern 5: Live Simulation Overlay

**What:** After simulation completes, `simulationStore.results` contains `VectorData[]`. The overlay extracts DC node voltages (`v(netName)`) and component currents (`i(refDesignator)`) and injects them into React Flow node `data` fields so custom node components can render them as labels.

**How net names map to nodes:**
The existing `circuitStore` tracks `Port.netId` for each port. The netlist builder assigns SPICE node names based on these net IDs. The mapping is: ngspice outputs `v(netName)` where `netName` is the net's assigned SPICE name (e.g., `net1`, `out`, `0`).

**Overlay store slice:**
```typescript
// src/overlay/overlayStore.ts
import { create } from 'zustand';

interface OverlayState {
  nodeVoltages: Record<string, number>;   // { 'net1': 3.3, 'out': 1.65 }
  branchCurrents: Record<string, number>; // { 'R1': 0.001, 'C1': 0.00002 }
  isVisible: boolean;
  setOverlay: (voltages: Record<string, number>, currents: Record<string, number>) => void;
  toggleVisibility: () => void;
  clear: () => void;
}

export const useOverlayStore = create<OverlayState>((set) => ({
  nodeVoltages: {},
  branchCurrents: {},
  isVisible: true,
  setOverlay: (voltages, currents) => set({ nodeVoltages: voltages, branchCurrents: currents }),
  toggleVisibility: () => set((s) => ({ isVisible: !s.isVisible })),
  clear: () => set({ nodeVoltages: {}, branchCurrents: {} }),
}));
```

**Overlay sync hook (watches simulationStore, extracts voltages):**
```typescript
// src/overlay/useOverlaySync.ts
import { useEffect } from 'react';
import { useSimulationStore } from '@/store/simulationStore';
import { useOverlayStore } from './overlayStore';
import type { VectorData } from '@/simulation/protocol';

export function useOverlaySync() {
  const results = useSimulationStore((s) => s.results);
  const setOverlay = useOverlayStore((s) => s.setOverlay);

  useEffect(() => {
    if (!results.length) return;

    const voltages: Record<string, number> = {};
    const currents: Record<string, number> = {};

    for (const vec of results) {
      const name = vec.name.toLowerCase();
      // DC op point: single-element array
      if (name.startsWith('v(') && name.endsWith(')') && vec.data.length === 1) {
        const netName = name.slice(2, -1); // "v(out)" → "out"
        voltages[netName] = vec.data[0]!;
      }
      if (name.startsWith('i(') && name.endsWith(')') && vec.data.length === 1) {
        const ref = name.slice(2, -1).toUpperCase(); // "i(r1)" → "R1"
        currents[ref] = vec.data[0]!;
      }
    }

    setOverlay(voltages, currents);
  }, [results, setOverlay]);
}
```

**React Flow node update pattern:** To display overlay values inside existing custom nodes, extend the node's `data` field type to include optional overlay fields. In `useOverlaySync`, after computing voltages/currents, call `useReactFlow().setNodes()` to inject overlay data — OR (simpler) keep overlay data in `overlayStore` and read it directly from node components via `useOverlayStore`. The second approach avoids expensive `setNodes` calls.

**Recommended approach:** Nodes read from `overlayStore` directly by their `netId` or `refDesignator`. This is simpler and avoids React Flow re-rendering all nodes on every simulation result update.

```typescript
// Inside ResistorNode.tsx (example)
import { useOverlayStore } from '@/overlay/overlayStore';

function ResistorNode({ data }: NodeProps<ResistorData>) {
  const current = useOverlayStore((s) => s.branchCurrents[data.refDesignator]);
  const isVisible = useOverlayStore((s) => s.isVisible);

  return (
    <div className={styles.node}>
      <ResistorSymbol />
      {isVisible && current !== undefined && (
        <span className={styles.overlayLabel}>{formatCurrent(current)}</span>
      )}
    </div>
  );
}
```

**Net-to-node mapping:** Each `Port` has a `netId`. The netlist builder assigns SPICE names to nets. The overlay reads node voltages by netName, and nodes read from the overlay by their port's netId. This requires the netlist builder to expose its `netId → spiceName` mapping — a small addition to Phase 1's netlist module.

---

### Pattern 6: PNG Export (html-to-image)

**Critical:** Lock `html-to-image` to `1.11.13`. Versions after this have a known broken export for React Flow (documented in React Flow GitHub discussions).

```typescript
// src/export/exportPng.ts
import { toPng } from 'html-to-image';
import { getNodesBounds, getViewportForBounds } from '@xyflow/react';

const IMAGE_WIDTH = 2048;
const IMAGE_HEIGHT = 1536;

export async function exportSchemticAsPng(
  viewportElement: HTMLElement,
  nodes: Node[],
  filename = 'circuit.png'
): Promise<void> {
  const nodesBounds = getNodesBounds(nodes);
  const viewport = getViewportForBounds(nodesBounds, IMAGE_WIDTH, IMAGE_HEIGHT, 0.5, 2);

  const dataUrl = await toPng(viewportElement, {
    backgroundColor: '#ffffff',
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    style: {
      width: String(IMAGE_WIDTH),
      height: String(IMAGE_HEIGHT),
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
    filter: (node) => {
      // Exclude React Flow controls, minimap, etc.
      if (node instanceof Element) {
        return !node.classList.contains('react-flow__minimap') &&
               !node.classList.contains('react-flow__controls');
      }
      return true;
    },
  });

  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}
```

Access the viewport element via a ref on the `ReactFlow` container or `document.querySelector('.react-flow__viewport')`.

---

### Pattern 7: CSV Export

Pure client-side. Transpose `VectorData[]` into column-major CSV.

```typescript
// src/export/exportCsv.ts
import type { VectorData } from '@/simulation/protocol';

export function exportWaveformAsCsv(vectors: VectorData[], filename = 'waveform.csv'): void {
  if (!vectors.length) return;

  const length = vectors[0]!.data.length;
  const headers = vectors.map((v) => v.name).join(',');

  const rows: string[] = [headers];
  for (let i = 0; i < length; i++) {
    const row = vectors.map((v) => v.data[i]?.toString() ?? '').join(',');
    rows.push(row);
  }

  const csv = rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}
```

**CSV column format:** `time, v(out), v(in), i(R1), ...` — one column per `VectorData` entry, rows indexed by sample number.

---

### Pattern 8: Netlist Export

The netlist builder already exists from Phase 1. Export is a trivial download button:

```typescript
// src/export/exportNetlist.ts
import { buildNetlist } from '@/simulation/netlistBuilder'; // Phase 1 module
import type { Circuit } from '@/circuit/types';
import type { AnalysisConfig } from '@/circuit/types';

export function exportNetlist(circuit: Circuit, config: AnalysisConfig, filename = 'circuit.cir'): void {
  const netlist = buildNetlist(circuit, config);
  const blob = new Blob([netlist], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}
```

---

### Pattern 9: LTspice .asc Parser

**No npm package exists for this.** The format is reverse-engineered from community documentation and KiCad's importer. Build a line-oriented parser.

**Format summary (verified from KiCad docs, Wikipedia example, community references):**

```
Version 4
SHEET 1 <width> <height>
WIRE <x1> <y1> <x2> <y2>
FLAG <x> <y> <netName>          # "0" = ground
IOPIN <x> <y> <direction>       # Port symbol
SYMBOL <symbolName> <x> <y> <orientation>
WINDOW <type> <x> <y> <justify> <size>   # Attribute positioning (can skip)
SYMATTR InstName <refDesignator>
SYMATTR Value <value>
SYMATTR SpiceModel <modelName>
TEXT <x> <y> <justify> <size> <text>    # "!" prefix = SPICE directive
```

**Orientation values:** `R0` (0°), `R90` (90°), `R180` (180°), `R270` (270°), `M0` (mirror), `M90`, `M180`, `M270`.

**Coordinate system:** LTspice uses 1/64th-inch grid. Divide by 64 to get inches, multiply by a scale factor to map to OmniSpice canvas coordinates (React Flow uses pixels). Recommended scale: `x_canvas = x_ltspice * 0.25` (LTspice 16px grid → React Flow 4px grid, then scale up).

**Symbol name to ComponentType mapping:**

| .asc SYMBOL name | OmniSpice ComponentType |
|-----------------|------------------------|
| `res` | `resistor` |
| `cap` | `capacitor` |
| `ind` | `inductor` |
| `diode` | `diode` |
| `schottky` | `schottky_diode` |
| `zener` | `zener_diode` |
| `npn` | `npn_bjt` |
| `pnp` | `pnp_bjt` |
| `nmos` | `nmos` |
| `pmos` | `pmos` |
| `voltage` | `dc_voltage` (check SYMATTR Value for AC/pulse/sin) |
| `current` | `dc_current` |
| `opamp` / `UniversalOpamp2` | `ideal_opamp` |

**LTspice .asc parser implementation approach:**

```typescript
// src/ltspice/types.ts
interface AscSymbol {
  name: string;          // e.g., "res"
  x: number; y: number;
  orientation: string;   // "R0" | "R90" | ...
  instName: string;      // from SYMATTR InstName
  value: string;         // from SYMATTR Value
  spiceModel?: string;   // from SYMATTR SpiceModel
}

interface AscWire {
  x1: number; y1: number;
  x2: number; y2: number;
}

interface AscFlag {
  x: number; y: number;
  netName: string;       // "0" = ground
}

interface AscCircuit {
  symbols: AscSymbol[];
  wires: AscWire[];
  flags: AscFlag[];
  directives: string[];  // SPICE directives from TEXT lines starting with "!"
}

// src/ltspice/parser.ts
export function parseAsc(text: string): AscCircuit {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const result: AscCircuit = { symbols: [], wires: [], flags: [], directives: [] };
  let currentSymbol: Partial<AscSymbol> | null = null;

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    const keyword = parts[0]?.toUpperCase();

    if (keyword === 'WIRE') {
      result.wires.push({ x1: +parts[1]!, y1: +parts[2]!, x2: +parts[3]!, y2: +parts[4]! });
    } else if (keyword === 'FLAG') {
      result.flags.push({ x: +parts[1]!, y: +parts[2]!, netName: parts[3] ?? '' });
    } else if (keyword === 'SYMBOL') {
      if (currentSymbol?.name) result.symbols.push(currentSymbol as AscSymbol);
      currentSymbol = { name: parts[1]!.toLowerCase(), x: +parts[2]!, y: +parts[3]!, orientation: parts[4] ?? 'R0', value: '', instName: '' };
    } else if (keyword === 'SYMATTR' && currentSymbol) {
      const attrKey = parts[1]?.toUpperCase();
      const attrVal = parts.slice(2).join(' ');
      if (attrKey === 'INSTNAME') currentSymbol.instName = attrVal;
      else if (attrKey === 'VALUE') currentSymbol.value = attrVal;
      else if (attrKey === 'SPICEMODEL') currentSymbol.spiceModel = attrVal;
    } else if (keyword === 'TEXT') {
      const textContent = parts.slice(4).join(' ');
      if (textContent.startsWith('!')) result.directives.push(textContent.slice(1).trim());
    }
  }

  if (currentSymbol?.name) result.symbols.push(currentSymbol as AscSymbol);
  return result;
}
```

**Wire connectivity (LTSP-01):** .asc wires are point-to-point segments. To determine which components share nets, build an adjacency graph: wires connect endpoints, flags name nets. This is equivalent to the unionize-by-shared-endpoint algorithm. Group wire endpoints into nets (union-find), then map component pin positions to net membership. This produces the `Net` and `Port.netId` data needed by `circuitStore`.

**LTSP-02 — SPICE directives:** LTspice `.tran`, `.ac`, `.dc` directives appear in `TEXT` lines starting with `!`. Extract these and pass them as the `AnalysisConfig` when the user runs simulation after import.

---

### Anti-Patterns to Avoid

- **Storing large circuit JSON in D1 rows:** The 2 MB row limit is a hard ceiling. Always put circuit data in R2; put only metadata in D1.
- **Using `routing="path"` with Clerk in a pure SPA:** Without React Router, this causes redirect loops. Always use `routing="hash"` or `routing="virtual"` for SPAs.
- **html-to-image > 1.11.13:** Newer versions have a confirmed broken export for React Flow nodes. Pin to 1.11.13.
- **Generating share tokens client-side:** Tokens must be generated server-side (Worker) where the D1 write is atomic. Never expose a circuit's ID in a public URL without a server-generated token.
- **Exposing `CLERK_SECRET_KEY` in Vite env:** Only `CLERK_PUBLISHABLE_KEY` (with `VITE_` prefix) belongs in the frontend. The secret key lives in Worker Secrets only.
- **WASM threading or SharedArrayBuffer:** Already prohibited per CLAUDE.md. Confirmed incompatible with university LMS iframe embeds.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth session management | Custom JWT cookies | Clerk | PKCE, refresh tokens, SAML, MFA — months of work |
| JWT verification in Workers | `jose` + manual JWKS fetch | `@hono/clerk-auth` | Handles JWKS caching, algorithm validation, token expiry |
| ID generation for share tokens | Custom base62 encoder | `crypto.randomUUID()` (built into Workers runtime) | Cryptographically secure, zero dependencies |
| Canvas PNG capture | Manual canvas 2D drawImage | `html-to-image` (pinned 1.11.13) | Handles CSS variables, custom fonts, SVG symbols in DOM |
| CSV serialization | Custom delimeter escaping | Plain string interpolation (vectors are pure numbers, no escaping needed) | No special chars in Float64 output |

---

## Common Pitfalls

### Pitfall 1: Clerk `routing` Prop on SignIn in SPA
**What goes wrong:** `<SignIn />` without `routing="hash"` tries to navigate to `/sign-in` as a real URL, causing a 404 in a Vite SPA.
**Why it happens:** Clerk defaults to path-based routing (assumes React Router or Next.js).
**How to avoid:** Always pass `routing="hash"` to `<SignIn>` and `<SignUp>` in the OmniSpice SPA.
**Warning signs:** Browser URL changes to `/#/sign-in` without loading the component.

### Pitfall 2: Circuit JSON > 2 MB in D1
**What goes wrong:** D1 silently fails or throws on rows exceeding the 2 MB limit.
**Why it happens:** Complex circuits with large component parameter blocks can produce multi-megabyte JSON.
**How to avoid:** Always route circuit data through R2. D1 stores only the `r2_key` reference, metadata, and a small `name` field.
**Warning signs:** D1 write errors on large circuits but not small ones.

### Pitfall 3: html-to-image Misses React Flow Edges
**What goes wrong:** PNG export contains nodes but edges are invisible.
**Why it happens:** React Flow renders edges in a separate SVG layer. html-to-image must capture the outer `.react-flow` container, not just `.react-flow__viewport`.
**How to avoid:** Target `document.querySelector('.react-flow')` as the capture element. Apply the viewport transform via inline `style` override rather than querying `.react-flow__viewport` directly.
**Warning signs:** Exported PNG shows components floating without wires.

### Pitfall 4: LTspice Coordinate Overflow
**What goes wrong:** Imported circuit renders off-screen or at 1px size.
**Why it happens:** LTspice coordinates are in 1/64-inch units. A typical schematic uses coordinates in the range 0–1000, which in LTspice's unit = 0–15 inches. Applied directly to canvas pixels, components stack at near-zero coordinates.
**How to avoid:** Apply coordinate scaling: `canvasX = (ltspiceX - minX) * SCALE_FACTOR + PADDING`. Use `SCALE_FACTOR = 0.25` as a starting point, then auto-fit the viewport after import.
**Warning signs:** Imported circuit shows all components stacked at top-left corner.

### Pitfall 5: ngspice Net Names vs. OmniSpice Net Names
**What goes wrong:** Overlay shows no voltages even though simulation succeeded.
**Why it happens:** ngspice output names `v(net001)`, `v(out)` etc. — the names come from how the netlist builder assigns SPICE node names. The overlay must use the same names. If the netlist builder assigns names differently than what the overlay reads, no match occurs.
**How to avoid:** The netlist builder must expose a `Map<netId, spiceName>` alongside the netlist string. The overlay uses this map to correlate `Port.netId` to the correct `v(...)` vector name.
**Warning signs:** Overlay store has no entries after successful simulation.

### Pitfall 6: Share URL and SPA Routing
**What goes wrong:** User opens `https://omnispice.app/share/abc123` and gets the editor instead of the shared circuit viewer, or gets a 404.
**Why it happens:** Vite SPA serves `index.html` for all routes, but the app's `App.tsx` doesn't handle the `/share/` path.
**How to avoid:** Check `window.location.pathname` at app root level (before any conditional rendering). Cloudflare Pages must also be configured to serve `index.html` for all `/*` paths — use `[[redirects]]` in `_redirects` file.
**Warning signs:** `/share/` URLs serve editor or blank page.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Clerk `@clerk/clerk-react` (deprecated) | `@clerk/react` (new unified package) | New installs use `@clerk/react`; old package still works but no new features |
| html-to-image latest | Pin to 1.11.13 (React Flow community consensus) | Newer versions break React Flow export — do not upgrade |
| Hono `jwt()` middleware with manual JWKS | `@hono/clerk-auth` 3.1.1 | Official integration; handles JWKS caching automatically |
| R2 presigned URLs from Workers | Direct `env.R2.put(key, body)` in Worker | For Worker-to-R2 (no browser direct upload needed), native R2 binding is simpler than presigned URLs |

---

## Open Questions

1. **Net name synchronization between netlist builder and overlay**
   - What we know: The netlist builder assigns SPICE net names from `Net.name` or auto-generates `net{n}`. The overlay reads `v(netName)` from simulation results.
   - What's unclear: Whether Phase 1's netlist builder currently exposes the `netId → spiceName` map, or only returns the raw netlist string.
   - Recommendation: Inspect `src/simulation/` netlist builder before planning LIVE-01. If the map isn't exposed, add it as a second return value. This is a 1-line change but blocks the overlay entirely.

2. **Clerk's auth modal UX in the circuit editor**
   - What we know: Clerk's `<SignIn>` renders as a full-page component by default.
   - What's unclear: Whether an inline modal overlay (Clerk's `<SignIn routing="hash" />`) will visually interfere with the React Flow canvas.
   - Recommendation: Use Clerk's pre-built modal trigger (`<SignInButton mode="modal" />`) which renders in a centered overlay. This avoids full-page takeover.

3. **LTspice SYMBOL to ComponentType edge cases**
   - What we know: Core passives and sources map cleanly. Transformers and complex sources (PWL, behavioral) may not have obvious mappings.
   - What's unclear: LTspice uses hundreds of symbol names; only ~12 map to OmniSpice's `ComponentType`.
   - Recommendation: Import known symbols; log unknown symbols as warnings and skip them. Document this as a known limitation in Phase 2. Do not block import on unknown components.

4. **Circuit JSON serialization format (R2)**
   - What we know: `Circuit` type uses `Map<string, Component>` and `Map<string, Wire>`. Maps do not serialize with `JSON.stringify()`.
   - What's unclear: Whether Phase 1 already has a serialization layer or relies on Zustand persist.
   - Recommendation: Before planning CLOUD-02, check if `circuitStore` has a toJSON / fromJSON method. If not, write `serializeCircuit(circuit: Circuit): string` that converts Maps to arrays before JSON.stringify.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | pnpm / wrangler | Assumed | 22.x (required for Vite 8) | — |
| pnpm | Package manager | Yes (in use) | 10.x | — |
| wrangler | Cloudflare local dev | Not yet installed | 4.81.1 (registry) | Install in Phase 2 Wave 0 |
| Cloudflare account | D1 + R2 + Workers deploy | Assumed | — | — |
| Clerk account + publishable key | Auth | Not yet configured | — | Create in Phase 2 Wave 0 |

**Missing dependencies with no fallback (must be addressed in Wave 0):**
- wrangler: `pnpm add -D wrangler` + `wrangler login`
- Clerk publishable key: requires creating a Clerk application at clerk.com

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.4 (already installed) |
| Config file | `vitest.config.ts` (check root) |
| Quick run command | `pnpm vitest run --reporter=verbose` |
| Full suite command | `pnpm vitest run --coverage` |

### Phase Requirements Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LIVE-01 | `useOverlaySync` extracts v(node) from results and populates overlayStore | unit | `pnpm vitest run src/overlay/__tests__/useOverlaySync.test.ts` | Wave 0 |
| LIVE-02 | `useOverlaySync` extracts i(ref) from results | unit | same file | Wave 0 |
| LIVE-03 | Overlay clears on `simulationStore.reset()` | unit | same file | Wave 0 |
| CLOUD-02 | `POST /api/circuits` writes R2 + D1 | integration (miniflare) | `pnpm vitest run worker/src/__tests__/circuits.test.ts` | Wave 0 |
| CLOUD-03 | `GET /api/circuits/:id` returns R2 body | integration (miniflare) | same file | Wave 0 |
| CLOUD-04 | `POST /api/circuits/:id/share` generates share_token | integration (miniflare) | same file | Wave 0 |
| LTSP-01 | `parseAsc()` parses simple RC .asc fixture | unit | `pnpm vitest run src/ltspice/__tests__/parser.test.ts` | Wave 0 |
| LTSP-01 | `mapAscToCircuit()` produces valid Circuit with correct component types | unit | `pnpm vitest run src/ltspice/__tests__/mapper.test.ts` | Wave 0 |
| EXP-02 | `exportWaveformAsCsv()` produces correct column headers and row count | unit | `pnpm vitest run src/export/__tests__/exportCsv.test.ts` | Wave 0 |
| EXP-03 | Netlist export produces valid .cir string | unit | `pnpm vitest run src/export/__tests__/exportNetlist.test.ts` | Wave 0 |
| CLOUD-01 | ClerkProvider renders SignedIn/SignedOut correctly | integration (jsdom) | manual — Clerk requires live keys | manual-only |
| EXP-01 | PNG export produces non-empty Blob | E2E (Playwright) | `pnpm playwright test export` | Wave 0 |

**Manual-only justifications:**
- CLOUD-01: Clerk auth flow requires live Clerk API keys; cannot be mocked in unit tests without significant setup. Validate by hand in dev environment.

### Sampling Rate
- **Per task commit:** `pnpm vitest run` (full unit suite, ~5s)
- **Per wave merge:** `pnpm vitest run --coverage` + manual Clerk smoke test
- **Phase gate:** Full suite green + Playwright export test + manual cloud save/load round-trip before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/overlay/__tests__/useOverlaySync.test.ts` — covers LIVE-01, LIVE-02, LIVE-03
- [ ] `src/ltspice/__tests__/parser.test.ts` — covers LTSP-01 parsing
- [ ] `src/ltspice/__tests__/mapper.test.ts` — covers LTSP-01 component mapping
- [ ] `src/export/__tests__/exportCsv.test.ts` — covers EXP-02
- [ ] `src/export/__tests__/exportNetlist.test.ts` — covers EXP-03
- [ ] `worker/src/__tests__/circuits.test.ts` — covers CLOUD-02, CLOUD-03, CLOUD-04 (uses miniflare)
- [ ] `tests/export.spec.ts` (Playwright) — covers EXP-01 PNG export
- [ ] Worker D1 schema migration: `worker/src/db/schema.sql`
- [ ] Worker `wrangler.toml` with D1 and R2 bindings
- [ ] `.dev.vars` for local Worker development (CLERK keys, never committed)

---

## Sources

### Primary (HIGH confidence)
- [Clerk React Quickstart](https://clerk.com/docs/react/getting-started/quickstart) — ClerkProvider, SignedIn/Out, useUser, useAuth, routing modes
- [Clerk Backend SDK overview](https://clerk.com/docs/references/backend/overview) — verifyToken, authenticateRequest
- [@hono/clerk-auth npm 3.1.1](https://www.npmjs.com/package/@hono/clerk-auth) — version verified via pnpm registry
- [honobyexample.com — Clerk + Hono](https://honobyexample.com/posts/clerk-backend) — clerkMiddleware, getAuth pattern
- [Hono Cloudflare Workers guide](https://hono.dev/docs/getting-started/cloudflare-workers) — Bindings type, c.env access
- [Cloudflare D1 Tutorial: Build API to access D1](https://developers.cloudflare.com/d1/tutorials/build-an-api-to-access-d1/) — D1 binding, prepared statements, batch
- [Cloudflare D1 Limits](https://developers.cloudflare.com/d1/platform/limits/) — 2 MB row max, 100 columns max
- [Cloudflare R2 Workers API Usage](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/) — put, get, delete, R2Object body
- [Cloudflare Workers Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/) — crypto.randomUUID() and crypto.getRandomValues() available
- [Cloudflare D1 Migrations](https://developers.cloudflare.com/d1/reference/migrations/) — schema versioning via .sql files
- [React Flow Download Image Example](https://reactflow.dev/examples/misc/download-image) — getNodesBounds, getViewportForBounds, html-to-image pattern
- [React Flow Node type reference](https://reactflow.dev/api-reference/types/node) — Node.data field, dynamic updates
- [KiCad LTspice Import Docs](https://dev-docs.kicad.org/en/import-formats/ltspice/index.html) — .asc keyword list, SYMBOL/WIRE/FLAG semantics
- [Wikipedia — LTspice](https://en.wikipedia.org/wiki/LTspice) — Complete RC circuit .asc example with all major keywords
- [nanoid 5.1.7](https://github.com/ai/nanoid) — URL-safe ID generation, Workers-compatible

### Secondary (MEDIUM confidence)
- [Cloudflare Storage Options guide](https://developers.cloudflare.com/workers/platform/storage-options/) — D1 vs R2 use case guidance
- [Hono Third-party Middleware](https://hono.dev/docs/middleware/third-party) — @hono/clerk-auth listed as official integration

### Tertiary (LOW confidence — needs validation at implementation time)
- LTspice SYMBOL name → OmniSpice ComponentType mapping table: assembled from community examples and KiCad source. Some symbol names may differ between LTspice versions (XVII vs newer). Validate against actual LTspice files during implementation.
- html-to-image 1.11.13 "last working version" claim: sourced from React Flow GitHub discussions (community consensus), not official docs. Test in Phase 2 integration before finalizing.

---

## Metadata

**Confidence breakdown:**
- Clerk setup: HIGH — verified against official Clerk React quickstart docs
- @hono/clerk-auth: HIGH — verified on npm registry + official Hono docs
- D1 schema + limits: HIGH — verified against Cloudflare D1 official docs
- R2 Worker API: HIGH — verified against Cloudflare R2 official docs
- html-to-image export: HIGH (pattern), MEDIUM (1.11.13 version pin — community consensus)
- LTspice .asc format: MEDIUM — format is reverse-engineered; no official Analog Devices spec published
- Live overlay: HIGH — pattern derived entirely from existing Phase 1 code (simulationStore, VectorData, React Flow node APIs)

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (30 days; Clerk and Hono are stable; D1/R2 are GA)
