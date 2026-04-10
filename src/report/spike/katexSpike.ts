/**
 * KaTeX → PDF rendering spike (04-01-06).
 *
 * Three candidate approaches are implemented here so that 04-06 can pick the
 * winning strategy with empirical data, not guesswork.
 *
 * The decision and supporting measurements live in
 * `.planning/phases/04-institutional-features/04-KATEX-SPIKE.md`.
 *
 * This module is *not* imported by production code. It is invoked by a small
 * harness (dev-only) that mounts each approach into an offscreen div, runs
 * the existing `html-to-image` path, and reports file size + fidelity.
 *
 * Run via:
 *   import { runKatexSpike } from './katexSpike';
 *   await runKatexSpike();    // logs a results table to the console
 */

import katex from 'katex';
import { toPng, toSvg } from 'html-to-image';
import jsPDF from 'jspdf';

/** Three formulas spanning simple → medium → summation. */
export const TEST_FORMULAS = [
  'V = I R',
  'H(s) = \\frac{1}{1 + sRC}',
  '\\sum_{k=0}^{N-1} V_k',
] as const;

export type SpikeApproach = 'A-inline-html2canvas' | 'B-pre-rasterize-png' | 'C-svg-embed';

export interface SpikeResult {
  approach: SpikeApproach;
  formula: string;
  /** Approximate bytes added to the PDF when this formula is embedded. */
  bytesInPdf: number;
  /** Render time in milliseconds (measured with performance.now). */
  renderMs: number;
  /** Empty string on success, stack trace on failure. */
  error: string;
}

/**
 * Approach A (baseline, expected to fail per 04-RESEARCH.md Pitfall 2):
 * render KaTeX to inline HTML/CSS and let jspdf.html() (which wraps
 * html2canvas internally) rasterize the whole thing.
 *
 * Pitfall: html2canvas does not fully support the CSS KaTeX generates
 * (font-stretch, line-height hacks, inline-block baseline tricks). Result
 * typically has misaligned fraction bars and mangled summation limits.
 */
export async function approachAInline(formula: string): Promise<SpikeResult> {
  const start = performance.now();
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.background = 'white';
  host.style.padding = '16px';
  try {
    host.innerHTML = katex.renderToString(formula, {
      throwOnError: false,
      output: 'html',
    });
    document.body.appendChild(host);

    const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
    await pdf.html(host, { x: 20, y: 20, width: 400, windowWidth: 600 });
    const blob = pdf.output('blob');
    return {
      approach: 'A-inline-html2canvas',
      formula,
      bytesInPdf: blob.size,
      renderMs: performance.now() - start,
      error: '',
    };
  } catch (e) {
    return {
      approach: 'A-inline-html2canvas',
      formula,
      bytesInPdf: 0,
      renderMs: performance.now() - start,
      error: e instanceof Error ? e.stack ?? e.message : String(e),
    };
  } finally {
    host.remove();
  }
}

/**
 * Approach B (recommended by 04-RESEARCH.md): render KaTeX to a DOM node,
 * pre-rasterize via `html-to-image` `toPng()`, then embed the PNG as an
 * <img> in the PDF host element. Because the math is already a pixel buffer
 * by the time jspdf/html2canvas see it, there is nothing to misalign.
 *
 * This is the production path if the spike validates it.
 */
export async function approachBPrerasterize(formula: string): Promise<SpikeResult> {
  const start = performance.now();
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.background = 'white';
  host.style.padding = '16px';
  host.style.fontSize = '18px';
  try {
    host.innerHTML = katex.renderToString(formula, { throwOnError: false, output: 'html' });
    document.body.appendChild(host);

    const pngDataUrl = await toPng(host, { pixelRatio: 2, backgroundColor: 'white' });

    // Now mount a wrapper <img> and let jspdf.html rasterize a trivial img tag.
    const wrapper = document.createElement('div');
    wrapper.style.padding = '16px';
    const img = document.createElement('img');
    img.src = pngDataUrl;
    img.style.display = 'block';
    wrapper.appendChild(img);
    document.body.appendChild(wrapper);

    const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
    await pdf.html(wrapper, { x: 20, y: 20, width: 400, windowWidth: 600 });
    const blob = pdf.output('blob');
    wrapper.remove();
    return {
      approach: 'B-pre-rasterize-png',
      formula,
      bytesInPdf: blob.size,
      renderMs: performance.now() - start,
      error: '',
    };
  } catch (e) {
    return {
      approach: 'B-pre-rasterize-png',
      formula,
      bytesInPdf: 0,
      renderMs: performance.now() - start,
      error: e instanceof Error ? e.stack ?? e.message : String(e),
    };
  } finally {
    host.remove();
  }
}

/**
 * Approach C (fallback): render KaTeX to SVG via `html-to-image` `toSvg()`,
 * then embed the SVG string. jspdf's SVG support is limited but the KaTeX
 * output is simple enough that it *may* round-trip — this approach is the
 * backup if PNG rasterisation is too lossy at small font sizes.
 */
export async function approachCSvgEmbed(formula: string): Promise<SpikeResult> {
  const start = performance.now();
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.background = 'white';
  host.style.padding = '16px';
  host.style.fontSize = '18px';
  try {
    host.innerHTML = katex.renderToString(formula, { throwOnError: false, output: 'html' });
    document.body.appendChild(host);

    const svgDataUrl = await toSvg(host);
    const wrapper = document.createElement('div');
    const img = document.createElement('img');
    img.src = svgDataUrl;
    wrapper.appendChild(img);
    document.body.appendChild(wrapper);

    const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
    await pdf.html(wrapper, { x: 20, y: 20, width: 400, windowWidth: 600 });
    const blob = pdf.output('blob');
    wrapper.remove();
    return {
      approach: 'C-svg-embed',
      formula,
      bytesInPdf: blob.size,
      renderMs: performance.now() - start,
      error: '',
    };
  } catch (e) {
    return {
      approach: 'C-svg-embed',
      formula,
      bytesInPdf: 0,
      renderMs: performance.now() - start,
      error: e instanceof Error ? e.stack ?? e.message : String(e),
    };
  } finally {
    host.remove();
  }
}

/** Run all three approaches against all test formulas and return a results table. */
export async function runKatexSpike(): Promise<SpikeResult[]> {
  const results: SpikeResult[] = [];
  for (const formula of TEST_FORMULAS) {
    results.push(await approachAInline(formula));
    results.push(await approachBPrerasterize(formula));
    results.push(await approachCSvgEmbed(formula));
  }
  // eslint-disable-next-line no-console
  console.table(results.map((r) => ({
    approach: r.approach,
    formula: r.formula,
    bytesInPdf: r.bytesInPdf,
    renderMs: Math.round(r.renderMs),
    error: r.error ? r.error.slice(0, 40) : 'ok',
  })));
  return results;
}
