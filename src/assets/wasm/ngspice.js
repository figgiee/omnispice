// Placeholder — real ngspice WASM is built via `bash docker/ngspice-wasm/build.sh`
// This stub causes loadNgspice() to fall back to mock mode during development.
export default function ngspice() {
  throw new Error('ngspice WASM not built. Run docker/ngspice-wasm/build.sh to build.');
}
