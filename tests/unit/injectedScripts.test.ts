import { describe, it, expect, vi, afterEach } from "vitest";
import { parseComponent } from "../../src/core/component/extract";

/**
 * Regression tests for dev-server injected scripts.
 *
 * When a component's `.html` partial is served through a dev server
 * (VS Code Live Preview, Live Server, BrowserSync, webpack-dev-server, …),
 * that server injects its own live-reload / HMR client <script> into the
 * served HTML. Those scripts must never be treated as component scripts —
 * ingesting them corrupts reactive-state extraction and silently breaks
 * every inline / $on: event handler in the component.
 */
describe("dev-server injected script filtering", () =>
{
    afterEach(() =>
    {
        vi.restoreAllMocks();
    });

    it("keeps the authored inline script and its variables/functions", async () =>
    {
        const source = `
      <div><input $bind="messageText" $on:keyup.enter="sendMessage()" /></div>
      <script>
        let messageText = "";
        const sendMessage = () => { messageText = ""; };
      </script>
    `;

        const component = await parseComponent(source, "input-c");

        expect(component.scripts).toHaveLength(1);
        expect(component.scripts[0].content).toContain("sendMessage");
        expect(component.scripts[0].content).toContain("messageText");
    });

    it("drops a VS Code Live Preview injected external script (never fetches it)", async () =>
    {
        const fetchSpy = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValue(new Response("/* should never be fetched */"));

        const source = `
      <div>hello</div>
      <script>let a = 1;</script>
      <script src="http://127.0.0.1:3000/___vscode_livepreview_injected_script" type="module"></script>
    `;

        const component = await parseComponent(source, "input-c");

        // Authored inline script survives; injected one is gone.
        expect(component.scripts).toHaveLength(1);
        expect(component.scripts[0].content).toContain("let a = 1");
        // The injected external script must not be fetched or inlined.
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(component.externalScripts).toHaveLength(0);
    });

    it("drops an inline Live Preview injected script by content marker", async () =>
    {
        const source = `
      <div>hi</div>
      <script>let real = 42;</script>
      <script>
        // Script injected by the VS Code Live Preview Extension.
        // http://aka.ms/live-preview
        window.addEventListener('message', (e) => {}, false);
      </script>
    `;

        const component = await parseComponent(source, "input-c");

        expect(component.scripts).toHaveLength(1);
        expect(component.scripts[0].content).toContain("let real = 42");
        expect(component.scripts.some((s) => s.content.includes("live-preview"))).toBe(
            false
        );
    });

    it("drops a BrowserSync injected inline script", async () =>
    {
        const source = `
      <div>hi</div>
      <script>let keep = true;</script>
      <script id="__bs_script__">document.write("<script async src='/browser-sync/browser-sync-client.js'><\\/script>".replace("HOST", location.hostname));</script>
    `;

        const component = await parseComponent(source, "input-c");

        expect(component.scripts).toHaveLength(1);
        expect(component.scripts[0].content).toContain("let keep = true");
    });
});
