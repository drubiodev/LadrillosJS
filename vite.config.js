const path = require("path");
const { defineConfig } = require("vite");

module.exports = defineConfig(({ command }) => {
  const base =
    command === "serve"
      ? { root: path.resolve(__dirname, "samples") }
      : {
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
              inlineDynamicImports: true,
            },
          },
        };

  return {
    ...base,
    resolve: {
      alias: {
        // allow bare‐imports against your source
        ladrillosjs: path.resolve(__dirname, "src/index.js"),
      },
    },
    server: base.server,
  };
});
