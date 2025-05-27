import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerComponent } from "ladrillosjs";

describe("State Management", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should update component state and trigger re-render", async () => {
    const testHtml = `<div>{count}</div><script>let count = 0;</script>`;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(testHtml),
      })
    );

    const tag = `state-test-${Date.now()}`;
    await registerComponent(tag, "/state.html");

    const element = document.createElement(tag);
    document.body.appendChild(element);

    // Wait for component to initialize
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Component should have setState method
    expect(typeof element.setState).toBe("function");

    // Update state
    element.setState({ count: 5 });

    // Check if re-render occurred
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(element.shadowRoot.textContent).toContain("5");

    document.body.removeChild(element);
  });

  it("should handle nested object state updates", async () => {
    const testHtml = `<div>{user.name} - {user.age}</div><script>let user = { name: "John", age: 25 };</script>`;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(testHtml),
      })
    );

    const tag = `nested-state-${Date.now()}`;
    await registerComponent(tag, "/nested.html");

    const element = document.createElement(tag);
    document.body.appendChild(element);

    await new Promise((resolve) => setTimeout(resolve, 0));

    element.setState({ user: { name: "Jane", age: 30 } });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(element.shadowRoot.textContent).toContain("Jane - 30");

    document.body.removeChild(element);
  });
});
