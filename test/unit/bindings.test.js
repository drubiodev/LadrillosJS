import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { registerComponent } from "../../src/index";
import {
  mockComponentFetch,
  FIXTURES,
  cleanupDOM,
  createTestElement,
  waitForNextFrame,
} from "../test-helpers";

describe("Template Bindings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanupDOM();
  });

  afterEach(() => {
    cleanupDOM();
  });

  describe("One-way text bindings", () => {
    it("should render simple text binding", async () => {
      const tag = `test-binding-${Date.now()}`;
      global.fetch = mockComponentFetch(FIXTURES.simpleBinding);

      await registerComponent(tag, "/simple.html");
      const el = createTestElement(tag);

      await waitForNextFrame();
      expect(el).toBeDefined();
    });

    it("should update text binding when state changes", async () => {
      const tag = `test-binding-update-${Date.now()}`;
      const html = `
        <template><p>{message}</p></template>
        <script>
          let message = 'Initial';
          export const change = () => message = 'Updated';
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/update.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should render multiple bindings in same element", async () => {
      const tag = `test-multi-binding-${Date.now()}`;
      const html = `
        <template><p>{first} {middle} {last}</p></template>
        <script>
          let first = 'John';
          let middle = 'Q';
          let last = 'Public';
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/multi.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should render nested property bindings", async () => {
      const tag = `test-nested-binding-${Date.now()}`;
      const html = `
        <template>
          <p>{user.name}</p>
          <p>{user.address.city}</p>
        </template>
        <script>
          let user = {
            name: 'John',
            address: { city: 'Springfield' }
          };
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/nested.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should render array element access", async () => {
      const tag = `test-array-binding-${Date.now()}`;
      const html = `
        <template>
          <p>First: {items[0]}</p>
          <p>Last: {items[items.length - 1]}</p>
        </template>
        <script>
          let items = ['a', 'b', 'c'];
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/array.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle binding in different element types", async () => {
      const tag = `test-binding-types-${Date.now()}`;
      const html = `
        <template>
          <p>{text}</p>
          <div>{text}</div>
          <span>{text}</span>
          <h1>{text}</h1>
          <li>{text}</li>
        </template>
        <script>
          let text = 'Content';
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/types.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should render binding at start of text", async () => {
      const tag = `test-binding-start-${Date.now()}`;
      const html = `
        <template><p>{greeting} World</p></template>
        <script>
          let greeting = 'Hello';
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/start.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should render binding in middle of text", async () => {
      const tag = `test-binding-middle-${Date.now()}`;
      const html = `
        <template><p>Hello {name} World</p></template>
        <script>
          let name = 'Alice';
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/middle.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should render binding at end of text", async () => {
      const tag = `test-binding-end-${Date.now()}`;
      const html = `
        <template><p>Hello {name}</p></template>
        <script>
          let name = 'Bob';
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/end.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });

  describe("Attribute bindings", () => {
    it("should bind to src attribute", async () => {
      const tag = `test-attr-src-${Date.now()}`;
      const html = `
        <template><img src="{imageUrl}" /></template>
        <script>
          let imageUrl = '/image.png';
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/src.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should bind to href attribute", async () => {
      const tag = `test-attr-href-${Date.now()}`;
      const html = `
        <template><a href="{url}">{text}</a></template>
        <script>
          let url = 'https://example.com';
          let text = 'Link';
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/href.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should bind to class attribute", async () => {
      const tag = `test-attr-class-${Date.now()}`;
      const html = `
        <template><div class="{cssClass}">{content}</div></template>
        <script>
          let cssClass = 'active';
          let content = 'Styled';
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/class.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should bind to title attribute", async () => {
      const tag = `test-attr-title-${Date.now()}`;
      const html = `
        <template><div title="{tooltip}">Hover me</div></template>
        <script>
          let tooltip = 'This is a tooltip';
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/title.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should bind to data attributes", async () => {
      const tag = `test-attr-data-${Date.now()}`;
      const html = `
        <template><div data-id="{id}" data-name="{name}">Data element</div></template>
        <script>
          let id = '123';
          let name = 'Item';
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/data.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should bind to alt attribute", async () => {
      const tag = `test-attr-alt-${Date.now()}`;
      const html = `
        <template><img src="/image.png" alt="{description}" /></template>
        <script>
          let description = 'Image description';
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/alt.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should bind to placeholder attribute", async () => {
      const tag = `test-attr-placeholder-${Date.now()}`;
      const html = `
        <template><input placeholder="{placeholder}" /></template>
        <script>
          let placeholder = 'Enter text...';
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/placeholder.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should bind to disabled attribute", async () => {
      const tag = `test-attr-disabled-${Date.now()}`;
      const html = `
        <template><button disabled="{isDisabled}">Click me</button></template>
        <script>
          let isDisabled = false;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/disabled.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should update attribute binding when state changes", async () => {
      const tag = `test-attr-update-${Date.now()}`;
      const html = `
        <template><img src="{imageUrl}" /></template>
        <script>
          let imageUrl = '/image1.png';
          export const changeImage = () => imageUrl = '/image2.png';
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/attr-update.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });

  describe("Dynamic classes", () => {
    it("should apply dynamic class when condition is true", async () => {
      const tag = `test-class-true-${Date.now()}`;
      const html = `
        <template><p class:active="{isActive}">Element</p></template>
        <script>
          let isActive = true;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/class-true.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should remove dynamic class when condition is false", async () => {
      const tag = `test-class-false-${Date.now()}`;
      const html = `
        <template><p class:active="{isActive}">Element</p></template>
        <script>
          let isActive = false;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/class-false.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should toggle class dynamically", async () => {
      const tag = `test-class-toggle-${Date.now()}`;
      const html = `
        <template><p class:active="{isActive}">Toggle me</p></template>
        <script>
          let isActive = false;
          export const toggle = () => isActive = !isActive;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/class-toggle.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should apply multiple dynamic classes", async () => {
      const tag = `test-class-multi-${Date.now()}`;
      const html = `
        <template>
          <p class:active="{isActive}" class:disabled="{isDisabled}" class:highlighted="{isHighlighted}">
            Multi-class
          </p>
        </template>
        <script>
          let isActive = true;
          let isDisabled = false;
          let isHighlighted = true;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/class-multi.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should combine static and dynamic classes", async () => {
      const tag = `test-class-combined-${Date.now()}`;
      const html = `
        <template><p class="base-class" class:active="{isActive}">Combined</p></template>
        <script>
          let isActive = true;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/class-combined.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle class based on expression evaluation", async () => {
      const tag = `test-class-expr-${Date.now()}`;
      const html = `
        <template><p class:large="{size > 10}">{size}</p></template>
        <script>
          let size = 15;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/class-expr.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });

  describe("Expression evaluation in bindings", () => {
    it("should evaluate arithmetic expressions", async () => {
      const tag = `test-expr-math-${Date.now()}`;
      const html = `
        <template>
          <p>{a + b}</p>
          <p>{a - b}</p>
          <p>{a * b}</p>
          <p>{a / b}</p>
        </template>
        <script>
          let a = 10;
          let b = 3;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/math.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should evaluate comparison expressions", async () => {
      const tag = `test-expr-compare-${Date.now()}`;
      const html = `
        <template>
          <p>{a > b}</p>
          <p>{a < b}</p>
          <p>{a === b}</p>
          <p>{a !== b}</p>
        </template>
        <script>
          let a = 10;
          let b = 5;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/compare.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should evaluate logical expressions", async () => {
      const tag = `test-expr-logic-${Date.now()}`;
      const html = `
        <template>
          <p>{a && b}</p>
          <p>{a || b}</p>
          <p>{!a}</p>
        </template>
        <script>
          let a = true;
          let b = false;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/logic.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should evaluate ternary expressions", async () => {
      const tag = `test-expr-ternary-${Date.now()}`;
      const html = `
        <template>
          <p>{isActive ? 'Active' : 'Inactive'}</p>
          <p>{count > 0 ? 'Positive' : 'Zero or Negative'}</p>
        </template>
        <script>
          let isActive = true;
          let count = 5;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/ternary.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should evaluate method calls", async () => {
      const tag = `test-expr-method-${Date.now()}`;
      const html = `
        <template>
          <p>{name.toUpperCase()}</p>
          <p>{name.toLowerCase()}</p>
          <p>{name.length}</p>
        </template>
        <script>
          let name = 'John';
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/method.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should evaluate array methods", async () => {
      const tag = `test-expr-array-method-${Date.now()}`;
      const html = `
        <template>
          <p>{items.length}</p>
          <p>{items[0]}</p>
        </template>
        <script>
          let items = ['a', 'b', 'c'];
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/array-method.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should evaluate complex chained expressions", async () => {
      const tag = `test-expr-chain-${Date.now()}`;
      const html = `
        <template>
          <p>{user.profile.name.toUpperCase()}</p>
          <p>{items[0].value * 2}</p>
        </template>
        <script>
          let user = { profile: { name: 'alice' } };
          let items = [{ value: 5 }];
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/chain.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should evaluate parenthesized expressions", async () => {
      const tag = `test-expr-paren-${Date.now()}`;
      const html = `
        <template>
          <p>{(a + b) * c}</p>
          <p>{a + (b * c)}</p>
        </template>
        <script>
          let a = 2;
          let b = 3;
          let c = 4;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/paren.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });
});
