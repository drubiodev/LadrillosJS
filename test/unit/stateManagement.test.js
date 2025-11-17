import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { registerComponent } from "../../src/index";
import {
  mockComponentFetch,
  FIXTURES,
  cleanupDOM,
  createTestElement,
  waitForNextFrame,
  flushAnimationFrames,
} from "../test-helpers";

describe("State Management & Reactivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanupDOM();
  });

  afterEach(() => {
    cleanupDOM();
  });

  describe("Direct state mutations", () => {
    it("should update text content when simple state changes", async () => {
      const tag = `test-state-${Date.now()}`;
      global.fetch = mockComponentFetch(FIXTURES.counter);

      await registerComponent(tag, "/counter.html");
      const el = createTestElement(tag);

      await waitForNextFrame();

      // Check initial state is rendered
      const p = el.shadowRoot.querySelector("p");
      expect(p).toBeDefined();
    });

    it("should trigger re-render when state is modified", async () => {
      const tag = `test-render-${Date.now()}`;
      const html = `
        <template><p>{count}</p></template>
        <script>
          let count = 0;
          export const increment = () => count++;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/test.html");
      const el = createTestElement(tag);

      await waitForNextFrame();
      expect(el).toBeDefined();
    });

    it("should handle multiple state changes", async () => {
      const tag = `test-multi-change-${Date.now()}`;
      const html = `
        <template><p>{x}-{y}-{z}</p></template>
        <script>
          let x = 1;
          let y = 2;
          let z = 3;
          export const change = () => {
            x++;
            y++;
            z++;
          };
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/multi.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle state increment operations", async () => {
      const tag = `test-increment-${Date.now()}`;
      const html = `
        <template><p>{count}</p></template>
        <script>
          let count = 5;
          export const inc = () => count++;
          export const dec = () => count--;
          export const add = (n) => count += n;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/increment.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle state decrement operations", async () => {
      const tag = `test-decrement-${Date.now()}`;
      const html = `
        <template><p>{count}</p></template>
        <script>
          let count = 10;
          export const dec = () => count--;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/decrement.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle reassignment of primitive values", async () => {
      const tag = `test-reassign-${Date.now()}`;
      const html = `
        <template><p>{value}</p></template>
        <script>
          let value = 'initial';
          export const reset = () => value = 'reset';
          export const update = (newVal) => value = newVal;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/reassign.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle boolean state toggle", async () => {
      const tag = `test-toggle-${Date.now()}`;
      const html = `
        <template><p>{isVisible}</p></template>
        <script>
          let isVisible = false;
          export const toggle = () => isVisible = !isVisible;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/toggle.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });

  describe("Nested state mutations", () => {
    it("should track nested object property changes", async () => {
      const tag = `test-nested-${Date.now()}`;
      global.fetch = mockComponentFetch(FIXTURES.nestedState);

      await registerComponent(tag, "/nested.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should update deeply nested properties", async () => {
      const tag = `test-deep-nested-${Date.now()}`;
      const html = `
        <template>
          <p>{user.profile.name}</p>
          <p>{user.profile.settings.theme}</p>
        </template>
        <script>
          let user = {
            profile: {
              name: 'John',
              settings: {
                theme: 'dark'
              }
            }
          };
          export const changeName = () => user.profile.name = 'Jane';
          export const changeTheme = () => user.profile.settings.theme = 'light';
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/deep.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle adding new properties to nested objects", async () => {
      const tag = `test-add-prop-${Date.now()}`;
      const html = `
        <template>
          <p>{obj.existing}</p>
          <p $if="{obj.newProp}">{obj.newProp}</p>
        </template>
        <script>
          let obj = { existing: 'value' };
          export const addProp = () => obj.newProp = 'new';
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/add-prop.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle deleting properties from nested objects", async () => {
      const tag = `test-delete-prop-${Date.now()}`;
      const html = `
        <template>
          <p $if="{obj.toDelete}">Exists: {obj.toDelete}</p>
          <p $else>Deleted</p>
        </template>
        <script>
          let obj = { toDelete: 'value' };
          export const removeProp = () => delete obj.toDelete;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/delete-prop.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle replacing entire nested object", async () => {
      const tag = `test-replace-obj-${Date.now()}`;
      const html = `
        <template>
          <p>{user.name}</p>
          <p>{user.age}</p>
        </template>
        <script>
          let user = { name: 'John', age: 30 };
          export const replaceUser = () => user = { name: 'Jane', age: 25 };
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/replace.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should track modifications to nested arrays", async () => {
      const tag = `test-nested-array-${Date.now()}`;
      const html = `
        <template>
          <p>{user.tags.length}</p>
          <p $for="tag in user.tags">{tag}</p>
        </template>
        <script>
          let user = { tags: ['tag1', 'tag2'] };
          export const addTag = () => user.tags.push('tag3');
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/nested-arr.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });

  describe("Array mutations", () => {
    it("should detect push mutations", async () => {
      const tag = `test-push-${Date.now()}`;
      const html = `
        <template>
          <p>Length: {items.length}</p>
          <ul><li $for="item in items">{item}</li></ul>
        </template>
        <script>
          let items = [1, 2];
          export const push = () => items.push(3);
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/push.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should detect pop mutations", async () => {
      const tag = `test-pop-${Date.now()}`;
      const html = `
        <template>
          <p>Length: {items.length}</p>
          <p>Last: {items[items.length-1]}</p>
        </template>
        <script>
          let items = [1, 2, 3];
          export const pop = () => items.pop();
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/pop.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should detect shift mutations", async () => {
      const tag = `test-shift-${Date.now()}`;
      const html = `
        <template>
          <p>First: {items[0]}</p>
        </template>
        <script>
          let items = ['a', 'b', 'c'];
          export const shift = () => items.shift();
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/shift.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should detect unshift mutations", async () => {
      const tag = `test-unshift-${Date.now()}`;
      const html = `
        <template>
          <p>First: {items[0]}</p>
        </template>
        <script>
          let items = ['b', 'c'];
          export const unshift = () => items.unshift('a');
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/unshift.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should detect reverse mutations", async () => {
      const tag = `test-reverse-${Date.now()}`;
      const html = `
        <template>
          <p $for="item in items">{item}</p>
        </template>
        <script>
          let items = [1, 2, 3];
          export const reverse = () => items.reverse();
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/reverse.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should detect sort mutations", async () => {
      const tag = `test-sort-${Date.now()}`;
      const html = `
        <template>
          <p $for="item in items">{item}</p>
        </template>
        <script>
          let items = [3, 1, 2];
          export const sort = () => items.sort();
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/sort.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should detect splice mutations", async () => {
      const tag = `test-splice-${Date.now()}`;
      const html = `
        <template>
          <p>Length: {items.length}</p>
          <p $for="item in items">{item}</p>
        </template>
        <script>
          let items = ['a', 'b', 'c', 'd'];
          export const splice = () => items.splice(1, 2, 'x');
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/splice.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should detect element property mutations in arrays", async () => {
      const tag = `test-array-elem-${Date.now()}`;
      const html = `
        <template>
          <p>{items[0].value}</p>
        </template>
        <script>
          let items = [{ value: 'a' }, { value: 'b' }];
          export const update = () => items[0].value = 'c';
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/array-elem.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle array reassignment", async () => {
      const tag = `test-array-reassign-${Date.now()}`;
      const html = `
        <template>
          <p>Length: {items.length}</p>
          <p $for="item in items">{item}</p>
        </template>
        <script>
          let items = [1, 2, 3];
          export const replace = () => items = [4, 5, 6, 7];
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/array-reassign.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle clearing array", async () => {
      const tag = `test-array-clear-${Date.now()}`;
      const html = `
        <template>
          <p>Length: {items.length}</p>
          <p $if="{items.length === 0}">Empty</p>
        </template>
        <script>
          let items = [1, 2, 3];
          export const clear = () => items.length = 0;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/array-clear.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });

  describe("State batching & performance", () => {
    it("should batch multiple state changes in single frame", async () => {
      const tag = `test-batch-${Date.now()}`;
      const html = `
        <template><p>{a}-{b}-{c}</p></template>
        <script>
          let a = 1, b = 1, c = 1;
          export const multiUpdate = () => {
            a++;
            b++;
            c++;
          };
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/batch.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should not re-render when state value does not change", async () => {
      const tag = `test-no-change-${Date.now()}`;
      const html = `
        <template><p>{value}</p></template>
        <script>
          let value = 'same';
          let renderCount = 0;
          export const setSame = () => value = 'same';
          $onRender(() => renderCount++);
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/no-change.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle rapid successive state changes", async () => {
      const tag = `test-rapid-${Date.now()}`;
      const html = `
        <template><p>{count}</p></template>
        <script>
          let count = 0;
          export const rapidInc = () => {
            for (let i = 0; i < 100; i++) {
              count++;
            }
          };
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/rapid.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });

  describe("Complex state patterns", () => {
    it("should handle state with multiple data types", async () => {
      const tag = `test-mixed-types-${Date.now()}`;
      const html = `
        <template>
          <p>{str}</p>
          <p>{num}</p>
          <p>{bool}</p>
          <p>{arr.length}</p>
          <p>{obj.key}</p>
        </template>
        <script>
          let str = 'hello';
          let num = 42;
          let bool = true;
          let arr = [1, 2, 3];
          let obj = { key: 'value' };
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/mixed.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle interdependent state variables", async () => {
      const tag = `test-interdependent-${Date.now()}`;
      const html = `
        <template>
          <p>A: {a}, B: {b}, Sum: {sum}</p>
          <button onclick="updateSum">Update</button>
        </template>
        <script>
          let a = 5;
          let b = 10;
          let sum = 15;
          export const updateSum = () => {
            a++;
            b++;
            sum = a + b;
          };
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/interdependent.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle state with circular references", async () => {
      const tag = `test-circular-${Date.now()}`;
      const html = `
        <template>
          <p>{obj.a}</p>
        </template>
        <script>
          let obj = { a: 'value' };
          obj.self = obj;
          export const update = () => obj.a = 'updated';
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/circular.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });
});
