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
afterEach(() => {
  vi.resetModules();
  setCodegenBackend(runtimeBackend);
});

/** Loads an entry and reports the backend it installed, in isolation. */
async function backendInstalledBy(entry: string): Promise<string> {
  vi.resetModules();
  await import(entry);
  const { getCodegenBackend } = await import("../../src/core/js/compiler");
  return getCodegenBackend().name;
}

describe("entry points install a codegen backend", () => {
  it("ladrillosjs installs the runtime backend", async () => {
    expect(await backendInstalledBy("../../src/index")).toBe("runtime");
  });

  it("ladrillosjs/core installs the runtime backend", async () => {
    expect(await backendInstalledBy("../../src/core")).toBe("runtime");
  });

  it("ladrillosjs/csp installs the precompiled backend", async () => {
    expect(await backendInstalledBy("../../src/csp")).toBe("precompiled");
  });

  it("ladrillosjs/lazy installs nothing, because it cannot mount a component", () => {
    // Asserted against the source rather than by importing it: importing
    // src/lazy.ts first in a fresh module graph trips a pre-existing circular
    // dependency between core/lazy and core/ladrillos ("initLazyLoader is not
    // a function"), which is unrelated to backend wiring and reproduces with
    // all of this branch's changes stashed.
    const source = readFileSync(
      resolve(process.cwd(), "src/lazy.ts"),
      "utf8"
    );

    // It only exports loading strategies; registering a component still
    // requires 'ladrillosjs' or 'ladrillosjs/core', which bring a backend.
    expect(source).not.toContain("setCodegenBackend");
    expect(source).not.toContain("runtimeBackend");
  });
});

describe("compiling with no backend installed", () => {
  it("fails with a message naming the entry points to import", async () => {
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

  it("does not quietly fall back to Function, which would defeat the CSP build", async () => {
    vi.resetModules();
    const { compileEvaluator } = await import("../../src/core/js/compiler");

    // A fallback would make the failure invisible until a CSP header rejected
    // it in production, so assert we never get a callable back.
    let result: unknown = "not thrown";
    try {
      result = compileEvaluator(["__state__"], "1 + 1");
    } catch {
      result = "threw";
    }
    expect(result).toBe("threw");
  });
});
