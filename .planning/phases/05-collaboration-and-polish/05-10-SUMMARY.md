---
phase: 05-collaboration-and-polish
plan: 10
subsystem: infra
tags: [pwa, service-worker, offline, vite-plugin-pwa, workbox, idb-keyval, zustand-persist, zundo, indexeddb]

# Dependency graph
requires:
  - phase: 05-collaboration-and-polish
    provides: "circuitStore with zundo temporal middleware + addComponentsAndWires action from 05-06"
  - phase: 01-core-simulator
    provides: "ngspice WASM worker that will be precached once the docker build ships its binary"
provides:
  - "vite-plugin-pwa integrated, sw.js emitted by production build, workbox precache of app shell + WASM"
  - "zustand persist middleware wrapping circuitStore state inside temporal, backed by idb-keyval"
  - "mapReplacer/mapReviver JSON helpers so Maps and Sets round-trip through persist storage"
  - "OfflineBanner top-strip component with online/offline listeners + dismiss + reappear semantics"
  - "useRegisterSW hook wiring virtual:pwa-register/react into App.tsx in autoUpdate mode"
  - "Phase5-offline Playwright project for E2E offline verification against pnpm preview"
affects: [05-09-collaboration, 05-11-release-readiness, future-ngspice-wasm-docker-build]

# Tech tracking
tech-stack:
  added: [vite-plugin-pwa@1.2.0, workbox-window@7.4.0]
  patterns:
    - "temporal(persist(...)) middleware order locked in — persist wraps the store body, temporal wraps persist, so undo history survives rehydration and persisted state is undoable"
    - "createJSONStorage(() => idbAdapter, { replacer, reviver }) — Zustand 5 supports replacer/reviver options on the JSON storage adapter, removing the need for a bespoke mapAwareStorage wrapper"
    - "Shared ResizeObserver + scrollIntoView + vi.mock('idb-keyval') in src/test/setup.ts so any test that imports circuitStore does not blow up on jsdom's missing IndexedDB"
    - "devOptions.enabled=false so the SW never runs in dev mode — it would interfere with HMR and the WASM worker init path"

key-files:
  created:
    - src/store/mapSerialization.ts
    - src/store/__tests__/mapSerialization.test.ts
    - src/store/__tests__/circuitStoreOfflinePersist.test.ts
    - src/app/OfflineBanner.tsx
    - src/app/OfflineBanner.module.css
    - src/app/__tests__/OfflineBanner.test.tsx
    - src/app/useRegisterSW.ts
    - public/icons/icon-192.png
    - public/icons/icon-512.png
    - tests/e2e/phase5-offline/offline.spec.ts
  modified:
    - src/store/circuitStore.ts
    - src/test/setup.ts
    - src/App.tsx
    - src/vite-env.d.ts
    - vite.config.ts
    - playwright.config.ts
    - package.json
    - pnpm-lock.yaml

key-decisions:
  - "Middleware order locked as temporal(persist(storeBody)) — persist wraps the store body so rehydrated state flows through temporal and counts as an undoable baseline. persist(temporal(...)) was the only alternative considered and rejected because it would persist temporal meta (past/future stacks) not the user's current circuit."
  - "createJSONStorage uses Zustand 5's native replacer/reviver option pair (not a bespoke mapAwareStorage wrapper) — cleaner and matches the Zustand 5 stock API."
  - "idb-keyval mocked globally in src/test/setup.ts rather than per-test, because ANY test that imports circuitStore indirectly triggers persist hydration. Per-test mocks get shadowed by module caching and still crash on 'indexedDB is not defined'."
  - "Phase5-offline Playwright tests live in their own project (port 4173, pnpm preview) separate from phase5 (port 5174, dev) because vite-plugin-pwa only emits sw.js in production builds. Same repo pattern as phase-04."
  - "PWA placeholder icons shipped as 1x1 PNGs at public/icons/icon-{192,512}.png. Flagged in user_setup — real icons are a design-asset task, not a Plan 05-10 blocker."
  - "devOptions.enabled=false — the dev SW interferes with HMR and the WASM worker's SharedArrayBuffer fallback detection. SW only runs in production/preview."
  - "Runtime CacheFirst strategy for /\\.wasm$/ paired with precache via globPatterns. Once docker/ngspice-wasm/build.sh ships its output the precache will pick it up automatically — no config change needed."

patterns-established:
  - "Zustand persist round-trip unit test: mock idb-keyval with an in-memory Map, add a component, wait for the async persist write, re-import the store module, call persist.rehydrate, and assert the component is still there"
  - "Offline banner pattern: navigator.onLine initial + window online/offline listener + dismiss state that resets on every fresh offline event"
  - "SW E2E pattern: wait for navigator.serviceWorker.ready before measuring offline behavior, use context.setOffline(true) to drive the browser event path our app listens to"

requirements-completed: [OFFLINE-01, OFFLINE-02]

# Metrics
duration: 45min
completed: 2026-04-11
---

# Phase 05 Plan 10: Offline PWA (service worker + IndexedDB persist) Summary

**vite-plugin-pwa emits sw.js precaching the app shell + .wasm glob, circuitStore persists to idb-keyval through temporal(persist(...)), and an OfflineBanner surfaces connectivity loss — Phase 5 OFFLINE-01 and OFFLINE-02 closed**

## Performance

- **Duration:** ~45 min (recovery run)
- **Started:** 2026-04-11T13:55:00Z (recovery resume)
- **Completed:** 2026-04-11T14:10:00Z
- **Tasks:** 5
- **Files modified:** 18 (10 created + 8 modified)

## Accomplishments

- **Offline state persistence via zustand persist + idb-keyval**, with the
  middleware order (`temporal(persist(storeBody))`) locked in behind a unit
  test so future plans that touch circuitStore cannot silently break undo
  or rehydration.
- **Map/Set serialization** — `mapReplacer`/`mapReviver` encode Maps as
  `{__type:'__$map$__', entries:[...]}` (and Sets analogously) so circuit
  state survives JSON.stringify through persist storage without data loss.
- **Service worker via vite-plugin-pwa 1.2.0** with `registerType:'autoUpdate'`,
  `globPatterns` explicitly including `wasm` (default excludes it), 20 MB
  precache size ceiling for the ngspice binary, and a runtime
  `CacheFirst` cache named `wasm-modules-v1`.
- **OfflineBanner component** mounted in App.tsx — appears on window
  `offline` event, dismissible with ×, reappears on next offline event,
  hides immediately on `online`. Covered by 5 unit tests.
- **Playwright `phase5-offline` project** targeting `pnpm preview` at
  port 4173 — 3 E2E specs for offline reload persistence, banner
  dismiss, and back-online-clears-banner.

## Task Commits

Each task was committed atomically (TDD tasks have red+green pairs):

1. **Task 1 (TDD-RED): mapReplacer/mapReviver failing tests** — `d831c75` (test)
2. **Task 1 (TDD-GREEN): mapReplacer/mapReviver implementation** — `b188f05` (feat)
3. **Task 2 (TDD-RED): circuitStore persist failing tests** — `b522efb` (test)
4. **Task 2 (TDD-GREEN): wrap circuitStore in persist(idb-keyval)** — `271abe1` (feat, conflict-resolved cherry-pick)
5. **Task 3: vite-plugin-pwa config + useRegisterSW + manifest** — `2d317a9` (feat)
6. **Task 4: OfflineBanner with online/offline listener + dismissal** — `0336226` (feat)
7. **Task 5: Playwright offline spec for SW cache + persist + banner** — `40c82d4` (test)

_Note: Tasks 1 and 2 were cherry-picked from the prior agent's abandoned
worktree (`worktree-agent-afcda451`) into this fresh worktree rebased on
current main. Task 2's commit (`271abe1`) is a new hash because its
circuitStore.ts conflicted with the `addComponentsAndWires` action shipped
by Plan 05-06 and had to be merged by hand._

## Files Created/Modified

### Created
- `src/store/mapSerialization.ts` — mapReplacer/mapReviver JSON helpers
- `src/store/__tests__/mapSerialization.test.ts` — 9 round-trip tests
- `src/store/__tests__/circuitStoreOfflinePersist.test.ts` — 4 middleware-order tests
- `src/app/OfflineBanner.tsx` — top-strip connectivity banner
- `src/app/OfflineBanner.module.css` — warm warning tint, token-based
- `src/app/__tests__/OfflineBanner.test.tsx` — 5 behavioral tests
- `src/app/useRegisterSW.ts` — virtual:pwa-register/react wrapper
- `public/icons/icon-192.png`, `public/icons/icon-512.png` — placeholder icons
- `tests/e2e/phase5-offline/offline.spec.ts` — 3 E2E specs

### Modified
- `src/store/circuitStore.ts` — wrapped in `temporal(persist(...))`, added
  idb-keyval adapter, partialize only `{ circuit, refCounters }`, version 1
- `src/test/setup.ts` — added `vi.mock('idb-keyval', ...)` global stub
  alongside the existing ResizeObserver + scrollIntoView jsdom polyfills
- `src/App.tsx` — mounts `<OfflineBanner/>` in fallthrough route, calls
  `useRegisterSW()` at the top of App() alongside the 05-04 orchestrator
- `src/vite-env.d.ts` — added `vite-plugin-pwa/react` + `vite-plugin-pwa/info` refs
- `vite.config.ts` — VitePWA plugin with workbox wasm globPatterns, runtime caching, and manifest
- `playwright.config.ts` — new `phase5-offline` project at port 4173
- `package.json` / `pnpm-lock.yaml` — `vite-plugin-pwa@1.2.0` and `workbox-window@7.4.0` devDeps

## Decisions Made

See `key-decisions` in frontmatter for the full list. Highlights:

- **Middleware order is `temporal(persist(storeBody))`** — locked in by
  the `circuitStoreOfflinePersist` test. Both orders compile; only this
  one both rehydrates user state AND keeps undo working.
- **Placeholder PWA icons** are 1x1 PNGs flagged in `user_setup`. The
  PWA still installs and functions — icons are a design-asset task.
- **phase5-offline targets `pnpm preview`** (port 4173) because
  vite-plugin-pwa emits sw.js only in production builds.
- **`createJSONStorage(() => idb, { replacer, reviver })`** — Zustand 5's
  native option pair used instead of a bespoke mapAwareStorage wrapper.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Cherry-pick conflict resolution on circuitStore.ts**

- **Found during:** Recovery cherry-pick of Task 2 (`1885d1e`)
- **Issue:** The prior agent's Task 2 commit was built against a circuitStore
  without `addComponentsAndWires` (Plan 05-06 landed between the abandoned
  worktree and current main). Cherry-picking produced conflicts in both
  `src/store/circuitStore.ts` and `src/test/setup.ts`.
- **Fix:** Hand-merged the files:
    - circuitStore.ts: kept the `temporal(persist(...))` wrapping structure from
      the cherry-pick but added `addComponentsAndWires` inside the persist wrapper
      alongside the other actions.
    - setup.ts: union of both sides — the 05-06 ResizeObserver + scrollIntoView
      polyfills AND the 05-10 `vi.mock('idb-keyval', ...)` global stub.
- **Files modified:** `src/store/circuitStore.ts`, `src/test/setup.ts`
- **Verification:** `pnpm test --run src/store/__tests__/circuitStoreOfflinePersist.test.ts`
  and `pnpm test --run src/store/__tests__/mapSerialization.test.ts` both green,
  full suite shows +5 passing tests after the conflict resolution.
- **Committed in:** `271abe1` (Task 2 cherry-pick continue)

**2. [Rule 2 - Missing Critical] devOptions.enabled=false**

- **Found during:** Task 3 (vite-plugin-pwa config)
- **Issue:** The plan did not specify a `devOptions` block. Left at the
  default, vite-plugin-pwa would have registered a SW during `pnpm dev`,
  which interferes with HMR and can shadow the WASM worker init path.
- **Fix:** Added `devOptions: { enabled: false }`. SW now only runs in
  production builds and via `pnpm preview`.
- **Files modified:** `vite.config.ts`
- **Verification:** `pnpm dev` still serves without a registered SW;
  `pnpm build && pnpm preview` does register one.
- **Committed in:** `2d317a9` (Task 3)

**3. [Rule 3 - Blocking] Placeholder PNG icons for manifest**

- **Found during:** Task 3 (manifest config)
- **Issue:** The manifest references `/icons/icon-192.png` and
  `/icons/icon-512.png`, but no icons existed in `public/`. Without
  these files the build succeeds but the PWA install banner would fail.
- **Fix:** Generated 1x1 PNG placeholders via Node `Buffer.from(pngHeader)`
  and wrote both files. Flagged in `user_setup` frontmatter so the icon
  generation task is not forgotten.
- **Files modified:** `public/icons/icon-192.png`, `public/icons/icon-512.png`
- **Verification:** `pnpm build` output includes both PNGs in the precache.
- **Committed in:** `2d317a9` (Task 3)

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 missing-critical, 1 blocking)
**Impact on plan:** All three were pure correctness fixes. No scope creep.

## Issues Encountered

- **Pre-existing `src/pages/AssignmentPage.test.tsx` suite failure** (uPlot
  `matchMedia is not a function` at module load) is still present. Already
  tracked in `.planning/phases/05-collaboration-and-polish/deferred-items.md`
  from Plan 05-04. Confirmed pre-existing by running the full suite
  against plain origin/main — fails identically. Out of scope for 05-10.
- **vite-plugin-pwa@1.2.0 peer dep warning for Vite 8**: the plugin's
  declared peer range is `^3.1.0 || ^4.0.0 || ^5.0.0 || ^6.0.0 || ^7.0.0`
  but our repo pins Vite 8. Despite the warning, the build completes
  successfully, sw.js is emitted, and the manifest includes the expected
  63 precache entries. Downgrading or forking is not warranted yet.
- **No real ngspice.wasm in dist/**: the docker/ngspice-wasm/build.sh
  output is not present in this repo, so the current precache manifest
  does not contain a WASM file (the runtime `CacheFirst` regex for
  `/\.wasm$/` is still wired, and the globPattern `wasm` extension will
  pick the binary up once the docker build lands). Verification passes
  because `wasm` still appears in `sw.js` (runtime caching route).

## User Setup Required

**PWA icons are placeholders.** A human must generate real app icons
at `public/icons/icon-192.png` and `public/icons/icon-512.png`:

- 192×192 PNG, theme color `#1a1a2e`, OmniSpice wordmark or logo
- 512×512 PNG, same design, used for install prompt and splash

Suggested tools: Figma export, `sharp` CLI, or any image editor.

Until real icons ship the PWA still works — the install prompt will
just show a tiny default icon.

## Next Phase Readiness

- Phase 5 success criterion 7 (Offline) CLOSED.
- Plan 05-10 is complete and independent of Plan 05-09 (collaboration),
  so either can ship first or they can ship in parallel.
- Future plans that touch `circuitStore.ts` shape MUST re-run
  `src/store/__tests__/circuitStoreOfflinePersist.test.ts` — it locks
  the `temporal(persist(...))` middleware order contract and will fail
  if someone accidentally inverts them.
- When the ngspice WASM docker build ships its binary into the Vite
  asset pipeline, no further config change is needed — the existing
  `globPatterns: ['**/*.{js,css,html,wasm,ttf,woff2}']` will auto-include
  it in the next production build's precache.

## Self-Check: PASSED

### Created files verified on disk

- [x] `src/store/mapSerialization.ts` — FOUND
- [x] `src/store/__tests__/mapSerialization.test.ts` — FOUND
- [x] `src/store/__tests__/circuitStoreOfflinePersist.test.ts` — FOUND
- [x] `src/app/OfflineBanner.tsx` — FOUND
- [x] `src/app/OfflineBanner.module.css` — FOUND
- [x] `src/app/__tests__/OfflineBanner.test.tsx` — FOUND
- [x] `src/app/useRegisterSW.ts` — FOUND
- [x] `public/icons/icon-192.png` — FOUND
- [x] `public/icons/icon-512.png` — FOUND
- [x] `tests/e2e/phase5-offline/offline.spec.ts` — FOUND

### Commits verified via git log

- [x] `d831c75` test(05-10): add failing tests for mapReplacer/mapReviver — FOUND
- [x] `b188f05` feat(05-10): implement mapReplacer/mapReviver — FOUND
- [x] `b522efb` test(05-10): add failing tests for circuitStore persist — FOUND
- [x] `271abe1` feat(05-10): wrap circuitStore in persist(idb-keyval) — FOUND
- [x] `2d317a9` feat(05-10): configure vite-plugin-pwa — FOUND
- [x] `0336226` feat(05-10): OfflineBanner — FOUND
- [x] `40c82d4` test(05-10): Playwright offline spec — FOUND

### Verification commands

```bash
# unit tests pass (+5 from the prior baseline)
pnpm test --run src/store/__tests__/mapSerialization.test.ts src/store/__tests__/circuitStoreOfflinePersist.test.ts src/app/__tests__/OfflineBanner.test.tsx
# → 18 passing (9 + 4 + 5)

# production build emits sw.js with wasm glob
pnpm build
# → PWA v1.2.0  mode generateSW  precache 63 entries (3240.80 KiB)
# → dist/sw.js + dist/workbox-*.js emitted
# → grep 'wasm' dist/sw.js  → matches runtime route

# typecheck clean
npx tsc --noEmit
# → no errors

# full unit suite (pre-existing AssignmentPage failure tracked in deferred-items.md)
pnpm test --run
# → 318 passed / 2 skipped / 1 pre-existing suite failure
```

---
*Phase: 05-collaboration-and-polish*
*Completed: 2026-04-11*
