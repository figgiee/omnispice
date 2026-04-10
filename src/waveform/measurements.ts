/**
 * Waveform auto-measurement functions.
 *
 * Pure math functions that operate on Float64Array data from simulation
 * results. Each function computes a single measurement (Vpp, frequency,
 * RMS, rise time) and returns a formatted result, or null if the
 * measurement cannot be computed from the given data.
 */

export interface MeasurementResult {
  /** Measurement name, e.g., "Vpp", "Frequency", "RMS", "Rise Time" */
  label: string;
  /** Numeric value of the measurement */
  value: number;
  /** Unit of measurement, e.g., "V", "Hz", "s" */
  unit: string;
  /** Human-readable formatted string, e.g., "2.00 V", "1.00 kHz" */
  formatted: string;
}

/**
 * SI prefix table for engineering notation formatting.
 * Ordered from largest to smallest for lookup.
 */
const SI_PREFIXES: readonly { factor: number; prefix: string }[] = [
  { factor: 1e12, prefix: 'T' },
  { factor: 1e9, prefix: 'G' },
  { factor: 1e6, prefix: 'M' },
  { factor: 1e3, prefix: 'k' },
  { factor: 1, prefix: '' },
  { factor: 1e-3, prefix: 'm' },
  { factor: 1e-6, prefix: 'u' },
  { factor: 1e-9, prefix: 'n' },
  { factor: 1e-12, prefix: 'p' },
  { factor: 1e-15, prefix: 'f' },
] as const;

/**
 * Format a numeric value with engineering notation and SI prefix.
 *
 * Examples:
 *   formatValue(0.001, 's')  -> '1.00 ms'
 *   formatValue(1000, 'Hz')  -> '1.00 kHz'
 *   formatValue(5.0, 'V')    -> '5.00 V'
 */
export function formatValue(value: number, unit: string): string {
  if (value === 0) {
    return `0.00 ${unit}`;
  }

  const absValue = Math.abs(value);

  for (const { factor, prefix } of SI_PREFIXES) {
    if (absValue >= factor * 0.9999) {
      const scaled = value / factor;
      return `${scaled.toFixed(2)} ${prefix}${unit}`;
    }
  }

  // Below femto range -- use raw scientific notation
  const smallest = SI_PREFIXES[SI_PREFIXES.length - 1];
  if (smallest) {
    const scaled = value / smallest.factor;
    return `${scaled.toFixed(2)} ${smallest.prefix}${unit}`;
  }

  return `${value.toFixed(2)} ${unit}`;
}

/**
 * Measure peak-to-peak voltage.
 *
 * Vpp = max(data) - min(data)
 *
 * @param data Signal amplitude data
 * @returns MeasurementResult or null if data is empty
 */
export function measureVpp(data: Float64Array): MeasurementResult | null {
  if (data.length === 0) {
    return null;
  }

  let min = data[0]!;
  let max = data[0]!;

  for (let i = 1; i < data.length; i++) {
    const v = data[i]!;
    if (v < min) min = v;
    if (v > max) max = v;
  }

  const vpp = max - min;
  return {
    label: 'Vpp',
    value: vpp,
    unit: 'V',
    formatted: formatValue(vpp, 'V'),
  };
}

/**
 * Measure signal frequency from zero crossings.
 *
 * Finds positive-going zero crossings (signal goes from negative to
 * positive), calculates the average period between consecutive crossings,
 * and returns frequency = 1 / period.
 *
 * @param timeData Time axis data
 * @param signalData Signal amplitude data
 * @returns MeasurementResult or null if frequency cannot be determined
 */
export function measureFrequency(
  timeData: Float64Array,
  signalData: Float64Array,
): MeasurementResult | null {
  if (timeData.length === 0 || signalData.length === 0) {
    return null;
  }

  if (timeData.length !== signalData.length) {
    return null;
  }

  // Find positive-going zero crossings
  const crossingTimes: number[] = [];

  for (let i = 1; i < signalData.length; i++) {
    const prev = signalData[i - 1]!;
    const curr = signalData[i]!;

    // Positive-going zero crossing: previous <= 0, current > 0
    if (prev <= 0 && curr > 0) {
      // Linear interpolation for more accurate crossing time
      const tPrev = timeData[i - 1]!;
      const tCurr = timeData[i]!;
      const fraction = (0 - prev) / (curr - prev);
      crossingTimes.push(tPrev + fraction * (tCurr - tPrev));
    }
  }

  // Need at least 2 crossings to determine a period
  if (crossingTimes.length < 2) {
    return null;
  }

  // Calculate average period from consecutive crossings
  let totalPeriod = 0;
  for (let i = 1; i < crossingTimes.length; i++) {
    totalPeriod += crossingTimes[i]! - crossingTimes[i - 1]!;
  }
  const avgPeriod = totalPeriod / (crossingTimes.length - 1);

  if (avgPeriod <= 0) {
    return null;
  }

  const frequency = 1 / avgPeriod;
  return {
    label: 'Frequency',
    value: frequency,
    unit: 'Hz',
    formatted: formatValue(frequency, 'Hz'),
  };
}

/**
 * Measure RMS (root mean square) value.
 *
 * RMS = sqrt(mean(data^2))
 *
 * @param data Signal amplitude data
 * @returns MeasurementResult or null if data is empty
 */
export function measureRMS(data: Float64Array): MeasurementResult | null {
  if (data.length === 0) {
    return null;
  }

  let sumSquares = 0;
  for (let i = 0; i < data.length; i++) {
    const v = data[i]!;
    sumSquares += v * v;
  }

  const rms = Math.sqrt(sumSquares / data.length);
  return {
    label: 'RMS',
    value: rms,
    unit: 'V',
    formatted: formatValue(rms, 'V'),
  };
}

/**
 * Measure rise time (10% to 90% of signal range).
 *
 * Finds the first time the signal crosses the 10% threshold and the
 * first time it crosses the 90% threshold (both computed relative to
 * the signal's min and max values). Uses linear interpolation for
 * accurate threshold crossing times.
 *
 * @param timeData Time axis data
 * @param signalData Signal amplitude data
 * @returns MeasurementResult or null if rise time cannot be determined
 */
export function measureRiseTime(
  timeData: Float64Array,
  signalData: Float64Array,
): MeasurementResult | null {
  if (timeData.length === 0 || signalData.length === 0) {
    return null;
  }

  if (timeData.length !== signalData.length) {
    return null;
  }

  // Find signal range
  let min = signalData[0]!;
  let max = signalData[0]!;
  for (let i = 1; i < signalData.length; i++) {
    const v = signalData[i]!;
    if (v < min) min = v;
    if (v > max) max = v;
  }

  const range = max - min;
  if (range === 0) {
    return null; // Constant signal -- no rise time
  }

  const threshold10 = min + 0.1 * range;
  const threshold90 = min + 0.9 * range;

  // Find first crossing of 10% threshold (upward)
  let time10: number | null = null;
  for (let i = 1; i < signalData.length; i++) {
    const prev = signalData[i - 1]!;
    const curr = signalData[i]!;
    if (prev <= threshold10 && curr > threshold10) {
      // Linear interpolation
      const fraction = (threshold10 - prev) / (curr - prev);
      time10 = timeData[i - 1]! + fraction * (timeData[i]! - timeData[i - 1]!);
      break;
    }
  }

  if (time10 === null) {
    return null;
  }

  // Find first crossing of 90% threshold (upward) AFTER the 10% crossing
  let time90: number | null = null;
  for (let i = 1; i < signalData.length; i++) {
    const prev = signalData[i - 1]!;
    const curr = signalData[i]!;
    if (prev <= threshold90 && curr > threshold90) {
      const fraction = (threshold90 - prev) / (curr - prev);
      const t = timeData[i - 1]! + fraction * (timeData[i]! - timeData[i - 1]!);
      if (t > time10) {
        time90 = t;
        break;
      }
    }
  }

  if (time90 === null) {
    return null;
  }

  const riseTime = time90 - time10;
  return {
    label: 'Rise Time',
    value: riseTime,
    unit: 's',
    formatted: formatValue(riseTime, 's'),
  };
}
