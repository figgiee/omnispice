import JSZip from 'jszip';
import type { ReportData } from './types';

/**
 * LaTeX special-character escape table. Covers the characters that
 * pdflatex interprets specially inside `\text{}` and body text.
 *
 * NOTE: the `\` character must be replaced FIRST so we don't double-
 * escape subsequent substitutions. We handle this by building the
 * result via a single regex with a lookup table rather than chained
 * .replace() calls.
 */
const LATEX_ESCAPES: Record<string, string> = {
  '&': '\\&',
  '%': '\\%',
  $: '\\$',
  '#': '\\#',
  _: '\\_',
  '{': '\\{',
  '}': '\\}',
  '~': '\\textasciitilde{}',
  '^': '\\textasciicircum{}',
  '\\': '\\textbackslash{}',
};

/**
 * Escape LaTeX-special characters in user-supplied text.
 *
 * IMPORTANT: only call on plain-text fields (title, author, course,
 * measurement labels, sanitised annotations). Do NOT call on raw
 * LaTeX formula sources — those must be inserted verbatim inside
 * math-mode delimiters.
 */
export function escapeLatex(input: string): string {
  if (!input) return '';
  return input.replace(/[\\&%$#_{}~^]/g, (ch) => LATEX_ESCAPES[ch] ?? ch);
}

/**
 * Input shape consumed by the public exportReportAsLatexZip /
 * buildLatexZipBlob functions. Broader than ReportData because the
 * Wave 0 red test fixture uses a subset (no paperSize, plain numeric
 * measurements, single schematic imageDataUrl).
 */
export interface LatexReportInput {
  title: string;
  author: string;
  course?: string;
  date?: string;
  sections: {
    schematic: { imageDataUrl: string; caption?: string };
    waveforms: Array<{ imageDataUrl: string; caption: string }>;
    measurements: Array<{
      name: string;
      expected: number | string;
      measured: number | string;
      delta: string;
      tex?: string;
      formulaImageDataUrl?: string;
    }>;
    annotations: string;
  };
}

/**
 * Render the .tex source string. Uses simple article class + graphicx
 * so the emitted file compiles with a stock `pdflatex`.
 */
export function renderLatex(data: LatexReportInput): string {
  const title = escapeLatex(data.title);
  const author = escapeLatex(data.author);
  const course = data.course ? escapeLatex(data.course) : '';
  const date = data.date ?? '\\today';

  const measurementsRows = data.sections.measurements
    .map((m) => {
      const name = escapeLatex(m.name);
      const expected = escapeLatex(String(m.expected));
      const measured = escapeLatex(String(m.measured));
      const delta = escapeLatex(m.delta);
      return `    ${name} & ${expected} & ${measured} & ${delta} \\\\`;
    })
    .join('\n');

  const waveformFigures = data.sections.waveforms
    .map((w, i) => {
      const caption = escapeLatex(w.caption);
      return `\\begin{figure}[h]
  \\centering
  \\includegraphics[width=0.8\\linewidth]{figures/waveform-${i + 1}.png}
  \\caption{${caption}}
\\end{figure}`;
    })
    .join('\n\n');

  // Annotations are treated as plain-text paragraphs. We escape them
  // wholesale — any markdown formatting is intentionally flattened
  // because the LaTeX export is a "compilable deliverable", not a
  // full markdown-to-LaTeX translation layer.
  const annotations = escapeLatex(data.sections.annotations || '');

  const schematicCaption = escapeLatex(data.sections.schematic.caption ?? 'Circuit schematic.');

  return `\\documentclass[11pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage{graphicx}
\\usepackage{amsmath}
\\usepackage{booktabs}
\\usepackage[margin=1in]{geometry}

\\title{${title}}
\\author{${author}${course ? ` \\\\ ${course}` : ''}}
\\date{${date}}

\\begin{document}
\\maketitle

\\section{Schematic}
\\begin{figure}[h]
  \\centering
  \\includegraphics[width=0.7\\linewidth]{figures/schematic.png}
  \\caption{${schematicCaption}}
\\end{figure}

\\section{Waveforms}
${waveformFigures || '% No waveforms captured.'}

\\section{Measurements}
\\begin{tabular}{llll}
  \\toprule
  Metric & Expected & Measured & $\\Delta$ \\\\
  \\midrule
${measurementsRows || '    % no measurements'}
  \\bottomrule
\\end{tabular}

\\section{Annotations}
${annotations || '% No annotations.'}

\\end{document}
`;
}

/**
 * Build a JSZip blob containing report.tex, figures/*.png, and a
 * README.md explaining how to compile the archive.
 */
export async function buildLatexZipBlob(data: LatexReportInput): Promise<Blob> {
  const zip = new JSZip();
  zip.file('report.tex', renderLatex(data));

  const figures = zip.folder('figures');
  if (!figures) {
    throw new Error('Failed to create figures folder in zip');
  }

  figures.file('schematic.png', dataUrlToUint8(data.sections.schematic.imageDataUrl));

  data.sections.waveforms.forEach((w, i) => {
    figures.file(`waveform-${i + 1}.png`, dataUrlToUint8(w.imageDataUrl));
  });

  data.sections.measurements.forEach((m, i) => {
    if (m.formulaImageDataUrl) {
      figures.file(`measurement-${i + 1}.png`, dataUrlToUint8(m.formulaImageDataUrl));
    }
  });

  zip.file(
    'README.md',
    `# ${data.title}

Compile with \`pdflatex report.tex\` (run twice for references).

Figures are in \`figures/\`.
`,
  );

  return zip.generateAsync({ type: 'blob' });
}

/**
 * Browser entry point: build the zip and trigger a download.
 */
export async function exportReportAsLatexZip(data: LatexReportInput): Promise<Blob> {
  const blob = await buildLatexZipBlob(data);
  if (typeof document !== 'undefined' && typeof (document as unknown as { fonts?: unknown }).fonts !== 'undefined') {
    triggerDownload(blob, `${slugifyFilename(data.title)}.zip`);
  }
  return blob;
}

function slugifyFilename(title: string): string {
  return title.replace(/\W+/g, '-').replace(/^-+|-+$/g, '') || 'report';
}

function triggerDownload(blob: Blob, filename: string): void {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    /* best-effort */
  }
}

/**
 * Decode a `data:image/...;base64,XXXX` data URL into a Uint8Array
 * suitable for JSZip.file. Falls back to an empty array on malformed
 * input so the zip still assembles (pdflatex will warn on the
 * missing figure but the archive itself is still valid).
 */
function dataUrlToUint8(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return new Uint8Array(0);
  const base64 = dataUrl.slice(comma + 1);
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }
  // Node fallback — reachable from vitest when atob is not polyfilled.
  // biome-ignore lint/suspicious/noGlobalIsNan: Buffer is a Node global.
  const b: { from: (s: string, enc: string) => Uint8Array } | undefined = (
    globalThis as { Buffer?: { from: (s: string, enc: string) => Uint8Array } }
  ).Buffer;
  if (b) return b.from(base64, 'base64');
  return new Uint8Array(0);
}
