import { describe, it, expect, afterEach } from "vitest";
import
  {
    runtimeBackend,
    setCodegenBackend,
    type CodegenBackend,
    type CompiledFn,
  } from "../../src/core/js/compiler";
import
  {
    precompiledBackend,
    registerArtifacts,
    clearArtifacts,
    type ArtifactTable,
  } from "../../src/core/js/precompiled";
import { createWebComponentClass } from "../../src/core/component/webcomponent";
import { parseComponent } from "../../src/core/component/extract";

/**
 * End-to-end proof that a component renders identically whether its code is
 * compiled at runtime by `new Function` or served from precompiled artifacts.
 *
 * Ground truth comes from the runtime itself: a recording backend captures
 * every (kind, key, params) the real render pipeline asks for, and those
 * recordings become the artifact table for a second, precompiled mount. That
 * way the test cannot drift from what the runtime actually requests — which is
 * exactly the failure mode a hand-written fixture list would hide.
 */

let tag = 0;
const nextTag = (base: string): string => `${base}-${++tag}`;

interface Recording
{
  kind: "evaluator" | "handler" | "setup";
  key: string;
  params: readonly string[];
  fn: CompiledFn;
}

function recordingBackend(into: Recording[]): CodegenBackend
{
  return {
    name: "recording",
    compileEvaluator(params, expression)
    {
      const fn = runtimeBackend.compileEvaluator(params, expression);
      into.push({ kind: "evaluator", key: expression, params, fn });
      return fn;
    },
    compileHandler(params, body, isAsync, key)
    {
      const fn = runtimeBackend.compileHandler(params, body, isAsync, key);
      into.push({ kind: "handler", key, params, fn });
      return fn;
    },
    compileSetup(params, body, key)
    {
      const fn = runtimeBackend.compileSetup(params, body, key);
      into.push({ kind: "setup", key, params, fn });
      return fn;
    },
  };
}

/**
 * Identifiers the expression actually mentions, so evaluator artifacts declare
 * a genuine subset in a different order than the runtime's parameter list —
 * which is what exercises the name-to-position mapping rather than an
 * accidental identity mapping.
 */
function depsFor(expression: string, params: readonly string[]): string[]
{
  const mentioned = new Set(expression.match(/[A-Za-z_$][\w$]*/g) ?? []);
  return params.filter((p) => mentioned.has(p));
}

function toArtifacts(recordings: Recording[]): ArtifactTable
{
  const table: ArtifactTable = { evaluators: {}, handlers: {}, setups: {} };

  for (const r of recordings)
  {
    if (r.kind === "evaluator")
    {
      // A recorded function takes the runtime's full positional list, but an
      // emitted one will take only what it uses. Wrap it so the artifact has a
      // genuinely minimal signature — otherwise `deps` would be an identity
      // mapping and would never exercise name-to-position resolution.
      const deps = depsFor(r.key, r.params);
      const positions = deps.map((d) => r.params.indexOf(d));
      const arity = r.params.length;
      const inner = r.fn;

      table.evaluators![r.key] = {
        deps,
        fn: (...values: unknown[]) =>
        {
          const full = new Array(arity);
          for (let i = 0; i < positions.length; i++)
          {
            full[positions[i]] = values[i];
          }
          return inner.apply(null, full);
        },
      };
    }
    else
    {
      // Handler and setup bodies destructure from the full parameter list, so
      // they must receive it verbatim.
      const entry = { deps: r.params, fn: r.fn };
      if (r.kind === "handler") table.handlers![r.key] = entry;
      else table.setups![r.key] = entry;
    }
  }

  return table;
}

function whenReady(el: HTMLElement): Promise<void>
{
  return new Promise((resolve) =>
  {
    el.addEventListener("ladrillos:ready", () => resolve(), { once: true });
  });
}

const settle = (): Promise<void> =>
  new Promise((r) => setTimeout(r as () => void, 50));

async function mount(tagName: string, source: string): Promise<ShadowRoot>
{
  const component = await parseComponent(source, tagName);
  customElements.define(tagName, createWebComponentClass(component, true));

  const el = document.createElement(tagName);
  document.body.appendChild(el);
  await whenReady(el);
  return (el as unknown as { shadowRoot: ShadowRoot; }).shadowRoot;
}

afterEach(() =>
{
  setCodegenBackend(runtimeBackend);
  clearArtifacts();
});

const fixtures: {
  name: string;
  source: string;
  /** Drives the component, then returns the DOM state to compare. */
  exercise: (root: ShadowRoot) => Promise<string>;
}[] = [
    {
      name: "interpolation and arithmetic",
      source: `
      <span id="out">{count} / {count * 2}</span>
      <script>let count = 21;</script>
    `,
      exercise: async (root) => root.getElementById("out")!.textContent!,
    },
    {
      name: "event handler mutating state",
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
    },
    {
      name: "conditional",
      source: `
      <div id="out">
        <if condition="show">yes</if>
        <else>no</else>
      </div>
      <button id="toggle" onclick="show = !show">t</button>
      <script>let show = true;</script>
    `,
      exercise: async (root) =>
      {
        const before = root.getElementById("out")!.textContent!.trim();
        root.getElementById("toggle")!.click();
        await settle();
        const after = root.getElementById("out")!.textContent!.trim();
        return `${before}|${after}`;
      },
    },
    {
      name: "method call and derived expression",
      source: `
      <span id="out">{greet(name)} {name.toUpperCase()}</span>
      <script>
        let name = "ada";
        function greet(n) { return "hi " + n; }
      </script>
    `,
      exercise: async (root) => root.getElementById("out")!.textContent!,
    },
  ];

describe("runtime vs precompiled conformance", () =>
{
  for (const fixture of fixtures)
  {
    it(`renders identically: ${fixture.name}`, async () =>
    {
      // Pass 1: real runtime, recording everything it compiles.
      const recordings: Recording[] = [];
      setCodegenBackend(recordingBackend(recordings));
      const runtimeRoot = await mount(nextTag("conf"), fixture.source);
      const runtimeResult = await fixture.exercise(runtimeRoot);

      expect(recordings.length).toBeGreaterThan(0);

      // Pass 2: same source, artifacts only. A fresh tag avoids per-component
      // caches serving pass 1's functions and making this vacuous.
      registerArtifacts(toArtifacts(recordings));

      let served = 0;
      let servedEvaluators = 0;
      setCodegenBackend({
        name: "counting-precompiled",
        compileEvaluator(params, expression)
        {
          served++;
          servedEvaluators++;
          return precompiledBackend.compileEvaluator(params, expression);
        },
        compileHandler(params, body, isAsync, key)
        {
          served++;
          return precompiledBackend.compileHandler(params, body, isAsync, key);
        },
        compileSetup(params, body, key)
        {
          served++;
          return precompiledBackend.compileSetup(params, body, key);
        },
      });

      const precompiledRoot = await mount(nextTag("conf"), fixture.source);
      const precompiledResult = await fixture.exercise(precompiledRoot);

      // Guards against a vacuous pass: the precompiled backend must actually
      // have been asked for code. Evaluators are counted separately because a
      // module-level cache once served them from pass 1, which silently hid a
      // broken index mapping.
      expect(served).toBeGreaterThan(0);
      const recordedEvaluators = recordings.filter(
        (r) => r.kind === "evaluator",
      ).length;
      if (recordedEvaluators > 0) expect(servedEvaluators).toBeGreaterThan(0);
      expect(precompiledResult).toBe(runtimeResult);
    });
  }
});
