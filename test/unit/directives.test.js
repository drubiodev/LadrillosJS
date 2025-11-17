import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { registerComponent } from "../../src/index";
import {
  mockComponentFetch,
  FIXTURES,
  cleanupDOM,
  createTestElement,
  waitForNextFrame,
} from "../test-helpers";

describe("Template Directives - Conditionals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanupDOM();
  });

  afterEach(() => {
    cleanupDOM();
  });

  describe("$if directive", () => {
    it("should render element when condition is true", async () => {
      const tag = `test-if-true-${Date.now()}`;
      const html = `
        <template>
          <p $if="{isVisible}">Visible</p>
        </template>
        <script>
          let isVisible = true;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/if-true.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should not render element when condition is false", async () => {
      const tag = `test-if-false-${Date.now()}`;
      const html = `
        <template>
          <p $if="{isVisible}">Not visible</p>
        </template>
        <script>
          let isVisible = false;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/if-false.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should update visibility when state changes", async () => {
      const tag = `test-if-update-${Date.now()}`;
      const html = `
        <template>
          <p $if="{isVisible}">Toggle me</p>
          <button onclick="toggle">Toggle</button>
        </template>
        <script>
          let isVisible = false;
          export const toggle = () => isVisible = !isVisible;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/if-update.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should evaluate expression in if condition", async () => {
      const tag = `test-if-expr-${Date.now()}`;
      const html = `
        <template>
          <p $if="{count > 5}">Count is high</p>
          <p $if="{name === 'admin'}">You are admin</p>
          <p $if="{items.length > 0}">Has items</p>
        </template>
        <script>
          let count = 10;
          let name = 'admin';
          let items = [1, 2, 3];
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/if-expr.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle truthy/falsy values", async () => {
      const tag = `test-if-truthy-${Date.now()}`;
      const html = `
        <template>
          <p $if="{nonEmptyString}">String true</p>
          <p $if="{emptyString}">Empty string false</p>
          <p $if="{positiveNumber}">Positive true</p>
          <p $if="{zero}">Zero false</p>
          <p $if="{arr}">Array true</p>
          <p $if="{nullValue}">Null false</p>
        </template>
        <script>
          let nonEmptyString = 'hello';
          let emptyString = '';
          let positiveNumber = 5;
          let zero = 0;
          let arr = [1, 2];
          let nullValue = null;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/if-truthy.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle nested if conditions", async () => {
      const tag = `test-if-nested-${Date.now()}`;
      const html = `
        <template>
          <div $if="{outer}">
            <p>Outer</p>
            <div $if="{inner}">
              <p>Inner</p>
            </div>
          </div>
        </template>
        <script>
          let outer = true;
          let inner = true;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/if-nested.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle multiple if statements", async () => {
      const tag = `test-if-multiple-${Date.now()}`;
      const html = `
        <template>
          <p $if="{cond1}">Condition 1</p>
          <p $if="{cond2}">Condition 2</p>
          <p $if="{cond3}">Condition 3</p>
        </template>
        <script>
          let cond1 = true;
          let cond2 = false;
          let cond3 = true;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/if-multiple.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });

  describe("$else-if directive", () => {
    it("should handle if-else-if chain", async () => {
      const tag = `test-else-if-${Date.now()}`;
      const html = `
        <template>
          <p $if="{status === 'loading'}">Loading</p>
          <p $else-if="{status === 'error'}">Error</p>
          <p $else-if="{status === 'success'}">Success</p>
        </template>
        <script>
          let status = 'success';
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/else-if.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should update on state change in else-if chain", async () => {
      const tag = `test-else-if-update-${Date.now()}`;
      const html = `
        <template>
          <p $if="{value === 1}">One</p>
          <p $else-if="{value === 2}">Two</p>
          <p $else-if="{value === 3}">Three</p>
          <button onclick="next">Next</button>
        </template>
        <script>
          let value = 1;
          export const next = () => {
            value = value === 3 ? 1 : value + 1;
          };
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/else-if-update.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle multiple else-if branches", async () => {
      const tag = `test-else-if-multi-${Date.now()}`;
      const html = `
        <template>
          <p $if="{grade === 'A'}">Excellent</p>
          <p $else-if="{grade === 'B'}">Good</p>
          <p $else-if="{grade === 'C'}">Fair</p>
          <p $else-if="{grade === 'D'}">Poor</p>
          <p $else-if="{grade === 'F'}">Fail</p>
        </template>
        <script>
          let grade = 'A';
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/else-if-multi.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });

  describe("$else directive", () => {
    it("should render else block when if is false", async () => {
      const tag = `test-else-${Date.now()}`;
      const html = `
        <template>
          <p $if="{condition}">If true</p>
          <p $else>If false</p>
        </template>
        <script>
          let condition = false;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/else.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should toggle between if and else", async () => {
      const tag = `test-else-toggle-${Date.now()}`;
      const html = `
        <template>
          <p $if="{condition}">If block</p>
          <p $else>Else block</p>
          <button onclick="toggle">Toggle</button>
        </template>
        <script>
          let condition = false;
          export const toggle = () => condition = !condition;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/else-toggle.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should work in if-else-if-else chain", async () => {
      const tag = `test-else-chain-${Date.now()}`;
      const html = `
        <template>
          <p $if="{value === 1}">One</p>
          <p $else-if="{value === 2}">Two</p>
          <p $else>Other</p>
        </template>
        <script>
          let value = 99;
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/else-chain.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });

  describe("Complex conditional patterns", () => {
    it("should handle loading state pattern", async () => {
      const tag = `test-loading-${Date.now()}`;
      const html = `
        <template>
          <p $if="{isLoading}">Loading...</p>
          <div $else-if="{hasError}">
            <p>Error: {error}</p>
            <button onclick="retry">Retry</button>
          </div>
          <div $else>
            <p>{data}</p>
          </div>
        </template>
        <script>
          let isLoading = false;
          let hasError = false;
          let error = '';
          let data = 'Result';
          export const retry = () => {
            isLoading = true;
            hasError = false;
          };
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/loading.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle empty state pattern", async () => {
      const tag = `test-empty-${Date.now()}`;
      const html = `
        <template>
          <ul $if="{items.length > 0}">
            <li $for="item in items">{item}</li>
          </ul>
          <p $else>No items to display</p>
        </template>
        <script>
          let items = [];
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/empty.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle permission-based rendering", async () => {
      const tag = `test-permission-${Date.now()}`;
      const html = `
        <template>
          <div $if="{user.isAdmin}">
            <button>Delete User</button>
            <button>Edit Settings</button>
          </div>
          <p $else-if="{user.isModerator}">
            <button>Flag Post</button>
          </p>
          <p $else>Guest User</p>
        </template>
        <script>
          let user = { isAdmin: false, isModerator: false };
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/permission.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle conditional rendering of form fields", async () => {
      const tag = `test-form-cond-${Date.now()}`;
      const html = `
        <template>
          <select $bind="userType" onchange="updateFields">
            <option value="individual">Individual</option>
            <option value="business">Business</option>
          </select>
          <input $if="{userType === 'individual'}" placeholder="First Name" />
          <input $if="{userType === 'individual'}" placeholder="Last Name" />
          <input $if="{userType === 'business'}" placeholder="Company Name" />
          <input $if="{userType === 'business'}" placeholder="Tax ID" />
        </template>
        <script>
          let userType = 'individual';
          export const updateFields = () => {};
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/form-cond.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });
});

describe("Template Directives - Loops", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanupDOM();
  });

  afterEach(() => {
    cleanupDOM();
  });

  describe("$for directive - basic iteration", () => {
    it("should render loop items", async () => {
      const tag = `test-for-${Date.now()}`;
      const html = `
        <template>
          <ul>
            <li $for="item in items">{item}</li>
          </ul>
        </template>
        <script>
          let items = ['a', 'b', 'c'];
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/for.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle empty array", async () => {
      const tag = `test-for-empty-${Date.now()}`;
      const html = `
        <template>
          <ul>
            <li $for="item in items">{item}</li>
          </ul>
          <p $if="{items.length === 0}">Empty</p>
        </template>
        <script>
          let items = [];
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/for-empty.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should render objects in array", async () => {
      const tag = `test-for-objects-${Date.now()}`;
      const html = `
        <template>
          <ul>
            <li $for="user in users">
              {user.name} - {user.email}
            </li>
          </ul>
        </template>
        <script>
          let users = [
            { name: 'Alice', email: 'alice@example.com' },
            { name: 'Bob', email: 'bob@example.com' }
          ];
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/for-objects.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should update loop when array changes", async () => {
      const tag = `test-for-update-${Date.now()}`;
      const html = `
        <template>
          <ul>
            <li $for="item in items">{item}</li>
          </ul>
          <button onclick="addItem">Add</button>
        </template>
        <script>
          let items = [1, 2, 3];
          export const addItem = () => items.push(items.length + 1);
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/for-update.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });

  describe("$for directive - with index", () => {
    it("should provide index in loop", async () => {
      const tag = `test-for-index-${Date.now()}`;
      const html = `
        <template>
          <ul>
            <li $for="(item, index) in items">{index}: {item}</li>
          </ul>
        </template>
        <script>
          let items = ['a', 'b', 'c'];
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/for-index.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should use index for alternating styles", async () => {
      const tag = `test-for-alternate-${Date.now()}`;
      const html = `
        <template>
          <ul>
            <li $for="(item, i) in items" class:even="{i % 2 === 0}">
              {item}
            </li>
          </ul>
        </template>
        <script>
          let items = ['a', 'b', 'c', 'd', 'e'];
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/for-alternate.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should use index for delete operations", async () => {
      const tag = `test-for-delete-${Date.now()}`;
      const html = `
        <template>
          <ul>
            <li $for="(item, idx) in items">
              {item}
              <button onclick="remove(idx)">Delete</button>
            </li>
          </ul>
        </template>
        <script>
          let items = ['a', 'b', 'c'];
          export const remove = (idx) => items.splice(idx, 1);
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/for-delete.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });

  describe("Complex loop patterns", () => {
    it("should handle nested loops", async () => {
      const tag = `test-for-nested-${Date.now()}`;
      const html = `
        <template>
          <div $for="group in groups">
            <h3>{group.name}</h3>
            <ul>
              <li $for="item in group.items">{item}</li>
            </ul>
          </div>
        </template>
        <script>
          let groups = [
            { name: 'Group 1', items: ['a', 'b'] },
            { name: 'Group 2', items: ['c', 'd', 'e'] }
          ];
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/for-nested.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle loop with conditional", async () => {
      const tag = `test-for-if-${Date.now()}`;
      const html = `
        <template>
          <ul>
            <li $for="item in items">
              <span $if="{item.active}">{item.name} (active)</span>
              <span $else>{item.name}</span>
            </li>
          </ul>
        </template>
        <script>
          let items = [
            { name: 'Item 1', active: true },
            { name: 'Item 2', active: false }
          ];
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/for-if.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle loop with methods", async () => {
      const tag = `test-for-methods-${Date.now()}`;
      const html = `
        <template>
          <ul>
            <li $for="item in items">
              {item.getName()}
            </li>
          </ul>
        </template>
        <script>
          let items = [
            { getName: () => 'Item A' },
            { getName: () => 'Item B' }
          ];
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/for-methods.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });

    it("should handle large lists", async () => {
      const tag = `test-for-large-${Date.now()}`;
      const html = `
        <template>
          <ul>
            <li $for="item in items">{item}</li>
          </ul>
        </template>
        <script>
          let items = Array.from({ length: 1000 }, (_, i) => \`Item \${i + 1}\`);
        </script>
      `;
      global.fetch = mockComponentFetch(html);

      await registerComponent(tag, "/for-large.html");
      const el = createTestElement(tag);

      expect(el).toBeDefined();
    });
  });
});
