#!/bin/bash
# Build ngspice WASM binary using Docker.
#
# Produces ngspice.js + ngspice.wasm in src/assets/wasm/
# These files are gitignored (large binaries) and must be
# built locally or downloaded from CI.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "Building ngspice WASM..."
docker build -t ngspice-wasm "$SCRIPT_DIR"

echo "Extracting build artifacts..."
mkdir -p "$PROJECT_ROOT/src/assets/wasm"
docker run --rm \
  -v "$PROJECT_ROOT/src/assets/wasm:/output" \
  ngspice-wasm \
  sh -c "cp /build/ngspice.js /build/ngspice.wasm /output/ 2>/dev/null || echo 'Build artifacts not found -- check Dockerfile build steps'"

echo "ngspice WASM built successfully to src/assets/wasm/"
echo ""
echo "Files:"
ls -lh "$PROJECT_ROOT/src/assets/wasm/ngspice"* 2>/dev/null || echo "  (no files found -- build may have failed)"
