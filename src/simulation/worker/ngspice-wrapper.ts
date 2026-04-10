/**
 * ngspice WASM module loader with pipe-mode interface.
 *
 * Loads the ngspice WebAssembly module and provides a high-level
 * interface for feeding netlists via stdin and capturing stdout/stderr.
 * Falls back to a mock implementation when WASM files are not available.
 */

import type { VectorData } from '../protocol';

/**
 * Emscripten module interface for ngspice WASM.
 */
export interface NgspiceModule {
  /** Emscripten virtual filesystem */
  FS: {
    writeFile: (path: string, data: string | Uint8Array) => void;
    readFile: (path: string, opts?: { encoding: string }) => string;
    mkdir: (path: string) => void;
    unlink: (path: string) => void;
  };
  /** Call ngspice main() with command-line arguments */
  callMain: (args: string[]) => void;
  /** Feed a string to ngspice stdin (pipe mode) */
  feedStdin: (input: string) => void;
  /** Captured stdout output */
  stdoutBuffer: string;
  /** Captured stderr output */
  stderrBuffer: string;
  /** Clear output buffers */
  clearBuffers: () => void;
  /** Whether this is the mock implementation */
  isMock: boolean;
}

/**
 * Attempt to load the real ngspice WASM module.
 * Falls back to mock if WASM files are not available.
 */
export async function loadNgspice(): Promise<NgspiceModule> {
  try {
    // Try to dynamically import the Emscripten-generated ES module.
    // This file is produced by docker/ngspice-wasm/build.sh and placed
    // in src/assets/wasm/ngspice.js. It won't exist until the Docker
    // build is run.
    const wasmModule = await import('../../assets/wasm/ngspice.js');
    const instance = await wasmModule.default();

    let stdoutBuffer = '';
    let stderrBuffer = '';
    const stdinQueue: number[] = [];

    // Set up pipe-mode I/O via Emscripten FS.init
    instance.FS.init(
      // stdin callback: return next char from queue, or null if empty
      () => (stdinQueue.length > 0 ? stdinQueue.shift()! : null),
      // stdout callback: accumulate output
      (char: number) => {
        stdoutBuffer += String.fromCharCode(char);
      },
      // stderr callback: accumulate errors
      (char: number) => {
        stderrBuffer += String.fromCharCode(char);
      },
    );

    // Ensure MEMFS directories exist for model files
    try {
      instance.FS.mkdir('/tmp');
    } catch {
      // Directory may already exist
    }
    try {
      instance.FS.mkdir('/spice');
    } catch {
      // Directory may already exist
    }
    try {
      instance.FS.mkdir('/spice/models');
    } catch {
      // Directory may already exist
    }

    return {
      FS: instance.FS,
      callMain: (args: string[]) => instance.callMain(args),
      feedStdin: (input: string) => {
        for (let i = 0; i < input.length; i++) {
          stdinQueue.push(input.charCodeAt(i));
        }
        // Null terminator signals end of input line
        stdinQueue.push(10); // newline
      },
      get stdoutBuffer() {
        return stdoutBuffer;
      },
      get stderrBuffer() {
        return stderrBuffer;
      },
      clearBuffers: () => {
        stdoutBuffer = '';
        stderrBuffer = '';
      },
      isMock: false,
    };
  } catch {
    // WASM files not available -- use mock implementation
    console.warn(
      '[ngspice-wrapper] WASM module not found. Running in MOCK mode. ' +
        'Run `bash docker/ngspice-wasm/build.sh` to build the real module.',
    );
    return createMockNgspice();
  }
}

/**
 * Mock ngspice implementation for development without WASM binary.
 *
 * Returns hardcoded simulation results for basic circuits.
 * Supports all SimCommand types so downstream development can proceed.
 */
export function createMockNgspice(): NgspiceModule {
  let stdoutBuffer = '';
  let stderrBuffer = '';
  const files = new Map<string, string>();

  return {
    FS: {
      writeFile: (path: string, data: string | Uint8Array) => {
        const content =
          typeof data === 'string' ? data : new TextDecoder().decode(data);
        files.set(path, content);
      },
      readFile: (path: string) => {
        const content = files.get(path);
        if (!content) {
          throw new Error(`Mock FS: file not found: ${path}`);
        }
        return content;
      },
      mkdir: () => {
        // No-op in mock
      },
      unlink: (path: string) => {
        files.delete(path);
      },
    },

    callMain: (_args: string[]) => {
      // In mock mode, callMain triggers simulation based on the
      // netlist previously written to /tmp/circuit.cir
      const netlist = files.get('/tmp/circuit.cir') || '';

      if (netlist.includes('.tran')) {
        stdoutBuffer = generateMockTransientOutput(netlist);
      } else if (netlist.includes('.ac')) {
        stdoutBuffer = generateMockACOutput();
      } else if (netlist.includes('.op')) {
        stdoutBuffer = generateMockDCOpOutput();
      } else if (netlist.includes('.dc')) {
        stdoutBuffer = generateMockDCSweepOutput();
      } else {
        stdoutBuffer = generateMockDCOpOutput();
      }
    },

    feedStdin: (input: string) => {
      // In mock mode, if stdin contains "source", trigger simulation
      if (input.includes('source')) {
        const netlist = files.get('/tmp/circuit.cir') || '';
        if (netlist.includes('.tran')) {
          stdoutBuffer = generateMockTransientOutput(netlist);
        } else if (netlist.includes('.ac')) {
          stdoutBuffer = generateMockACOutput();
        } else if (netlist.includes('.op')) {
          stdoutBuffer = generateMockDCOpOutput();
        } else if (netlist.includes('.dc')) {
          stdoutBuffer = generateMockDCSweepOutput();
        } else {
          stdoutBuffer = generateMockDCOpOutput();
        }
      }
    },

    get stdoutBuffer() {
      return stdoutBuffer;
    },
    get stderrBuffer() {
      return stderrBuffer;
    },
    clearBuffers: () => {
      stdoutBuffer = '';
      stderrBuffer = '';
    },
    isMock: true,
  };
}

/**
 * Generate mock transient analysis output.
 * Simulates a simple RC circuit charging curve.
 */
function generateMockTransientOutput(_netlist: string): string {
  const lines: string[] = [];
  lines.push('Index\ttime\tv(out)\ti(V1)');
  const points = 100;
  const tStop = 1e-3; // 1ms
  const tau = 1e-4; // RC time constant

  for (let i = 0; i <= points; i++) {
    const t = (i / points) * tStop;
    const vOut = 5.0 * (1 - Math.exp(-t / tau));
    const iV1 = (5.0 / 1000) * Math.exp(-t / tau);
    lines.push(`${i}\t${t.toExponential(6)}\t${vOut.toExponential(6)}\t${iV1.toExponential(6)}`);
  }

  return lines.join('\n');
}

/**
 * Generate mock AC analysis output.
 * Simulates a simple RC low-pass filter frequency response.
 */
function generateMockACOutput(): string {
  const lines: string[] = [];
  lines.push('Index\tfrequency\tv(out)\tv(out)');
  const points = 50;
  const fStart = 1;
  const fStop = 1e6;
  const fc = 1591.55; // 1/(2*pi*1k*100n)

  for (let i = 0; i <= points; i++) {
    const f = fStart * Math.pow(fStop / fStart, i / points);
    const w = 2 * Math.PI * f;
    const wc = 2 * Math.PI * fc;
    const mag = 1 / Math.sqrt(1 + (w / wc) ** 2);
    const phase = -Math.atan(w / wc);
    // AC output has real and imaginary parts
    const real = mag * Math.cos(phase);
    const imag = mag * Math.sin(phase);
    lines.push(
      `${i}\t${f.toExponential(6)}\t${real.toExponential(6)},${imag.toExponential(6)}`,
    );
  }

  return lines.join('\n');
}

/**
 * Generate mock DC operating point output.
 */
function generateMockDCOpOutput(): string {
  return [
    'v(net_1) = 5.00000e+00',
    'v(out) = 2.50000e+00',
    'i(V1) = -2.50000e-03',
  ].join('\n');
}

/**
 * Generate mock DC sweep output.
 */
function generateMockDCSweepOutput(): string {
  const lines: string[] = [];
  lines.push('Index\tv-sweep\tv(out)\ti(V1)');
  const points = 50;

  for (let i = 0; i <= points; i++) {
    const vIn = (i / points) * 10.0;
    const vOut = vIn * 0.5; // Simple voltage divider
    const iV1 = vIn / 2000;
    lines.push(
      `${i}\t${vIn.toExponential(6)}\t${vOut.toExponential(6)}\t${iV1.toExponential(6)}`,
    );
  }

  return lines.join('\n');
}

/**
 * Parse mock stdout output into VectorData arrays.
 * Used by the mock implementation to return properly typed results.
 */
export function parseMockOutput(
  stdout: string,
  analysisType: 'tran' | 'ac' | 'dc' | 'op',
): VectorData[] {
  if (analysisType === 'op') {
    return parseMockDCOp(stdout);
  }

  const lines = stdout.trim().split('\n');
  if (lines.length < 2) return [];

  const header = lines[0]!.split('\t').slice(1); // Skip "Index"
  const isAC = analysisType === 'ac';

  // For AC, we have complex pairs, so actual vector count is header.length
  // but we need to handle the complex format
  const vectors: VectorData[] = header.map((name) => ({
    name,
    data: new Float64Array(lines.length - 1),
    unit: inferUnit(name),
    isComplex: isAC && name !== 'frequency',
  }));

  for (let row = 1; row < lines.length; row++) {
    const cols = lines[row]!.split('\t').slice(1); // Skip index
    for (let col = 0; col < cols.length && col < vectors.length; col++) {
      const val = cols[col]!;
      if (isAC && val.includes(',')) {
        // Store magnitude for complex values
        const [realStr, imagStr] = val.split(',');
        const real = Number.parseFloat(realStr!);
        const imag = Number.parseFloat(imagStr!);
        vectors[col]!.data[row - 1] = Math.sqrt(real * real + imag * imag);
      } else {
        vectors[col]!.data[row - 1] = Number.parseFloat(val);
      }
    }
  }

  return vectors;
}

function parseMockDCOp(stdout: string): VectorData[] {
  const lines = stdout.trim().split('\n');
  return lines
    .filter((line) => line.includes('='))
    .map((line) => {
      const [name, valueStr] = line.split('=').map((s) => s.trim());
      return {
        name: name!,
        data: new Float64Array([Number.parseFloat(valueStr!)]),
        unit: inferUnit(name!),
        isComplex: false,
      };
    });
}

function inferUnit(name: string): string {
  if (name.startsWith('v(') || name.startsWith('v-')) return 'V';
  if (name.startsWith('i(')) return 'A';
  if (name === 'time') return 's';
  if (name === 'frequency') return 'Hz';
  return '';
}
