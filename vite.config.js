const path = require("path");
const { defineConfig } = require("vite");

module.exports = defineConfig(({ command }) => {
  const base =
    command === "serve"
      ? {
          root: path.resolve(__dirname, "samples"),
          server: {
            sourcemapIgnoreList: () => false,
          },
          build: {
            sourcemap: true,
          },
          esbuild: {
            sourcemap: true,
          },
        }
      : {
          build: {
            lib: [
              {
                entry: path.resolve(__dirname, "src/index.ts"),
                name: "ladrillosjs",
                formats: ["es", "umd", "cjs"],
                fileName: (fmt) => `ladrillosjs.${fmt}.js`,
              },
              {
                entry: path.resolve(__dirname, "src/vite/index.ts"),
                name: "ladrillosjs-vite",
                formats: ["es", "cjs"],
                fileName: (fmt) => `vite/index.${fmt === "es" ? "js" : "cjs"}`,
              },
            ],
            outDir: path.resolve(__dirname, "dist"),
            emptyOutDir: true,
            target: "es2015",
            minify: "esbuild",
            cssMinify: true,
            sourcemap: true,
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
        ladrillosjs: path.resolve(__dirname, "src/index.ts"),
      },
    },
    server: base.server,
    css: {
      devSourcemap: true,
    },
    define: {
      __DEV__: command === "serve",
    },
  };
});
