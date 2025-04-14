const path = require("path");
const { defineConfig } = require("vite");

module.exports = defineConfig({
  root: path.resolve(__dirname, "samples"),
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/core/main.js"),
      name: "ladrillosjs",
      // Generate multiple formats
      formats: ["es", "umd", "cjs"],
      fileName: (format) => `ladrillosjs.${format}.js`,
    },
    outDir: path.resolve(__dirname, "dist"),
    minify: "esbuild",
    target: "es2015",
    cssMinify: true,
    rollupOptions: {
      output: {
        // Use predictable filenames without hashes for npm
        chunkFileNames: "chunks/[name].js",
        entryFileNames: "[name].js",
      },
    },
    reportCompressedSize: true,
    chunkSizeWarningLimit: 500,
  },
});
