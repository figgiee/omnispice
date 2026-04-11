/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />
/// <reference types="vite-plugin-pwa/info" />

/**
 * Type declaration for the ngspice WASM Emscripten module.
 * The actual file is produced by docker/ngspice-wasm/build.sh.
 * Until it's built, this declaration satisfies the TypeScript compiler.
 * eslint-disable-next-line @typescript-eslint/no-explicit-any
 */
declare module '*/assets/wasm/ngspice.js' {
  // Emscripten factory returns an object with the full module interface.
  // We use any here because the type is defined in the runtime WASM build,
  // not in the source tree. The caller casts to NgspiceModule.
  // biome-ignore lint/suspicious/noExplicitAny: WASM module has no static types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const factory: () => Promise<any>;
  export default factory;
}
