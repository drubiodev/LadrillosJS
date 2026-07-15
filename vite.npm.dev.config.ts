import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
    define: {
        __DEV__: JSON.stringify(true),
    },
    build: {
        lib: {
            entry: {
                index: resolve(__dirname, "src/index.ts"),
                core: resolve(__dirname, "src/core.ts"),
                lazy: resolve(__dirname, "src/lazy.ts"),
                events: resolve(__dirname, "src/events.ts"),
            },
            formats: ["es"],
        },
        outDir: "dist",
        minify: false,
        sourcemap: true,
        rollupOptions: {
            onwarn(warning, defaultHandler)
            {
                if (warning.code === "INEFFECTIVE_DYNAMIC_IMPORT") return;
                defaultHandler(warning);
            },
            output: {
                entryFileNames: "[name].dev.js",
                chunkFileNames: "shared-[hash].dev.js",
            },
            treeshake: {
                moduleSideEffects: false,
                propertyReadSideEffects: false,
            },
        },
        emptyOutDir: false,
    },
});