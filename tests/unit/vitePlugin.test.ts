// @vitest-environment node
/**
 * Runs a real Vite build over a real project and checks the two things the
 * plugin exists to guarantee: the registration calls are gone, and nothing in
 * the bundle needs `script-src 'unsafe-eval'`.
 *
 * The fixture resolves `ladrillosjs` through node_modules like any consumer
 * would, so this exercises the published entry points, not the source tree.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { build, type Rollup } from "vite";
import ladrillos from "../../packages/vite-plugin/src/index";

const root = resolve(process.cwd(), "tests/.generated/vite-plugin");

const BUTTON = `
<button id="go" onclick="count++">{label}: {count}</button>
<style>button { color: red; }</style>
<script>
  let count = 0;
  let label = "Clicks";
</script>
`;

const CARD = `
<div id="card"><slot></slot></div>
<script>let title = "card";</script>
`;

function write(file: string, content: string): void
{
    const full = join(root, file);
    mkdirSync(resolve(full, ".."), { recursive: true });
    writeFileSync(full, content);
}

interface Bundle
{
    /** The entry chunk — what the page actually loads up front. */
    entry: string;
    /** Every chunk, including the ones only reached by a dynamic import. */
    all: string;
}

async function bundle(entry: string, options = {}, minify = false): Promise<Bundle>
{
    const result = (await build({
        root,
        mode: "production",
        logLevel: "silent",
        configFile: false,
        plugins: [ladrillos(options)],
        build: {
            write: false,
            minify,
            lib: { entry: resolve(root, entry), formats: ["es"], fileName: () => "out.js" },
        },
    })) as Rollup.RollupOutput[];

    const chunks = result[0].output.map((chunk) =>
        "code" in chunk ? chunk.code : ""
    );

    return { entry: chunks[0], all: chunks.join("\n") };
}

beforeAll(() =>
{
    rmSync(root, { recursive: true, force: true });
    write("components/button.html", BUTTON);
    write("components/card.html", CARD);
});

afterAll(() =>
{
    rmSync(root, { recursive: true, force: true });
});

describe("@ladrillosjs/vite-plugin", () =>
{
    it("replaces registerComponent with a precompiled artifact", async () =>
    {
        write(
            "single.js",
            `import { registerComponent } from "ladrillosjs";
       await registerComponent("my-button", "./components/button.html");`
        );

        const { entry } = await bundle("single.js");

        expect(entry).toContain("registerArtifacts");
        expect(entry).toContain("my-button");
        expect(entry).not.toMatch(/registerComponent\(\s*["']my-button["']/);

        // Nothing is left that would fetch and parse the .html at runtime.
        // Minified, so the framework's own doc comments cannot match.
        const { entry: min } = await bundle("single.js", {}, true);
        expect(min).not.toContain("DOMParser");
    });

    it("produces a bundle with no runtime code generation", async () =>
    {
        // Importing from "ladrillosjs/csp" is the whole point: the default
        // entry installs the `Function`-based backend, and the plugin cannot
        // remove an import the app asked for. See the next test.
        write(
            "single.js",
            `import { registerComponent } from "ladrillosjs/csp";
       await registerComponent("my-button", "./components/button.html");`
        );

        // Minified, so a comment mentioning `new Function` cannot pass for one.
        const { all } = await bundle("single.js", {}, true);

        expect(all).not.toMatch(/\bnew Function\s*\(/);
        expect(all).not.toMatch(/(?<![.\w$])eval\s*\(/);
        expect(all).not.toMatch(/(?<![.\w$])Function\s*\(/);
    });

    it("cannot remove code generation if the app imports the default entry", async () =>
    {
        // The opposite of the test above, so that one cannot pass by accident:
        // if this fixture ever stops containing `Function(`, the check is no
        // longer measuring anything.
        write(
            "default-entry.js",
            `import { registerComponent } from "ladrillosjs";
       await registerComponent("my-button", "./components/button.html");`
        );

        const { all } = await bundle("default-entry.js", {}, true);

        expect(all).toMatch(/(?<![.\w$])Function\s*\(/);
    });

    it("handles a TypeScript entry, whose syntax is not parseable as ESTree", async () =>
    {
        write(
            "entry.ts",
            `import { registerComponent } from "ladrillosjs";
       interface Unused { a: string }
       const tag: string = "my-button";
       await registerComponent("my-button", "./components/button.html" as string);`
        );

        const { entry } = await bundle("entry.ts");
        expect(entry).toContain("registerArtifacts");
    });

    it("keeps the build machine's absolute paths out of the bundle", async () =>
    {
        write(
            "single.js",
            `import { registerComponent } from "ladrillosjs";
       registerComponent("my-button", "./components/button.html");`
        );

        const { all } = await bundle("single.js");

        // sourcePath only surfaces in dev warnings, so it is relative to the root.
        expect(all).not.toContain(root);
        expect(all).toContain(`"sourcePath": "components/button.html"`);
    });

    it("carries the component's own script and styles into the artifact", async () =>
    {
        write(
            "single.js",
            `import { registerComponent } from "ladrillosjs";
       registerComponent("my-button", "./components/button.html");`
        );

        const { entry } = await bundle("single.js");

        expect(entry).toContain("button { color: red; }");
        expect(entry).toContain("Clicks");
    });

    it("keeps the result shape of registerComponents", async () =>
    {
        write(
            "batch.js",
            `import { registerComponents } from "ladrillosjs";
       const result = await registerComponents([
         { name: "my-button", path: "./components/button.html" },
         { name: "my-card", path: "./components/card.html", useShadowDOM: false },
       ]);
       globalThis.__result = result;`
        );

        const { entry } = await bundle("batch.js");

        // The bundler is free to reformat the object literal, so match on shape.
        expect(entry).toMatch(/success[^\n]*my-button[^\n]*my-card/s);
        expect(entry).toMatch(/["']?failed["']?:\s*\[\s*\]/);
        expect(entry).toMatch(/["']?skipped["']?:\s*\[\s*\]/);
        expect(entry).toMatch(/["']?useShadowDOM["']?:\s*false/);
    });

    it("accepts the record form of registerComponents", async () =>
    {
        write(
            "record.js",
            `import { registerComponents } from "ladrillosjs";
       await registerComponents({ "my-button": "./components/button.html" });`
        );

        const { entry } = await bundle("record.js");
        expect(entry).toContain("registerArtifacts");

        const { entry: min } = await bundle("record.js", {}, true);
        expect(min).not.toContain("DOMParser");
    });

    it("leaves a dynamic registration alone rather than guessing", async () =>
    {
        write(
            "dynamic.js",
            `import { registerComponent } from "ladrillosjs";
       const which = globalThis.pick;
       await registerComponent("my-button", which);`
        );

        const { all } = await bundle("dynamic.js");

        expect(all).not.toContain("registerArtifacts");
        expect(all).toContain("registerComponent");
    });

    it("fails the build on an unprecompilable registration when strict", async () =>
    {
        write(
            "dynamic.js",
            `import { registerComponent } from "ladrillosjs";
       await registerComponent("my-button", globalThis.pick);`
        );

        await expect(bundle("dynamic.js", { strict: true })).rejects.toThrow(
            /path is not a string literal/
        );
    });

    it("does not precompile a lazy component, which asked not to be defined up front", async () =>
    {
        write(
            "lazy.js",
            `import { registerComponents } from "ladrillosjs";
       await registerComponents([
         { name: "my-card", path: "./components/card.html", lazy: true },
       ]);`
        );

        const { all } = await bundle("lazy.js");
        expect(all).not.toContain("registerArtifacts");
    });

    it("reports a path it cannot find instead of emitting a broken import", async () =>
    {
        write(
            "missing.js",
            `import { registerComponent } from "ladrillosjs";
       await registerComponent("my-ghost", "./components/ghost.html");`
        );

        await expect(bundle("missing.js", { strict: true })).rejects.toThrow(
            /no file found for ".\/components\/ghost.html"/
        );
    });

    it("does nothing in a dev server by default", async () =>
    {
        write(
            "single.js",
            `import { registerComponent } from "ladrillosjs";
       await registerComponent("my-button", "./components/button.html");`
        );

        const plugin = ladrillos();
        // configResolved is where the plugin decides whether it applies.
        (plugin.configResolved as (config: unknown) => void).call(
            {},
            { root, command: "serve" }
        );

        const transform = plugin.transform as (
            this: unknown,
            code: string,
            id: string
        ) => Promise<unknown>;

        const result = await transform.call(
            {},
            `registerComponent("my-button", "./components/button.html");`,
            join(root, "single.js")
        );

        expect(result).toBeNull();
    });
});
