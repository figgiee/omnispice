import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
// RED — src/report/exportLatex lands in 04-06.
// @ts-expect-error — module does not exist yet (Wave 0 scaffold).
import { exportReportAsLatexZip } from '../exportLatex';

describe('report/exportLatex — RPT-02 LaTeX zip export', () => {
  const sampleReportData = {
    title: 'RC Transient & Response',
    author: 'Test_Student #1',
    sections: {
      schematic: { imageDataUrl: 'data:image/png;base64,iVBORw0KGgo=' },
      waveforms: [{ imageDataUrl: 'data:image/png;base64,iVBORw0KGgo=', caption: 'v(out)' }],
      measurements: [{ name: 'τ', expected: 1, measured: 0.99, delta: '-1%' }],
      annotations: 'Agrees with theory.',
    },
  };

  it('returns a Blob (zip container)', async () => {
    const blob = await exportReportAsLatexZip(sampleReportData);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('zip contains report.tex, figures/schematic.png, figures/waveform-1.png, README.md', async () => {
    const blob = await exportReportAsLatexZip(sampleReportData);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(zip.file('report.tex')).not.toBeNull();
    expect(zip.file('figures/schematic.png')).not.toBeNull();
    expect(zip.file('figures/waveform-1.png')).not.toBeNull();
    expect(zip.file('README.md')).not.toBeNull();
  });

  it('report.tex escapes LaTeX-special characters in title and author', async () => {
    const blob = await exportReportAsLatexZip(sampleReportData);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const tex = await zip.file('report.tex')!.async('string');
    // & must become \&, # must become \#, _ must become \_
    expect(tex).toContain('RC Transient \\& Response');
    expect(tex).toContain('Test\\_Student \\#1');
  });
});
