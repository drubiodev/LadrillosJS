const path = require("path");
const { defineConfig } = require("vite");

module.exports = defineConfig({
  root: path.resolve(__dirname, "samples"),
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/core/main.js"),
      name: "ladrillosjs",
      fileName: (format) => `ladrillosjs.${format}.js`,
    },
    outDir: path.resolve(__dirname, "dist"),
  },
});
