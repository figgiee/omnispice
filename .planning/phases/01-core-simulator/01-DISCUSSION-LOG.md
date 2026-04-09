# Phase 1: Core Simulator - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-09
**Phase:** 01-core-simulator
**Mode:** Auto (all gray areas auto-resolved with recommended defaults)
**Areas discussed:** Schematic Canvas, Component Symbols, Wire Routing, Simulation Workflow, Error Presentation, Waveform Viewer, Component Library

---

## Schematic Canvas Interaction

| Option | Description | Selected |
|--------|-------------|----------|
| Magnetic snap with auto-connect | Components snap to nearby pins/wires with visual feedback | ✓ |
| Manual connect only | User must explicitly click pins to connect | |
| Proximity connect | Connect when component is dropped near a wire (no visual feedback) | |

**User's choice:** [auto] Magnetic snap with auto-connect (recommended default)
**Notes:** Figma-style interaction model — smooth, natural, visual feedback on valid connections

## Component Symbol Rendering

| Option | Description | Selected |
|--------|-------------|----------|
| IEEE/IEC standard EE symbols | Resistor zigzag, capacitor plates, inductor loops | ✓ |
| Simplified block symbols | Rectangular blocks with labels | |
| Mixed (IEC for passives, blocks for ICs) | Standard symbols for simple components, boxes for complex | |

**User's choice:** [auto] IEEE/IEC standard EE symbols (recommended default)
**Notes:** Students learn with standard symbols — using anything else would confuse them

## Wire Routing

| Option | Description | Selected |
|--------|-------------|----------|
| Orthogonal auto-routing with manual override | 90-degree angles, auto-path between pins, user can add bends | ✓ |
| Freeform wire drawing | User draws wire path freely | |
| Strict auto-routing only | System chooses all paths, no manual override | |

**User's choice:** [auto] Orthogonal auto-routing with manual override (recommended default)
**Notes:** Standard EE schematic convention. T-junctions with filled dots.

## Simulation Workflow

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit Run button with analysis selector | User chooses analysis type, clicks Run | ✓ |
| Auto-simulate on circuit change | Simulation runs automatically after each edit | |
| Right-click context menu to simulate | Simulation triggered from context menu | |

**User's choice:** [auto] Explicit Run button with analysis selector (recommended default)
**Notes:** Auto-simulate would be annoying for complex circuits. Explicit control preferred.

## Error Presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Inline + bottom panel | Errors in collapsible panel, clicking highlights problem on canvas | ✓ |
| Modal dialog | Error appears in popup | |
| Toast notifications | Transient error messages | |

**User's choice:** [auto] Inline + bottom panel (recommended default)
**Notes:** Pre-simulation validation catches issues before ngspice runs. IDE-like error experience.

## Waveform Viewer

| Option | Description | Selected |
|--------|-------------|----------|
| Resizable split pane with click-to-cursor | Panel below/beside schematic, click to place cursors | ✓ |
| Separate window/tab | Waveforms open in new window | |
| Overlay on schematic | Waveforms render directly on the schematic canvas | |

**User's choice:** [auto] Resizable split pane with click-to-cursor (recommended default)
**Notes:** Split pane is standard for simulation tools. Overlay would be too cluttered.

---

## Claude's Discretion

- Color palette and theme defaults
- Loading states and skeleton screens
- Keyboard shortcut help panel
- Typography and spacing
- Empty state design
- Component tooltip styling
- SPICE model import flow UI

## Deferred Ideas

- Dark mode toggle — Phase 2+
- Keyboard shortcut customization — future
- Circuit template gallery — Phase 2
- Multi-page schematics — future
- Visual undo history panel — future
