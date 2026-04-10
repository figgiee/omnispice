import type { WaveformSectionItem } from '../types';

/**
 * Renders pre-captured waveform PNGs. Each entry is an uPlot canvas
 * that was serialised via `canvas.toDataURL('image/png')` in
 * buildReportData — this component is pure presentation.
 */
export function WaveformSection({ waveforms }: { waveforms: WaveformSectionItem[] }) {
  if (waveforms.length === 0) {
    return (
      <section className="report-waveforms" data-section="waveforms">
        <h2>2. Waveforms</h2>
        <p style={{ fontStyle: 'italic', color: '#57606a' }}>
          No waveforms captured.
        </p>
      </section>
    );
  }

  return (
    <section className="report-waveforms" data-section="waveforms">
      <h2>2. Waveforms</h2>
      {waveforms.map((w, i) => (
        <figure
          // Index keys are acceptable here: waveforms order is stable
          // for the duration of a single ReportLayout render.
          // biome-ignore lint/suspicious/noArrayIndexKey: presentational list
          key={i}
          style={{ margin: '12px 0' }}
        >
          <img
            src={w.imageDataUrl}
            alt={w.caption}
            style={{
              display: 'block',
              width: '100%',
              maxWidth: '520px',
              height: 'auto',
              border: '1px solid #d0d7de',
            }}
          />
          <figcaption style={{ fontSize: 12, color: '#57606a', marginTop: 4 }}>
            Figure {i + 2}: {w.caption}
          </figcaption>
        </figure>
      ))}
    </section>
  );
}
