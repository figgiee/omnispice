import { describe, it, expect, beforeEach } from 'vitest';
// RED — src/report/exportPdf lands in 04-06.
// @ts-expect-error — module does not exist yet (Wave 0 scaffold).
import { exportReportAsPdf } from '../exportPdf';

async function blobHeadBytes(blob: Blob, n: number): Promise<string> {
  const buf = await blob.slice(0, n).arrayBuffer();
  return new TextDecoder('ascii').decode(buf);
}

describe('report/exportPdf — RPT-01 PDF export', () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    host = document.createElement('div');
    host.innerHTML = '<section><h1>Report</h1><p>Body</p></section>';
    document.body.appendChild(host);
  });

  it('returns a non-empty Blob', async () => {
    const blob = await exportReportAsPdf(host, 'lab.pdf');
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('PDF blob begins with %PDF- magic bytes', async () => {
    const blob = await exportReportAsPdf(host, 'lab.pdf');
    const head = await blobHeadBytes(blob, 5);
    expect(head).toBe('%PDF-');
  });

  it('multi-page: content exceeding one page produces 2+ pages', async () => {
    const big = document.createElement('div');
    big.style.height = '3000px';
    for (let i = 0; i < 50; i++) {
      const p = document.createElement('p');
      p.textContent = `Line ${i} — very long content meant to push overflow.`;
      big.appendChild(p);
    }
    document.body.appendChild(big);
    const blob = await exportReportAsPdf(big, 'big.pdf');
    const txt = await blob.text();
    const endobjCount = (txt.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    expect(endobjCount).toBeGreaterThanOrEqual(2);
  });

  it('succeeds for both paper size a4 and letter', async () => {
    const a4 = await exportReportAsPdf(host, 'lab.pdf', { paperSize: 'a4' });
    const letter = await exportReportAsPdf(host, 'lab.pdf', { paperSize: 'letter' });
    expect(a4.size).toBeGreaterThan(0);
    expect(letter.size).toBeGreaterThan(0);
  });
});
