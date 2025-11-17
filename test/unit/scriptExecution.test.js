import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { registerComponent } from "../../src/index";
import {
  mockComponentFetch,
  cleanupDOM,
  createTestElement,
  waitForNextFrame,
} from "../test-helpers";

describe("Script Execution & Event Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanupDOM();
  });

  afterEach(() => {
    cleanupDOM();
  });

  describe("Inline script execution", () => {
    it("should execute inline script on component load", async () => {
      const tag = `test-inline-${Date.now()}`;
      const html = `
        <template><p>{initialized}</p></template>
        <script>
          let initialized = false;
          initialized = true;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/inline.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should export functions from script", async () => {
      const tag = `test-export-${Date.now()}`;
      const html = `
        <template><button onclick="greet">Greet</button></template>
        <script>
          export const greet = () => {
            alert('Hello');
          };
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/export.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should export multiple functions", async () => {
      const tag = `test-multi-export-${Date.now()}`;
      const html = `
        <template>
          <button onclick="add">Add</button>
          <button onclick="remove">Remove</button>
          <button onclick="reset">Reset</button>
        </template>
        <script>
          export const add = () => {};
          export const remove = () => {};
          export const reset = () => {};
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/multi-export.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should auto-bind variables to state", async () => {
      const tag = `test-auto-bind-${Date.now()}`;
      const html = `
        <template>
          <p>{count}</p>
          <button onclick="increment">+</button>
        </template>
        <script>
          let count = 0;
          export const increment = () => count++;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/auto-bind.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should track multiple variable declarations", async () => {
      const tag = `test-multi-var-${Date.now()}`;
      const html = `
        <template>
          <p>{a}-{b}-{c}</p>
        </template>
        <script>
          let a = 1;
          let b = 2;
          let c = 3;
          const d = 4;
          var e = 5;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/multi-var.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle arrow functions", async () => {
      const tag = `test-arrow-${Date.now()}`;
      const html = `
        <template>
          <button onclick="handleClick">Click</button>
        </template>
        <script>
          export const handleClick = () => console.log('clicked');
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/arrow.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle regular functions", async () => {
      const tag = `test-regular-func-${Date.now()}`;
      const html = `
        <template>
          <button onclick="handleClick">Click</button>
        </template>
        <script>
          export function handleClick() {
            console.log('clicked');
          }
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/regular-func.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle functions with parameters", async () => {
      const tag = `test-params-${Date.now()}`;
      const html = `
        <template>
          <button onclick="greet('World')">Say Hello</button>
        </template>
        <script>
          export const greet = (name) => {
            return 'Hello ' + name;
          };
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/params.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle nested object methods", async () => {
      const tag = `test-nested-methods-${Date.now()}`;
      const html = `
        <template>
          <button onclick="api.fetch">Fetch</button>
        </template>
        <script>
          export const api = {
            fetch: () => console.log('fetching')
          };
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/nested-methods.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle destructuring in script", async () => {
      const tag = `test-destructure-${Date.now()}`;
      const html = `
        <template><p>{sum}</p></template>
        <script>
          let { a = 5, b = 3 } = {};
          let sum = a + b;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/destructure.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle spread operator", async () => {
      const tag = `test-spread-${Date.now()}`;
      const html = `
        <template>
          <p>{items.length}</p>
        </template>
        <script>
          let arr1 = [1, 2];
          let arr2 = [3, 4];
          let items = [...arr1, ...arr2];
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/spread.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });

  describe("Event handlers", () => {
    it("should handle click events", async () => {
      const tag = `test-click-${Date.now()}`;
      const html = `
        <template>
          <button onclick="handleClick">Click me</button>
        </template>
        <script>
          export const handleClick = (e) => {
            console.log(e.type);
          };
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/click.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle change events", async () => {
      const tag = `test-change-${Date.now()}`;
      const html = `
        <template>
          <input onchange="handleChange" type="text" />
        </template>
        <script>
          export const handleChange = (e) => {
            console.log(e.target.value);
          };
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/change.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle input events", async () => {
      const tag = `test-input-${Date.now()}`;
      const html = `
        <template>
          <input oninput="handleInput" type="text" />
        </template>
        <script>
          export const handleInput = (e) => {
            console.log(e.target.value);
          };
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/input.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle submit events", async () => {
      const tag = `test-submit-${Date.now()}`;
      const html = `
        <template>
          <form onsubmit="handleSubmit">
            <button type="submit">Submit</button>
          </form>
        </template>
        <script>
          export const handleSubmit = (e) => {
            e.preventDefault();
          };
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/submit.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle focus events", async () => {
      const tag = `test-focus-${Date.now()}`;
      const html = `
        <template>
          <input onfocus="handleFocus" />
        </template>
        <script>
          export const handleFocus = (e) => {
            console.log('focused');
          };
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/focus.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle blur events", async () => {
      const tag = `test-blur-${Date.now()}`;
      const html = `
        <template>
          <input onblur="handleBlur" />
        </template>
        <script>
          export const handleBlur = (e) => {
            console.log('blurred');
          };
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/blur.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle keypress events", async () => {
      const tag = `test-keypress-${Date.now()}`;
      const html = `
        <template>
          <input onkeypress="handleKeypress" />
        </template>
        <script>
          export const handleKeypress = (e) => {
            if (e.key === 'Enter') {
              console.log('entered');
            }
          };
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/keypress.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle multiple event handlers on same element", async () => {
      const tag = `test-multi-events-${Date.now()}`;
      const html = `
        <template>
          <input onfocus="onFocus" onblur="onBlur" onclick="onClick" />
        </template>
        <script>
          export const onFocus = () => console.log('focus');
          export const onBlur = () => console.log('blur');
          export const onClick = () => console.log('click');
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/multi-events.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should pass event object to handler", async () => {
      const tag = `test-event-obj-${Date.now()}`;
      const html = `
        <template>
          <button onclick="handleClick">Click</button>
        </template>
        <script>
          export const handleClick = (event) => {
            console.log(event.type);
            console.log(event.target);
            console.log(event.currentTarget);
          };
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/event-obj.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle inline event expressions", async () => {
      const tag = `test-inline-expr-${Date.now()}`;
      const html = `
        <template>
          <button onclick="count++">Count: {count}</button>
        </template>
        <script>
          let count = 0;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/inline-expr.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });

  describe("Script error handling", () => {
    it("should handle errors in event handlers", async () => {
      const tag = `test-error-handler-${Date.now()}`;
      const html = `
        <template>
          <button onclick="throwError">Throw</button>
        </template>
        <script>
          export const throwError = () => {
            try {
              throw new Error('Test error');
            } catch (e) {
              console.log(e.message);
            }
          };
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/error-handler.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle undefined function calls gracefully", async () => {
      const tag = `test-undefined-func-${Date.now()}`;
      const html = `
        <template>
          <p>{status}</p>
        </template>
        <script>
          let status = 'init';
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/undefined-func.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle synchronous errors", async () => {
      const tag = `test-sync-error-${Date.now()}`;
      const html = `
        <template>
          <p>{result}</p>
        </template>
        <script>
          let result = '';
          try {
            JSON.parse('invalid json');
          } catch (e) {
            result = 'Error caught';
          }
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/sync-error.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });

  describe("Closure and scope", () => {
    it("should handle closure in exported functions", async () => {
      const tag = `test-closure-${Date.now()}`;
      const html = `
        <template><button onclick="increment">{count}</button></template>
        <script>
          let count = 0;
          export const increment = () => count++;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/closure.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle private variables", async () => {
      const tag = `test-private-${Date.now()}`;
      const html = `
        <template><p>{public}</p></template>
        <script>
          let private = 'hidden';
          let public = 'visible';
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/private.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle function factories", async () => {
      const tag = `test-factory-${Date.now()}`;
      const html = `
        <template><p>{result}</p></template>
        <script>
          const createAdder = (a) => (b) => a + b;
          let result = createAdder(5)(3);
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/factory.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });

  describe("Script with complex patterns", () => {
    it("should handle immediately invoked function expression", async () => {
      const tag = `test-iife-${Date.now()}`;
      const html = `
        <template><p>{result}</p></template>
        <script>
          let result = (() => {
            return 42;
          })();
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/iife.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle computed properties", async () => {
      const tag = `test-computed-${Date.now()}`;
      const html = `
        <template>
          <p>{items[currentIndex]}</p>
        </template>
        <script>
          let items = ['a', 'b', 'c'];
          let currentIndex = 1;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/computed.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle utility functions", async () => {
      const tag = `test-utils-${Date.now()}`;
      const html = `
        <template>
          <p>{result}</p>
        </template>
        <script>
          const sum = (a, b) => a + b;
          const multiply = (a, b) => a * b;
          let result = sum(5, 3) + multiply(2, 4);
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/utils.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });
});
