/**
 * ngspice stdout output parser.
 *
 * Parses the text output from ngspice pipe-mode into typed VectorData
 * arrays. Handles all 4 analysis types: transient, AC, DC operating
 * point, and DC sweep.
 */

import type { AnalysisType } from '../circuit/types';
import type { VectorData } from './protocol';

/**
 * Parse ngspice pipe-mode stdout output into typed VectorData arrays.
 *
 * Format varies by analysis type:
 * - Transient/DC sweep: tab-separated columns with header row
 * - AC: complex number pairs (real + imaginary per signal)
 * - DC op: "node = value" lines
 *
 * @param stdout - Raw stdout text from ngspice
 * @param analysisType - Type of analysis that produced this output
 * @returns Parsed vector data for each signal
 * @throws Error if output format is unrecognizable
 */
export function parseOutput(
  stdout: string,
  analysisType: AnalysisType,
): VectorData[] {
  const trimmed = stdout.trim();
  if (!trimmed) return [];

  if (analysisType === 'dc_op') {
    return parseDCOperatingPoint(trimmed);
  }

  if (analysisType === 'ac') {
    return parseACAnalysis(trimmed);
  }

  // Transient and DC sweep share the same tabular format
  return parseTabular(trimmed, analysisType);
}

/**
 * Convert parallel real and imaginary arrays to magnitude (dB) and phase (degrees).
 *
 * magnitude = 20 * log10(sqrt(re^2 + im^2))  (in dB)
 * phase = atan2(im, re) * (180 / PI)          (in degrees)
 */
export function complexToMagnitudePhase(
  real: Float64Array,
  imaginary: Float64Array,
): { magnitude: Float64Array; phase: Float64Array } {
  const len = real.length;
  const magnitude = new Float64Array(len);
  const phase = new Float64Array(len);

  for (let i = 0; i < len; i++) {
    const re = real[i]!;
    const im = imaginary[i]!;
    const mag = Math.sqrt(re * re + im * im);
    magnitude[i] = 20 * Math.log10(mag);
    phase[i] = Math.atan2(im, re) * (180 / Math.PI);
  }

  return { magnitude, phase };
}

/**
 * Parse DC operating point output.
 * Format: "v(node) = 1.23456e+00" per line.
 */
function parseDCOperatingPoint(stdout: string): VectorData[] {
  const lines = stdout.split('\n').filter((line) => line.includes('='));

  if (lines.length === 0) return [];

  return lines.map((line) => {
    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) {
      throw new Error(`Malformed DC op output line: ${line}`);
    }
    const name = line.slice(0, eqIndex).trim();
    const valueStr = line.slice(eqIndex + 1).trim();
    const value = Number.parseFloat(valueStr);

    if (Number.isNaN(value)) {
      throw new Error(
        `Failed to parse DC op value for "${name}": "${valueStr}"`,
      );
    }

    return {
      name,
      data: new Float64Array([value]),
      unit: inferUnit(name),
      isComplex: false,
    };
  });
}

/**
 * Parse AC analysis output with complex number pairs.
 * Produces frequency, magnitude (dB), and phase (degrees) vectors.
 *
 * Input format: tab-separated with complex values as "real,imag".
 * The header has duplicate signal names for real/imag pairs.
 */
function parseACAnalysis(stdout: string): VectorData[] {
  const lines = stdout.split('\n').filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  if (!headerLine) return [];

  const headerParts = headerLine.split('\t').slice(1); // Skip "Index"

  // Validate header
  if (headerParts.length === 0) {
    throw new Error('Malformed AC output: no header columns found');
  }

  const freqName = headerParts[0] ?? 'frequency';
  const numDataRows = lines.length - 1;

  // Frequency vector
  const freqData = new Float64Array(numDataRows);

  // Collect unique signal names (skip frequency and deduplicate)
  const signalNames = new Set<string>();
  for (let i = 1; i < headerParts.length; i++) {
    const name = headerParts[i];
    if (name) signalNames.add(name);
  }

  // For each unique signal, we produce magnitude and phase vectors
  const realArrays = new Map<string, Float64Array>();
  const imagArrays = new Map<string, Float64Array>();
  for (const name of signalNames) {
    realArrays.set(name, new Float64Array(numDataRows));
    imagArrays.set(name, new Float64Array(numDataRows));
  }

  // Parse data rows
  for (let row = 1; row < lines.length; row++) {
    const line = lines[row];
    if (!line) continue;
    const cols = line.split('\t').slice(1); // Skip index

    // First column is frequency
    const freqStr = cols[0];
    if (freqStr) {
      freqData[row - 1] = Number.parseFloat(freqStr);
    }

    // Remaining columns are complex pairs
    let signalIdx = 0;
    const signalNameArray = [...signalNames];
    for (let col = 1; col < cols.length; col++) {
      const val = cols[col];
      const sigName = signalNameArray[signalIdx];
      if (!val || !sigName) continue;

      if (val.includes(',')) {
        const [realStr, imagStr] = val.split(',');
        const realArr = realArrays.get(sigName);
        const imagArr = imagArrays.get(sigName);
        if (realArr) realArr[row - 1] = Number.parseFloat(realStr ?? '0');
        if (imagArr) imagArr[row - 1] = Number.parseFloat(imagStr ?? '0');
      } else {
        const realArr = realArrays.get(sigName);
        if (realArr) realArr[row - 1] = Number.parseFloat(val);
      }
      signalIdx++;
    }
  }

  // Build output vectors
  const vectors: VectorData[] = [];

  // Frequency vector
  vectors.push({
    name: freqName,
    data: freqData,
    unit: 'Hz',
    isComplex: false,
  });

  // For each signal, compute magnitude (dB) and phase (degrees)
  for (const sigName of signalNames) {
    const realArr = realArrays.get(sigName)!;
    const imagArr = imagArrays.get(sigName)!;
    const { magnitude, phase } = complexToMagnitudePhase(realArr, imagArr);

    vectors.push({
      name: `${sigName}_magnitude`,
      data: magnitude,
      unit: 'dB',
      isComplex: false,
    });

    vectors.push({
      name: `${sigName}_phase`,
      data: phase,
      unit: 'deg',
      isComplex: false,
    });
  }

  return vectors;
}

/**
 * Parse tabular output (transient, DC sweep).
 * Format: tab-separated with "Index" first column, header row, then numeric rows.
 */
function parseTabular(
  stdout: string,
  analysisType: AnalysisType,
): VectorData[] {
  const lines = stdout.split('\n').filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  if (!headerLine) return [];

  const headerParts = headerLine.split('\t');

  // Validate: first column should be "Index" (case-insensitive)
  const firstCol = headerParts[0]?.trim().toLowerCase();
  if (firstCol !== 'index') {
    throw new Error(
      `Malformed ${analysisType} output: expected "Index" header column, got "${headerParts[0]}"`,
    );
  }

  const signalNames = headerParts.slice(1);
  if (signalNames.length === 0) {
    throw new Error(
      `Malformed ${analysisType} output: no signal columns in header`,
    );
  }

  const numDataRows = lines.length - 1;

  const vectors: VectorData[] = signalNames.map((name) => ({
    name,
    data: new Float64Array(numDataRows),
    unit: inferUnit(name),
    isComplex: false,
  }));

  for (let row = 1; row < lines.length; row++) {
    const line = lines[row];
    if (!line) continue;
    const cols = line.split('\t').slice(1); // Skip index column

    for (let col = 0; col < cols.length && col < vectors.length; col++) {
      const val = cols[col];
      const vec = vectors[col];
      if (!val || !vec) continue;
      vec.data[row - 1] = Number.parseFloat(val);
    }
  }

  return vectors;
}

/**
 * Infer unit of measurement from signal name.
 */
function inferUnit(name: string): string {
  const lower = name.toLowerCase();
  if (lower.startsWith('v(') || lower.startsWith('v-')) return 'V';
  if (lower.startsWith('i(')) return 'A';
  if (lower === 'time') return 's';
  if (lower === 'frequency') return 'Hz';
  return '';
}
