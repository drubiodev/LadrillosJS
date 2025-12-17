import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      ladrillosjs: path.resolve(__dirname, "../../src"),
    },
    // Keeps symlinked workspace deps behaving predictably
    preserveSymlinks: true,
  },
  server: {
    // Allow importing files from the monorepo root (../../src)
    fs: {
      allow: [path.resolve(__dirname, "../..")],
    },
  },
});
