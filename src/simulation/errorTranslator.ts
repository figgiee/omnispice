/**
 * ngspice error translator for OmniSpice.
 *
 * Maps raw ngspice error strings to human-readable messages with
 * fix suggestions. Extracts component references when possible.
 */

export interface TranslatedError {
  message: string;
  suggestion: string;
  componentRef?: string;
  severity: 'error' | 'warning';
  raw: string;
}

interface ErrorPattern {
  pattern: RegExp;
  translate: (
    match: RegExpMatchArray,
    netMap?: Map<string, string>,
  ) => Omit<TranslatedError, 'raw'>;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern: /singular matrix.*node (\w+)/i,
    translate: (match, netMap) => ({
      message: `Node "${netMap?.get(match[1]!) || match[1]!}" has a problem in the circuit.`,
      suggestion:
        'Check for floating nodes (components not connected to anything) or short circuits across voltage sources.',
      componentRef: match[1],
      severity: 'error',
    }),
  },
  {
    pattern: /no dc path to ground.*node (\w+)/i,
    translate: (match, netMap) => ({
      message: `Node "${netMap?.get(match[1]!) || match[1]!}" is not connected to ground.`,
      suggestion:
        'Every node needs a path to ground (node 0). Add a ground connection or a large resistor (1M ohm) to ground.',
      componentRef: match[1],
      severity: 'error',
    }),
  },
  {
    pattern: /timestep too small/i,
    translate: () => ({
      message: 'The simulation is having trouble converging.',
      suggestion:
        'Try increasing the maximum timestep, simplifying your circuit, or adding small parasitic capacitances to high-impedance nodes.',
      severity: 'error',
    }),
  },
  {
    pattern: /can'?t find model (\w+)/i,
    translate: (match) => ({
      message: `SPICE model "${match[1]}" was not found.`,
      suggestion:
        'Check the model name spelling, or import the model file (.mod or .lib) using the import dialog.',
      componentRef: match[1],
      severity: 'error',
    }),
  },
  {
    pattern: /too many iterations without convergence/i,
    translate: () => ({
      message: 'The simulation failed to converge after too many iterations.',
      suggestion:
        'Try simplifying the circuit, checking for unrealistic component values, or adjusting simulation parameters.',
      severity: 'error',
    }),
  },
];

/**
 * Extract a component reference designator from an error string.
 * Matches patterns like R1, C2, V1, D3, Q1, M2, X1, I1, L1.
 */
function extractComponentRef(raw: string): string | undefined {
  const match = raw.match(/\b([RCLVDQMXI]\d+)\b/);
  return match ? match[1] : undefined;
}

/**
 * Translate a raw ngspice error string into a human-readable error.
 *
 * Matches against known error patterns. If no pattern matches,
 * returns a generic error with the raw output preserved.
 *
 * @param raw - Raw ngspice error output string
 * @param netMap - Optional map from internal net names to user-friendly names
 * @returns Translated error with message, suggestion, and optional component reference
 */
export function translateError(raw: string, netMap?: Map<string, string>): TranslatedError {
  for (const { pattern, translate } of ERROR_PATTERNS) {
    const match = raw.match(pattern);
    if (match) {
      const result = translate(match, netMap);
      return {
        ...result,
        // If the pattern didn't extract a component ref, try to find one
        componentRef: result.componentRef || extractComponentRef(raw),
        raw,
      };
    }
  }

  // No pattern matched -- return generic error with raw output
  return {
    message: 'The simulation encountered an error.',
    suggestion:
      'Check your circuit for errors. The raw simulator output is shown below for debugging.',
    componentRef: extractComponentRef(raw),
    severity: 'error',
    raw,
  };
}
