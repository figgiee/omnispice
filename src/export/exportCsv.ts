import type { VectorData } from '@/simulation/protocol';

/**
 * Export simulation results as CSV.
 * Columns: one per VectorData entry (name as header).
 * Rows: one per sample index.
 * Only Float64 values — no escaping needed.
 */
export function exportWaveformAsCsv(
  vectors: VectorData[],
  filename = 'waveform.csv',
): void {
  if (!vectors.length) return;

  const length = vectors[0]!.data.length;
  const headers = vectors.map((v) => v.name).join(',');

  const rows: string[] = [headers];
  for (let i = 0; i < length; i++) {
    const row = vectors.map((v) => v.data[i]?.toString() ?? '').join(',');
    rows.push(row);
  }

  const csv = rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}
