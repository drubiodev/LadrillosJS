import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      // Sample-repo plumbing: use the framework source from the monorepo
      // root. A real app that ran `npm install ladrillosjs` needs none of
      // the `resolve` / `server.fs` config in this file.
      ladrillosjs: path.resolve(__dirname, "../../src"),
    },
    // Keeps symlinked workspace deps behaving predictably
    preserveSymlinks: true,
  },
  optimizeDeps: {
    // Keep the design system out of dependency pre-bundling so its
    // import.meta.url-relative .html files keep resolving from the real
    // package directory (pre-bundled copies live in .vite/deps, away from
    // the component files).
    exclude: ["my-design-system"],
  },
  server: {
    // Allow importing files from the monorepo root (../../src)
    fs: {
      allow: [path.resolve(__dirname, "../..")],
    },
  },
});
