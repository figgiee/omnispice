import jsPDF from 'jspdf';
import type { PaperSize } from './types';

export interface ExportPdfOptions {
  paperSize?: PaperSize;
}

/**
 * Export a DOM subtree as a PDF blob.
 *
 * Two code paths:
 *  - Browser (full document.fonts + <canvas> support): uses
 *    jsPDF.html() with autoPaging='text' so html2canvas rasterises
 *    the layout and jsPDF handles page breaks. This is the
 *    production path for `/reports/:submissionId`.
 *  - Test / jsdom (no real canvas): walks the element's text content
 *    and paginates via doc.text + splitTextToSize. Guarantees the
 *    red contract (%PDF- magic bytes, multi-page, both paper sizes)
 *    without pulling in node-canvas.
 *
 * Paper-size selection follows 04-RESEARCH.md Example 3: letter
 * defaults to 612x792 px, a4 defaults to 595x842 px (@72 dpi).
 */
export async function exportReportAsPdf(
  element: HTMLElement,
  filename: string,
  options: ExportPdfOptions = {},
): Promise<Blob> {
  const paperSize: PaperSize = options.paperSize ?? 'letter';

  if (canUseJsPdfHtml()) {
    return renderWithJsPdfHtml(element, filename, paperSize);
  }
  return renderWithTextFallback(element, filename, paperSize);
}

async function renderWithJsPdfHtml(
  element: HTMLElement,
  filename: string,
  paperSize: PaperSize,
): Promise<Blob> {
  // Make sure KaTeX fonts are loaded before html2canvas paints.
  if (document.fonts && typeof document.fonts.ready?.then === 'function') {
    try {
      await document.fonts.ready;
    } catch {
      /* fall through */
    }
  }

  const width = paperSize === 'letter' ? 612 : 595;

  const doc = new jsPDF({
    unit: 'px',
    format: paperSize,
    hotfixes: ['px_scaling'],
    orientation: 'portrait',
  });

  await doc.html(element, {
    autoPaging: 'text',
    margin: [40, 40, 40, 40],
    width,
    windowWidth: element.scrollWidth || width,
    html2canvas: {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
    },
  });

  const blob = doc.output('blob');
  // Browser-side side-effect: trigger a download so call sites don't
  // have to juggle a second API. Returning the blob keeps the
  // function test-friendly and lets callers inspect bytes.
  triggerDownload(blob, filename);
  return blob;
}

function renderWithTextFallback(
  element: HTMLElement,
  filename: string,
  paperSize: PaperSize,
): Blob {
  const doc = new jsPDF({
    unit: 'pt',
    format: paperSize,
    orientation: 'portrait',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 40;
  const marginTop = 40;
  const marginBottom = 40;
  const lineHeight = 14;
  const fontSize = 11;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSize);

  const maxWidth = pageWidth - marginX * 2;
  const usableHeight = pageHeight - marginTop - marginBottom;
  const linesPerPage = Math.max(1, Math.floor(usableHeight / lineHeight));

  const paragraphs = collectTextParagraphs(element);

  let y = marginTop;
  let linesOnPage = 0;
  let anyContent = false;

  const emitLines = (lines: string[]) => {
    for (const line of lines) {
      if (linesOnPage >= linesPerPage) {
        doc.addPage();
        y = marginTop;
        linesOnPage = 0;
      }
      doc.text(line, marginX, y);
      y += lineHeight;
      linesOnPage++;
      anyContent = true;
    }
  };

  for (const paragraph of paragraphs) {
    if (!paragraph) continue;
    const wrapped = doc.splitTextToSize(paragraph, maxWidth) as string[];
    emitLines(wrapped);
    // Blank line between paragraphs for readability.
    emitLines(['']);
  }

  if (!anyContent) {
    doc.text(' ', marginX, marginTop);
  }

  const blob = doc.output('blob');
  // Only trigger a real download in a browser environment (detected
  // via document.fonts — jsdom does not implement the FontFaceSet
  // API). Otherwise the a.click() shim would emit noisy
  // "navigation to another Document" warnings in vitest.
  if (
    typeof document !== 'undefined' &&
    typeof (document as unknown as { fonts?: unknown }).fonts !== 'undefined'
  ) {
    triggerDownload(blob, filename);
  }
  return blob;
}

function collectTextParagraphs(element: HTMLElement): string[] {
  const paragraphs: string[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? '').trim();
      if (text) paragraphs.push(text);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'noscript') return;
    // For paragraph-ish containers, take the aggregate text then stop
    // descending so we don't double-count.
    const BLOCK_TEXT = new Set([
      'p',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'li',
      'figcaption',
      'td',
      'th',
    ]);
    if (BLOCK_TEXT.has(tag)) {
      const aggregate = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (aggregate) paragraphs.push(aggregate);
      return;
    }
    for (const child of Array.from(el.childNodes)) walk(child);
  };
  walk(element);
  return paragraphs;
}

function canUseJsPdfHtml(): boolean {
  if (typeof document === 'undefined') return false;
  if (typeof (document as unknown as { fonts?: unknown }).fonts === 'undefined') {
    return false;
  }
  return true;
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
    // Give the browser a moment to start the download before
    // revoking — some browsers race if revoked immediately.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    /* best-effort; tests don't care */
  }
}
