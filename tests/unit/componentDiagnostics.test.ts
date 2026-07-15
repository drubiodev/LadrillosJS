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
});