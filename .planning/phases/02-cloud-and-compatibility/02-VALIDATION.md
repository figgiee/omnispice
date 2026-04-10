---
phase: 2
slug: cloud-and-compatibility
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-09
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (already installed from Phase 1) |
| **Config file** | `vitest.config.ts` (root — already configured) |
| **Quick run command** | `pnpm vitest run --reporter=verbose` |
| **Full suite command** | `pnpm vitest run --coverage` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run --reporter=verbose`
- **After every plan wave:** Run `pnpm vitest run --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Nyquist Strategy

Phase 2 has 5 plans. The Nyquist rule requires at least one behavioral test per 3 tasks. This phase has ~10 implementation tasks, so at minimum 3–4 automated test suites are required.

Pure functions (serialization, LTspice parser, CSV export, overlay sync logic) get unit tests. The Worker API gets integration tests via Vitest + miniflare bindings. Clerk auth flow is manual-only (requires live keys).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists? |
|---------|------|------|-------------|-----------|-------------------|-------------|
| serialization | 02-03 | 2 | CLOUD-02 | unit | `pnpm vitest run src/cloud/__tests__/serialization.test.ts` | Wave 0 |
| worker CRUD | 02-03 | 2 | CLOUD-02, CLOUD-03 | integration | `pnpm vitest run worker/src/__tests__/circuits.test.ts` | Wave 0 |
| share token | 02-03 | 2 | CLOUD-04 | integration | same file | Wave 0 |
| overlaySync | 02-02 | 1 | LIVE-01, LIVE-02, LIVE-03 | unit | `pnpm vitest run src/overlay/__tests__/useOverlaySync.test.ts` | Wave 0 |
| csvExport | 02-02 | 1 | EXP-02 | unit | `pnpm vitest run src/export/__tests__/exportCsv.test.ts` | Wave 0 |
| netlistExport | 02-02 | 1 | EXP-03 | unit | `pnpm vitest run src/export/__tests__/exportNetlist.test.ts` | Wave 0 |
| ascParser | 02-05 | 3 | LTSP-01 | unit | `pnpm vitest run src/ltspice/__tests__/parser.test.ts` | Wave 0 |
| ascMapper | 02-05 | 3 | LTSP-01 | unit | `pnpm vitest run src/ltspice/__tests__/mapper.test.ts` | Wave 0 |

*Status: pending (not yet executed)*

---

## Wave 0 Requirements

Test scaffolds must be created before implementation tasks run. Each scaffold file contains failing tests that define the expected behavior. Implementation tasks turn red → green.

- [ ] `src/cloud/__tests__/serialization.test.ts` — Map serialization round-trip
- [ ] `src/overlay/__tests__/useOverlaySync.test.ts` — Overlay sync extracts v()/i() correctly
- [ ] `src/export/__tests__/exportCsv.test.ts` — CSV columns match VectorData names and rows match sample count
- [ ] `src/export/__tests__/exportNetlist.test.ts` — Netlist export string matches generateNetlist output
- [ ] `worker/src/__tests__/circuits.test.ts` — CRUD + share token (miniflare or mock D1/R2)
- [ ] `src/ltspice/__tests__/parser.test.ts` — parseAsc() handles WIRE, FLAG, SYMBOL, SYMATTR, TEXT
- [ ] `src/ltspice/__tests__/mapper.test.ts` — mapAscToCircuit() produces ComponentType-valid Circuit

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Clerk SignIn modal appears over canvas | CLOUD-01 | Requires live Clerk API keys; Clerk SDK mocking is complex and brittle | Open dev server, click Save, verify modal appears centered over canvas without disrupting layout |
| Clerk UserButton shows after login | CLOUD-01 | Same | Complete login flow, verify avatar appears in toolbar |
| PNG export matches canvas visually | EXP-01 | html-to-image captures DOM — unit tests can't verify visual fidelity | Export PNG from a known circuit, open file, verify edges and components are all visible |
| Shared link opens in incognito | CLOUD-04 | Requires live D1 + R2 bindings | Create share link, open in incognito, verify read-only viewer loads |
| LTspice .asc import renders correctly | LTSP-01 | Visual canvas verification needed | Import a known RC circuit .asc, verify components appear at correct positions |

---

## Test Fixtures

### `src/ltspice/__tests__/fixtures/rc-circuit.asc`
A minimal LTspice RC circuit for parser tests:
```
Version 4
SHEET 1 880 680
WIRE 240 160 96 160
WIRE 384 160 240 160
WIRE 384 256 384 160
WIRE 96 256 96 160
FLAG 96 256 0
FLAG 384 256 0
SYMBOL res 208 144 R90
WINDOW 0 0 56 VBottom 2
WINDOW 3 32 56 VTop 2
SYMATTR InstName R1
SYMATTR Value 10k
SYMBOL cap 368 160 R0
WINDOW 0 24 8 Left 2
WINDOW 3 24 56 Left 2
SYMATTR InstName C1
SYMATTR Value 1n
SYMBOL voltage 96 160 R0
WINDOW 123 0 0 Left 2
WINDOW 39 0 0 Left 2
SYMATTR InstName V1
SYMATTR Value 5
TEXT -64 296 Left 2 !.op
```

### `src/cloud/__tests__/fixtures/example-circuit.json`
Serialized circuit JSON for round-trip tests (generated during test setup from a known `Circuit` object — do not hand-write).
