/**
 * Web Worker entry point for ngspice WASM simulation.
 *
 * Hosts the ngspice WASM module (or mock) in a dedicated thread,
 * keeping the main thread responsive. Communicates via the typed
 * SimCommand/SimResponse protocol.
 *
 * Plan 05-04: extended to support the four-lane tiered controller.
 * The worker now:
 *   - persists `currentCircuitHash` across RUN commands and skips reload
 *     when the hash matches
 *   - tags each RESULT/ERROR/CANCELLED with the incoming requestId so the
 *     controller can correlate multiple in-flight requests
 *   - accepts RESET_CIRCUIT to drop the loaded circuit without killing the
 *     worker (which would cost ~200-400ms WASM re-init)
 *   - tracks cancelled requestIds: if a CANCEL arrives before a RUN
 *     finishes, the eventual result is emitted as `CANCELLED` instead of
 *     `RESULT` so the main thread can discard it silently
 *
 * Backwards compatible: legacy `RUN { type, analysis }` without a
 * requestId still works — the controller and tests that predate 05-04
 * continue to function unchanged.
 */

import type { ProtocolAnalysis, SimCommand, SimResponse } from '../protocol';
import { loadNgspice, type NgspiceModule, parseMockOutput } from './ngspice-wrapper';

let ngspiceModule: NgspiceModule | null = null;
let currentCircuitHash: string | null = null;
const cancelledRequestIds = new Set<string>();

/**
 * Post a typed response to the main thread.
 */
function respond(response: SimResponse): void {
  self.postMessage(response);
}

/**
 * Determine analysis type from netlist content or analysis command.
 */
function detectAnalysisType(text: string): ProtocolAnalysis {
  const lower = text.toLowerCase();
  if (lower.includes('.tran') || lower.includes('tran ')) return 'tran';
  if (lower.includes('.ac') || lower.includes('ac ')) return 'ac';
  if (lower.includes('.dc') || lower.includes('dc ')) return 'dc';
  return 'op';
}

/**
 * Feed the analysis keyword (+ optional preformatted params fragment) to
 * ngspice stdin. The `params` field is an already-formatted SPICE fragment
 * supplied by the TieredSimulationController's helpers.
 */
function feedAnalysisCommand(
  mod: NgspiceModule,
  analysis: ProtocolAnalysis,
  params: string | undefined,
): void {
  const suffix = params ? ` ${params}` : '';
  switch (analysis) {
    case 'op':
      mod.feedStdin('op');
      break;
    case 'tran':
      mod.feedStdin(`tran${suffix}`);
      break;
    case 'ac':
      mod.feedStdin(`ac${suffix}`);
      break;
    case 'dc':
      mod.feedStdin(`dc${suffix}`);
      break;
  }
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
        currentCircuitHash = null;
        cancelledRequestIds.clear();

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

      // Fast path: if circuitHash matches the currently-loaded circuit, skip
      // the FS write entirely. This is how the TieredSimulationController
      // avoids reparsing the same netlist on every DC op-point tick.
      if (cmd.circuitHash && currentCircuitHash === cmd.circuitHash) {
        respond({
          type: 'STDOUT',
          text: `Circuit cached (hash ${cmd.circuitHash}), skipping reload`,
        });
        break;
      }

      try {
        // Write netlist to MEMFS as /tmp/circuit.cir
        ngspiceModule.FS.writeFile('/tmp/circuit.cir', cmd.netlist);
        if (cmd.circuitHash) {
          currentCircuitHash = cmd.circuitHash;
        }
        respond({
          type: 'STDOUT',
          text: 'Circuit loaded to /tmp/circuit.cir',
        });
      } catch (err) {
        respond({
          type: 'ERROR',
          message: `Failed to load circuit: ${err instanceof Error ? err.message : String(err)}`,
          raw: String(err),
        });
      }
      break;
    }

    case 'RESET_CIRCUIT': {
      // Drop the cached netlist hash so the next LOAD_CIRCUIT re-parses fresh.
      // We do NOT terminate the worker — that would cost ~200-400ms of WASM
      // re-init. The MEMFS file is left in place; it will be overwritten on
      // the next LOAD_CIRCUIT. ngspice's in-memory circuit state is
      // implicitly destroyed when the next `source` / analysis cycle runs.
      currentCircuitHash = null;
      cancelledRequestIds.clear();
      respond({ type: 'STDOUT', text: 'Circuit reset' });
      break;
    }

    case 'RUN': {
      if (!ngspiceModule) {
        respond({
          type: 'ERROR',
          message: 'ngspice not initialized. Send INIT first.',
          raw: 'ERR_NOT_INITIALIZED',
          ...(cmd.requestId ? { requestId: cmd.requestId } : {}),
        });
        break;
      }

      const requestId = cmd.requestId;

      try {
        ngspiceModule.clearBuffers();

        // Read netlist to detect analysis type (legacy fallback path)
        let netlistContent = '';
        try {
          netlistContent = ngspiceModule.FS.readFile('/tmp/circuit.cir', {
            encoding: 'utf8',
          });
        } catch {
          // File might not exist, that's OK -- ngspice will report the error
        }

        // Feed source command to ngspice stdin (pipe mode)
        ngspiceModule.feedStdin('source /tmp/circuit.cir');

        if (cmd.protocolAnalysis) {
          // Plan 05-04 path: per-analysis dispatch
          feedAnalysisCommand(ngspiceModule, cmd.protocolAnalysis, cmd.params);
        } else {
          // Legacy path: whatever the caller supplied
          ngspiceModule.feedStdin(cmd.analysis);
        }
        ngspiceModule.feedStdin('quit');

        // In mock mode, callMain triggers the simulation
        ngspiceModule.callMain(['-p']);

        // If cancelled while the (synchronous mock) analysis ran, drop the result
        if (requestId && cancelledRequestIds.has(requestId)) {
          cancelledRequestIds.delete(requestId);
          respond({ type: 'CANCELLED', requestId });
          break;
        }

        // Check for errors
        if (ngspiceModule.stderrBuffer.trim()) {
          respond({
            type: 'ERROR',
            message: ngspiceModule.stderrBuffer.trim(),
            raw: ngspiceModule.stderrBuffer,
            ...(requestId ? { requestId } : {}),
          });
          break;
        }

        // Parse output into VectorData
        const analysisType: ProtocolAnalysis =
          cmd.protocolAnalysis ?? detectAnalysisType(netlistContent || cmd.analysis);
        const vectors = parseMockOutput(ngspiceModule.stdoutBuffer, analysisType);

        respond({
          type: 'RESULT',
          vectors,
          ...(requestId ? { requestId } : {}),
          ...(cmd.protocolAnalysis ? { protocolAnalysis: cmd.protocolAnalysis } : {}),
        });
      } catch (err) {
        respond({
          type: 'ERROR',
          message: `Simulation failed: ${err instanceof Error ? err.message : String(err)}`,
          raw: String(err),
          ...(requestId ? { requestId } : {}),
        });
      }
      break;
    }

    case 'CANCEL': {
      // Cannot gracefully cancel ngspice mid-run. If the caller supplies a
      // requestId, stash it so the pending RESULT is re-emitted as CANCELLED.
      // The main thread will terminate this worker if it wants a hard stop.
      if (cmd.requestId) {
        cancelledRequestIds.add(cmd.requestId);
        respond({ type: 'CANCELLED', requestId: cmd.requestId });
      } else {
        respond({ type: 'CANCELLED' });
      }
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
