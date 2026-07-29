import { defineConfig } from "vite";

export default defineConfig({
    build: {
        // Surfaces oversized bundles early rather than at deploy time.
        chunkSizeWarningLimit: 300,
    },
});
