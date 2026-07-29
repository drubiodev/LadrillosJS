import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { setCodegenBackend } from "../../src/core/js/compiler";
import { runtimeBackend } from "../../src/core/js/runtimeBackend";

/**
 * Installing the backend from the entry points is what makes the CSP build's
 * guarantee structural: `csp.ts` never imports `runtimeBackend`, so the
 * `Function` constructor cannot reach that bundle. The cost is that the wiring
 * is a single easily-deleted line per entry, and deleting it fails at the
 * first render rather than at build time.
 *
 * Each test runs in a fresh module graph so the entry's module-scope install
 * actually re-runs, and so it observes the same `compiler` instance the entry
 * wrote to. `tests/setup.ts` installs a backend globally, which would
 * otherwise mask a missing install.
 */
afterEach(() =>
{
    vi.resetModules();
    setCodegenBackend(runtimeBackend);
});

/** Loads an entry and reports the backend it installed, in isolation. */
async function backendInstalledBy(entry: string): Promise<string>
{
    vi.resetModules();
    await import(entry);
    const { getCodegenBackend } = await import("../../src/core/js/compiler");
    return getCodegenBackend().name;
}

describe("entry points install a codegen backend", () =>
{
    it("ladrillosjs installs the runtime backend", async () =>
    {
        expect(await backendInstalledBy("../../src/index")).toBe("runtime");
    });

    it("ladrillosjs/core installs the runtime backend", async () =>
    {
        expect(await backendInstalledBy("../../src/core")).toBe("runtime");
    });

    it("ladrillosjs/csp installs the precompiled backend", async () =>
    {
        expect(await backendInstalledBy("../../src/csp")).toBe("precompiled");
    });

    it("ladrillosjs/lazy installs nothing, because it cannot mount a component", async () =>
    {
        expect(await backendInstalledBy("../../src/lazy")).toBe("uninstalled");

        // It only exports loading strategies; registering a component still
        // requires 'ladrillosjs' or 'ladrillosjs/core', which bring a backend.
        const source = readFileSync(resolve(process.cwd(), "src/lazy.ts"), "utf8");
        expect(source).not.toContain("setCodegenBackend");
        expect(source).not.toContain("runtimeBackend");
    });
});

describe("compiling with no backend installed", () =>
{
    it("fails with a message naming the entry points to import", async () =>
    {
        vi.resetModules();
        const { compileEvaluator, compileHandler, compileSetup } = await import(
            "../../src/core/js/compiler"
        );

        expect(() => compileEvaluator(["__state__"], "1 + 1")).toThrow(
            /No codegen backend installed/
        );
        expect(() => compileHandler(["event"], "x++", false, "x++")).toThrow(
            /ladrillosjs\/csp/
        );
        expect(() => compileSetup(["__state__"], "let x = 1;", "k")).toThrow(
            /deep internal path/
        );
    });

    it("does not quietly fall back to Function, which would defeat the CSP build", async () =>
    {
        vi.resetModules();
        const { compileEvaluator } = await import("../../src/core/js/compiler");

        // A fallback would make the failure invisible until a CSP header rejected
        // it in production, so assert we never get a callable back.
        let result: unknown = "not thrown";
        try
        {
            result = compileEvaluator(["__state__"], "1 + 1");
        } catch
        {
            result = "threw";
        }
        expect(result).toBe("threw");
    });
});

/**
 * Pins each entry's public surface. Without this, dropping an export from an
 * entry is invisible: every other test imports the deep module directly, so the
 * suite stays green while the published API loses a function.
 */
describe("entry points export what the docs promise", () =>
{
    const surface: Record<string, string[]> = {
        "../../src/index": ["registerComponent", "registerComponents", "$use", "configure"],
        "../../src/core": ["registerComponent", "registerComponents", "$use", "configure"],
        "../../src/csp": [
            "registerComponent",
            "registerComponents",
            "$use",
            "configure",
            "defineCompiled",
            "registerArtifacts",
            "clearArtifacts",
            "hasArtifact",
        ],
        "../../src/compiler/index": ["emitComponent", "parseComponent"],
    };

    for (const [entry, names] of Object.entries(surface))
    {
        it(`${entry.replace("../../src/", "")} exports ${names.length} functions`, async () =>
        {
            const mod: Record<string, unknown> = await import(entry);
            for (const name of names)
            {
                expect(typeof mod[name], `${entry} is missing ${name}`).toBe("function");
            }
        });
    }
});

describe("ladrillosjs/compiler", () =>
{
    it("installs no codegen backend, because it never mounts anything", async () =>
    {
        vi.resetModules();
        await import("../../src/compiler/index");
        const { getCodegenBackend } = await import("../../src/core/js/compiler");

        // It runs in Node at build time. Installing a backend here would mean the
        // emitter's own module graph could compile at runtime, which is exactly
        // what the artifacts exist to avoid.
        expect(getCodegenBackend().name).toBe("uninstalled");
    });

    it("is not reachable from any runtime entry", () =>
    {
        // The bundle-level version of this lives in scripts/verify-no-eval.js.
        // This catches the mistake in review, before anyone has to build.
        for (const entry of ["index", "core", "csp", "lazy", "events"])
        {
            const source = readFileSync(
                resolve(process.cwd(), `src/${entry}.ts`),
                "utf8"
            );
            expect(source).not.toMatch(/["'][^"']*compiler\/emit["']/);
        }
    });

    it("emits an import that matches a real package export", async () =>
    {
        const { emitComponent } = await import("../../src/compiler/index");
        const pkg = JSON.parse(
            readFileSync(resolve(process.cwd(), "package.json"), "utf8")
        );

        const { code } = emitComponent({
            tagName: "x-import-check",
            template: "<p>{a}</p>",
            scripts: [{ content: "let a = 1;", type: "text/javascript" }],
            externalScripts: [],
            externalStyles: [],
            styles: "",
            templateBindings: [],
        });

        // Emitting `from "ladrillosjs/csp"` is only useful if that subpath
        // resolves; a typo here produces artifacts nobody can import.
        const [, specifier] = code.match(/from\s+"([^"]+)"/) ?? [];
        expect(specifier).toBe("ladrillosjs/csp");
        expect(pkg.exports["./csp"]).toBeDefined();
        expect(pkg.exports["./compiler"]).toBeDefined();
    });
});
