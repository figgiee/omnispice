import type { MeasurementRow } from '../types';

/**
 * Renders a measurements table. The formula column uses the
 * pre-rasterized KaTeX PNG from buildReportData — NOT a live KaTeX
 * DOM node (Pitfall 2).
 */
export function MeasurementsSection({ measurements }: { measurements: MeasurementRow[] }) {
  if (measurements.length === 0) {
    return (
      <section className="report-measurements" data-section="measurements">
        <h2>3. Measurements</h2>
        <p style={{ fontStyle: 'italic', color: '#57606a' }}>
          No measurements recorded.
        </p>
      </section>
    );
  }

  const hasFormulas = measurements.some((m) => !!m.formulaImageDataUrl);

  return (
    <section className="report-measurements" data-section="measurements">
      <h2>3. Measurements</h2>
      <table
        style={{
          borderCollapse: 'collapse',
          width: '100%',
          fontSize: 13,
        }}
      >
        <thead>
          <tr>
            <th style={thStyle}>Metric</th>
            {hasFormulas ? <th style={thStyle}>Formula</th> : null}
            <th style={thStyle}>Expected</th>
            <th style={thStyle}>Measured</th>
            <th style={thStyle}>Δ</th>
          </tr>
        </thead>
        <tbody>
          {measurements.map((m, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: presentational list
            <tr key={i}>
              <td style={tdStyle}>{m.name}</td>
              {hasFormulas ? (
                <td style={tdStyle}>
                  {m.formulaImageDataUrl ? (
                    <img
                      src={m.formulaImageDataUrl}
                      alt={m.tex ?? m.name}
                      style={{ height: 24, verticalAlign: 'middle' }}
                    />
                  ) : null}
                </td>
              ) : null}
              <td style={tdStyle}>{String(m.expected)}</td>
              <td style={tdStyle}>{String(m.measured)}</td>
              <td style={tdStyle}>{m.delta}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

const thStyle: React.CSSProperties = {
  borderBottom: '2px solid #24292f',
  padding: '6px 8px',
  textAlign: 'left',
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  borderBottom: '1px solid #d0d7de',
  padding: '6px 8px',
  textAlign: 'left',
};
