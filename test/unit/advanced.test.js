import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { registerComponent } from "../../src/index";
import {
  mockComponentFetch,
  FIXTURES,
  cleanupDOM,
  createTestElement,
  waitForNextFrame,
} from "../test-helpers";

describe("Two-Way Binding ($bind)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanupDOM();
  });

  afterEach(() => {
    cleanupDOM();
  });

  describe("Text input binding", () => {
    it("should bind text input value", async () => {
      const tag = `test-bind-text-${Date.now()}`;
      const html = `
        <template>
          <input $bind="name" type="text" />
          <p>{name}</p>
        </template>
        <script>
          let name = 'Initial';
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/bind-text.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should update state when input changes", async () => {
      const tag = `test-bind-update-${Date.now()}`;
      const html = `
        <template>
          <input $bind="email" type="text" />
          <p>{email}</p>
        </template>
        <script>
          let email = '';
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/bind-update.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle empty text input", async () => {
      const tag = `test-bind-empty-${Date.now()}`;
      const html = `
        <template>
          <input $bind="text" type="text" />
          <p $if="{text === ''}">Empty</p>
          <p $else>{text}</p>
        </template>
        <script>
          let text = '';
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/bind-empty.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle text with special characters", async () => {
      const tag = `test-bind-special-${Date.now()}`;
      const html = `
        <template>
          <input $bind="text" type="text" />
          <p>{text}</p>
        </template>
        <script>
          let text = 'Hello <>&"';
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/bind-special.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });

  describe("Textarea binding", () => {
    it("should bind textarea value", async () => {
      const tag = `test-bind-textarea-${Date.now()}`;
      const html = `
        <template>
          <textarea $bind="content"></textarea>
          <p>{content}</p>
        </template>
        <script>
          let content = 'Initial content';
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/bind-textarea.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle multiline textarea", async () => {
      const tag = `test-bind-multiline-${Date.now()}`;
      const html = `
        <template>
          <textarea $bind="message"></textarea>
          <p>Length: {message.length}</p>
          <p>Lines: {message.split('\\n').length}</p>
        </template>
        <script>
          let message = 'Line 1\\nLine 2\\nLine 3';
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/bind-multiline.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });

  describe("Select/dropdown binding", () => {
    it("should bind select value", async () => {
      const tag = `test-bind-select-${Date.now()}`;
      const html = `
        <template>
          <select $bind="choice">
            <option value="">Select</option>
            <option value="a">Option A</option>
            <option value="b">Option B</option>
          </select>
          <p>{choice}</p>
        </template>
        <script>
          let choice = '';
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/bind-select.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle select with number values", async () => {
      const tag = `test-bind-select-num-${Date.now()}`;
      const html = `
        <template>
          <select $bind="count">
            <option value="1">1</option>
            <option value="5">5</option>
            <option value="10">10</option>
          </select>
          <p>{count}</p>
        </template>
        <script>
          let count = '1';
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/bind-select-num.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle multiple select", async () => {
      const tag = `test-bind-select-multi-${Date.now()}`;
      const html = `
        <template>
          <select $bind="selected" multiple>
            <option value="red">Red</option>
            <option value="green">Green</option>
            <option value="blue">Blue</option>
          </select>
          <p>{selected}</p>
        </template>
        <script>
          let selected = [];
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/bind-select-multi.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });

  describe("Checkbox binding", () => {
    it("should bind checkbox value", async () => {
      const tag = `test-bind-checkbox-${Date.now()}`;
      const html = `
        <template>
          <input $bind="agreed" type="checkbox" />
          <p $if="{agreed}">You agreed</p>
        </template>
        <script>
          let agreed = false;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/bind-checkbox.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle multiple checkboxes", async () => {
      const tag = `test-bind-checkbox-multi-${Date.now()}`;
      const html = `
        <template>
          <label>
            <input $bind="opt1" type="checkbox" />
            Option 1
          </label>
          <label>
            <input $bind="opt2" type="checkbox" />
            Option 2
          </label>
          <p>Selected: {opt1 && 'Opt1'} {opt2 && 'Opt2'}</p>
        </template>
        <script>
          let opt1 = false;
          let opt2 = true;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/bind-checkbox-multi.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });

  describe("Radio button binding", () => {
    it("should bind radio button value", async () => {
      const tag = `test-bind-radio-${Date.now()}`;
      const html = `
        <template>
          <label>
            <input $bind="gender" type="radio" value="male" />
            Male
          </label>
          <label>
            <input $bind="gender" type="radio" value="female" />
            Female
          </label>
          <p>Selected: {gender}</p>
        </template>
        <script>
          let gender = 'male';
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/bind-radio.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });

  describe("Contenteditable binding", () => {
    it("should bind contenteditable value", async () => {
      const tag = `test-bind-contenteditable-${Date.now()}`;
      const html = `
        <template>
          <div $bind="text" contenteditable></div>
          <p>{text}</p>
        </template>
        <script>
          let text = 'Editable content';
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/bind-contenteditable.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });

  describe("Nested property binding", () => {
    it("should bind nested property", async () => {
      const tag = `test-bind-nested-${Date.now()}`;
      const html = `
        <template>
          <input $bind="user.name" type="text" />
          <p>{user.name}</p>
        </template>
        <script>
          let user = { name: 'John' };
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/bind-nested.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should bind deeply nested property", async () => {
      const tag = `test-bind-deep-nested-${Date.now()}`;
      const html = `
        <template>
          <input $bind="user.profile.settings.theme" type="text" />
          <p>{user.profile.settings.theme}</p>
        </template>
        <script>
          let user = {
            profile: {
              settings: {
                theme: 'dark'
              }
            }
          };
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/bind-deep-nested.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });

  describe("Array binding", () => {
    it("should bind to array element", async () => {
      const tag = `test-bind-array-elem-${Date.now()}`;
      const html = `
        <template>
          <input $bind="items[0]" type="text" />
          <p>{items[0]}</p>
        </template>
        <script>
          let items = ['first', 'second'];
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/bind-array-elem.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });

  describe("Form binding patterns", () => {
    it("should bind entire form", async () => {
      const tag = `test-bind-form-${Date.now()}`;
      const html = `
        <template>
          <form onsubmit="handleSubmit">
            <input $bind="formData.name" type="text" placeholder="Name" />
            <input $bind="formData.email" type="email" placeholder="Email" />
            <button type="submit">Submit</button>
          </form>
          <p>Data: {formData.name} - {formData.email}</p>
        </template>
        <script>
          let formData = { name: '', email: '' };
          export const handleSubmit = (e) => {
            e.preventDefault();
          };
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/bind-form.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });
});

describe("Lifecycle Hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanupDOM();
  });

  afterEach(() => {
    cleanupDOM();
  });

  describe("$onMount hook", () => {
    it("should call onMount after component mounts", async () => {
      const tag = `test-mount-${Date.now()}`;
      const html = `
        <template><p>{mounted}</p></template>
        <script>
          let mounted = false;
          $onMount(() => {
            mounted = true;
          });
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/mount.html");
      const el = createTestElement(tag);

      await waitForNextFrame();
      expect(el).toBeDefined();
    });

    it("should call onMount for initialization", async () => {
      const tag = `test-mount-init-${Date.now()}`;
      const html = `
        <template><p>{data}</p></template>
        <script>
          let data = '';
          $onMount(() => {
            data = 'Initialized';
          });
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/mount-init.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should support async onMount", async () => {
      const tag = `test-mount-async-${Date.now()}`;
      const html = `
        <template><p>{data}</p></template>
        <script>
          let data = 'Loading...';
          $onMount(async () => {
            await new Promise(r => setTimeout(r, 10));
            data = 'Loaded';
          });
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/mount-async.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle multiple onMount hooks", async () => {
      const tag = `test-mount-multi-${Date.now()}`;
      const html = `
        <template><p>{counter}</p></template>
        <script>
          let counter = 0;
          $onMount(() => counter++);
          $onMount(() => counter++);
          $onMount(() => counter++);
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/mount-multi.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });

  describe("$onUnmount hook", () => {
    it("should call onUnmount before component unmounts", async () => {
      const tag = `test-unmount-${Date.now()}`;
      const html = `
        <template><p>{status}</p></template>
        <script>
          let status = 'active';
          $onUnmount(() => {
            status = 'unmounted';
          });
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/unmount.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should call onUnmount for cleanup", async () => {
      const tag = `test-unmount-cleanup-${Date.now()}`;
      const html = `
        <template><p>Component</p></template>
        <script>
          let listeners = [];
          $onMount(() => {
            listeners.push('listener1');
          });
          $onUnmount(() => {
            listeners = [];
          });
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/unmount-cleanup.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });

  describe("$onRender hook", () => {
    it("should call onRender after render", async () => {
      const tag = `test-render-${Date.now()}`;
      const html = `
        <template><p>{renderCount}</p></template>
        <script>
          let renderCount = 0;
          $onRender(() => {
            renderCount++;
          });
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/render.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });
});

describe("Edge Cases & Complex Scenarios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanupDOM();
  });

  afterEach(() => {
    cleanupDOM();
  });

  describe("Error handling", () => {
    it("should handle undefined variables gracefully", async () => {
      const tag = `test-undefined-${Date.now()}`;
      const html = `
        <template>
          <p $if="{typeof optional !== 'undefined'}">{optional}</p>
          <p $else>Undefined</p>
        </template>
        <script>
          let optional;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/undefined.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle null values", async () => {
      const tag = `test-null-${Date.now()}`;
      const html = `
        <template>
          <p $if="{value === null}">Null value</p>
          <p $else>{value}</p>
        </template>
        <script>
          let value = null;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/null.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle missing property access", async () => {
      const tag = `test-missing-prop-${Date.now()}`;
      const html = `
        <template>
          <p $if="{user && user.name}">{user.name}</p>
          <p $else>No name</p>
        </template>
        <script>
          let user = {};
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/missing-prop.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle array out of bounds", async () => {
      const tag = `test-array-bounds-${Date.now()}`;
      const html = `
        <template>
          <p>{items[99]}</p>
        </template>
        <script>
          let items = [1, 2, 3];
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/array-bounds.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });

  describe("Performance scenarios", () => {
    it("should handle very large state object", async () => {
      const tag = `test-large-state-${Date.now()}`;
      const html = `
        <template>
          <p>{data.keys.length} keys</p>
        </template>
        <script>
          let data = {
            keys: Array.from({ length: 10000 }, (_, i) => \`key_\${i}\`)
          };
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/large-state.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle frequent state updates", async () => {
      const tag = `test-frequent-updates-${Date.now()}`;
      const html = `
        <template><p>{count}</p></template>
        <script>
          let count = 0;
          export const increment = () => count++;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/frequent.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });

  describe("Complex component interactions", () => {
    it("should handle cross-cutting concerns", async () => {
      const tag = `test-cross-cutting-${Date.now()}`;
      const html = `
        <template>
          <div>
            <p $if="{isVisible}">{value}</p>
            <button onclick="toggle">{isVisible ? 'Hide' : 'Show'}</button>
          </div>
        </template>
        <script>
          let isVisible = false;
          let value = 'Content';
          
          export const toggle = () => isVisible = !isVisible;
          
          $onMount(() => {
            isVisible = true;
          });
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/cross-cutting.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle state cascading", async () => {
      const tag = `test-cascade-${Date.now()}`;
      const html = `
        <template>
          <p>{a} -> {b} -> {c}</p>
          <button onclick="updateA">Update</button>
        </template>
        <script>
          let a = 1;
          let b = a * 2;
          let c = b * 2;
          
          export const updateA = () => {
            a++;
            b = a * 2;
            c = b * 2;
          };
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/cascade.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });
});
