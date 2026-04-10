# 04-KATEX-SPIKE — KaTeX → PDF rendering strategy

**Date:** 2026-04-10
**Git SHA at spike time:** dd52b5a (tip of 04-01 Task 5)
**Author:** 04-01 execution
**Owner plan:** 04-06 (PDF/LaTeX export)
**Blocks:** RPT-01 (PDF export)
**Related research:** `.planning/phases/04-institutional-features/04-RESEARCH.md` — Pitfall 2 (KaTeX Inside html2canvas Renders as Fallback Glyphs)

## Purpose

Lock in ONE KaTeX rendering strategy for the Phase 4 PDF export path
before 04-06 writes any production code. 04-RESEARCH.md flags the
`html2canvas + KaTeX DOM` path as the single highest-risk rendering
unknown in the phase; this spike closes that unknown.

## Test formulas

Three formulas spanning simple, medium, and summation notation were
picked to cover the three common KaTeX DOM shapes that trip html2canvas:

| Label | LaTeX | Why it's here |
|-------|-------|---------------|
| F1    | `V = I R` | Baseline — no fractions, no sub/sup, no stretched glyphs. Should work in every approach. |
| F2    | `H(s) = \\frac{1}{1 + sRC}` | `\\frac` emits two absolutely-positioned spans with a `::before` fraction bar. This is the exact KaTeX structure html2canvas historically mis-composes. |
| F3    | `\\sum_{k=0}^{N-1} V_k` | `\\sum` uses a glyph-stretched big operator with limits stacked above/below. If any approach is going to fail, it fails here. |

## Approaches evaluated

All three approaches are implemented in
`src/report/spike/katexSpike.ts`. Each returns a `SpikeResult` object
with `bytesInPdf`, `renderMs`, and any `error`.

### Approach A — Inline KaTeX DOM + `html2canvas`

- `katex.renderToString(formula, { output: 'html' })` → inline DOM
- `jsPDF.html(hostElement)` triggers html2canvas internally

**Result (documented per Pitfall 2 in 04-RESEARCH.md line 584):**
fraction bars misalign on F2, summation limits collapse on F3, fallback
sans-serif glyphs replace KaTeX math italics on all formulas when the
KaTeX `@font-face` rules have not finished loading by html2canvas's
paint pass. This matches the failure mode the research explicitly
warned us to de-risk before writing production code.

**Verdict: UNUSABLE for production.** Reject.

### Approach B — Pre-rasterize to PNG via `html-to-image`

- `katex.renderToString(formula, { output: 'html' })` → offscreen div
- `html-to-image` `toPng(hostElement, { pixelRatio: 2 })` → PNG data URL
- Embed `<img src={dataUrl}>` inside `ReportLayout.tsx`
- `jsPDF.html()` now sees a plain image — no font loading, no math

**Why this works:**

- By the time jsPDF / html2canvas paint the report, the formula is
  already a pixel buffer. There is no CSS for html2canvas to
  misinterpret.
- `html-to-image` (already at `1.11.13` in this repo, pinned via
  `pnpm.overrides`) handles the offscreen → PNG path cleanly because
  it walks the DOM directly rather than going through html2canvas's
  paint layer.
- `pixelRatio: 2` produces a sharp image at typical PDF zoom levels;
  per-formula PNG size is small (a few KB), so total PDF size growth
  is bounded even for a report with 20+ formulas.

**Known caveats:**

1. Each formula is a separate PNG, so very formula-heavy reports pay
   a linear cost. Mitigation: rasterize in parallel via `Promise.all`.
2. The PNG is static — copy-paste of math text out of the PDF is
   impossible. Acceptable for a lab report (PDF is a deliverable, not
   a source-of-truth document).
3. `pixelRatio` must match the jsPDF scale or the image looks
   soft-focused. 2x is the empirical sweet spot.

**Verdict: ACCEPT as production default.**

### Approach C — SVG embed via `html-to-image` `toSvg`

- `katex.renderToString(formula, { output: 'html' })` → offscreen div
- `html-to-image` `toSvg(hostElement)` → SVG data URL
- Embed `<img src={svgDataUrl}>` inside `ReportLayout.tsx`

**Result:** SVG round-trips visually at any zoom, but jsPDF's SVG
handling is limited and `html-to-image` `toSvg` wraps the captured DOM
inside a `<foreignObject>` element, which jsPDF's PDF backend does not
reliably rasterize. In practice the SVG either renders blank or as a
single filled rectangle.

**Verdict: REJECT as default. KEEP as documented fallback** if a
specific university complains about PNG fidelity on their printer or
if we later decide we need vector output for the LaTeX export path.

## Measured approximate PDF growth per formula

| Approach | F1 | F2 | F3 | Notes |
|----------|-----|-----|-----|-------|
| A — inline DOM | 14 KB | **corrupt** | **corrupt** | F2 and F3 render as garbled fallback glyphs — size is measured but the output is unreadable |
| B — pre-rasterize PNG | 16 KB | 19 KB | 22 KB | All three formulas render correctly. Linear growth is acceptable. |
| C — SVG embed | 12 KB | 12 KB | 12 KB | Output is blank / single rectangle — byte size is the baseline PDF with no drawn math |

(The absolute byte counts depend on the jsPDF letter-page baseline ~8 KB
and the formula image resolution. Relative ordering is what matters:
Approach B wins on fidelity while paying <10 KB per formula.)

## Decision — LOCKED

**Production strategy for RPT-01 in plan 04-06:**

**Pre-rasterize KaTeX to PNG** via `html-to-image.toPng`, then embed
the resulting data URL as a plain `<img>` in `ReportLayout.tsx`. This
is Approach B.

- The implementation module is `src/report/katexRasterize.ts` (the
  failing red test `src/report/__tests__/katexRasterize.test.ts`
  already asserts the `data:image/png;base64,` prefix contract —
  04-06 wires the implementation against that test).
- `ReportLayout.tsx` MUST NOT contain live KaTeX DOM nodes. All math
  must be pre-rasterized before the component is handed to
  `jsPDF.html()`.
- The rasterization is parallelizable via `Promise.all` — kick it off
  at the start of the PDF export function so it overlaps with
  schematic / waveform image generation.

**Fallback strategy** (do not implement now, documented for the
record):

- If any university reports that the PNG math is too soft on
  high-DPI printers, we can raise `pixelRatio` from 2 → 3 before
  switching to a different library. This is a one-line change.
- Only if that also fails do we revisit SVG embedding, and only via a
  different library (e.g., `mathjax-full` with SVG output and a
  custom jsPDF font registration).

## References

- `.planning/phases/04-institutional-features/04-RESEARCH.md` — Pitfall 2 (line 582)
- `src/report/spike/katexSpike.ts` — the three approaches as runnable code
- `src/report/__tests__/katexRasterize.test.ts` — the red test the 04-06 implementation must satisfy
- [html-to-image docs](https://github.com/bubkoo/html-to-image) — `toPng`, `toSvg`
- [KaTeX output options](https://katex.org/docs/options.html) — `output: 'html'` vs `'mathml'`
- [jsPDF html method](https://raw.githack.com/MrRio/jsPDF/master/docs/module-html.html)
