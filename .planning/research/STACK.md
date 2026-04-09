# Technology Stack

**Project:** OmniSpice
**Researched:** 2026-04-09

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| React | 19.x | UI framework | Confirmed constraint. Largest ecosystem, best TypeScript support, mandatory for tldraw/React Flow. React 19 adds useTransition for non-blocking sim updates, Suspense for lazy-loaded component models. | HIGH |
| Vite | 8.x | Build tool | Confirmed constraint. Native ESM, sub-second HMR, WASM import support via vite-plugin-wasm. Vite 8 drops Babel dependency for React Refresh (uses Oxc), faster builds. Requires Node 20.19+ or 22.12+. | HIGH |
| TypeScript | 5.7+ | Type safety | Confirmed constraint. Critical for agentic AI coding -- Claude Code generates far better output with strong types. Strict mode mandatory. | HIGH |
| pnpm | 10.x | Package manager | User constraint. Faster installs, strict node_modules, workspace support if monorepo needed later. | HIGH |

### SPICE Simulation Engine

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| ngspice (custom WASM build) | 45.x | Circuit simulation | The only viable option. 40+ years of validated SPICE models, proven WASM builds exist (danchitnis, wokwi, EEcircuit, tscircuit). Supports DC, AC, transient, DC sweep, parametric. Must compile from source via Emscripten -- no maintained npm package exists. | HIGH |
| Emscripten | 4.x | WASM compiler | Required to compile ngspice C source to WASM. Well-documented build process. Use pipe-mode stdin/stdout interface (not shared library API -- shared lib has documented Emscripten compatibility issues). | HIGH |

**Build approach:** Fork danchitnis/ngspice build scripts (updated June 2025, most active). Compile ngspice 45.x with Emscripten targeting pipe-mode (FS.init with JS callbacks for stdin/stdout). Run in Web Worker to avoid blocking UI thread. Parse raw output into structured TypeScript types.

**Why not alternatives:**
- SpiceSharp (C#): Would require Blazor WASM runtime (~10MB+), not React-compatible
- circuitjs1 (Java/GWT): Not real SPICE, toy accuracy, wrong language ecosystem
- Custom SPICE engine: Years of work to match ngspice's model library
- wokwi/ngspice-wasm npm: Only 7 stars, appears unmaintained, better to own the build

### Schematic Editor Canvas

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| React Flow (@xyflow/react) | 12.10.x | Schematic editor canvas | **Recommended over tldraw.** MIT licensed (free commercial use). Purpose-built for node-and-edge graphs -- which is exactly what circuit schematics are: components (nodes) connected by wires (edges). Custom nodes = circuit components. Custom edges = wires with routing. Built-in viewport optimization (only renders visible elements). 36k stars, excellent TypeScript types, extensive docs. | HIGH |

**Why React Flow over tldraw:**

| Criterion | React Flow | tldraw |
|-----------|-----------|--------|
| License | MIT -- free commercial use | Proprietary -- $6,000/year per team for production |
| Mental model | Nodes + edges (= components + wires) | Shapes + drawings (= whiteboard) |
| Custom nodes | React components with typed handles | Custom shapes with bindings API |
| Wire routing | Built-in edge types (bezier, step, smoothstep) + smart-edge plugin | Must build from scratch via bindings |
| Snap-to-grid | Built-in | Available but not primary use case |
| Performance | Viewport-based rendering, proven at 1000+ nodes | Canvas-based, good but whiteboard-optimized |
| Collab (Yjs) | Proven integration (Synergy Codes ebook, multiple examples) | Has sync support but different architecture |
| AI coding | Simpler API surface, nodes are just React components | Larger API surface, more abstractions to learn |

**Why not others:**
- tldraw: $6,000/year license kills it for a startup. Also wrong mental model -- it's a whiteboard SDK, not a circuit editor. You'd fight the abstraction constantly.
- Konva: Low-level canvas lib, no node/edge primitives. You'd rebuild React Flow from scratch.
- fabric.js: Same as Konva -- generic canvas, no graph concepts. Also jQuery-era API design.

### Waveform Rendering

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| uPlot | 1.6.32 | Waveform viewer | Best fit for oscilloscope-style waveform display. 166k points in 25ms, ~100k pts/ms linear scaling. 20KB gzipped (tiny). Canvas 2D-based. Handles cursor interactions, zoom, pan. Multiple Y-axes for voltage/current overlay. Plugin system for custom markers/measurements. | HIGH |
| uplot-react | latest | React wrapper | Thin wrapper for React integration. Avoids manual lifecycle management. | MEDIUM |

**Why uPlot over alternatives:**
- Chart.js/Recharts/ECharts: 4-7x slower, 4-7x larger. Designed for dashboards, not oscilloscopes.
- webgl-plot: Faster for extreme real-time streaming (60fps), but only 395 GitHub stars, 717 weekly npm downloads. Too niche, too few users, sparse docs. uPlot is fast enough -- SPICE results are computed once, not streamed.
- D3.js: Low-level, enormous API surface, poor for agentic AI coding.
- Plotly: Bloated (3.5MB), overkill.

**Key insight:** SPICE waveforms are NOT real-time streaming data. They're computed results displayed after simulation. uPlot's ~100k pts/ms is more than sufficient. WebGL only matters for live oscilloscope feeds, which OmniSpice doesn't have.

### State Management

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Zustand | 5.0.x | Client state | Under 1KB, hook-based, zero boilerplate. Perfect for circuit editor state (selected components, tool mode, simulation status). Slice pattern for domain separation. No Provider wrapper needed. | HIGH |
| TanStack Query | 5.96.x | Server state | Caching, deduplication, background refetch for API calls (save/load circuits, user data). Separates server state from client state cleanly. | HIGH |

**Why not Redux:** Boilerplate. Zustand does everything Redux does for this use case in 1/10th the code. Claude Code generates cleaner Zustand code.

**Why not Jotai:** Atomic model is elegant but harder for AI agents to reason about. Zustand's single-store + slices is more predictable for agentic coding.

### Real-Time Collaboration

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Yjs | 13.6.x | CRDT engine | Industry standard for collaborative editing. Used by Tiptap, ProseMirror, Excalidraw. Y.Map/Y.Array map naturally to circuit data (components map, wires array). Offline-first with automatic merge. | HIGH |
| y-websocket (client) | latest | WebSocket provider | Client-side Yjs provider for WebSocket transport. | HIGH |
| y-durableobjects | latest | Server provider | Yjs provider for Cloudflare Durable Objects. Eliminates Node.js dependency. Hono-based. Proven implementation (napolab/y-durableobjects). | MEDIUM |

**Architecture:** Each circuit document gets a Durable Object instance. Yjs syncs state via WebSocket through the Durable Object. Hibernatable WebSockets reduce costs when users are idle. D1 stores persistent snapshots for cold-start recovery.

**Why not Firebase/Supabase Realtime:** Cloudflare is the confirmed deployment target. Mixing cloud providers adds complexity and latency. Durable Objects + Yjs is the native Cloudflare pattern for collaboration.

### Backend / Infrastructure

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Cloudflare Workers | latest | API / edge compute | Confirmed constraint. Zero cold starts, 200+ PoPs globally. Hono as HTTP framework. | HIGH |
| Hono | 4.3+ | HTTP framework | Lightweight, Workers-native, TypeScript-first. Required peer dependency for y-durableobjects. | HIGH |
| Cloudflare D1 | GA | Database | SQLite at the edge. 10GB per database, read replicas globally. Sufficient for user accounts, circuit metadata, assignment data. | MEDIUM |
| Cloudflare R2 | GA | Object storage | S3-compatible, zero egress fees. Store circuit files, component libraries, exported PDFs. | HIGH |
| Cloudflare Durable Objects | GA | Stateful collaboration | WebSocket server for Yjs sync. One DO per active circuit. Hibernatable WebSockets for cost efficiency. SQLite-backed (billing enabled Jan 2026). | HIGH |
| Cloudflare Pages | latest | Static hosting | Hosts the SPA (React build output). Integrates with Workers for API. | HIGH |

**Why not Vercel/AWS:**
- Vercel: Function cold starts (bad for WebSocket upgrade), no Durable Objects equivalent, higher costs at scale
- AWS: Operational complexity way too high for a startup. Lambda cold starts, API Gateway pricing, managing DynamoDB/RDS

### Authentication

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Clerk | latest | Auth provider | Drop-in React components, SSO/SAML for university IdP integration (critical for site licenses), MFA, user management dashboard. Cloudflare Workers compatible. | MEDIUM |

**Why Clerk over Auth0/Supabase Auth:**
- Auth0: More expensive, more complex for what we need
- Supabase Auth: Ties you to Supabase ecosystem, doesn't integrate with Cloudflare natively
- Clerk: Best React DX, SSO/SAML support for university licensing, Workers-compatible
- Roll-your-own: Massive security risk, months of work

**Alternative if Clerk pricing is prohibitive:** Better Auth (open source, self-hosted on Workers). Lower confidence -- verify Workers compatibility.

### Supporting Libraries

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| react-hotkeys-hook | latest | Keyboard shortcuts | Schematic editor hotkeys (Ctrl+Z, Delete, Ctrl+C, etc.) | HIGH |
| @dnd-kit/core | latest | Drag and drop | Component palette drag-to-canvas | HIGH |
| cmdk | latest | Command palette | Fuzzy search for components, commands | HIGH |
| jspdf + html2canvas | latest | PDF export | Lab report generation | MEDIUM |
| KaTeX | latest | Math rendering | Circuit equations in insights/labs | MEDIUM |
| vitest | latest | Testing | Unit + integration tests. Vite-native, fast. | HIGH |
| Playwright | latest | E2E testing | Browser testing for canvas interactions | HIGH |
| Biome | latest | Lint + format | Replaces ESLint + Prettier. Faster, single tool. | HIGH |

### Development Tools

| Tool | Purpose | Why |
|------|---------|-----|
| Storybook 8 | Component development | Isolate and test canvas components, waveform viewer |
| vite-plugin-wasm | WASM imports | Clean import of ngspice WASM module in Vite |
| wrangler | Cloudflare dev | Local development of Workers, D1, R2, Durable Objects |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Canvas | React Flow (MIT) | tldraw ($6k/yr) | License cost, wrong mental model (whiteboard vs circuit graph) |
| Canvas | React Flow | Konva/fabric.js | No graph primitives, rebuild everything from scratch |
| Charts | uPlot | webgl-plot | Tiny ecosystem (395 stars, 717 downloads/week), sparse docs. uPlot is fast enough for non-streaming data. |
| Charts | uPlot | Chart.js/Recharts | 4-7x slower, much larger bundle, designed for dashboards not oscilloscopes |
| State | Zustand | Redux Toolkit | Unnecessary boilerplate for this app size |
| State | Zustand | Jotai | Atomic model harder for AI agents to reason about |
| Server state | TanStack Query | SWR | TanStack Query has richer feature set (mutations, optimistic updates, devtools) |
| Auth | Clerk | Auth0 | More expensive, more complex |
| HTTP | Hono | Express | Express doesn't run on Workers |
| SPICE | ngspice WASM | SpiceSharp | C#/Blazor runtime, not React-compatible |
| Collab | Yjs | Automerge | Yjs has better ecosystem (more providers, React Flow integration examples) |
| Linting | Biome | ESLint+Prettier | Single tool, 100x faster, simpler config |

## Installation

```bash
# Core framework
pnpm add react react-dom
pnpm add -D @types/react @types/react-dom typescript vite @vitejs/plugin-react vite-plugin-wasm

# Canvas (schematic editor)
pnpm add @xyflow/react

# Waveform rendering
pnpm add uplot uplot-react

# State management
pnpm add zustand @tanstack/react-query

# Collaboration
pnpm add yjs y-websocket

# Backend (Cloudflare)
pnpm add hono
pnpm add -D wrangler

# Auth
pnpm add @clerk/clerk-react

# UI utilities
pnpm add react-hotkeys-hook @dnd-kit/core cmdk

# Testing
pnpm add -D vitest @testing-library/react playwright

# Linting
pnpm add -D @biomejs/biome
```

## Version Summary

| Package | Pinned Version | Last Verified |
|---------|---------------|---------------|
| react | 19.x | 2026-04-09 |
| vite | 8.x | 2026-04-09 |
| typescript | 5.7+ | 2026-04-09 |
| @xyflow/react | 12.10.x | 2026-04-09 |
| uplot | 1.6.32 | 2026-04-09 |
| zustand | 5.0.x | 2026-04-09 |
| @tanstack/react-query | 5.96.x | 2026-04-09 |
| yjs | 13.6.x | 2026-04-09 |
| tldraw | 4.5.x | 2026-04-09 (NOT recommended) |
| hono | 4.3+ | 2026-04-09 |

## Critical Build Decision: ngspice WASM

This is the highest-risk technical decision. There is no maintained npm package for ngspice WASM. You must:

1. **Fork danchitnis/ngspice** build infrastructure (most active, updated June 2025)
2. **Compile ngspice 45.x** source with Emscripten to WASM
3. **Use pipe-mode** (stdin/stdout via FS.init) -- NOT shared library API (documented Emscripten compatibility issues)
4. **Run in Web Worker** -- ngspice's blocking I/O model would freeze the UI thread
5. **Build a TypeScript wrapper** that translates between JS circuit representation and ngspice netlists, and parses raw output into typed results

Reference implementations to study:
- danchitnis/ngspice (build scripts, testbench)
- eelab-dev/EEcircuit (full circuit editor architecture)
- tscircuit/ngspice (alternative build approach)
- wokwi/ngspice-wasm (minimal WASM build)

## Sources

- [@xyflow/react npm](https://www.npmjs.com/package/@xyflow/react) - v12.10.2, MIT license
- [tldraw pricing](https://tldraw.dev/pricing) - $6,000/yr commercial license
- [tldraw SDK 4.0 announcement](https://tldraw.dev/blog/tldraw-sdk-4-0)
- [React Flow Pro pricing](https://reactflow.dev/pro/pricing)
- [uPlot GitHub](https://github.com/leeoniya/uPlot) - performance benchmarks
- [webgl-plot GitHub](https://github.com/danchitnis/webgl-plot) - 395 stars
- [danchitnis/ngspice GitHub](https://github.com/danchitnis/ngspice) - WASM build tools
- [EEcircuit GitHub](https://github.com/eelab-dev/EEcircuit) - reference architecture
- [Yjs docs](https://docs.yjs.dev/) - CRDT documentation
- [y-durableobjects GitHub](https://github.com/napolab/y-durableobjects) - Cloudflare Yjs provider
- [Cloudflare D1 docs](https://www.cloudflare.com/developer-platform/products/d1/)
- [Cloudflare Durable Objects docs](https://developers.cloudflare.com/durable-objects/)
- [Zustand npm](https://www.npmjs.com/package/zustand) - v5.0.12
- [TanStack Query npm](https://www.npmjs.com/package/@tanstack/react-query) - v5.96.2
- [Synergy Codes - Yjs + React Flow collab](https://www.synergycodes.com/blog/real-time-collaboration-for-multiple-users-in-react-flow-projects-with-yjs-e-book)
- [Vite releases](https://vite.dev/releases) - Vite 8 with Oxc
