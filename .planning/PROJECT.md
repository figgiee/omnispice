# OmniSpice

## What This Is

A modern, web-based SPICE circuit simulator built to replace LTspice in university electrical and computer engineering programs. Zero-install, runs entirely in the browser via WebAssembly, with a Figma-quality schematic editor, interactive waveform viewer, and education-first features like guided labs and circuit insights. Targets university site licenses as the primary revenue model.

## Core Value

Students can simulate circuits accurately in a modern, intuitive interface that helps them understand circuits — not just compute them.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Browser-based schematic editor with drag-and-drop components, magnetic snap, and intelligent wire routing
- [ ] SPICE-accurate simulation engine (ngspice via WASM) supporting DC, AC, transient, DC sweep, and parametric analysis
- [ ] Interactive waveform viewer with cursors, measurements, and frequency/time domain toggle
- [ ] Comprehensive component library (passives, BJTs, MOSFETs, op-amps, sources) with fuzzy search
- [ ] Human-readable error messages that help students fix circuits (not "singular matrix at node 7")
- [ ] Live values displayed on schematic during simulation (voltage, current, power at each node/component)
- [ ] Cloud save with user accounts
- [ ] Real-time collaboration (two students working on same circuit simultaneously)
- [ ] Guided labs with step-by-step circuit-building experiences and checkpoints
- [ ] Circuit Insights — deterministic plain-language explanations of simulation results
- [ ] Comparison mode — student circuit behavior vs reference behavior
- [ ] Export to lab report (PDF/LaTeX with schematics, waveforms, annotations)
- [ ] LMS integration (Canvas, Blackboard, Moodle) for assignment management
- [ ] Instructor dashboard for creating assignments and reviewing student work
- [ ] Offline mode via service worker

### Out of Scope

- Mobile native apps — web-first, responsive design handles mobile/tablet
- PCB layout — different product category, defer indefinitely
- RF/microwave simulation — specialized domain, not needed for undergrad courses
- Manufacturing output (Gerber, BOM) — this is a simulation tool, not a design-to-fab tool
- AI-generated circuit suggestions — risky for educational tool, students need to learn by doing

## Context

**Market gap:** LTspice dominates university circuit simulation because it's free (Analog Devices). But it has 1980s UX, Windows-only bias, no web version, no collaboration, no learning features. Students universally hate the interface. No current tool combines SPICE accuracy with modern web UX and education features.

**Competitive landscape (validated 2026-04-09):**
- LTspice: Free, accurate, terrible UX, Windows-centric
- Multisim (NI): Good UI, expensive site licenses, weaker simulation engine
- CircuitLab: Web-based, decent UX, shallow simulation, paid
- Falstad/circuitjs1 (2,815 GitHub stars): Browser-based, popular, but NOT real SPICE — toy-level accuracy
- EEcircuit (161 stars): Closest competitor — TypeScript, ngspice-wasm, MIT, but early/small
- PSpice (Cadence): Industry standard, extremely expensive

**Technical foundation:**
- ngspice-wasm proven viable (multiple implementations exist)
- React + TypeScript + Vite for frontend (largest ecosystem, best for agentic AI coding)
- tldraw (46k stars) or React Flow (36k stars) for canvas
- uPlot (10k stars) for waveform rendering
- Yjs for real-time collaboration (CRDT, proven React Flow integration)
- Cloudflare Workers + D1/R2 for minimal backend

**Business model:** Free tier for individual students (basic simulation). University site license (per-seat/year) unlocks collaboration, guided labs, LMS integration, instructor tools. Competitive with MATLAB/Simulink site license pricing.

**Team context:** User has university connections for license sales through a friend. Revenue target: 200k within months.

## Constraints

- **Platform**: Browser-only (Chrome, Firefox, Safari, Edge). Must work on Chromebooks.
- **Engine**: ngspice via WASM — proven, SPICE-compatible, runs client-side
- **Stack**: React 19 + Vite + TypeScript. No SSR framework (pure SPA).
- **Package manager**: pnpm (user preference)
- **AI coding**: Stack must be well-documented and strongly typed for agentic development
- **License**: Proprietary (not open source) — but may use MIT/BSD-licensed dependencies

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Web-only, no desktop app | Zero-install is the #1 adoption advantage over LTspice | -- Pending |
| ngspice-wasm over custom engine | 40+ years of validated SPICE models, proven WASM builds exist | -- Pending |
| React+Vite over Next.js | No SSR needed for WASM-heavy SPA; simpler build | -- Pending |
| tldraw or React Flow for canvas | Both massive ecosystems (46k/36k stars); final choice after research | -- Pending |
| Cloudflare over Vercel | No function cold starts, better pricing at scale, R2/D1 integrated | -- Pending |
| Education features as differentiator | LTspice optimizes for engineers; OmniSpice optimizes for learning | -- Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? Move to Out of Scope with reason
2. Requirements validated? Move to Validated with phase reference
3. New requirements emerged? Add to Active
4. Decisions to log? Add to Key Decisions
5. "What This Is" still accurate? Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-09 after initialization*
