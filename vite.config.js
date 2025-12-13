const path = require("path");
const { defineConfig } = require("vite");

module.exports = defineConfig(({ command }) => {
  if (command === "serve") {
    return {
      root: path.resolve(__dirname, "playground"),
      resolve: {
        alias: {
          ladrillosjs: path.resolve(__dirname, "src/index.ts"),
        },
      },
      server: {
        fs: {
          allow: [__dirname],
        },
        sourcemapIgnoreList: () => false,
      },
      build: {
        sourcemap: true,
      },
      esbuild: {
        sourcemap: true,
      },
      css: {
        devSourcemap: true,
      },
      define: {
        __DEV__: true,
      },
    };
  }

  // Production build
  return {
    build: {
      lib: {
        entry: path.resolve(__dirname, "src/index.ts"),
        name: "ladrillosjs",
        formats: ["es", "umd", "cjs"],
        fileName: (fmt) => `ladrillosjs.${fmt}.js`,
      },
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
    resolve: {
      alias: {
        ladrillosjs: path.resolve(__dirname, "src/index.ts"),
      },
    },
    css: {
      devSourcemap: true,
    },
    define: {
      __DEV__: false,
    },
  };
});
