import { describe, it, expect, beforeEach, vi } from "vitest";
import { createWebComponentClass } from "../../src/core/component/webcomponent";
import { loadTemplate, prepareTemplate } from "../../src/core/html/htmlparser";
import { getPendingLazyContent } from "../../src/core/builtins/lazyElement";
import
  {
    setCachedComponentSource,
    getCachedComponentSource,
    setCacheSize,
  } from "../../src/core/component/cache";

describe("component source cache", () =>
{
  beforeEach(() =>
  {
    setCacheSize(3); // fresh small cache per test
  });

  it("stores and retrieves cached sources", () =>
  {
    setCachedComponentSource("/a.html", "<div>A</div>");
    expect(getCachedComponentSource("/a.html")).toBe("<div>A</div>");
  });

  it("returns undefined for unknown paths", () =>
  {
    expect(getCachedComponentSource("/missing.html")).toBeUndefined();
  });

  it("evicts the least recently used entry when cache is full", () =>
  {
    setCachedComponentSource("/a.html", "A");
    setCachedComponentSource("/b.html", "B");
    setCachedComponentSource("/c.html", "C");
    // Access /a.html to mark it as recently used
    getCachedComponentSource("/a.html");
    // Add /d.html — should evict /b.html (least recently used)
    setCachedComponentSource("/d.html", "D");

    expect(getCachedComponentSource("/b.html")).toBeUndefined();
    expect(getCachedComponentSource("/a.html")).toBe("A");
    expect(getCachedComponentSource("/c.html")).toBe("C");
    expect(getCachedComponentSource("/d.html")).toBe("D");
  });

  it("setCacheSize evicts immediately when new size is smaller", () =>
  {
    setCachedComponentSource("/a.html", "A");
    setCachedComponentSource("/b.html", "B");
    setCachedComponentSource("/c.html", "C");
    setCacheSize(1);
    // Only the most recently inserted (c) should survive
    expect(getCachedComponentSource("/a.html")).toBeUndefined();
    expect(getCachedComponentSource("/b.html")).toBeUndefined();
    expect(getCachedComponentSource("/c.html")).toBe("C");
  });

  it("setCacheSize throws on invalid input", () =>
  {
    expect(() => setCacheSize(0)).toThrow();
    expect(() => setCacheSize(-1)).toThrow();
    expect(() => setCacheSize(NaN)).toThrow();
  });
});

describe("component template cache", () =>
{
  it("keeps lazy fragments and their bindings separate for each clone", () =>
  {
    const prepared = prepareTemplate("<lazy><span>{title}</span></lazy>");
    const first = document.createElement("div");
    const second = document.createElement("div");
    const firstBindings = loadTemplate(first, prepared).bindings;
    const secondBindings = loadTemplate(second, prepared).bindings;
    const [firstContent] = getPendingLazyContent(first);
    const [secondContent] = getPendingLazyContent(second);

    expect(firstContent).toBeDefined();
    expect(secondContent).toBeDefined();
    expect(firstContent).not.toBe(secondContent);
    expect(firstBindings).toHaveLength(1);
    expect(secondBindings).toHaveLength(1);
    expect(firstBindings[0].node).not.toBe(secondBindings[0].node);
    firstBindings[0].node.textContent = "Changed";
    expect(secondContent.textContent).toBe("{title}");
    expect(prepared.content.querySelector("lazy span")?.textContent).toBe("{title}");
  });

  it.each([true, false])("parses once with independent instance bindings (shadow: %s)", async (useShadowDOM) =>
  {
    const tagName = `cached-template-${useShadowDOM ? "shadow" : "light"}`;
    const template = '<p class="cached-template">{title}</p>';
    const componentClass = createWebComponentClass({
      tagName,
      template,
      scripts: [],
      externalScripts: [],
      styles: [],
      templateBindings: ["title"],
    }, useShadowDOM);
    customElements.define(tagName, componentClass);
    const parseSpy = vi.spyOn(HTMLTemplateElement.prototype, "innerHTML", "set");
    const first = document.createElement(tagName);
    const second = document.createElement(tagName);
    first.setAttribute("title", "First");
    second.setAttribute("title", "Second");
    const ready = (element: HTMLElement) => new Promise<void>((resolve) =>
    {
      element.addEventListener("ladrillos:ready", () => resolve(), { once: true });
    });
    const initialized = Promise.all([ready(first), ready(second)]);

    try
    {
      document.body.append(first, second);
      await initialized;
      expect(parseSpy.mock.calls.filter(([html]) => html === template)).toHaveLength(1);
      const firstRoot = first.shadowRoot ?? first;
      const secondRoot = second.shadowRoot ?? second;
      expect(firstRoot.textContent).toBe("First");
      expect(secondRoot.textContent).toBe("Second");
      expect(firstRoot.firstChild).not.toBe(secondRoot.firstChild);
      first.setAttribute("title", "Updated");
      expect(firstRoot.textContent).toBe("Updated");
      expect(secondRoot.textContent).toBe("Second");
    }
    finally
    {
      first.remove();
      second.remove();
      parseSpy.mockRestore();
    }
  });
});
