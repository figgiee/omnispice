import { useMemo, useRef, useState } from 'react';
import { FALLBACK_PNG_DATA_URL } from '../report/katexRasterize';
import { ReportLayout } from '../report/ReportLayout';
import { exportReportAsLatexZip } from '../report/exportLatex';
import { exportReportAsPdf } from '../report/exportPdf';
import type { PaperSize, ReportData } from '../report/types';

interface Props {
  submissionId: string;
}

/**
 * Report preview + export surface. Two modes:
 *
 *  - submissionId === 'sample'  → hard-coded deterministic ReportData
 *    backing the Playwright visual regression baseline and the manual
 *    PDF academic-quality verification checkpoint (Task 5).
 *
 *  - any other submissionId     → placeholder until the submissions
 *    → ReportData pipeline lands (tracked as a follow-up). For now
 *    we still render the layout using the sample fixture so the
 *    export buttons are exercised.
 */
export function ReportPreviewPage({ submissionId }: Props) {
  const [paperSize, setPaperSize] = useState<PaperSize>('letter');
  const layoutRef = useRef<HTMLDivElement>(null);

  const reportData = useMemo<ReportData>(() => {
    const base = buildSampleReportData();
    return { ...base, paperSize };
  }, [paperSize]);

  const handleExportPdf = async () => {
    if (!layoutRef.current) return;
    await exportReportAsPdf(
      layoutRef.current,
      `${slugify(reportData.title)}.pdf`,
      { paperSize },
    );
  };

  const handleExportLatex = async () => {
    await exportReportAsLatexZip(reportData);
  };

  return (
    <div
      className="report-preview-page"
      style={{
        minHeight: '100vh',
        background: '#f6f8fa',
        padding: 24,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginBottom: 16,
          maxWidth: 820,
          marginInline: 'auto',
        }}
      >
        <h1 style={{ fontSize: 20, margin: 0, flex: 1 }}>
          Lab Report Preview {submissionId !== 'sample' ? `· ${submissionId}` : ''}
        </h1>
        <label style={{ fontSize: 13 }}>
          Paper:&nbsp;
          <select
            value={paperSize}
            onChange={(e) => setPaperSize(e.target.value as PaperSize)}
            data-testid="paper-size-select"
          >
            <option value="letter">US Letter</option>
            <option value="a4">A4</option>
          </select>
        </label>
        <button
          type="button"
          onClick={handleExportPdf}
          data-testid="export-pdf-button"
          style={buttonStyle}
        >
          Export PDF
        </button>
        <button
          type="button"
          onClick={handleExportLatex}
          data-testid="export-latex-button"
          style={buttonStyle}
        >
          Export LaTeX (ZIP)
        </button>
      </header>

      <div
        style={{
          background: '#ffffff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          maxWidth: 820,
          marginInline: 'auto',
          padding: 0,
        }}
      >
        <ReportLayout data={reportData} ref={layoutRef} />
      </div>
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: 13,
  border: '1px solid #d0d7de',
  borderRadius: 6,
  background: '#ffffff',
  cursor: 'pointer',
};

function slugify(s: string): string {
  return s.replace(/\W+/g, '-').replace(/^-+|-+$/g, '') || 'report';
}

/**
 * Deterministic sample ReportData — mirrors
 * tests/report/fixtures/sample-report.html. Dates, measurements and
 * image payloads are all hard-coded so the Playwright visual
 * regression baseline is pixel stable across CI runs.
 */
function buildSampleReportData(): ReportData {
  return {
    title: 'EECS-101 Lab 1 — RC Transient Response',
    author: 'Test Student',
    course: 'Intro Circuits',
    date: '2026-04-10',
    paperSize: 'letter',
    sections: {
      schematic: {
        imageDataUrl: FALLBACK_PNG_DATA_URL,
        caption: 'Figure 1: RC low-pass filter, R = 1 kΩ, C = 1 µF.',
      },
      waveforms: [
        {
          imageDataUrl: FALLBACK_PNG_DATA_URL,
          caption: 'Step response v(out) over 5 ms.',
        },
      ],
      measurements: [
        { name: 'Rise time (10→90%)', expected: '2.2 ms', measured: '2.18 ms', delta: '−0.9%' },
        { name: 'Steady-state v(out)', expected: '5.00 V', measured: '5.00 V', delta: '0.0%' },
        { name: 'Time constant τ', expected: '1.00 ms', measured: '0.99 ms', delta: '−1.0%' },
      ],
      annotations:
        'The measured rise time agrees with the textbook prediction τ × 2.2. The circuit behaves as a first-order low-pass filter with cutoff f_c ≈ 159 Hz.',
    },
  };
}
