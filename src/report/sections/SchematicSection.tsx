import type { SchematicSectionData } from '../types';

/**
 * Renders the pre-captured schematic PNG.
 *
 * Pitfall 7: Do NOT mount a live React Flow canvas here. The schematic
 * must already be a PNG data URL by the time this component is handed
 * to jsPDF.html().
 */
export function SchematicSection({ data }: { data: SchematicSectionData }) {
  return (
    <section className="report-schematic" data-section="schematic">
      <h2>1. Schematic</h2>
      <figure style={{ margin: 0 }}>
        <img
          src={data.imageDataUrl}
          alt={data.caption ?? 'Schematic'}
          style={{
            display: 'block',
            width: '100%',
            maxWidth: '520px',
            height: 'auto',
            border: '1px solid #d0d7de',
          }}
        />
        {data.caption ? (
          <figcaption style={{ fontSize: 12, color: '#57606a', marginTop: 4 }}>
            {data.caption}
          </figcaption>
        ) : null}
      </figure>
    </section>
  );
}
