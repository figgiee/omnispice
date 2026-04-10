import { forwardRef } from 'react';
import { AnnotationsSection } from './sections/AnnotationsSection';
import { MeasurementsSection } from './sections/MeasurementsSection';
import { SchematicSection } from './sections/SchematicSection';
import { WaveformSection } from './sections/WaveformSection';
import type { ReportData } from './types';

/**
 * ReportLayout — shared DOM for both on-screen preview AND jsPDF
 * rendering. WYSIWYG guarantee: what the student sees is what the
 * PDF looks like. Pure presentation, no live state, no live
 * React Flow / uPlot.
 *
 * Width is pinned to the paper size in px so jsPDF can measure
 * deterministically (letter = 612pt, a4 ≈ 595pt at 72dpi).
 */
export const ReportLayout = forwardRef<HTMLDivElement, { data: ReportData }>(
  function ReportLayout({ data }, ref) {
    const widthPx = data.paperSize === 'a4' ? 595 : 612;

    return (
      <div
        ref={ref}
        className="report-layout"
        data-testid="report-layout"
        style={{
          width: widthPx,
          margin: '0 auto',
          padding: 40,
          background: '#ffffff',
          color: '#24292f',
          fontFamily:
            '"Times New Roman", Times, Georgia, "Liberation Serif", serif',
          fontSize: 13,
          lineHeight: 1.4,
          boxSizing: 'border-box',
        }}
      >
        <ReportHeader data={data} />
        <SchematicSection data={data.sections.schematic} />
        <WaveformSection waveforms={data.sections.waveforms} />
        <MeasurementsSection measurements={data.sections.measurements} />
        <AnnotationsSection markdown={data.sections.annotations} />
        {data.sections.labCheckpoints && data.sections.labCheckpoints.length > 0 ? (
          <LabCheckpointSummary checkpoints={data.sections.labCheckpoints} />
        ) : null}
      </div>
    );
  },
);

function ReportHeader({ data }: { data: ReportData }) {
  const dateText = data.date ? formatDate(data.date) : '';
  return (
    <header
      className="report-header"
      style={{ borderBottom: '2px solid #24292f', paddingBottom: 12, marginBottom: 16 }}
    >
      <h1 style={{ margin: 0, fontSize: 22 }}>{data.title}</h1>
      <p className="report-meta" style={{ margin: '4px 0 0', fontSize: 12, color: '#57606a' }}>
        Student: {data.author}
        {data.course ? ` · Course: ${data.course}` : ''}
        {dateText ? ` · Date: ${dateText}` : ''}
      </p>
    </header>
  );
}

function LabCheckpointSummary({
  checkpoints,
}: {
  checkpoints: NonNullable<ReportData['sections']['labCheckpoints']>;
}) {
  return (
    <section className="report-lab-checkpoints" data-section="lab-checkpoints">
      <h2>5. Lab Checkpoints</h2>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
        <thead>
          <tr>
            <th style={checkThStyle}>Step</th>
            <th style={checkThStyle}>Checkpoint</th>
            <th style={checkThStyle}>Status</th>
          </tr>
        </thead>
        <tbody>
          {checkpoints.map((c, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: presentational list
            <tr key={i}>
              <td style={checkTdStyle}>{c.stepTitle}</td>
              <td style={checkTdStyle}>{c.label}</td>
              <td style={checkTdStyle}>
                <span style={{ color: statusColor(c.status), fontWeight: 600 }}>
                  {c.status.toUpperCase()}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function statusColor(status: 'pass' | 'partial' | 'fail'): string {
  if (status === 'pass') return '#1a7f37';
  if (status === 'partial') return '#9a6700';
  return '#cf222e';
}

function formatDate(iso: string): string {
  // Render an ISO date as YYYY-MM-DD. Deterministic so Playwright
  // visual regression is stable across machines / timezones.
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1]! : iso;
}

const checkThStyle: React.CSSProperties = {
  borderBottom: '2px solid #24292f',
  padding: '6px 8px',
  textAlign: 'left',
  fontWeight: 600,
};

const checkTdStyle: React.CSSProperties = {
  borderBottom: '1px solid #d0d7de',
  padding: '6px 8px',
  textAlign: 'left',
};
