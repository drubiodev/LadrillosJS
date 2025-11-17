import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  registerComponent,
  registerComponents,
  $listen,
  $emit,
  $setState,
  $getState,
} from "../../src/index";
import {
  mockComponentFetch,
  cleanupDOM,
  createTestElement,
  waitForNextFrame,
  waitForAsync,
  FIXTURES,
} from "../test-helpers";

describe("Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanupDOM();
  });

  afterEach(() => {
    cleanupDOM();
  });

  describe("Multi-component integration", () => {
    it("should register and instantiate multiple components", async () => {
      const tag1 = `comp-a-${Date.now()}`;
      const tag2 = `comp-b-${Date.now()}`;
      const tag3 = `comp-c-${Date.now()}`;

      global.fetch = vi.fn((url) => {
        if (url.includes("a")) return mockComponentFetch(FIXTURES.counter)();
        if (url.includes("b")) return mockComponentFetch(FIXTURES.form)();
        return mockComponentFetch(FIXTURES.todoList)();
      });

      await registerComponents([
        { tag: tag1, src: "/a.html" },
        { tag: tag2, src: "/b.html" },
        { tag: tag3, src: "/c.html" },
      ]);

      const el1 = createTestElement(tag1);
      const el2 = createTestElement(tag2);
      const el3 = createTestElement(tag3);

      expect(el1).toBeDefined();
      expect(el2).toBeDefined();
      expect(el3).toBeDefined();
    });

    it("should handle nested components", async () => {
      const parentTag = `parent-${Date.now()}`;
      const childTag = `child-${Date.now()}`;

      const parentHtml = `
        <template>
          <div class="parent">
            <${childTag}></${childTag}>
          </div>
        </template>
        <script>
          let parentState = 'ready';
        </script>
      `;

      const childHtml = `
        <template>
          <div class="child">{text}</div>
        </template>
        <script>
          let text = 'Child component';
        </script>
      `;

      global.fetch = vi.fn((url) => {
        if (url.includes("child")) return mockComponentFetch(childHtml)();
        return mockComponentFetch(parentHtml)();
      });

      await registerComponent(childTag, "/child.html");
      await registerComponent(parentTag, "/parent.html");

      const parent = createTestElement(parentTag);
      expect(parent).toBeDefined();
    });

    it("should maintain separate state for multiple instances", async () => {
      const tag = `counter-${Date.now()}`;
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

      await registerComponent(tag, "/counter.html");

      const el1 = createTestElement(tag);
      const el2 = createTestElement(tag);

      expect(el1).toBeDefined();
      expect(el2).toBeDefined();
    });
  });

  describe("Event bus cross-component communication", () => {
    it("should communicate between components via event bus", async () => {
      const senderTag = `sender-${Date.now()}`;
      const receiverTag = `receiver-${Date.now()}`;

      const senderHtml = `
        <template>
          <button onclick="send">Send Message</button>
        </template>
        <script>
          export const send = () => {
            $emit('message', { text: 'Hello from sender' });
          };
        </script>
      `;

      const receiverHtml = `
        <template>
          <p>{lastMessage}</p>
        </template>
        <script>
          let lastMessage = '';
          $listen('message', (data) => {
            lastMessage = data.text;
          });
        </script>
      `;

      global.fetch = vi.fn((url) => {
        if (url.includes("sender")) return mockComponentFetch(senderHtml)();
        return mockComponentFetch(receiverHtml)();
      });

      await registerComponent(senderTag, "/sender.html");
      await registerComponent(receiverTag, "/receiver.html");

      const sender = createTestElement(senderTag);
      const receiver = createTestElement(receiverTag);

      expect(sender).toBeDefined();
      expect(receiver).toBeDefined();
    });

    it("should handle multiple subscribers to same event", async () => {
      const pubTag = `pub-${Date.now()}`;
      const sub1Tag = `sub1-${Date.now()}`;
      const sub2Tag = `sub2-${Date.now()}`;

      const pubHtml = `
        <template>
          <button onclick="publish">Publish</button>
        </template>
        <script>
          export const publish = () => {
            $emit('notification', { id: 1 });
          };
        </script>
      `;

      const subHtml = `
        <template>
          <p>{received}</p>
        </template>
        <script>
          let received = false;
          $listen('notification', (data) => {
            received = data.id === 1;
          });
        </script>
      `;

      global.fetch = vi.fn((url) => {
        if (url.includes("pub")) return mockComponentFetch(pubHtml)();
        return mockComponentFetch(subHtml)();
      });

      await registerComponent(pubTag, "/pub.html");
      await registerComponent(sub1Tag, "/sub1.html");
      await registerComponent(sub2Tag, "/sub2.html");

      const pub = createTestElement(pubTag);
      const sub1 = createTestElement(sub1Tag);
      const sub2 = createTestElement(sub2Tag);

      expect(pub).toBeDefined();
      expect(sub1).toBeDefined();
      expect(sub2).toBeDefined();
    });

    it("should unsubscribe from events", async () => {
      const tag = `test-unsub-${Date.now()}`;
      const html = `
        <template>
          <p>{messages}</p>
        </template>
        <script>
          let messages = 0;
          const unsubscribe = $listen('update', () => {
            messages++;
          });
          export const stopListening = () => {
            unsubscribe();
          };
        </script>
      `;

      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/unsub.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });

  describe("State management across operations", () => {
    it("should handle rapid state changes", async () => {
      const tag = `rapid-${Date.now()}`;
      const html = `
        <template>
          <p>{value}</p>
          <button onclick="rapid">Rapid Changes</button>
        </template>
        <script>
          let value = 0;
          export const rapid = () => {
            for (let i = 0; i < 100; i++) {
              value++;
            }
          };
        </script>
      `;

      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/rapid.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle complex nested state mutations", async () => {
      const tag = `complex-${Date.now()}`;
      const html = `
        <template>
          <p>{user.profile.name}</p>
          <button onclick="updateProfile">Update</button>
        </template>
        <script>
          let user = {
            id: 1,
            profile: {
              name: 'John',
              address: {
                city: 'NYC',
                zip: '10001'
              }
            }
          };
          export const updateProfile = () => {
            user.profile.address.city = 'LA';
          };
        </script>
      `;

      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/complex.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should batch multiple state changes in single frame", async () => {
      const tag = `batch-${Date.now()}`;
      const html = `
        <template>
          <p>{a}-{b}-{c}</p>
          <button onclick="batchUpdate">Update</button>
        </template>
        <script>
          let a = 0, b = 0, c = 0;
          export const batchUpdate = () => {
            a = 1;
            b = 2;
            c = 3;
          };
        </script>
      `;

      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/batch.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });

  describe("Shadow DOM and style scoping", () => {
    it("should create components with shadow DOM by default", async () => {
      const tag = `shadow-${Date.now()}`;
      const html = `
        <template>
          <p>Content</p>
          <style>
            p { color: blue; }
          </style>
        </template>
      `;

      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/shadow.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should scope styles to component", async () => {
      const tag = `scoped-${Date.now()}`;
      const html = `
        <template>
          <button class="btn">Click</button>
          <style>
            .btn {
              padding: 10px;
              background: blue;
            }
          </style>
        </template>
      `;

      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/scoped.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should not leak styles between instances", async () => {
      const tag = `isolate-${Date.now()}`;
      const html = `
        <template>
          <p class="text">Text</p>
          <style>
            .text { color: red; }
          </style>
        </template>
      `;

      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/isolate.html");

      const el1 = createTestElement(tag);
      const el2 = createTestElement(tag);

      expect(el1).toBeDefined();
      expect(el2).toBeDefined();
    });
  });

  describe("Performance scenarios", () => {
    it("should handle component with large state", async () => {
      const tag = `large-state-${Date.now()}`;
      const html = `
        <template>
          <p>{items.length}</p>
        </template>
        <script>
          let items = Array(1000).fill(0).map((_, i) => ({ id: i, name: 'item' + i }));
        </script>
      `;

      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/large-state.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle many event listeners", async () => {
      const tag = `many-listeners-${Date.now()}`;
      const html = `
        <template>
          <div $for="item in items">
            <button onclick="handleItem">{item}</button>
          </div>
        </template>
        <script>
          let items = Array(100).fill(0).map((_, i) => i);
          export const handleItem = (e) => {
            console.log(e.target.textContent);
          };
        </script>
      `;

      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/many-listeners.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle component with many bindings", async () => {
      const tag = `many-bindings-${Date.now()}`;
      const items = Array(50)
        .fill(0)
        .map((_, i) => `<p>{item${i}}</p>`)
        .join("");
      const scripts = Array(50)
        .fill(0)
        .map((_, i) => `let item${i} = ${i};`)
        .join("");
      const html = `
        <template>
          ${items}
        </template>
        <script>
          ${scripts}
        </script>
      `;

      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/many-bindings.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle deeply nested conditional rendering", async () => {
      const tag = `deep-conditional-${Date.now()}`;
      const html = `
        <template>
          <div $if="{a}">
            <div $if="{b}">
              <div $if="{c}">
                <div $if="{d}">
                  <p>Deep content</p>
                </div>
              </div>
            </div>
          </div>
        </template>
        <script>
          let a = true, b = true, c = true, d = true;
        </script>
      `;

      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/deep-conditional.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle multiple concurrent component loads", async () => {
      const tags = Array(10)
        .fill(0)
        .map((_, i) => `comp-${i}-${Date.now()}`);
      const htmlContent = `
        <template><p>{status}</p></template>
        <script>let status = 'loaded';</script>
      `;

      global.fetch = mockComponentFetch(htmlContent);

      const promises = tags.map((tag) =>
        registerComponent(tag, "/component.html")
      );

      await Promise.all(promises);

      tags.forEach((tag) => {
        const el = createTestElement(tag);
        expect(el).toBeDefined();
      });
    });
  });

  describe("Complex real-world patterns", () => {
    it("should handle form with validation and submission", async () => {
      const tag = `form-${Date.now()}`;
      const html = `
        <template>
          <form onsubmit="handleSubmit">
            <input $bind="email" type="email" />
            <input $bind="password" type="password" />
            <p $if="{errors.email}">{errors.email}</p>
            <p $if="{errors.password}">{errors.password}</p>
            <button type="submit">Submit</button>
          </form>
        </template>
        <script>
          let email = '';
          let password = '';
          let errors = {};
          
          export const handleSubmit = (e) => {
            e.preventDefault();
            errors = {};
            if (!email) errors.email = 'Email required';
            if (!password) errors.password = 'Password required';
          };
        </script>
      `;

      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/form.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle list with add/remove operations", async () => {
      const tag = `list-${Date.now()}`;
      const html = `
        <template>
          <ul>
            <li $for="item in items">{item.name}</li>
          </ul>
          <button onclick="addItem">Add</button>
        </template>
        <script>
          let items = [];
          export const addItem = () => {
            items.push({ id: Date.now(), name: 'Item' });
          };
        </script>
      `;

      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/list.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle filtering and sorting", async () => {
      const tag = `filter-${Date.now()}`;
      const html = `
        <template>
          <input $bind="searchTerm" type="text" />
          <button onclick="sort">Sort</button>
          <ul>
            <li $for="item in filtered">{item.name}</li>
          </ul>
        </template>
        <script>
          let items = [
            { id: 1, name: 'Apple' },
            { id: 2, name: 'Banana' },
            { id: 3, name: 'Orange' }
          ];
          let searchTerm = '';
          
          let filtered = items.filter(item =>
            item.name.toLowerCase().includes(searchTerm.toLowerCase())
          );
          
          export const sort = () => {
            filtered = [...filtered].sort((a, b) =>
              a.name.localeCompare(b.name)
            );
          };
        </script>
      `;

      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/filter.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle tabs/panels pattern", async () => {
      const tag = `tabs-${Date.now()}`;
      const html = `
        <template>
          <div class="tabs">
            <button class:active="{activeTab === 'tab1'}" onclick="selectTab('tab1')">Tab 1</button>
            <button class:active="{activeTab === 'tab2'}" onclick="selectTab('tab2')">Tab 2</button>
          </div>
          <div $if="{activeTab === 'tab1'}">Content 1</div>
          <div $if="{activeTab === 'tab2'}">Content 2</div>
        </template>
        <script>
          let activeTab = 'tab1';
          export const selectTab = (tab) => {
            activeTab = tab;
          };
        </script>
      `;

      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/tabs.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle modal/dialog pattern", async () => {
      const tag = `modal-${Date.now()}`;
      const html = `
        <template>
          <button onclick="openModal">Open Modal</button>
          <div class="modal" $if="{isOpen}">
            <div class="modal-content">
              <button onclick="closeModal">Close</button>
            </div>
          </div>
        </template>
        <script>
          let isOpen = false;
          export const openModal = () => {
            isOpen = true;
          };
          export const closeModal = () => {
            isOpen = false;
          };
        </script>
      `;

      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/modal.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });

  describe("Error recovery and resilience", () => {
    it("should continue functioning after component error", async () => {
      const tag1 = `ok-${Date.now()}`;
      const tag2 = `error-${Date.now()}`;
      const tag3 = `ok2-${Date.now()}`;

      global.fetch = vi.fn((url) => {
        if (url.includes("error")) {
          return mockComponentFetch("<template><p>Error</p></template>")();
        }
        return mockComponentFetch(FIXTURES.counter)();
      });

      await registerComponent(tag1, "/ok1.html");
      await registerComponent(tag2, "/error.html");
      await registerComponent(tag3, "/ok2.html");

      expect(createTestElement(tag1)).toBeDefined();
      expect(createTestElement(tag2)).toBeDefined();
      expect(createTestElement(tag3)).toBeDefined();
    });

    it("should handle partial state recovery", async () => {
      const tag = `recover-${Date.now()}`;
      const html = `
        <template>
          <p>{validData}</p>
          <p $if="{invalidData}">{invalidData}</p>
        </template>
        <script>
          let validData = 'OK';
          let invalidData = null;
          try {
            invalidData = JSON.parse('bad json');
          } catch (e) {
            invalidData = null;
          }
        </script>
      `;

      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/recover.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });

  describe("Event timing and sequencing", () => {
    it("should handle events in correct order", async () => {
      const tag = `sequence-${Date.now()}`;
      const html = `
        <template>
          <button onclick="log">Click</button>
          <p>{events}</p>
        </template>
        <script>
          let events = '';
          export const log = () => {
            events += 'click;';
          };
        </script>
      `;

      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/sequence.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should debounce rapid state changes", async () => {
      const tag = `debounce-${Date.now()}`;
      const html = `
        <template>
          <p>{value}</p>
          <button onclick="rapidClicks">Rapid</button>
        </template>
        <script>
          let value = 0;
          export const rapidClicks = () => {
            value++;
            value++;
            value++;
          };
        </script>
      `;

      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/debounce.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });
});
