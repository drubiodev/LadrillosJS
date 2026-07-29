import { describe, it, expect, afterEach, beforeAll, afterAll } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import
  {
    setCodegenBackend,
    type CodegenBackend,
  } from "../../src/core/js/compiler";
import { runtimeBackend } from "../../src/core/js/runtimeBackend";
import
  {
    precompiledBackend,
    registerArtifacts,
    clearArtifacts,
    type ArtifactTable,
  } from "../../src/core/js/precompiled";
import { emitComponent } from "../../src/compiler/emit";
import { createWebComponentClass } from "../../src/core/component/webcomponent";
import { parseComponent } from "../../src/core/component/extract";

/**
 * Proves the emitter produces real, static JavaScript that drives a component
 * without any runtime compilation.
 *
 * The generated file is written to disk and loaded with a normal dynamic
 * `import()` — no `Function`, no `eval`. If the output were not valid standalone
 * JS, the import itself would fail.
 */

let outDir: string;
let tag = 0;

/** A real module the fixture below imports, to prove import bindings survive. */
const depPath = join(process.cwd(), "tests", ".generated", "dep.mjs");
const depUrl = pathToFileURL(depPath).href;

beforeAll(() =>
{
  // Inside the project root: Vite's resolver will not load modules from $TMPDIR.
  outDir = join(process.cwd(), "tests", ".generated");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(depPath, "export const TAX = 7;\n", "utf8");
});

afterAll(() =>
{
  rmSync(outDir, { recursive: true, force: true });
});

afterEach(() =>
{
  setCodegenBackend(runtimeBackend);
  clearArtifacts();
});

function whenReady(el: HTMLElement): Promise<void>
{
  return new Promise((resolve) =>
  {
    el.addEventListener("ladrillos:ready", () => resolve(), { once: true });
  });
}

const settle = (): Promise<void> =>
  new Promise((r) => setTimeout(r as () => void, 50));

/** Module scripts only execute when the component has a source URL. */
const COMPONENT_URL = "http://localhost/emit-fixture.html";

async function mount(source: string, base: string): Promise<ShadowRoot>
{
  const tagName = `${base}-${++tag}`;
  const component = await parseComponent(source, tagName, COMPONENT_URL);
  customElements.define(tagName, createWebComponentClass(component, true));

  const el = document.createElement(tagName);
  document.body.appendChild(el);
  await whenReady(el);
  return (el as unknown as { shadowRoot: ShadowRoot; }).shadowRoot;
}

interface Fixture
{
  name: string;
  source: string;
  exercise: (root: ShadowRoot) => Promise<string>;
  /** Pinned so "both paths agree" can never mean "both paths are broken". */
  expected: string;
}

const fixtures: Fixture[] = [
  {
    name: "interpolation",
    source: `
      <span id="out">{count} / {count * 2}</span>
      <script>let count = 21;</script>
    `,
    exercise: async (root) => root.getElementById("out")!.textContent!,
    expected: "21 / 42",
  },
  {
    name: "handler mutating state",
    source: `
      <span id="out">{count}</span>
      <button id="inc" onclick="count++">+</button>
      <script>let count = 0;</script>
    `,
    exercise: async (root) =>
    {
      root.getElementById("inc")!.click();
      root.getElementById("inc")!.click();
      await settle();
      return root.getElementById("out")!.textContent!;
    },
    expected: "2",
  },
  {
    name: "conditional",
    source: `
      <div id="out">
        <if condition="show">yes</if>
        <else>no</else>
      </div>
      <button id="t" onclick="show = !show">t</button>
      <script>let show = true;</script>
    `,
    exercise: async (root) =>
    {
      const before = root.getElementById("out")!.textContent!.trim();
      root.getElementById("t")!.click();
      await settle();
      return `${before}|${root.getElementById("out")!.textContent!.trim()}`;
    },
    expected: "yes|no",
  },
  {
    name: "keyed loop",
    source: `
      <ul id="list">
        <for each="(item, i) in items" key="item.id">
          <li>{i}:{item.name}</li>
        </for>
      </ul>
      <script>let items = [{ id: 1, name: "a" }, { id: 2, name: "b" }];</script>
    `,
    exercise: async (root) =>
      root.getElementById("list")!.textContent!.replace(/\s+/g, " ").trim(),
    expected: "0:a1:b",
  },
  {
    name: "module script",
    source: `
      <span id="out">{count} {label}</span>
      <button id="inc" onclick="count++">+</button>
      <script type="module">
        let count = 5;
        let label = "hi";
      </script>
    `,
    exercise: async (root) =>
    {
      const before = root.getElementById("out")!.textContent!;
      root.getElementById("inc")!.click();
      await settle();
      return `${before}|${root.getElementById("out")!.textContent!}`;
    },
    expected: "5 hi|6 hi",
  },
  {
    name: "module script calling its own function",
    source: `
      <span id="out">{total}</span>
      <button id="add" onclick="addItem()">add</button>
      <script type="module">
        let total = 0;
        function addItem() { total += 2; }
      </script>
    `,
    exercise: async (root) =>
    {
      root.getElementById("add")!.click();
      root.getElementById("add")!.click();
      await settle();
      return root.getElementById("out")!.textContent!;
    },
    expected: "4",
  },
  {
    name: "module and regular script together",
    source: `
      <span id="out">{a} {b}</span>
      <script>let a = 1;</script>
      <script type="module">let b = 2;</script>
    `,
    exercise: async (root) => root.getElementById("out")!.textContent!,
    expected: "1 2",
  },
  {
    name: "module script with a real import",
    source: `
      <span id="out">{price}</span>
      <script type="module">
        import { TAX } from "${depUrl}";
        let price = 100 + TAX;
      </script>
    `,
    exercise: async (root) => root.getElementById("out")!.textContent!,
    expected: "107",
  },
];

/** Records every artifact the real runtime asks for while rendering. */
async function recordKeys(fixture: Fixture): Promise<Set<string>>
{
  const seen = new Set<string>();
  const rec: CodegenBackend = {
    name: "rec",
    compileEvaluator(p, e)
    {
      seen.add(`evaluator:${e}`);
      return runtimeBackend.compileEvaluator(p, e);
    },
    compileHandler(p, b, a, k)
    {
      seen.add(`handler:${k}`);
      return runtimeBackend.compileHandler(p, b, a, k);
    },
    compileSetup(p, b, k)
    {
      seen.add(`setup:${k}`);
      return runtimeBackend.compileSetup(p, b, k);
    },
  };

  setCodegenBackend(rec);
  const root = await mount(fixture.source, "rec");
  await fixture.exercise(root);
  setCodegenBackend(runtimeBackend);
  return seen;
}

describe("emitter", () =>
{
  for (const fixture of fixtures)
  {
    it(`emits static JS covering every request: ${fixture.name}`, async () =>
    {
      const component = await parseComponent(fixture.source, "emit-src", COMPONENT_URL);
      const emitted = emitComponent(component, { format: "table" });

      const file = join(outDir, `${fixture.name.replace(/\W+/g, "-")}.mjs`);
      writeFileSync(file, emitted.code, "utf8");

      // A plain dynamic import: if this is not valid standalone JS, it throws.
      const mod = (await import(
        /* @vite-ignore */ pathToFileURL(file).href
      )) as { default: ArtifactTable; };
      const artifacts = mod.default;

      const emittedKeys = new Set([
        ...Object.keys(artifacts.evaluators ?? {}).map((k) => `evaluator:${k}`),
        ...Object.keys(artifacts.handlers ?? {}).map((k) => `handler:${k}`),
        ...Object.keys(artifacts.setups ?? {}).map((k) => `setup:${k}`),
      ]);

      const recorded = await recordKeys(fixture);
      const missing = [...recorded].filter((k) => !emittedKeys.has(k));
      expect(missing).toEqual([]);
    });

    it(`renders identically from emitted artifacts: ${fixture.name}`, async () =>
    {
      const component = await parseComponent(fixture.source, "emit-src2", COMPONENT_URL);
      const emitted = emitComponent(component, { format: "table" });

      const file = join(outDir, `${fixture.name.replace(/\W+/g, "-")}-run.mjs`);
      writeFileSync(file, emitted.code, "utf8");
      const mod = (await import(
        /* @vite-ignore */ pathToFileURL(file).href
      )) as { default: ArtifactTable; };

      const runtimeRoot = await mount(fixture.source, "rt");
      const expected = await fixture.exercise(runtimeRoot);

      // Guards against the whole comparison being vacuous: if the runtime
      // itself silently rendered nothing, both paths would "agree" on garbage.
      expect(expected).toBe(fixture.expected);

      registerArtifacts(mod.default);

      let served = 0;
      setCodegenBackend({
        name: "counting",
        compileEvaluator(p, e)
        {
          served++;
          return precompiledBackend.compileEvaluator(p, e);
        },
        compileHandler(p, b, a, k)
        {
          served++;
          return precompiledBackend.compileHandler(p, b, a, k);
        },
        compileSetup(p, b, k)
        {
          served++;
          return precompiledBackend.compileSetup(p, b, k);
        },
      });

      const emittedRoot = await mount(fixture.source, "pc");
      const actual = await fixture.exercise(emittedRoot);

      expect(served).toBeGreaterThan(0);
      expect(actual).toBe(expected);
    });
  }
});
