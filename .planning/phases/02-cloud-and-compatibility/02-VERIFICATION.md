---
phase: 02-cloud-and-compatibility
verified: 2026-04-09T00:00:00Z
status: gaps_found
score: 3/5 success criteria verified
gaps:
  - truth: "After simulation completes, node voltages appear directly on the schematic wires and component currents appear on each component"
    status: partial
    reason: "Component currents are correctly rendered on all component nodes via overlayStore. However, node voltages (nodeVoltages from overlayStore) are never displayed on wire edges — WireEdge.tsx does not read from overlayStore at all. Only GroundNode shows a static '0 V' label when overlay data is present. Net voltages for non-ground nodes (e.g., 'out', 'net1') are stored in overlayStore.nodeVoltages but nothing renders them on the schematic."
    artifacts:
      - path: "src/canvas/edges/WireEdge.tsx"
        issue: "Does not import or read from overlayStore; nodeVoltages are never displayed on wires"
      - path: "src/overlay/overlayStore.ts"
        issue: "nodeVoltages field is populated correctly but has no rendering consumer except GroundNode (static 0V label)"
    missing:
      - "WireEdge.tsx (or a canvas overlay component) must read nodeVoltages from overlayStore and render voltage labels on wire edges"
      - "Alternatively, a floating label layer above the ReactFlow canvas must map net names to wire positions and display voltages"

  - truth: "User can share a circuit via a link and a recipient can open it in a different browser with no login required"
    status: failed
    reason: "Two distinct problems block this flow: (1) ShareModal is defined but never rendered anywhere — there is no button, menu item, or other trigger that mounts ShareModal in the application. CircuitDashboard has no Share button. The share API endpoint and hooks are wired and correct, but the UI entry point is missing. (2) The Cloudflare Pages _redirects file (public/_redirects) has its SPA fallback rule commented out ('/* /index.html 200'), so direct navigation to /share/:token in a new browser returns a 404 before App.tsx can route the request."
    artifacts:
      - path: "src/components/share/ShareModal.tsx"
        issue: "Orphaned — defined but never imported or rendered in any parent component"
      - path: "public/_redirects"
        issue: "Contains only a commented-out rule ('/* /index.html 200'). Uncommented rule is required for Cloudflare Pages SPA routing so /share/:token deep links resolve to index.html"
      - path: "src/components/dashboard/CircuitDashboard.tsx"
        issue: "Has no Share button; each circuit row only has a Load button — no trigger to open ShareModal"
    missing:
      - "Add a Share button to each circuit row in CircuitDashboard that opens ShareModal with the circuit id"
      - "Alternatively add a standalone share trigger in Toolbar.tsx for the active circuit"
      - "Uncomment '/* /index.html 200' in public/_redirects so Cloudflare Pages serves index.html for /share/* paths"
human_verification:
  - test: "Verify node voltage overlay renders on wires after DC op simulation"
    expected: "After running a DC operating point simulation, numeric voltage values (e.g., '5.00 V') appear as labels on or adjacent to wire segments connecting components, not just a '0 V' on the ground node"
    why_human: "Requires running the WASM simulation engine in a real browser to produce DC op results and visually confirm label rendering on wire edges"
  - test: "End-to-end share flow: save a circuit, generate share link, open in incognito"
    expected: "Circuit renders correctly in a browser that has never logged in, with no auth prompt"
    why_human: "Requires a deployed Cloudflare Worker + D1 + R2 environment with real Clerk credentials — cannot verify locally"
---

# Phase 2: Cloud and Compatibility Verification Report

**Phase Goal:** Users can save circuits to the cloud, share them via link, see live voltage/current values on the schematic, import LTspice circuits, and export their work.
**Verified:** 2026-04-09
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can create an account with email/password, log in, and find saved circuits after refresh | ✓ VERIFIED | ClerkProvider wraps app in main.tsx; AuthModal uses SignInButton (modal mode); useCurrentUser wraps Clerk hooks; SaveButton + CircuitDashboard both gated on `signed-in`; listCircuits API calls GET /api/circuits with Bearer token from Clerk |
| 2 | User can share a circuit via link; recipient opens it with no login | ✗ FAILED | Share API + hooks are correct; GET /api/share/:token requires no auth. But: ShareModal is never mounted anywhere in the app (orphaned component). _redirects is commented out, causing 404 on direct /share/:token navigation. |
| 3 | After simulation, node voltages appear on schematic wires and currents on components | ✗ PARTIAL | Branch currents: correctly rendered on ResistorNode, CapacitorNode, InductorNode, DiodeNode, VoltageSourceNode, CurrentSourceNode (all read branchCurrents from overlayStore). Node voltages: stored in overlayStore.nodeVoltages by useOverlaySync, but WireEdge.tsx never reads them. Only GroundNode shows a static "0 V" label. |
| 4 | User can import an LTspice .asc file and see the circuit rendered on the canvas, then simulate it | ✓ VERIFIED | parseAsc → mapAscToCircuit pipeline is complete and substantive (union-find net resolution, 13 symbol types mapped). ImportMenu is mounted in Toolbar.tsx. mapAscToCircuit → setCircuit → circuitToNodes/circuitToEdges pipeline is fully wired. |
| 5 | User can export schematic as PNG and waveform as CSV in one click | ✓ VERIFIED | ExportMenu mounted in Toolbar; exportSchematicAsPng uses html-to-image 1.11.13 (pinned); exportWaveformAsCsv dumps all VectorData; CSV disabled when no results (correct UX guard). |

**Score: 3/5 truths verified**

---

## Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `src/auth/AuthProvider.tsx` | ✓ VERIFIED | ClerkProvider + QueryClientProvider, mounted in main.tsx |
| `src/auth/AuthModal.tsx` | ✓ VERIFIED | Uses Clerk v6 `<Show>` API; modal sign-in; rendered by UserMenu |
| `src/auth/useCurrentUser.ts` | ✓ VERIFIED | Wraps useUser/useAuth; exposes getToken; used by cloud/hooks.ts |
| `src/components/toolbar/UserMenu.tsx` | ✓ VERIFIED | Renders AuthModal; mounted in Toolbar.tsx |
| `src/overlay/overlayStore.ts` | ✓ VERIFIED | Zustand store; nodeVoltages, branchCurrents, isVisible, setOverlay, clear |
| `src/overlay/useOverlaySync.ts` | ✓ VERIFIED | Watches simulationStore.results; filters DC op (single-element vectors); populates overlayStore |
| `src/export/exportPng.ts` | ✓ VERIFIED | html-to-image 1.11.13; captures .react-flow container; viewport transform for bounds |
| `src/export/exportCsv.ts` | ✓ VERIFIED | Builds CSV from VectorData[]; blob download |
| `src/export/exportNetlist.ts` | ✓ VERIFIED | Blob download of .cir string |
| `src/components/toolbar/ExportMenu.tsx` | ✓ VERIFIED | Dropdown with PNG/CSV/Netlist; mounted in Toolbar; CSV disabled without results |
| `src/ui/OverlayToggle.tsx` | ✓ VERIFIED | Eye/EyeOff toggle; reads overlayStore; mounted in Toolbar |
| `worker/src/index.ts` | ✓ VERIFIED | Hono app; CORS; clerkMiddleware on /api/circuits/*; routes registered |
| `worker/src/routes/circuits.ts` | ✓ VERIFIED | Full CRUD; POST /share generates token; D1 + R2 used; requireAuth enforced |
| `worker/src/routes/share.ts` | ✓ VERIFIED | GET /api/share/:token; no auth; D1 lookup by share_token; R2 fetch |
| `worker/src/db/schema.sql` | ✓ VERIFIED | circuits table with share_token UNIQUE; indexed on user_id and share_token |
| `src/cloud/api.ts` | ✓ VERIFIED | saveCircuit, listCircuits, loadCircuit, shareCircuit, loadSharedCircuit; authedFetch adds Bearer token |
| `src/cloud/hooks.ts` | ✓ VERIFIED | useCircuits (query), useSaveCircuit (mutation), useLoadCircuit, useShareCircuit |
| `src/cloud/serialization.ts` | ✓ VERIFIED | Map→array serialization/deserialization; JSON.stringify safe |
| `src/components/toolbar/SaveButton.tsx` | ✓ VERIFIED | Show signed-in/out; prompts for name; calls useSaveCircuit; brief feedback |
| `src/components/dashboard/CircuitDashboard.tsx` | ⚠️ PARTIAL | Renders circuit list from useCircuits; Load button works. Missing: no Share button per circuit row — ShareModal can never be opened. |
| `src/components/share/ShareModal.tsx` | ⚠️ ORPHANED | Exists; substantive; correct implementation. Never imported or rendered anywhere. No call site in Toolbar, Dashboard, or any other component. |
| `src/components/share/SharedCircuitViewer.tsx` | ⚠️ PARTIAL | Component is correct; wired in App.tsx; BUT public/_redirects is commented out, so direct URL navigation returns 404 before App loads. |
| `src/ltspice/parser.ts` | ✓ VERIFIED | Handles WIRE, FLAG, SYMBOL, SYMATTR, TEXT; CRLF normalization; robust |
| `src/ltspice/mapper.ts` | ✓ VERIFIED | 13 symbol types; union-find net graph; port snapping; coordinate transform |
| `src/ltspice/ImportMenu.tsx` | ✓ VERIFIED | FileReader; parseAsc → mapAscToCircuit → setCircuit; mounted in Toolbar |
| `public/_redirects` | ✗ BROKEN | Contains `/* /index.html 200` but it is commented out with `/*`. Cloudflare Pages will 404 on /share/:token direct navigation. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| main.tsx | AuthProvider | import + JSX wrap | ✓ WIRED | ClerkProvider and QueryClientProvider wrap App |
| Toolbar.tsx | UserMenu | import + render | ✓ WIRED | UserMenu in right toolbar group |
| Toolbar.tsx | SaveButton | import + render | ✓ WIRED | SaveButton in right group |
| Toolbar.tsx | CircuitDashboard | import + useState + render | ✓ WIRED | dashboardOpen state; CircuitDashboard rendered below toolbar div |
| Toolbar.tsx | ImportMenu | import + render | ✓ WIRED | ImportMenu in left toolbar group |
| Toolbar.tsx | ExportMenu | import + render | ✓ WIRED | ExportMenu in right group |
| Toolbar.tsx | OverlayToggle | import + render | ✓ WIRED | OverlayToggle in right group |
| App.tsx | SharedCircuitViewer | import + pathname match | ✓ WIRED (partial) | Route logic correct; _redirects broken so link navigation fails |
| App.tsx | useOverlaySync | import + hook call | ✓ WIRED | Called at app root level as required by hook doc |
| SaveButton | useSaveCircuit | hook call | ✓ WIRED | save.mutate called on click |
| useSaveCircuit | serializeCircuit + saveCircuit API | mutation fn | ✓ WIRED | serializeCircuit(circuit) → POST /api/circuits |
| CircuitDashboard | useCircuits + useLoadCircuit | hooks | ✓ WIRED | Query populates list; mutate loads circuit |
| ShareModal | useShareCircuit | hook call | ✓ WIRED (internal) | shareMutation.mutate in useEffect; but ShareModal has no parent |
| ShareModal | Toolbar / Dashboard | import + render | ✗ NOT WIRED | ShareModal exists but is never imported or mounted |
| useOverlaySync | overlayStore.setOverlay | store mutation | ✓ WIRED | setOverlay called when DC op results present |
| overlayStore | canvas component nodes | branchCurrents | ✓ WIRED | ResistorNode, CapacitorNode, InductorNode, DiodeNode, VoltageSourceNode, CurrentSourceNode all read branchCurrents |
| overlayStore | WireEdge | nodeVoltages | ✗ NOT WIRED | WireEdge.tsx does not read overlayStore; nodeVoltages not rendered on wires |
| worker/routes/circuits | D1 + R2 | DB.prepare + CIRCUIT_BUCKET | ✓ WIRED | Real D1 queries; R2 put/get in all CRUD handlers |
| worker/routes/share | D1 + R2 | share_token lookup | ✓ WIRED | DB.prepare by share_token; R2 get by r2_key |
| ImportMenu | parseAsc → mapAscToCircuit → setCircuit | FileReader + pipeline | ✓ WIRED | Full pipeline executed on file load |
| ExportMenu | exportSchematicAsPng | direct call + nodes from useReactFlow | ✓ WIRED | getNodes() passed to exportSchematicAsPng |
| ExportMenu | exportWaveformAsCsv | direct call + results from simulationStore | ✓ WIRED | results from useSimulationStore passed directly |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| CircuitDashboard.tsx | `circuits` from useCircuits | GET /api/circuits → D1 SELECT → JSON response | Yes — real D1 query returning user's rows | ✓ FLOWING |
| WireEdge.tsx | (nodeVoltages — absent) | overlayStore.nodeVoltages | N/A — no data variable in component | ✗ DISCONNECTED |
| SharedCircuitViewer.tsx | `circuit` from loadSharedCircuit | GET /api/share/:token → D1 + R2 | Yes — real R2 object body returned | ✓ FLOWING (if page loads) |
| ResistorNode.tsx (representative) | `current` from branchCurrents | overlayStore populated by useOverlaySync from simulationStore.results | Yes — real simulation vectors | ✓ FLOWING |

---

## Behavioral Spot-Checks

Step 7b: SKIPPED — No runnable entry points without a deployed Cloudflare Worker and live WASM engine. The worker requires D1/R2 bindings and the frontend requires a running ngspice WASM module. Static checks are sufficient.

---

## Requirements Coverage

Requirements were not enumerated in a separate REQUIREMENTS.md for this phase. Coverage is assessed against the 5 success criteria from ROADMAP.md, mapped above.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `public/_redirects` | 1 | `/* /index.html 200` commented out | ✗ Blocker | Direct navigation to `/share/:token` returns 404; share link flow breaks for recipients |
| `src/components/share/ShareModal.tsx` | — | Orphaned component; never imported | ✗ Blocker | Share link generation UI is unreachable; success criterion 2 cannot be met |
| `src/canvas/edges/WireEdge.tsx` | — | No overlayStore access; nodeVoltages never rendered | ✗ Blocker | Node voltage half of success criterion 3 is unimplemented |
| `worker/wrangler.toml` | 9 | `database_id = "PLACEHOLDER_REPLACE_WITH_ACTUAL_ID"` | ⚠️ Warning | Worker cannot deploy to production without a real D1 database ID |
| `src/components/toolbar/SaveButton.tsx` | 34 | `window.prompt()` for circuit name | ℹ️ Info | Functional but low-quality UX; browser prompt blocks UI thread; acceptable for MVP |

---

## Human Verification Required

### 1. Node voltage display on wires

**Test:** Build a simple RC circuit, run a DC operating point, verify voltage labels appear on wire segments  
**Expected:** Numeric voltage labels (e.g., "3.30 V", "0 V") visible on wire edges connecting components, toggled by the eye button  
**Why human:** Requires WASM engine running in browser; rendered output must be visually confirmed

### 2. Share link in a fresh browser

**Test:** Log in, save a circuit, click Share (once ShareModal is fixed), copy the link, open it in an incognito window with no account  
**Expected:** Circuit renders on the read-only canvas with "Shared Circuit — Read Only" banner; no auth prompt appears  
**Why human:** Requires deployed Cloudflare Worker with real D1/R2/Clerk credentials

### 3. LTspice .asc import end-to-end

**Test:** Import an .asc file from an actual LTspice installation, verify components render correctly, then run simulation  
**Expected:** Components placed on canvas with correct topology; simulation produces matching results to LTspice  
**Why human:** Correctness of port snapping depends on real .asc coordinate data; visual topology review required

---

## Gaps Summary

Three gaps block goal achievement:

**Gap 1 — Node voltages not rendered on wires (SC #3 partially failed)**

The overlay infrastructure is correct: `useOverlaySync` watches simulation results, filters DC operating point data, and populates `overlayStore.nodeVoltages`. But the rendering side is missing. `WireEdge.tsx` contains no reference to `overlayStore`. Component-level branch currents work correctly across all node types. Net voltages sit in the store with no consumer. The fix requires either adding voltage label rendering to `WireEdge.tsx` or adding a floating canvas overlay that reads `nodeVoltages` and positions labels at wire midpoints.

**Gap 2 — ShareModal is orphaned, _redirects is commented out (SC #2 failed)**

The share API endpoint, share token generation, and `SharedCircuitViewer` component are all implemented correctly. Two wiring failures block the user flow: (a) `ShareModal` is never imported or rendered — there is no button in `CircuitDashboard` or `Toolbar` that opens it, so a user has no way to generate a share link; (b) `public/_redirects` has its catch-all rule commented out, so a recipient clicking `/share/:token` would receive a 404 from Cloudflare Pages rather than seeing `index.html` load and route the token. Both must be fixed together for SC #2 to work.

**Gap 3 — Save/load flow verified, no delete/rename UI (informational)**

The backend implements full CRUD including DELETE. The frontend has no delete button in CircuitDashboard. This is not a success criterion gap but is a UX incompleteness worth noting for Phase 3 polish.

---

_Verified: 2026-04-09_
_Verifier: Claude (gsd-verifier)_
