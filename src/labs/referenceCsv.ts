/**
 * Reference waveform CSV parser for LAB-03.
 *
 * Parses a 2-column CSV (time,value) into a pair of Float64Arrays so the
 * waveform_match evaluator can feed them to rmse/maxAbs without further
 * allocation. Accepts an optional header row — if the first row is
 * non-numeric, it's skipped.
 *
 * Deliberately minimal: no streaming, no quoting, no multi-column support.
 * Reference CSVs are authored by the lab's instructor via ngspice browser
 * export, so the format is tightly controlled.
 */

export interface ReferenceWaveform {
  time: Float64Array;
  /** Value column. Named `value` (singular) to match the evaluator context. */
  value: Float64Array;
}

/**
 * Parse a CSV body into a ReferenceWaveform.
 *
 * Throws `Error` on malformed rows — authors should see failures at
 * upload time (in the lab editor, 04-05), not silently during student
 * evaluation.
 */
export function parseReferenceCsv(text: string): ReferenceWaveform {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { time: new Float64Array(0), value: new Float64Array(0) };
  }

  // Detect and skip a header row: first line has at least one non-numeric
  // cell. We don't assume "time,value" literally — the user might use
  // "t,v(out)" or similar.
  let startIdx = 0;
  const firstLine = lines[0] ?? '';
  const firstCells = firstLine.split(',').map((c) => c.trim());
  const firstIsHeader = firstCells.some((c) => c !== '' && !Number.isFinite(Number(c)));
  if (firstIsHeader) startIdx = 1;

  const dataLines = lines.slice(startIdx);
  const time = new Float64Array(dataLines.length);
  const value = new Float64Array(dataLines.length);

  for (let i = 0; i < dataLines.length; i++) {
    const row = dataLines[i] ?? '';
    const cells = row.split(',').map((c) => c.trim());
    if (cells.length < 2) {
      throw new Error(`parseReferenceCsv: row ${i + startIdx} has fewer than 2 columns`);
    }
    const t = Number(cells[0]);
    const v = Number(cells[1]);
    if (!Number.isFinite(t) || !Number.isFinite(v)) {
      throw new Error(
        `parseReferenceCsv: row ${i + startIdx} has non-numeric cell(s): "${row}"`,
      );
    }
    time[i] = t;
    value[i] = v;
  }

  return { time, value };
}
