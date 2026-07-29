import { defineConfig } from "vite";
import { resolve } from "path";
import dts from "vite-plugin-dts";

// Node-only build tool: everything outside src stays external, including the
// framework itself, which the plugin reaches through the consumer's install.
export default defineConfig({
    build: {
        target: "node18",
        outDir: "dist",
        emptyOutDir: true,
        sourcemap: true,
        minify: false,
        lib: {
            entry: resolve(__dirname, "src/index.ts"),
            formats: ["es"],
            fileName: () => "index.js",
        },
        rollupOptions: {
            external: (id) =>
                !id.startsWith(".") && !resolve(id).startsWith(resolve(__dirname, "src")),
        },
    },
    plugins: [
        dts({
            include: ["src/**/*.ts"],
            tsconfigPath: "./tsconfig.json",
        }),
    ],
});
