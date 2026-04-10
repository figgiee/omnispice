import { rasterizeKatexBatch } from './katexRasterize';
import type { MeasurementRow, PaperSize, ReportData, WaveformSectionItem } from './types';

/**
 * Compose a ReportData payload from raw inputs.
 *
 * Call sites:
 *   - ReportPreviewPage  — pass the live React Flow container element and
 *                           the uPlot canvas elements, plus any measurements.
 *   - /reports/sample    — synthetic fixture baked in at the route.
 *
 * This helper MUST be called before ReportLayout is rendered into the
 * PDF host DOM — the schematic and waveforms must already be pixel
 * buffers by the time jsPDF paints (see 04-KATEX-SPIKE.md Approach B).
 */
export async function buildReportData(opts: {
  schematicDataUrl: string;
  schematicCaption?: string;
  waveformCanvases: Array<HTMLCanvasElement | { dataUrl: string; caption: string }>;
  title: string;
  author: string;
  measurements: Array<
    Omit<MeasurementRow, 'formulaImageDataUrl'> & { tex?: string }
  >;
  annotations: string;
  course?: string;
  date?: string;
  paperSize?: PaperSize;
  labCheckpoints?: ReportData['sections']['labCheckpoints'];
}): Promise<ReportData> {
  const paperSize: PaperSize = opts.paperSize ?? defaultPaperSizeForLocale();

  const waveforms: WaveformSectionItem[] = opts.waveformCanvases.map((entry, i) => {
    if (entry instanceof HTMLCanvasElement) {
      return {
        imageDataUrl: entry.toDataURL('image/png'),
        caption: `Waveform ${i + 1}`,
      };
    }
    return { imageDataUrl: entry.dataUrl, caption: entry.caption };
  });

  // Pre-rasterize KaTeX formulas in parallel (Approach B from the spike).
  const texSources = opts.measurements.map((m) => m.tex ?? '');
  const pngs = texSources.some((t) => t.length > 0)
    ? await rasterizeKatexBatch(texSources.map((t) => (t.length > 0 ? t : ' ')))
    : [];

  const measurements: MeasurementRow[] = opts.measurements.map((m, i) => ({
    ...m,
    formulaImageDataUrl: m.tex ? pngs[i] : undefined,
  }));

  return {
    title: opts.title,
    author: opts.author,
    date: opts.date ?? new Date().toISOString(),
    course: opts.course,
    paperSize,
    sections: {
      schematic: {
        imageDataUrl: opts.schematicDataUrl,
        caption: opts.schematicCaption,
      },
      waveforms,
      measurements,
      annotations: opts.annotations,
      labCheckpoints: opts.labCheckpoints,
    },
  };
}

export function defaultPaperSizeForLocale(): PaperSize {
  if (typeof navigator === 'undefined') return 'letter';
  const lang = (navigator.language ?? '').toLowerCase();
  // US, Canada, Mexico, Philippines ship letter; the rest of the world
  // uses A4. We key off en-US as the canonical letter locale.
  if (lang.startsWith('en-us') || lang.startsWith('en-ca')) return 'letter';
  return 'a4';
}
