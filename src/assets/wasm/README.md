# ngspice WASM Build Artifacts

This directory contains the ngspice WASM binary and JavaScript loader.

## Files

- `ngspice.js` - Emscripten-generated ES module loader
- `ngspice.wasm` - Compiled ngspice WebAssembly binary

These files are **gitignored** (large binaries, ~5-15MB combined) and must be
built locally or downloaded from CI.

## Building

### Prerequisites

- Docker installed and running

### Build Command

From the project root:

```bash
bash docker/ngspice-wasm/build.sh
```

This will:
1. Build a Docker image with Emscripten and ngspice 45 source
2. Compile ngspice to WebAssembly with pipe-mode interface
3. Copy `ngspice.js` and `ngspice.wasm` to this directory

### Build Configuration

- **Emscripten SDK:** 4.0.0
- **ngspice version:** 45
- **Initial memory:** 256MB
- **Maximum memory:** 2GB (with ALLOW_MEMORY_GROWTH)
- **Module format:** ES module (MODULARIZE + EXPORT_ES6)
- **Interface:** Pipe mode (stdin/stdout), NOT shared library API

### Mock Mode

If WASM files are not available, the application falls back to a mock
ngspice implementation that returns hardcoded simulation results for
basic circuits. This enables development and testing without the real
WASM binary.

See `src/simulation/worker/ngspice-wrapper.ts` for mock implementation details.

### Troubleshooting

- **Docker build fails:** Ensure Docker has at least 4GB memory allocated
- **WASM too large:** The uncompressed .wasm file may be 10-15MB; Vite
  serves it with gzip compression in production (~3-5MB)
- **Memory errors at runtime:** Increase INITIAL_MEMORY in the Dockerfile
  if simulating very large circuits
