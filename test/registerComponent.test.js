import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerComponent } from "ladrillosjs";

describe("Ladrillos core", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("defines a custom element when registering a component", async () => {
    const testHtml = `<p>Hello</p><script>let x=0;</script><style>p{}</style>`;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(testHtml),
      })
    );

    const tag = `test-comp-${Date.now()}`;
    await registerComponent(tag, "/test.html");
    expect(customElements.get(tag)).toBeDefined();
  });

  it("caches fetched HTML so fetch is only called once per path", async () => {
    const testHtml = `<p>Cache Test</p>`;
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(testHtml),
    });
    vi.stubGlobal("fetch", mockFetch);

    const tag = `cache-${Date.now()}`;
    await registerComponent(tag, "/cache.html");
    await registerComponent(tag, "/cache.html");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
