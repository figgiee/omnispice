# Phase 2: Cloud and Compatibility - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

User accounts, cloud persistence, shareable links, live simulation overlay, LTspice .asc import, and export (PNG, CSV, netlist). All features layer on top of the Phase 1 offline simulator — users who don't log in still get the full simulator. Cloud features are opt-in: the save button prompts login, but the editor is always accessible without an account.

No real-time collaboration in this phase. No classroom features. Sharing is read-only (recipient can view + simulate, not edit).
</domain>

<decisions>
## Implementation Decisions

### Authentication (CLOUD-01)
- **D-01:** Clerk modal UX — `<SignInButton mode="modal" />` triggers a centered overlay. No full-page takeover of the canvas. Confirmed: use `routing="hash"` on SignIn/SignUp components (SPA without React Router).
- **D-02:** ClerkProvider wraps the entire app in `src/main.tsx`. The editor loads without auth. Login is prompted on first cloud action (save/load).
- **D-03:** `VITE_CLERK_PUBLISHABLE_KEY` in frontend `.env`; `CLERK_SECRET_KEY` in Worker Secrets only (never in Vite build). Document this in wrangler.toml as a comment.

### Cloud Storage (CLOUD-02, CLOUD-03, CLOUD-05)
- **D-04:** D1 + R2 split: D1 stores metadata only (`id, user_id, name, share_token, r2_key, created_at, updated_at`). Full circuit JSON goes to R2 at `circuits/{id}.json`. Reason: D1 hard row limit is 2 MB; complex circuits can exceed this.
- **D-05:** Circuit serialization — `serializeCircuit(circuit: Circuit): string` converts `Map` fields to arrays before `JSON.stringify`. `deserializeCircuit(json: string): Circuit` reverses this. These live in `src/cloud/serialization.ts`.
- **D-06:** Upsert pattern for saves — `POST /api/circuits` creates or updates (by circuit ID). If circuit has no ID yet, Worker generates one via `crypto.randomUUID()`.
- **D-07:** Auto-save on simulation run only (not on every edit). Explicit "Save" button for manual saves. Reason: aggressive auto-save would flood the API on every component drag.

### Shareable Links (CLOUD-04)
- **D-08:** Share tokens generated server-side (Worker) via `crypto.randomUUID().replace(/-/g, '').slice(0, 16)` — 16-char URL-safe token. Never client-side.
- **D-09:** Share URL pattern: `/share/{token}`. Cloudflare Pages serves `index.html` for all routes; `App.tsx` checks `window.location.pathname` at mount and routes to `<SharedCircuitViewer>` if it matches `/share/:token`.
- **D-10:** Shared circuits are read-only. `SharedCircuitViewer` shows the canvas with no toolbar, no component palette, no simulation controls. A "Fork" button lets the recipient copy to their own account if logged in.

### Live Simulation Overlay (LIVE-01, LIVE-02, LIVE-03)
- **D-11:** Overlay reads from `overlayStore` directly inside custom node components — NOT via `setNodes`. Avoids React Flow re-rendering all nodes on every simulation update.
- **D-12:** `useOverlaySync()` hook watches `simulationStore.results`. For DC operating point results only (single-element vectors), it extracts `v(netName)` → voltage and `i(refDesignator)` → current. Overlay is blank for transient/AC (too many points to meaningfully display on schematic).
- **D-13:** The netlister must expose `netId → spiceName` alongside the netlist string. New export: `generateNetlistWithMap(circuit, config)` returns `{ netlist: string; netMap: Map<string, string> }`. The netMap is stored in `simulationStore.netMap` and used by `useOverlaySync` to correlate port netIds to ngspice vector names.
- **D-14:** Overlay toggle button in toolbar (eye icon). Default: visible when results exist, hidden otherwise.

### Export (EXP-01, EXP-02, EXP-03)
- **D-15:** `html-to-image` pinned to `1.11.13`. Newer versions break React Flow export (confirmed community bug). This constraint must be documented in package.json with a comment and in this file.
- **D-16:** PNG export captures the `.react-flow` container (not `.react-flow__viewport`). This ensures edges (rendered in a separate SVG layer) appear in the export.
- **D-17:** CSV export is pure client-side — no server involvement. Columns: one per `VectorData` entry. Rows: one per sample. No escaping needed (Float64 values only).
- **D-18:** All three exports (PNG, CSV, netlist) appear as a single "Export" dropdown in the toolbar. Export options are disabled when no relevant data exists (PNG always available; CSV disabled with no simulation results; netlist disabled with empty circuit).

### LTspice Import (LTSP-01, LTSP-02)
- **D-19:** Hand-rolled line-oriented parser for .asc format. No npm package. Handles: VERSION, SHEET, WIRE, FLAG, SYMBOL, SYMATTR, TEXT keywords. Unknown keywords are silently skipped.
- **D-20:** Unknown SYMBOL names are logged as console warnings and skipped (not imported as unknown components). This is documented as a known limitation — not all LTspice symbols have OmniSpice equivalents.
- **D-21:** LTspice coordinate scaling: `canvasX = (ltspiceX - minX) * 0.25 + 50`, `canvasY = (ltspiceY - minY) * 0.25 + 50`. Auto-fit viewport after import so circuit is centered.
- **D-22:** SPICE directives from TEXT lines (starting with `!`) are extracted and parsed into an `AnalysisConfig`. If multiple directives exist, the first recognized one wins. Unknown directives are ignored.
- **D-23:** Import triggered via "File" menu dropdown → "Import LTspice .asc" → file picker (`<input type="file" accept=".asc" />`). No drag-and-drop to canvas (deferred).

### Backend (Worker) Structure
- **D-24:** Worker lives in `worker/` directory at project root. Separate `package.json` and `wrangler.toml`. Not bundled into the Vite SPA.
- **D-25:** Hono 4 router with three route groups: `/api/circuits` (CRUD, auth required), `/api/circuits/:id/share` (share token generation, auth required), `/api/share/:token` (public read, no auth).
- **D-26:** CORS: allow `http://localhost:5173` (dev) and `https://omnispice.app` (prod). No wildcard — the public share endpoint needs CORS too.
- **D-27:** D1 migration via `wrangler d1 migrations apply`. Migration file: `worker/migrations/0001_create_circuits.sql`.

### TanStack Query
- **D-28:** TanStack Query (`@tanstack/react-query`) manages all cloud API calls — circuit list, load, save. `QueryClientProvider` wraps the app inside `ClerkProvider`. Query keys: `['circuits']` for list, `['circuit', id]` for individual load.
</decisions>

<deferred>
## Deferred to Later Phases

- Real-time collaboration (Phase 5 — requires Yjs + Durable Objects WebSocket)
- Offline support / service worker (Phase 5)
- Assignment submission from shared circuits (Phase 3)
- Fork shared circuit to own account (post-Phase 2 polish)
- LTspice drag-and-drop import (post-Phase 2 polish)
- Overlay for transient/AC results (would need animated waveform labels — complex)
- PWA / installable app (not in roadmap)
</deferred>
