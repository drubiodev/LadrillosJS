import { describe, it, expect, beforeEach } from "vitest";
import { loadScripts } from "../../src/core/js/scriptParser";

/**
 * Regression test: $host must be available inside inline event handlers
 * (onclick="..." and $on:...="...") and inside script functions invoked
 * from them.
 *
 * Bug: createVanillaEventHandler rebuilt the handler scope with only
 * `event`, `__state__`, `$refs`, and allow-listed globals. Script functions
 * are RE-CREATED from source in that scope, so a function referencing
 * `$host` lost its original closure and threw a silent ReferenceError
 * (dev warning 301). Fixed by passing `$host` (the component host element)
 * as a handler parameter, like `$refs`.
 */
describe("$host in inline event handlers", () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
  });

  it("onclick can use $host directly", async () => {
    host.innerHTML = `<button id="direct" onclick="$host.classList.add('lit')">go</button>`;

    await loadScripts(host, [
      { content: "let unused = 0;", type: "text/javascript" } as any,
    ], []);

    host.querySelector<HTMLButtonElement>("#direct")!.click();

    expect(host.classList.contains("lit")).toBe(true);
  });

  it("a script function called from onclick can use $host", async () => {
    host.innerHTML = `<button id="fn" onclick="markHost()">go</button>`;

    const scriptContent = `
      let hostTag = "";
      function markHost() {
        hostTag = $host.tagName;
        $host.classList.toggle("marked");
      }
    `;

    const state = await loadScripts(host, [
      { content: scriptContent, type: "text/javascript" } as any,
    ], []);

    const btn = host.querySelector<HTMLButtonElement>("#fn")!;

    btn.click();
    expect(state.hostTag).toBe("DIV");
    expect(host.classList.contains("marked")).toBe(true);

    // Toggle must keep working across invocations
    btn.click();
    expect(host.classList.contains("marked")).toBe(false);
  });

  it("$on: directive handlers can use $host", async () => {
    host.innerHTML = `<button id="dir" $on:click="$host.setAttribute('data-via', 'directive')">go</button>`;

    await loadScripts(host, [
      { content: "let unused = 0;", type: "text/javascript" } as any,
    ], []);

    host.querySelector<HTMLButtonElement>("#dir")!.click();

    expect(host.getAttribute("data-via")).toBe("directive");
  });
});
