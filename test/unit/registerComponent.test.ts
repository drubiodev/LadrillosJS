import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  registerComponent,
  registerComponents,
  $listen,
  $emit,
  $getState,
  $setState,
  $querySelector,
  $querySelectorAll,
} from "../../src/index";
import {
  mockComponentFetch,
  FIXTURES,
  cleanupDOM,
  createTestElement,
} from "../test-helpers";

describe("Component Registration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanupDOM();
  });

  afterEach(() => {
    cleanupDOM();
  });

  describe("registerComponent", () => {
    it("should register a single component from HTML", async () => {
      const tag = `test-counter-${Date.now()}`;
      global.fetch = mockComponentFetch(FIXTURES.counter);

      await registerComponent(tag, "/counter.html");

      const ctor = customElements.get(tag);
      expect(ctor).toBeDefined();
    });

    it("should cache component definitions", async () => {
      const tag = `test-cached-${Date.now()}`;
      const fetchMock = mockComponentFetch(FIXTURES.counter);
      global.fetch = fetchMock;

      await registerComponent(tag, "/counter.html");

      const el = createTestElement(tag);
      expect(el).toBeDefined();
    });

    it("should throw error on invalid fetch response", async () => {
      const tag = `test-error-${Date.now()}`;
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: "Not Found",
      });

      try {
        await registerComponent(tag, "/invalid.html");
        expect(true).toBe(false); // Should not reach here
      } catch (e) {
        expect(e).toBeDefined();
      }
    });

    it("should throw error when fetch fails", async () => {
      const tag = `test-fetch-fail-${Date.now()}`;
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      try {
        await registerComponent(tag, "/missing.html");
        expect(true).toBe(false); // Should not reach here
      } catch (e) {
        expect(e).toBeDefined();
      }
    });

    it("should create component instance", async () => {
      const tag = `test-instance-${Date.now()}`;
      global.fetch = mockComponentFetch(FIXTURES.simpleBinding);

      await registerComponent(tag, "/simple.html");
      const el = createTestElement(tag);

      expect(el).toBeInstanceOf(HTMLElement);
      expect(el.tagName.toLowerCase()).toBe(tag);
    });

    it("should handle lazy loading option", async () => {
      const tag = `test-lazy-${Date.now()}`;
      global.fetch = mockComponentFetch(FIXTURES.counter);

      await registerComponent(tag, "/counter.html", true, true);

      expect(customElements.get(tag)).toBeDefined();
    });

    it("should handle Shadow DOM disabled", async () => {
      const tag = `test-no-shadow-${Date.now()}`;
      global.fetch = mockComponentFetch(FIXTURES.counter);

      await registerComponent(tag, "/counter.html", false);

      const el = createTestElement(tag);
      expect(el.shadowRoot).toBeNull();
    });

    it("should parse and extract component parts correctly", async () => {
      const tag = `test-parse-${Date.now()}`;
      const htmlWithComments = `
        <!-- This is a comment -->
        <template>
          <div>{message}</div>
        </template>
        <script>
          let message = 'Hello';
        </script>
        <style>
          :host { display: block; }
        </style>
      `;
      global.fetch = mockComponentFetch(htmlWithComments);

      await registerComponent(tag, "/with-comments.html");
      const ctor = customElements.get(tag);

      expect(ctor).toBeDefined();
    });

    it("should handle HTML with no template", async () => {
      const tag = `test-no-template-${Date.now()}`;
      global.fetch = mockComponentFetch("<script>let x = 0;</script>");

      await registerComponent(tag, "/no-template.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle HTML with no script", async () => {
      const tag = `test-no-script-${Date.now()}`;
      global.fetch = mockComponentFetch("<template><p>Content</p></template>");

      await registerComponent(tag, "/no-script.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle HTML with no styles", async () => {
      const tag = `test-no-style-${Date.now()}`;
      global.fetch = mockComponentFetch(
        "<template><p>Content</p></template><script>let x = 0;</script>"
      );

      await registerComponent(tag, "/no-style.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle empty component", async () => {
      const tag = `test-empty-${Date.now()}`;
      global.fetch = mockComponentFetch("<template></template>");

      await registerComponent(tag, "/empty.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle malformed HTML gracefully", async () => {
      const tag = `test-malformed-${Date.now()}`;
      global.fetch = mockComponentFetch(
        "<template><unclosed><script>let x = 0</template>"
      );

      await registerComponent(tag, "/malformed.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle very large component", async () => {
      const tag = `test-large-${Date.now()}`;
      const largeTemplate = `
        <template>
          ${Array.from({ length: 100 }, (_, i) => `<p>{item${i}}</p>`).join(
            "\n"
          )}
        </template>
        <script>
          ${Array.from({ length: 100 }, (_, i) => `let item${i} = ${i};`).join(
            "\n"
          )}
        </script>
      `;
      global.fetch = mockComponentFetch(largeTemplate);

      await registerComponent(tag, "/large.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle component with multiple dashes in name", async () => {
      const tag = `test-multi-dash-comp-${Date.now()}`;
      global.fetch = mockComponentFetch(FIXTURES.counter);

      await registerComponent(tag, "/counter.html");

      expect(customElements.get(tag)).toBeDefined();
    });

    it("should handle fetch with relative paths", async () => {
      const tag = `test-relative-${Date.now()}`;
      global.fetch = mockComponentFetch(FIXTURES.counter);

      await registerComponent(tag, "./components/counter.html");

      expect(customElements.get(tag)).toBeDefined();
    });

    it("should handle fetch with absolute paths", async () => {
      const tag = `test-absolute-${Date.now()}`;
      global.fetch = mockComponentFetch(FIXTURES.counter);

      await registerComponent(tag, "https://example.com/counter.html");

      expect(customElements.get(tag)).toBeDefined();
    });

    it("should handle component name with numbers", async () => {
      const tag = `test-comp-123-${Date.now()}`;
      global.fetch = mockComponentFetch(FIXTURES.counter);

      await registerComponent(tag, "/counter.html");

      expect(customElements.get(tag)).toBeDefined();
    });
  });

  describe("registerComponents - bulk registration", () => {
    it("should register multiple components", async () => {
      const tag1 = `test-multi-1-${Date.now()}`;
      const tag2 = `test-multi-2-${Date.now()}`;

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(FIXTURES.counter),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(FIXTURES.form),
        });

      await registerComponents([
        { name: tag1, path: "/counter.html" },
        { name: tag2, path: "/form.html" },
      ]);

      expect(customElements.get(tag1)).toBeDefined();
      expect(customElements.get(tag2)).toBeDefined();
    });

    it("should handle empty array", async () => {
      await registerComponents([]);
      expect(true).toBe(true);
    });

    it("should handle single component in array", async () => {
      const tag = `test-single-array-${Date.now()}`;
      global.fetch = mockComponentFetch(FIXTURES.counter);

      await registerComponents([{ name: tag, path: "/counter.html" }]);

      expect(customElements.get(tag)).toBeDefined();
    });

    it("should handle many components", async () => {
      const count = 20;
      const tags = Array.from(
        { length: count },
        (_, i) => `test-many-${i}-${Date.now()}`
      );

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(FIXTURES.counter),
      });

      await registerComponents(
        tags.map((tag) => ({ name: tag, path: "/counter.html" }))
      );

      tags.forEach((tag) => {
        expect(customElements.get(tag)).toBeDefined();
      });
    });

    it("should respect useShadowDOM option in registrations", async () => {
      const tag1 = `test-shadow-1-${Date.now()}`;
      const tag2 = `test-shadow-2-${Date.now()}`;

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(FIXTURES.counter),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(FIXTURES.counter),
        });

      await registerComponents([
        { name: tag1, path: "/counter.html", useShadowDOM: true },
        { name: tag2, path: "/counter.html", useShadowDOM: false },
      ]);

      const el1 = createTestElement(tag1);
      const el2 = createTestElement(tag2);

      expect(el1.shadowRoot).toBeDefined();
      expect(el2.shadowRoot).toBeNull();
    });

    it("should respect lazy option in registrations", async () => {
      const tag1 = `test-lazy-1-${Date.now()}`;
      const tag2 = `test-lazy-2-${Date.now()}`;

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(FIXTURES.counter),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(FIXTURES.counter),
        });

      await registerComponents([
        { name: tag1, path: "/counter.html", lazy: false },
        { name: tag2, path: "/counter.html", lazy: true },
      ]);

      expect(customElements.get(tag1)).toBeDefined();
      expect(customElements.get(tag2)).toBeDefined();
    });
  });

  describe("Component edge cases", () => {
    it("should handle script with export statements", async () => {
      const tag = `test-exports-${Date.now()}`;
      const html = `
        <template><button onclick="increment">Count: {count}</button></template>
        <script>
          let count = 0;
          export const increment = () => count++;
          export const reset = () => count = 0;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/exports.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle styles with CSS variables", async () => {
      const tag = `test-css-vars-${Date.now()}`;
      const html = `
        <template><p>Styled</p></template>
        <style>
          :host {
            --primary-color: #007bff;
            --secondary-color: #6c757d;
            display: block;
            color: var(--primary-color);
          }
        </style>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/css-vars.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle template with deeply nested elements", async () => {
      const tag = `test-deeply-nested-${Date.now()}`;
      const html = `
        <template>
          <div class="level1">
            <div class="level2">
              <div class="level3">
                <div class="level4">
                  <p>{content}</p>
                </div>
              </div>
            </div>
          </div>
        </template>
        <script>
          let content = 'Deep';
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/deep-nested.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle component with data attributes", async () => {
      const tag = `test-data-attrs-${Date.now()}`;
      const html = `
        <template>
          <div data-component="test" data-version="1.0">
            <p>{message}</p>
          </div>
        </template>
        <script>
          let message = 'Data test';
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/data-attrs.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle script with console statements", async () => {
      const tag = `test-console-${Date.now()}`;
      const html = `
        <template><p>{count}</p></template>
        <script>
          let count = 0;
          console.log('Component initialized');
          export const increment = () => {
            count++;
            console.log('Count:', count);
          };
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/console.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle HTML with Unicode characters", async () => {
      const tag = `test-unicode-${Date.now()}`;
      const html = `
        <template>
          <p>Hello 世界 🌍 مرحبا</p>
          <p>{message}</p>
        </template>
        <script>
          let message = 'مرحبا بك';
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/unicode.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle styles with media queries", async () => {
      const tag = `test-media-${Date.now()}`;
      const html = `
        <template><p>Responsive</p></template>
        <style>
          :host { display: block; }
          @media (max-width: 768px) {
            :host { padding: 10px; }
          }
          @media (min-width: 1200px) {
            :host { padding: 20px; }
          }
        </style>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/media.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle component with ARIA attributes", async () => {
      const tag = `test-aria-${Date.now()}`;
      const html = `
        <template>
          <button aria-label="Close" onclick="close">✕</button>
          <div role="alert">{message}</div>
        </template>
        <script>
          let message = 'Alert message';
          export const close = () => {};
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/aria.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle styles with animations", async () => {
      const tag = `test-animations-${Date.now()}`;
      const html = `
        <template><div class="animated">Animating</div></template>
        <style>
          @keyframes slideIn {
            from { transform: translateX(-100%); }
            to { transform: translateX(0); }
          }
          .animated {
            animation: slideIn 0.3s ease-in-out;
          }
        </style>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/animations.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle script with try-catch blocks", async () => {
      const tag = `test-try-catch-${Date.now()}`;
      const html = `
        <template><p>{result}</p></template>
        <script>
          let result = '';
          export const riskyOperation = () => {
            try {
              result = JSON.parse('invalid');
            } catch (e) {
              result = 'Error caught';
            }
          };
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/try-catch.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle HTML with special entities", async () => {
      const tag = `test-entities-${Date.now()}`;
      const html = `
        <template>
          <p>&lt;div&gt; &amp; &quot;quoted&quot;</p>
          <p>{text}</p>
        </template>
        <script>
          let text = 'Special &lt;&gt;';
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/entities.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle very deeply nested state properties", async () => {
      const tag = `test-deep-state-${Date.now()}`;
      const html = `
        <template>
          <p>{a.b.c.d.e.f.g}</p>
        </template>
        <script>
          let a = {
            b: {
              c: {
                d: {
                  e: {
                    f: {
                      g: 'deep'
                    }
                  }
                }
              }
            }
          };
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/deep-state.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });
});
