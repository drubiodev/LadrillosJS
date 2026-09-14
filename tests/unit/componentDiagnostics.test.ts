import { beforeEach, describe, expect, it, vi } from "vitest";
import { ladrillos } from "../../src/core/ladrillos";
import { fetchComponentSource } from "../../src/core/component/loader";
import { ErrorCode, LadrillosError } from "../../src/utils/devWarnings";

describe("component diagnostics", () =>
{
    beforeEach(() =>
    {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("rejects missing component files with an actionable coded error", async () =>
    {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response("Not found", {
                    status: 404,
                    headers: { "content-type": "text/html" },
                }),
            ),
        );

        await expect(
            fetchComponentSource("https://example.test/missing-card.html"),
        ).rejects.toMatchObject({
            name: "LadrillosError",
            code: ErrorCode.COMPONENT_LOAD_FAILED,
            hint: expect.stringContaining("Check the path"),
        });
    });

    it("explains invalid custom element names before fetching", async () =>
    {
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => { });

        await ladrillos.registerComponent("card", "./card.html");

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(consoleSpy.mock.calls.flat().join(" ")).toContain("LJS506");
        expect(consoleSpy.mock.calls.flat().join(" ")).toContain(
            "Custom element names must contain a hyphen",
        );
    });

    it("uses the typed error class for component failures", async () =>
    {
        await expect(fetchComponentSource("")).rejects.toBeInstanceOf(
            LadrillosError,
        );
    });

    it.each(["source", "script"])("defines ready components without waiting for a slower %s", async (dependency) =>
    {
        const slowName = `batch-slow-${dependency}`;
        const fastName = `batch-fast-${dependency}`;
        let resolveSlow!: (response: Response) => void;
        const slowResponse = new Promise<Response>((resolve) =>
        {
            resolveSlow = resolve;
        });
        vi.stubGlobal("fetch", vi.fn((url: string) =>
        {
            if (url.endsWith(`${slowName}.js`)) return slowResponse;
            if (url.endsWith(`${slowName}.html`))
            {
                return dependency === "source"
                    ? slowResponse
                    : Promise.resolve(new Response(`<p>Slow</p><script src="./${slowName}.js"></script>`));
            }
            return Promise.resolve(new Response("<p>Ready</p>"));
        }));

        const registration = ladrillos.registerComponents([
            { name: slowName, path: `./${slowName}.html` },
            { name: fastName, path: `./${fastName}.html` },
        ]);

        try
        {
            await vi.waitFor(() =>
            {
                expect(customElements.get(fastName)).toBeDefined();
            });
            expect(customElements.get(slowName)).toBeUndefined();
        }
        finally
        {
            resolveSlow(new Response(dependency === "source" ? "<p>Slow</p>" : "let loaded = true;"));
            await registration;
        }

        expect(await registration).toEqual({
            success: [slowName, fastName],
            failed: [],
            skipped: [],
        });
    });

    it("keeps successful batch registrations when another request fails", async () =>
    {
        vi.spyOn(console, "error").mockImplementation(() => { });
        vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(
            url.endsWith("batch-missing.html")
                ? new Response("Not found", { status: 404 })
                : new Response("<p>Ready</p>"),
        )));
        const result = await ladrillos.registerComponents([
            { name: "batch-missing", path: "./batch-missing.html" },
            { name: "batch-survivor", path: "./batch-survivor.html" },
        ]);
        expect(result.success).toEqual(["batch-survivor"]);
        expect(result.failed).toMatchObject([{
            name: "batch-missing",
            error: { code: ErrorCode.COMPONENT_LOAD_FAILED },
        }]);
        expect(customElements.get("batch-survivor")).toBeDefined();
        expect(ladrillos.components["batch-missing"]).toBeUndefined();
    });
});