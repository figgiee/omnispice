/**
 * Engineering notation parse/format helpers used by the inline parameter
 * chip (Plan 05-05). SPICE-compatible suffixes only — we do NOT support
 * ambiguous "M" (ngspice treats M as milli, not mega; the mega unit is
 * "Meg"). The scrub gesture drives these via `parseEngineeringNotation`
 * → numeric delta → `formatEngineeringNotation`.
 *
 * Examples:
 *   parseEngineeringNotation('2k')     → 2000
 *   parseEngineeringNotation('4.7µF')  → 4.7e-6
 *   parseEngineeringNotation('10Meg')  → 1e7
 *   formatEngineeringNotation(1500)    → '1.5k'
 *   formatEngineeringNotation(4.7e-6)  → '4.7µ'
 */

interface Suffix {
  label: string;
  value: number;
}

/** Ordered longest-first so parsing "Meg" matches before "M" (milli). */
const PARSE_SUFFIXES: Suffix[] = [
  { label: 'Meg', value: 1e6 },
  { label: 'meg', value: 1e6 },
  { label: 'µ', value: 1e-6 },
  { label: 'u', value: 1e-6 },
  { label: 'p', value: 1e-12 },
  { label: 'n', value: 1e-9 },
  { label: 'm', value: 1e-3 },
  { label: 'k', value: 1e3 },
  { label: 'K', value: 1e3 },
  { label: 'G', value: 1e9 },
  { label: 'T', value: 1e12 },
  { label: 'f', value: 1e-15 },
  { label: 'a', value: 1e-18 },
];

/** Ordered large→small for format() selection. */
const FORMAT_SUFFIXES: Array<{ label: string; value: number }> = [
  { label: 'T', value: 1e12 },
  { label: 'G', value: 1e9 },
  { label: 'Meg', value: 1e6 },
  { label: 'k', value: 1e3 },
  { label: '', value: 1 },
  { label: 'm', value: 1e-3 },
  { label: 'µ', value: 1e-6 },
  { label: 'n', value: 1e-9 },
  { label: 'p', value: 1e-12 },
  { label: 'f', value: 1e-15 },
  { label: 'a', value: 1e-18 },
];

/**
 * Parse a value string like "4.7k" or "10Meg" into a plain number.
 * Returns `NaN` on unparseable input; callers should guard. Trailing
 * non-numeric characters after the suffix (e.g. "Ω", "F") are stripped.
 */
export function parseEngineeringNotation(input: string): number {
  if (!input) return Number.NaN;
  const trimmed = input.trim();
  // Pull off the unit trailer (letters after the suffix), if any.
  // Leading digits/decimal/scientific notation are handled by parseFloat.
  const match = trimmed.match(/^([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)([a-zA-ZµΩ]*)$/);
  if (!match) return Number.parseFloat(trimmed);

  const mantissa = Number.parseFloat(match[1] ?? '');
  const rawSuffix = match[2] ?? '';
  if (!rawSuffix) return mantissa;

  // Try longest-match suffix first so "Meg" beats "m".
  for (const s of PARSE_SUFFIXES) {
    if (rawSuffix.startsWith(s.label)) {
      return mantissa * s.value;
    }
  }
  return mantissa;
}

/**
 * Format a plain number as SPICE-style engineering notation. Prefers the
 * suffix that yields a mantissa in [1, 1000). Zero is returned as "0".
 * Non-finite values become the string "—" so the UI never shows NaN.
 */
export function formatEngineeringNotation(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';

  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);

  for (const s of FORMAT_SUFFIXES) {
    const mantissa = abs / s.value;
    if (mantissa >= 1 && mantissa < 1000) {
      // Drop trailing zeros after the decimal, cap at 3 significant digits.
      const rounded = Math.round(mantissa * 1000) / 1000;
      return `${sign}${stripTrailingZeros(rounded)}${s.label}`;
    }
  }
  // Fallback: very small or very large — use scientific notation.
  return `${sign}${abs.toExponential(3)}`;
}

function stripTrailingZeros(n: number): string {
  // Avoid exponential format for the mantissa range we care about.
  let str = n.toFixed(3);
  if (str.includes('.')) {
    str = str.replace(/0+$/, '').replace(/\.$/, '');
  }
  return str;
}
