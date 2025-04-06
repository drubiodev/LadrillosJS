const path = require("path");
const { defineConfig } = require("vite");

module.exports = defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/core/main.js"),
      name: "ladrillosjs",
      fileName: (format) => `ladrillosjs.${format}.js`,
    },
  },
});
