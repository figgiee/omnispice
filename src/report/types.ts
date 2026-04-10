/**
 * ReportData — canonical shape consumed by ReportLayout, exportPdf, and exportLatex.
 *
 * Shape is nested under `sections` to match the authoritative red test in
 * src/report/__tests__/exportLatex.test.ts (Wave 0 scaffold). The plan
 * 04-06 draft used a flat layout; the red test shape wins per TDD.
 */

export type PaperSize = 'letter' | 'a4';

export interface SchematicSectionData {
  /** PNG data URL produced via the Phase 2 export path (html-to-image). */
  imageDataUrl: string;
  caption?: string;
}

export interface WaveformSectionItem {
  /** PNG data URL produced via uPlot canvas.toDataURL('image/png'). */
  imageDataUrl: string;
  caption: string;
}

export interface MeasurementRow {
  name: string;
  expected: number | string;
  measured: number | string;
  delta: string;
  /** Optional pre-rasterized KaTeX PNG data URL for a formula column. */
  formulaImageDataUrl?: string;
  /** Raw LaTeX source — used by exportLatex for math-mode insertion. */
  tex?: string;
}

export interface LabCheckpointResult {
  stepTitle: string;
  label: string;
  status: 'pass' | 'partial' | 'fail';
}

export interface ReportSections {
  schematic: SchematicSectionData;
  waveforms: WaveformSectionItem[];
  measurements: MeasurementRow[];
  /** Markdown source rendered via marked + DOMPurify. */
  annotations: string;
  labCheckpoints?: LabCheckpointResult[];
}

export interface ReportData {
  title: string;
  author: string;
  /** ISO date string. */
  date?: string;
  course?: string;
  paperSize?: PaperSize;
  sections: ReportSections;
}
