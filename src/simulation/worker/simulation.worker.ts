/**
 * Web Worker entry point for ngspice WASM simulation.
 *
 * Hosts the ngspice WASM module (or mock) in a dedicated thread,
 * keeping the main thread responsive. Communicates via the typed
 * SimCommand/SimResponse protocol.
 */

import type { SimCommand, SimResponse } from '../protocol';
<<<<<<< Updated upstream
import {
  type NgspiceModule,
  loadNgspice,
  parseMockOutput,
} from './ngspice-wrapper';
=======
import { type NgspiceModule, loadNgspice, parseMockOutput } from './ngspice-wrapper';
>>>>>>> Stashed changes

let ngspiceModule: NgspiceModule | null = null;

/**
 * Post a typed response to the main thread.
 */
function respond(response: SimResponse): void {
  self.postMessage(response);
}

/**
<<<<<<< Updated upstream
 * Determine analysis type from netlist content or analysis command.
 */
function detectAnalysisType(
  text: string,
): 'tran' | 'ac' | 'dc' | 'op' {
  const lower = text.toLowerCase();
  if (lower.includes('.tran') || lower.includes('tran ')) return 'tran';
  if (lower.includes('.ac') || lower.includes('ac ')) return 'ac';
  if (lower.includes('.dc') || lower.includes('dc ')) return 'dc';
=======
 * Determine analysis type from the netlist content.
 */
function detectAnalysisType(
  netlist: string,
): 'tran' | 'ac' | 'dc' | 'op' {
  const lower = netlist.toLowerCase();
  if (lower.includes('.tran')) return 'tran';
  if (lower.includes('.ac')) return 'ac';
  if (lower.includes('.dc')) return 'dc';
>>>>>>> Stashed changes
  return 'op';
}

/**
 * Handle incoming commands from the main thread.
 */
self.onmessage = async (event: MessageEvent<SimCommand>) => {
  const cmd = event.data;

  switch (cmd.type) {
    case 'INIT': {
      try {
        ngspiceModule = await loadNgspice();

        // Pre-create MEMFS directories for model files
        try {
          ngspiceModule.FS.mkdir('/tmp');
        } catch {
          // May already exist
        }
        try {
          ngspiceModule.FS.mkdir('/spice');
        } catch {
          // May already exist
        }
        try {
          ngspiceModule.FS.mkdir('/spice/models');
        } catch {
          // May already exist
        }

        respond({ type: 'READY' });
      } catch (err) {
        respond({
          type: 'ERROR',
          message: `Failed to initialize ngspice: ${err instanceof Error ? err.message : String(err)}`,
          raw: String(err),
        });
      }
      break;
    }

    case 'LOAD_CIRCUIT': {
      if (!ngspiceModule) {
        respond({
          type: 'ERROR',
          message: 'ngspice not initialized. Send INIT first.',
          raw: 'ERR_NOT_INITIALIZED',
        });
        break;
      }

      try {
        // Write netlist to MEMFS as /tmp/circuit.cir
        ngspiceModule.FS.writeFile('/tmp/circuit.cir', cmd.netlist);
<<<<<<< Updated upstream
        respond({
          type: 'STDOUT',
          text: 'Circuit loaded to /tmp/circuit.cir',
        });
=======
        respond({ type: 'STDOUT', text: 'Circuit loaded to /tmp/circuit.cir' });
>>>>>>> Stashed changes
      } catch (err) {
        respond({
          type: 'ERROR',
          message: `Failed to load circuit: ${err instanceof Error ? err.message : String(err)}`,
          raw: String(err),
        });
      }
      break;
    }

    case 'RUN': {
      if (!ngspiceModule) {
        respond({
          type: 'ERROR',
          message: 'ngspice not initialized. Send INIT first.',
          raw: 'ERR_NOT_INITIALIZED',
        });
        break;
      }

      try {
        ngspiceModule.clearBuffers();

        // Read netlist to detect analysis type
        let netlistContent = '';
        try {
          netlistContent = ngspiceModule.FS.readFile('/tmp/circuit.cir', {
            encoding: 'utf8',
          });
        } catch {
          // File might not exist, that's OK -- ngspice will report the error
        }

        // Feed source command to ngspice stdin (pipe mode)
<<<<<<< Updated upstream
        ngspiceModule.feedStdin('source /tmp/circuit.cir');
=======
        ngspiceModule.feedStdin(`source /tmp/circuit.cir`);
>>>>>>> Stashed changes
        ngspiceModule.feedStdin(cmd.analysis);
        ngspiceModule.feedStdin('quit');

        // In mock mode, callMain triggers the simulation
        ngspiceModule.callMain(['-p']);

        // Check for errors
        if (ngspiceModule.stderrBuffer.trim()) {
          respond({
            type: 'ERROR',
            message: ngspiceModule.stderrBuffer.trim(),
            raw: ngspiceModule.stderrBuffer,
          });
          break;
        }

        // Parse output into VectorData
<<<<<<< Updated upstream
        const analysisType = detectAnalysisType(
          netlistContent || cmd.analysis,
        );
=======
        const analysisType = detectAnalysisType(netlistContent || cmd.analysis);
>>>>>>> Stashed changes
        const vectors = parseMockOutput(
          ngspiceModule.stdoutBuffer,
          analysisType,
        );

        respond({ type: 'RESULT', vectors });
      } catch (err) {
        respond({
          type: 'ERROR',
          message: `Simulation failed: ${err instanceof Error ? err.message : String(err)}`,
          raw: String(err),
        });
      }
      break;
    }

    case 'CANCEL': {
      // Cannot gracefully cancel ngspice mid-run.
      // The main thread will terminate this worker and spawn a new one.
      // We still send CANCELLED so the main thread knows we received it.
      respond({ type: 'CANCELLED' });
      break;
    }

    case 'LOAD_MODEL': {
      if (!ngspiceModule) {
        respond({
          type: 'ERROR',
          message: 'ngspice not initialized. Send INIT first.',
          raw: 'ERR_NOT_INITIALIZED',
        });
        break;
      }

      try {
        // Write model file to MEMFS
        const path = `/spice/models/${cmd.filename}`;
        ngspiceModule.FS.writeFile(path, cmd.content);
        respond({
          type: 'STDOUT',
          text: `Model loaded: ${cmd.filename}`,
        });
      } catch (err) {
        respond({
          type: 'ERROR',
          message: `Failed to load model: ${err instanceof Error ? err.message : String(err)}`,
          raw: String(err),
        });
      }
      break;
    }
  }
};
