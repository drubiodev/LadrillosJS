import { beforeEach, describe, expect, it, vi } from "vitest";
import { ladrillos } from "../../src/core/ladrillos";
import
{
    clearComponentCache,
    fetchComponentSource,
    invalidateComponentCache,
} from "../../src/core/component/loader";
import { ErrorCode, LadrillosError } from "../../src/utils/devWarnings";

describe("component diagnostics", () =>
{
    beforeEach(() =>
    {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        clearComponentCache();
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

    it("reuses empty component sources from the cache", async () =>
    {
        const fetchMock = vi.fn().mockResolvedValue(new Response(""));
        vi.stubGlobal("fetch", fetchMock);

        await expect(
            fetchComponentSource("https://example.test/empty.html"),
        ).resolves.toEqual({
            source: "",
            resolvedPath: "https://example.test/empty.html",
        });
        await fetchComponentSource("https://example.test/empty.html");

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("preserves a folder component's resolved URL when served from cache", async () =>
    {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response("<script src=\"./card.js\"></script>"),
        );
        vi.stubGlobal("fetch", fetchMock);
        const path = "https://example.test/components/card";

        const first = await fetchComponentSource(path);
        const cached = await fetchComponentSource(path);

        expect(first.resolvedPath).toBe(
            "https://example.test/components/card/index.html",
        );
        expect(cached).toEqual(first);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("shares simultaneous requests for the same component", async () =>
    {
        let resolveFetch!: (response: Response) => void;
        const response = new Promise<Response>((resolve) =>
        {
            resolveFetch = resolve;
        });
        const fetchMock = vi.fn().mockReturnValue(response);
        vi.stubGlobal("fetch", fetchMock);
        const path = "https://example.test/shared.html";

        const first = fetchComponentSource(path);
        const second = fetchComponentSource(path);
        resolveFetch(new Response("<p>Shared</p>"));

        await expect(Promise.all([first, second])).resolves.toEqual([
            { source: "<p>Shared</p>", resolvedPath: path },
            { source: "<p>Shared</p>", resolvedPath: path },
        ]);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("retries after a shared request fails", async () =>
    {
        const fetchMock = vi.fn()
            .mockRejectedValueOnce(new TypeError("offline"))
            .mockResolvedValueOnce(new Response("<p>Recovered</p>"));
        vi.stubGlobal("fetch", fetchMock);
        const path = "https://example.test/retry.html";

        const first = fetchComponentSource(path);
        const second = fetchComponentSource(path);
        await expect(Promise.allSettled([first, second])).resolves.toEqual([
            expect.objectContaining({ status: "rejected" }),
            expect.objectContaining({ status: "rejected" }),
        ]);
        await expect(fetchComponentSource(path)).resolves.toMatchObject({
            source: "<p>Recovered</p>",
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("rejects malformed cache invalidation paths with a typed error", () =>
    {
        expect(() => invalidateComponentCache("http://[invalid")).toThrow(
            expect.objectContaining({
                code: ErrorCode.INVALID_COMPONENT_PATH,
            }),
        );
    });

    it("invalidates one page-relative component source", async () =>
    {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response("<p>First</p>"))
            .mockResolvedValueOnce(new Response("<p>Second</p>"));
        vi.stubGlobal("fetch", fetchMock);

        await fetchComponentSource("http://localhost:3000/card.html");
        expect(invalidateComponentCache("./card.html")).toBe(true);
        await expect(
            fetchComponentSource("http://localhost:3000/card.html"),
        ).resolves.toMatchObject({ source: "<p>Second</p>" });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("does not let an invalidated request repopulate the cache", async () =>
    {
        let resolveFetch!: (response: Response) => void;
        const firstResponse = new Promise<Response>((resolve) =>
        {
            resolveFetch = resolve;
        });
        const fetchMock = vi.fn()
            .mockReturnValueOnce(firstResponse)
            .mockResolvedValueOnce(new Response("<p>Fresh</p>"));
        vi.stubGlobal("fetch", fetchMock);
        const path = "http://localhost:3000/pending.html";

        const staleRequest = fetchComponentSource(path);
        expect(invalidateComponentCache("./pending.html")).toBe(false);
        resolveFetch(new Response("<p>Stale</p>"));
        await staleRequest;

        await expect(fetchComponentSource(path)).resolves.toMatchObject({
            source: "<p>Fresh</p>",
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("does not let a request repopulate a cleared cache", async () =>
    {
        let resolveFetch!: (response: Response) => void;
        const firstResponse = new Promise<Response>((resolve) =>
        {
            resolveFetch = resolve;
        });
        const fetchMock = vi.fn()
            .mockReturnValueOnce(firstResponse)
            .mockResolvedValueOnce(new Response("<p>Fresh</p>"));
        vi.stubGlobal("fetch", fetchMock);
        const path = "http://localhost:3000/cleared-pending.html";

        const staleRequest = fetchComponentSource(path);
        clearComponentCache();
        resolveFetch(new Response("<p>Stale</p>"));
        await staleRequest;

        await expect(fetchComponentSource(path)).resolves.toMatchObject({
            source: "<p>Fresh</p>",
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("does not let a slower stale response overwrite a fresh response", async () =>
    {
        let resolveStale!: (response: Response) => void;
        const staleResponse = new Promise<Response>((resolve) =>
        {
            resolveStale = resolve;
        });
        const fetchMock = vi.fn()
            .mockReturnValueOnce(staleResponse)
            .mockResolvedValueOnce(new Response("<p>Fresh</p>"));
        vi.stubGlobal("fetch", fetchMock);
        const path = "http://localhost:3000/race.html";

        const staleRequest = fetchComponentSource(path);
        invalidateComponentCache("./race.html");
        await expect(fetchComponentSource(path)).resolves.toMatchObject({
            source: "<p>Fresh</p>",
        });
        resolveStale(new Response("<p>Stale</p>"));
        await staleRequest;

        await expect(fetchComponentSource(path)).resolves.toMatchObject({
            source: "<p>Fresh</p>",
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
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

    it("reports invalid batch entries without blocking valid components", async () =>
    {
        vi.spyOn(console, "error").mockImplementation(() => { });
        const fetchMock = vi.fn().mockResolvedValue(new Response("<p>Ready</p>"));
        vi.stubGlobal("fetch", fetchMock);

        const result = await ladrillos.registerComponents([
            { name: "InvalidName", path: "./invalid-name.html" },
            { name: "batch-empty-path", path: "" },
            { name: "batch-malformed-path", path: "http://[invalid" },
            { name: "batch-valid-entry", path: "./valid.html" },
        ]);

        expect(result.success).toEqual(["batch-valid-entry"]);
        expect(result.failed).toEqual([
            expect.objectContaining({
                name: "InvalidName",
                error: expect.objectContaining({
                    code: ErrorCode.INVALID_COMPONENT_NAME,
                }),
            }),
            expect.objectContaining({
                name: "batch-empty-path",
                error: expect.objectContaining({
                    code: ErrorCode.INVALID_COMPONENT_PATH,
                }),
            }),
            expect.objectContaining({
                name: "batch-malformed-path",
                error: expect.objectContaining({
                    code: ErrorCode.INVALID_COMPONENT_PATH,
                }),
            }),
        ]);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("rejects duplicate names within one batch before fetching twice", async () =>
    {
        vi.spyOn(console, "error").mockImplementation(() => { });
        const fetchMock = vi.fn().mockResolvedValue(new Response("<p>Ready</p>"));
        vi.stubGlobal("fetch", fetchMock);

        const result = await ladrillos.registerComponents([
            { name: "batch-duplicate-entry", path: "./first.html" },
            { name: "batch-duplicate-entry", path: "./second.html" },
        ]);

        expect(result.success).toEqual(["batch-duplicate-entry"]);
        expect(result.failed).toMatchObject([{
            name: "batch-duplicate-entry",
            error: { code: ErrorCode.COMPONENT_ALREADY_REGISTERED },
        }]);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("reports an existing custom element conflict without fetching", async () =>
    {
        vi.spyOn(console, "error").mockImplementation(() => { });
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        customElements.define(
            "batch-external-conflict",
            class extends HTMLElement { },
        );

        const result = await ladrillos.registerComponents([
            {
                name: "batch-external-conflict",
                path: "./external-conflict.html",
            },
        ]);

        expect(result.failed).toMatchObject([{
            name: "batch-external-conflict",
            error: { code: ErrorCode.COMPONENT_ALREADY_REGISTERED },
        }]);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});