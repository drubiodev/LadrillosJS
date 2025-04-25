const path = require("path");
const { defineConfig } = require("vite");

module.exports = defineConfig(({ command }) => {
  if (command === "serve") {
    return {
      root: path.resolve(__dirname, "samples"),
      server: {
        /* … */
      },
    };
  } else {
    return {
      build: {
        lib: {
          entry: path.resolve(__dirname, "src/index.js"),
          name: "ladrillosjs",
          formats: ["es", "umd", "cjs"],
          fileName: (fmt) => `ladrillosjs.${fmt}.js`,
        },
        outDir: path.resolve(__dirname, "dist"),
        emptyOutDir: true,
        target: "es2015",
        minify: "esbuild",
        cssMinify: true,
        rollupOptions: {
          // ← this forces everything into your entry file
          inlineDynamicImports: true,
        },
      },
    };
  }
});
