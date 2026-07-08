// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import wasm from "vite-plugin-wasm";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Needed for @zama-fhe/relayer-sdk, which ships its FHE engine as a WASM module.
  //
  // No top-level-await plugin: with build.target "esnext", both the browser
  // bundle and the Node-based SSR server already support top-level await
  // natively. vite-plugin-top-level-await injects its own "__tla" helper into
  // every module it transforms, and Nitro's Vercel preset bundles multiple of
  // those modules into one server function — causing a real
  // "Identifier '__tla' has already been declared" crash at runtime.
  vite: {
    plugins: [wasm()],
    build: {
      target: "esnext",
    },
    optimizeDeps: {
      exclude: ["@zama-fhe/relayer-sdk"],
    },
    // The relayer SDK is only ever touched inside client-triggered functions
    // (behind a real wallet connection) in src/lib/fhevm.ts, never during SSR.
    // Without this, Rollup's chunking merges its browser-only top-level code
    // into the same output file as ethers' Contract export (both depend on
    // ethers internally), and since every route imports ethers' Contract via
    // wallet-store.ts, that merged chunk loads eagerly during SSR — crashing
    // with "self is not defined" the moment the relayer SDK's module-level
    // code runs on the server, where there's no browser `self` global.
    ssr: {
      external: ["@zama-fhe/relayer-sdk"],
    },
  },
});
