/**
 * MeasurementCalloutLayer — renders user-placed measurement annotation
 * callouts in the waveform panel. Each callout shows a label, value, and
 * unit, with a remove button to clear it from the session.
 */

import { useReportAnnotationsStore } from '@/store/reportAnnotationsStore';
import styles from './MeasurementCalloutLayer.module.css';

export function MeasurementCalloutLayer() {
  const { annotations, removeAnnotation } = useReportAnnotationsStore();
  if (annotations.length === 0) return null;
  return (
    <div className={styles.layer} aria-label="Measurement annotations">
      {annotations.map((a) => (
        <div key={a.id} className={styles.callout}>
          <span>
            {a.label}: {a.value.toPrecision(4)} {a.unit}
          </span>
          <button
            onClick={() => removeAnnotation(a.id)}
            aria-label="Remove annotation"
            type="button"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
