/**
 * Build script for the Vite plugin
 * This builds the vite plugin separately and outputs to dist/vite.js and dist/vite.cjs
 */

const esbuild = require("esbuild");
const path = require("path");

const baseConfig = {
  entryPoints: [path.resolve(__dirname, "../src/vite/index.ts")],
  bundle: true,
  sourcemap: true,
  target: "es2015",
  platform: "node",
  external: ["fs", "path", "vite"],
  minify: true,
};

Promise.all([
  // ES Module build
  esbuild.build({
    ...baseConfig,
    format: "esm",
    outfile: path.resolve(__dirname, "../dist/vite.js"),
  }),
  // CommonJS build
  esbuild.build({
    ...baseConfig,
    format: "cjs",
    outfile: path.resolve(__dirname, "../dist/vite.cjs"),
  }),
])
  .then(() => {
    console.log("✓ Vite plugin built successfully");
  })
  .catch((err) => {
    console.error("✗ Failed to build Vite plugin:", err);
    process.exit(1);
  });
