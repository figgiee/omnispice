---
phase: 02-cloud-and-compatibility
plan: "04"
subsystem: cloud-ui
tags: [cloud, save, load, share, routing, clerk, tanstack-query]
dependency_graph:
  requires: [02-01, 02-03]
  provides: [cloud-save-ui, cloud-load-ui, cloud-share-ui, spa-routing]
  affects: [src/App.tsx, src/ui/Toolbar.tsx, src/cloud/]
tech_stack:
  added: []
  patterns:
    - TanStack Query useMutation for save/load/share cloud operations
    - Clerk Show when="signed-in/out" (v6 API) for auth-gated toolbar actions
    - Shared circuitToFlow utility extracted from Layout for reuse in read-only viewer
    - window.location.pathname routing for SPA share links
    - Cloudflare Pages _redirects for SPA fallback
key_files:
  created:
    - src/cloud/types.ts
    - src/cloud/api.ts
    - src/cloud/hooks.ts
    - src/canvas/circuitToFlow.ts
    - src/components/toolbar/SaveButton.tsx
    - src/components/dashboard/CircuitDashboard.tsx
    - src/components/share/ShareModal.tsx
    - src/components/share/SharedCircuitViewer.tsx
    - public/_redirects
    - .env.example
  modified:
    - src/app/Layout.tsx
    - src/ui/Toolbar.tsx
    - src/App.tsx
decisions:
  - Used Clerk v6 Show when="signed-in/out" instead of removed SignedIn/SignedOut components
  - Extracted circuitToNodes/circuitToEdges from Layout.tsx into src/canvas/circuitToFlow.ts for shared use
  - Used window.location.pathname routing (not hash routing) to match the plan's key_links contract
  - Fork to My Account button is a deliberate disabled stub per plan instructions
metrics:
  duration: "~5 minutes"
  completed: "2026-04-09"
  tasks: 2
  files: 10
---

# Phase 2 Plan 04: Cloud Save/Load/Share UI Summary

Cloud persistence UI wired to the Worker API: auth-gated Save button, circuit dashboard with list+load, share modal with clipboard, and read-only shared circuit viewer at `/share/:token`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Cloud API layer, SaveButton, CircuitDashboard | 8084ebd | types.ts, api.ts, hooks.ts, circuitToFlow.ts, SaveButton.tsx, CircuitDashboard.tsx, Toolbar.tsx |
| 2 | ShareModal, SharedCircuitViewer, SPA routing | ce0933c | ShareModal.tsx, SharedCircuitViewer.tsx, App.tsx, public/_redirects |

## What Was Built

**API layer (`src/cloud/`):**
- `types.ts` — CircuitMeta, SaveCircuitInput, SaveCircuitResponse, ShareResponse interfaces
- `api.ts` — saveCircuit, listCircuits, loadCircuit, shareCircuit, loadSharedCircuit fetch wrappers using `VITE_API_URL` and Bearer auth
- `hooks.ts` — useCircuits (query), useSaveCircuit, useLoadCircuit, useShareCircuit (mutations)

**Toolbar additions (`src/ui/Toolbar.tsx`):**
- SaveButton: auth-gated via Clerk `<Show when="signed-out/signed-in">`, prompts for name, calls useSaveCircuit, shows "✓ Saved" for 2s on success
- My Circuits button: opens CircuitDashboard overlay (visible only when signed in)

**CircuitDashboard (`src/components/dashboard/CircuitDashboard.tsx`):**
- Modal overlay listing all user circuits from useCircuits query
- Each row shows circuit name + last-updated timestamp with a Load button
- Loading and empty states handled

**ShareModal (`src/components/share/ShareModal.tsx`):**
- Calls useShareCircuit on open, displays the URL in a readonly input
- Copy-to-clipboard with "Copied!" feedback (2s timeout)
- Closes on backdrop click or Escape key

**SharedCircuitViewer (`src/components/share/SharedCircuitViewer.tsx`):**
- Fetches circuit JSON via loadSharedCircuit (no auth, useState+useEffect)
- Deserializes with deserializeCircuit
- Renders ReactFlow with nodesDraggable=false, nodesConnectable=false, elementsSelectable=false
- Passes real edges via circuitToEdges (wires visible, not empty array)
- Shows loading, error, and "Fork to My Account" (disabled, deferred) states

**Shared utility (`src/canvas/circuitToFlow.ts`):**
- Extracted circuitToNodes and circuitToEdges from Layout.tsx into a shared module
- Layout.tsx updated to import from the shared utility

**Routing & hosting:**
- `App.tsx` routes `/share/:token` via `window.location.pathname.match()`
- `public/_redirects` with `/* /index.html 200` for Cloudflare Pages SPA fallback

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Clerk v6 has no SignedIn/SignedOut exports**
- **Found during:** Task 1 — TypeScript error on import
- **Issue:** Plan specified `import { SignedIn, SignedOut } from '@clerk/react'` but Clerk v6 removed these in favour of `<Show when="signed-in/out">`
- **Fix:** Used `<Show when="signed-in">` / `<Show when="signed-out">` throughout SaveButton and Toolbar, consistent with existing AuthModal pattern
- **Files modified:** src/components/toolbar/SaveButton.tsx, src/ui/Toolbar.tsx
- **Commit:** 8084ebd

**2. [Rule 2 - Missing shared utility] circuitToNodes/circuitToEdges were inlined in Layout.tsx**
- **Found during:** Task 2 — SharedCircuitViewer needed the same conversion logic
- **Issue:** Plan instructed importing from `@/canvas/circuitToFlow` but the file didn't exist
- **Fix:** Extracted the two functions from Layout.tsx into src/canvas/circuitToFlow.ts; updated Layout.tsx to import from it
- **Files modified:** src/canvas/circuitToFlow.ts (created), src/app/Layout.tsx
- **Commit:** 8084ebd

## Known Stubs

| File | Line | Description | Resolution |
|------|------|-------------|------------|
| src/components/share/SharedCircuitViewer.tsx | 121 | "Fork to My Account" button is disabled with title="Coming soon" | Intentional per plan — fork UX deferred to a later phase |

## Verification

- `pnpm exec tsc --noEmit` — zero errors
- `pnpm build` — succeeds; `dist/_redirects` confirmed present
- `src/cloud/api.ts` exports: saveCircuit, listCircuits, loadCircuit, shareCircuit, loadSharedCircuit
- `src/cloud/hooks.ts` exports: useCircuits, useSaveCircuit, useLoadCircuit, useShareCircuit
- `App.tsx` contains `window.location.pathname.match(/^\/share\//)`
- `public/_redirects` contains `/* /index.html 200`
- `SharedCircuitViewer` passes `edges={circuitToEdges(circuit)}` (real wires, not empty array)

## Self-Check: PASSED
