---
phase: 1
slug: core-simulator
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-09
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts (Wave 0 installs) |
| **Quick run command** | `pnpm vitest run --reporter=verbose` |
| **Full suite command** | `pnpm vitest run --coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run --reporter=verbose`
- **After every plan wave:** Run `pnpm vitest run --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| *Populated during planning* | | | | | | | |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — Vitest configuration with jsdom environment
- [ ] `src/test/setup.ts` — Test setup file (React Testing Library, global mocks)
- [ ] `pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitest/coverage-v8` — Test dependencies

*Wave 0 plan creates the test infrastructure.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag component from sidebar to canvas | SCHEM-01 | DnD + React Flow canvas interaction requires visual verification | 1. Open app 2. Drag resistor from sidebar 3. Verify it appears on canvas at drop position |
| Wire routing with orthogonal bends | SCHEM-03 | Visual wire path quality requires human judgment | 1. Place two components 2. Click pin to start wire 3. Route to second pin 4. Verify 90-degree bends |
| Waveform zoom/pan/cursor | WAVE-01, WAVE-02 | uPlot canvas interactions not testable via jsdom | 1. Run simulation 2. Scroll to zoom 3. Click to place cursor 4. Verify readout values |
| Canvas zoom/pan responsiveness | SCHEM-02 | Performance perception requires visual verification | 1. Place 20+ components 2. Scroll to zoom 3. Middle-click to pan 4. Verify smooth interaction |

*All other behaviors have automated verification via unit/integration tests.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
