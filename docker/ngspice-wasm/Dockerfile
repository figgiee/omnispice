# ngspice WASM Build
#
# Compiles ngspice 45 to WebAssembly using Emscripten.
# Produces ngspice.js + ngspice.wasm for use in a Web Worker.
#
# Usage:
#   docker build -t ngspice-wasm docker/ngspice-wasm/
#   docker run --rm -v "$(pwd)/src/assets/wasm:/output" ngspice-wasm \
#     cp /build/ngspice.js /build/ngspice.wasm /output/

FROM emscripten/emsdk:4.0.0

RUN apt-get update && apt-get install -y \
    autoconf \
    automake \
    libtool \
    bison \
    flex \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src

# Clone ngspice 45 from sourceforge
RUN git clone --depth 1 --branch ngspice-45 \
    https://git.code.sf.net/p/ngspice/ngspice ngspice

WORKDIR /src/ngspice

# Apply Emscripten compatibility patches
# Patches modify main.c to use emscripten_set_main_loop instead of
# blocking loop, and configure FS.init with JS-defined stdin/stdout/stderr
COPY patches/ /src/patches/
RUN if [ -d /src/patches ] && [ "$(ls -A /src/patches 2>/dev/null)" ]; then \
      for p in /src/patches/*.patch; do \
        git apply "$p" || echo "Warning: patch $p did not apply cleanly"; \
      done; \
    fi

# Generate configure script
RUN ./autogen.sh

# Configure for Emscripten build
# - Pipe mode (stdin/stdout) interface, NOT shared library API
# - Disable X11, readline, and other host-only features
RUN emconfigure ./configure \
    --host=wasm32-unknown-emscripten \
    --prefix=/build \
    --disable-debug \
    --enable-xspice \
    --enable-cider \
    --disable-openmp \
    --without-x \
    --without-readline \
    --without-tcl \
    CFLAGS="-O2"

# Build ngspice
RUN emmake make -j$(nproc)

# Link with Emscripten flags for WASM output
# Key flags:
#   INITIAL_MEMORY=256MB - sufficient for most circuits
#   ALLOW_MEMORY_GROWTH=1 - can grow for large simulations
#   MAXIMUM_MEMORY=2GB - hard cap to prevent runaway allocation
#   MODULARIZE=1 + EXPORT_ES6=1 - ES module output for Web Worker import
#   NO_EXIT_RUNTIME=1 - keep WASM alive after main() returns
#   ENVIRONMENT=worker - optimize for Web Worker context
#   FILESYSTEM=1 - MEMFS support for netlist/model file I/O
RUN emcc \
    -O2 \
    -o /build/ngspice.js \
    src/.libs/ngspice.o \
    -s INITIAL_MEMORY=268435456 \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s MAXIMUM_MEMORY=2147483648 \
    -s MODULARIZE=1 \
    -s EXPORT_ES6=1 \
    -s EXPORTED_FUNCTIONS="['_main']" \
    -s EXPORTED_RUNTIME_METHODS="['FS','callMain']" \
    -s NO_EXIT_RUNTIME=1 \
    -s ENVIRONMENT=worker \
    -s FILESYSTEM=1 \
    --preload-file /src/ngspice/src/spiceinit@/spice/spiceinit \
    || echo "Note: Final link step may need adjustment for your ngspice version"
