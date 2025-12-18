import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "ladrillosjs", // Global variable name (window.ladrillosjs)
      fileName: "ladrillos",
      formats: ["iife"], // Immediately Invoked Function Expression for CDN usage
    },
    outDir: "dist-cdn",
  },
});
