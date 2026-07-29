import { describe, it, expect, afterEach } from "vitest";
import
{
  setCodegenBackend,
  type CodegenBackend,
  type CompiledFn,
} from "../../src/core/js/compiler";
import { runtimeBackend } from "../../src/core/js/runtimeBackend";
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
  /**
   * Pinned so "both backends agree" can never quietly mean "both backends are
   * broken". Adding these caught two real defects that this suite had been
   * reporting as conformant: `{fn(x)}` against a plain-<script> function
   * declaration, and nested `<for>`.
   */
  expected: string;
}[] = [
    {
      name: "interpolation and arithmetic",
      source: `
      <span id="out">{count} / {count * 2}</span>
      <script>let count = 21;</script>
    `,
      exercise: async (root) => root.getElementById("out")!.textContent!,
      expected: "21 / 42",
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
      expected: "2",
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
      expected: "yes|no",
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
      expected: "hi ada ADA",
    },
    {
      // A binding whose only identifier is a function name still has to be
      // invalidated by what that function reads.
      name: "plain-script function reading state after an update",
      source: `
      <span id="out">{shout()}</span>
      <button id="go" onclick="name = 'bo'">g</button>
      <script>
        let name = "ada";
        function shout() { return name.toUpperCase(); }
      </script>
    `,
      exercise: async (root) =>
      {
        root.getElementById("go")!.click();
        await settle();
        return root.getElementById("out")!.textContent!;
      },
      expected: "BO",
    },
    {
      // The dependency is two calls deep, and `word` is only reachable
      // because `outer`'s source names `mid` -- exercises the transitive walk.
      name: "binding invalidated through a chain of function calls",
      source: `
      <span id="out">{outer()}</span>
      <button id="go" onclick="word = 'bo'">g</button>
      <script>
        let word = "ada";
        function mid() { return word + "!"; }
        function outer() { return mid().toUpperCase(); }
      </script>
    `,
      exercise: async (root) =>
      {
        root.getElementById("go")!.click();
        await settle();
        return root.getElementById("out")!.textContent!;
      },
      expected: "BO!",
    },
    {
      // Mutually recursive functions must not hang the dependency walk.
      name: "binding invalidated through mutually recursive functions",
      source: `
      <span id="out">{even(n)}</span>
      <button id="go" onclick="n = 3">g</button>
      <script>
        let n = 2;
        function even(k) { return k === 0 ? "yes" : odd(k - 1); }
        function odd(k) { return k === 0 ? "no" : even(k - 1); }
      </script>
    `,
      exercise: async (root) =>
      {
        root.getElementById("go")!.click();
        await settle();
        return root.getElementById("out")!.textContent!;
      },
      expected: "no",
    },
    {
      // KNOWN BUG, pinned deliberately: correct output is "ADA!".
      // Unrelated to dependency tracking, and pre-dates it -- `const mid = ...`
      // is rewritten to `__state__.mid`, leaving no local `mid`, but the
      // transform's `(?!\s*[:(])` lookahead skips the *call site*, so `outer`'s
      // body still says bare `mid()` -> ReferenceError. A `function mid() {}`
      // declaration is unaffected, because it stays a real local declaration.
      // See ROADMAP.
      name: "function calling an arrow function declared in the same script",
      source: `
      <span id="out">{outer()}</span>
      <script>
        let word = "ada";
        const mid = () => word + "!";
        function outer() { return mid(); }
      </script>
    `,
      exercise: async (root) =>
        root.getElementById("out")!.textContent!,
      expected: "{outer()}",
    },
    {
      // Same call inside a loop row, where handlers splice function source in
      // alongside the state copy -- the two must not collide.
      name: "plain-script function called from a loop row",
      source: `
      <ul id="list">
        <for each="item in items">
          <li>{label(item)}</li>
        </for>
      </ul>
      <script>
        let items = [1, 2];
        function label(n) { return "#" + n; }
      </script>
    `,
      exercise: async (root) =>
        root.getElementById("list")!.textContent!.replace(/\s+/g, " ").trim(),
      expected: "#1#2",
    },
    {
      name: "else-if chain",
      source: `
      <div id="out">
        <if condition="status === 'loading'">loading</if>
        <else-if condition="status === 'error'">error</else-if>
        <else>done</else>
      </div>
      <button id="next" onclick="status = status === 'loading' ? 'error' : 'ok'">n</button>
      <script>let status = "loading";</script>
    `,
      exercise: async (root) =>
      {
        const read = () => root.getElementById("out")!.textContent!.trim();
        const a = read();
        root.getElementById("next")!.click();
        await settle();
        const b = read();
        root.getElementById("next")!.click();
        await settle();
        return `${a}|${b}|${read()}`;
      },
      expected: "loading|error|done",
    },
    {
      name: "show directive",
      source: `
      <show condition="visible"><span id="box">here</span></show>
      <button id="t" onclick="visible = !visible">t</button>
      <script>let visible = true;</script>
    `,
      exercise: async (root) =>
      {
        // `<show>` flips display on the wrapper itself, not on its children.
        const display = () =>
          (root.querySelector("show") as HTMLElement | null)?.style.display ??
          "no-element";
        const before = display();
        root.getElementById("t")!.click();
        await settle();
        return `${before}|${display()}`;
      },
      // `contents`, not `` -- a visible <show> wrapper is explicitly taken out
      // of the layout so it cannot affect its children's box model.
      expected: "contents|none",
    },
    {
      name: "two-way binding",
      source: `
      <input id="field" $bind="text" />
      <span id="out">{text}</span>
      <script>let text = "start";</script>
    `,
      exercise: async (root) =>
      {
        const input = root.getElementById("field") as HTMLInputElement;
        const initial = input.value;
        input.value = "typed";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        await settle();
        return `${initial}|${root.getElementById("out")!.textContent}`;
      },
      expected: "start|typed",
    },
    {
      name: "ref accessed from a handler",
      source: `
      <input id="field" $ref="fieldEl" value="hello" />
      <span id="out">{seen}</span>
      <button id="read" onclick="seen = $refs.fieldEl.value">r</button>
      <script>let seen = "none";</script>
    `,
      exercise: async (root) =>
      {
        root.getElementById("read")!.click();
        await settle();
        return root.getElementById("out")!.textContent!;
      },
      expected: "hello",
    },
    {
      name: "$on directive with modifiers",
      source: `
      <span id="out">{count}</span>
      <button id="once" $on:click.once="count++">once</button>
      <script>let count = 0;</script>
    `,
      exercise: async (root) =>
      {
        const btn = root.getElementById("once")!;
        btn.click();
        btn.click();
        await settle();
        return root.getElementById("out")!.textContent!;
      },
      expected: "1",
    },
    {
      name: "nested loops",
      source: `
      <div id="out">
        <for each="group in groups">
          <for each="item in group.items"><span>{group.name}-{item}</span></for>
        </for>
      </div>
      <script>
        let groups = [
          { name: "a", items: [1, 2] },
          { name: "b", items: [3] },
        ];
      </script>
    `,
      exercise: async (root) =>
        root.getElementById("out")!.textContent!.replace(/\s+/g, " ").trim(),
      expected: "a-1a-2 b-3",
    },
    {
      // Both loops' indexes must be visible at once, and the row template has
      // several children so the wrapper path is exercised too.
      name: "nested loops with both indexes",
      source: `
      <div id="out">
        <for each="group, gi in groups">
          <b>{gi}</b>
          <for each="item, ii in group.items"><span>{gi}{ii}{item}</span></for>
        </for>
      </div>
      <script>
        let groups = [{ items: ["a", "b"] }, { items: ["c"] }];
      </script>
    `,
      exercise: async (root) =>
        root.getElementById("out")!.textContent!.replace(/\s+/g, " ").trim(),
      expected: "0 00a01b 1 10c",
    },
    {
      // Mutating the outer array must re-render the inner loops of reused
      // rows against their new item, not leave stale rows behind.
      name: "nested loops re-render when the outer array changes",
      source: `
      <div id="out">
        <for each="group in groups">
          <for each="item in group.items"><span>{item}</span></for>
        </for>
      </div>
      <button id="go" onclick="groups = [{ items: [9] }, { items: [7, 8] }]">g</button>
      <script>
        let groups = [{ items: [1, 2] }, { items: [3] }];
      </script>
    `,
      exercise: async (root) =>
      {
        root.getElementById("go")!.click();
        await settle();
        return root.getElementById("out")!.textContent!
          .replace(/\s+/g, " ")
          .trim();
      },
      expected: "9 78",
    },
    {
      // A handler inside the inner row must close over BOTH loop variables.
      name: "nested loop handler using outer and inner variables",
      source: `
      <div id="out">{picked}</div>
      <div>
        <for each="group in groups">
          <for each="item in group.items">
            <button class="pick" onclick="picked = group.name + item">x</button>
          </for>
        </for>
      </div>
      <script>
        let picked = "none";
        let groups = [
          { name: "a", items: [1, 2] },
          { name: "b", items: [3] },
        ];
      </script>
    `,
      exercise: async (root) =>
      {
        root.querySelectorAll<HTMLElement>("button.pick")[2]?.click();
        await settle();
        return root.getElementById("out")!.textContent!;
      },
      expected: "b3",
    },
    {
      name: "loop with an event handler using the row item",
      source: `
      <div id="out">{picked}</div>
      <ul id="list">
        <for each="item in items" key="item.id">
          <li><button class="pick" onclick="picked = item.name">{item.name}</button></li>
        </for>
      </ul>
      <script>
        let picked = "none";
        let items = [{ id: 1, name: "a" }, { id: 2, name: "b" }];
      </script>
    `,
      exercise: async (root) =>
      {
        const buttons = root.querySelectorAll<HTMLElement>("button.pick");
        buttons[1]?.click();
        await settle();
        return root.getElementById("out")!.textContent!;
      },
      expected: "b",
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

      // Guards against the whole comparison being vacuous: without this, a
      // fixture that both backends render wrongly still "conforms".
      expect(runtimeResult).toBe(fixture.expected);

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
