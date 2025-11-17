/**
 * Test Helpers & Utilities for LadrillosJS Tests
 * Provides mock fetch, component fixtures, and DOM utilities
 */

import { vi } from "vitest";

/**
 * Mock fetch for component loading
 */
export function mockComponentFetch(htmlContent) {
  return vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(htmlContent),
  });
}

export function mockFetchError(statusText = "Not Found") {
  return vi.fn().mockResolvedValue({
    ok: false,
    statusText,
    text: () => Promise.resolve(""),
  });
}

/**
 * Component HTML Fixtures
 */
export const FIXTURES = {
  // Simple counter component
  counter: `
    <template>
      <div>
        <p>Count: {count}</p>
        <button onclick="count++">Increment</button>
        <button onclick="count--">Decrement</button>
      </div>
    </template>
    <script>
      let count = 0;
    </script>
    <style>
      :host { display: block; }
      p { font-size: 18px; }
    </style>
  `,

  // Form component with two-way binding
  form: `
    <template>
      <form onsubmit="handleSubmit">
        <input $bind="name" type="text" placeholder="Name" />
        <input $bind="email" type="email" placeholder="Email" />
        <textarea $bind="message" placeholder="Message"></textarea>
        <select $bind="category">
          <option value="">Select</option>
          <option value="bug">Bug</option>
          <option value="feature">Feature</option>
        </select>
        <input $bind="subscribe" type="checkbox" />
        <button type="submit">Submit</button>
        <p $if="{submitted}">Submitted: {name}</p>
      </form>
    </template>
    <script>
      let name = '';
      let email = '';
      let message = '';
      let category = '';
      let subscribe = false;
      let submitted = false;
      
      export const handleSubmit = (e) => {
        e.preventDefault();
        submitted = true;
      };
    </script>
    <style>
      :host { display: block; padding: 20px; }
      input, textarea, select { display: block; margin: 10px 0; padding: 8px; }
      button { padding: 10px 20px; cursor: pointer; }
    </style>
  `,

  // List component with conditionals and loops
  todoList: `
    <template>
      <div>
        <input $bind="newTodo" type="text" placeholder="Add todo" onkeypress="handleKeyPress" />
        <button onclick="addTodo">Add</button>
        
        <p $if="{items.length === 0}">No items yet</p>
        <ul $if="{items.length > 0}">
          <li $for="(item, idx) in items">
            <span>{item.text}</span>
            <input $bind="item.completed" type="checkbox" />
            <button onclick="removeTodo(idx)">Delete</button>
          </li>
        </ul>
        
        <p>Total: {items.length}</p>
        <p $if="{completedCount > 0}">Completed: {completedCount}</p>
      </div>
    </template>
    <script>
      let newTodo = '';
      let items = [];
      let completedCount = 0;
      
      export const addTodo = () => {
        if (newTodo.trim()) {
          items.push({ text: newTodo, completed: false });
          newTodo = '';
          updateCompletedCount();
        }
      };
      
      export const removeTodo = (idx) => {
        items.splice(idx, 1);
        updateCompletedCount();
      };
      
      export const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
          addTodo();
        }
      };
      
      const updateCompletedCount = () => {
        completedCount = items.filter(i => i.completed).length;
      };
    </script>
    <style>
      :host { display: block; }
      ul { list-style: none; padding: 0; }
      li { display: flex; gap: 10px; margin: 5px 0; }
    </style>
  `,

  // Nested state component
  nestedState: `
    <template>
      <div>
        <h2>{user.name}</h2>
        <p>Email: {user.email}</p>
        <p>Address: {user.address.street}, {user.address.city}</p>
        <button onclick="updateName">Change Name</button>
        <button onclick="updateCity">Change City</button>
      </div>
    </template>
    <script>
      let user = {
        name: 'John',
        email: 'john@example.com',
        address: {
          street: '123 Main St',
          city: 'Springfield'
        }
      };
      
      export const updateName = () => {
        user.name = 'Jane';
      };
      
      export const updateCity = () => {
        user.address.city = 'Shelbyville';
      };
    </script>
    <style>
      :host { display: block; padding: 20px; }
    </style>
  `,

  // Conditional rendering with $if/$else-if/$else
  conditional: `
    <template>
      <div>
        <p $if="{status === 'loading'}">Loading...</p>
        <p $else-if="{status === 'error'}">Error: {errorMessage}</p>
        <p $else-if="{status === 'success'}">Success! Data: {data}</p>
        <p $else>Idle</p>
      </div>
    </template>
    <script>
      let status = 'idle';
      let errorMessage = '';
      let data = '';
    </script>
    <style>
      :host { display: block; }
    </style>
  `,

  // Array mutations component
  arrayMutations: `
    <template>
      <div>
        <p>Items: {items.length}</p>
        <ul>
          <li $for="item in items">{item}</li>
        </ul>
        <button onclick="push">Push</button>
        <button onclick="pop">Pop</button>
        <button onclick="shift">Shift</button>
        <button onclick="unshift">Unshift</button>
        <button onclick="reverse">Reverse</button>
        <button onclick="sort">Sort</button>
        <button onclick="splice">Splice</button>
      </div>
    </template>
    <script>
      let items = ['a', 'b', 'c'];
      
      export const push = () => items.push('d');
      export const pop = () => items.pop();
      export const shift = () => items.shift();
      export const unshift = () => items.unshift('z');
      export const reverse = () => items.reverse();
      export const sort = () => items.sort();
      export const splice = () => items.splice(1, 1, 'x');
    </script>
    <style>
      :host { display: block; }
    </style>
  `,

  // Expression evaluation component
  expressions: `
    <template>
      <div>
        <p>{count + 1}</p>
        <p>{name.toUpperCase()}</p>
        <p $if="{count > 5 && enabled}">Threshold reached</p>
        <p class:active="{isActive}">Status</p>
        <p>{condition ? 'Yes' : 'No'}</p>
        <p>{items.length > 0 ? 'Has items' : 'Empty'}</p>
      </div>
    </template>
    <script>
      let count = 3;
      let name = 'john';
      let enabled = true;
      let isActive = false;
      let condition = true;
      let items = [];
    </script>
    <style>
      .active { color: green; }
    </style>
  `,

  // Dynamic attributes component
  dynamicAttributes: `
    <template>
      <div>
        <img src="{imageUrl}" alt="{imageAlt}" />
        <a href="{linkUrl}">{linkText}</a>
        <div class="{customClass}">Content</div>
        <button disabled="{isDisabled}">Click me</button>
      </div>
    </template>
    <script>
      let imageUrl = '/logo.png';
      let imageAlt = 'Logo';
      let linkUrl = 'https://example.com';
      let linkText = 'Example';
      let customClass = 'default-class';
      let isDisabled = false;
    </script>
    <style>
      :host { display: block; }
    </style>
  `,

  // Event handlers component
  eventHandlers: `
    <template>
      <div>
        <button onclick="handleClick">Click Count: {clickCount}</button>
        <input onchange="handleChange" type="text" />
        <form onsubmit="handleSubmit">
          <input type="text" />
          <button type="submit">Submit</button>
        </form>
        <p>{lastEvent}</p>
      </div>
    </template>
    <script>
      let clickCount = 0;
      let lastEvent = '';
      
      export const handleClick = (e) => {
        clickCount++;
        lastEvent = 'click';
      };
      
      export const handleChange = (e) => {
        lastEvent = 'change: ' + e.target.value;
      };
      
      export const handleSubmit = (e) => {
        e.preventDefault();
        lastEvent = 'submit';
      };
    </script>
    <style>
      :host { display: block; }
    </style>
  `,

  // Lifecycle hooks component
  lifecycle: `
    <template>
      <div>
        <p>Mounted: {isMounted}</p>
        <p>Render count: {renderCount}</p>
        <p>Last action: {lastAction}</p>
      </div>
    </template>
    <script>
      let isMounted = false;
      let renderCount = 0;
      let lastAction = 'init';
      
      $onMount(() => {
        isMounted = true;
        lastAction = 'mounted';
      });
      
      $onRender(() => {
        renderCount++;
        lastAction = 'rendered';
      });
      
      $onUnmount(() => {
        lastAction = 'unmounted';
      });
    </script>
    <style>
      :host { display: block; }
    </style>
  `,

  // Simple binding component
  simpleBinding: `
    <template>
      <p>{message}</p>
    </template>
    <script>
      let message = 'Hello World';
    </script>
  `,

  // Module script component
  moduleScript: `
    <template>
      <p>Result: {result}</p>
      <button onclick="doCalculation">Calculate</button>
    </template>
    <script type="module">
      import { add } from './math.js';
      let result = 0;
      export const doCalculation = () => {
        result = add(5, 3);
      };
    </script>
  `,
};

/**
 * Create a temporary DOM element with test component
 */
export function createTestElement(tag) {
  const el = document.createElement(tag);
  document.body.appendChild(el);
  return el;
}

/**
 * Clean up DOM after tests
 */
export function cleanupDOM() {
  document.body.innerHTML = "";
}

/**
 * Wait for next animation frame
 */
export function waitForNextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * Wait for async operations
 */
export function waitForAsync(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Flush all pending animation frames
 */
export async function flushAnimationFrames(count = 5) {
  for (let i = 0; i < count; i++) {
    await waitForNextFrame();
  }
}

/**
 * Wait for condition to be true
 */
export async function waitFor(condition, timeout = 1000, interval = 50) {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error("waitFor timeout");
    }
    await waitForAsync(interval);
  }
}

/**
 * Mock component context for testing
 */
export function createMockComponent(state = {}) {
  return {
    state,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    attachShadow: vi.fn(() => ({
      appendChild: vi.fn(),
      innerHTML: "",
    })),
  };
}

/**
 * Create a test component registration object
 */
export function createTestRegistration(name, html = FIXTURES.counter) {
  return {
    name,
    path: `/components/${name}.html`,
    html,
  };
}
