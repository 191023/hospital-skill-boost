// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    server: {
      host: true,
      allowedHosts: [
        "fmstraining.ovbhospital.com",
        ".ovbhospital.com",
      ],
      proxy: {
        "/__supabase": {
          target: "http://127.0.0.1:54321",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/__supabase/, ""),
          ws: true,
        },
        "/__l5e": {
          target: "https://hospital-skill-boost.lovable.app",
          changeOrigin: true,
        },
      },
    },
    optimizeDeps: {
      // Prebundle the lazy room renderer at startup so opening it cannot swap
      // the React dependency graph underneath an already mounted page.
      include: [
        "react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime",
        "@react-three/fiber", "@react-three/drei", "three",
        "three/examples/jsm/utils/SkeletonUtils.js",
        "three/examples/jsm/utils/BufferGeometryUtils.js",
      ],
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
