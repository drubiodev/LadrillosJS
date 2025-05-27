import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerComponent } from "ladrillosjs";

describe("Data Binding", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should handle two-way data binding with input elements", async () => {
    const testHtml = `
      <input type="text" data-bind="name" />
      <div>{name}</div>
      <script>let name = "Initial";</script>
    `;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(testHtml),
      })
    );

    const tag = `binding-test-${Date.now()}`;
    await registerComponent(tag, "/binding.html");

    const element = document.createElement(tag);
    document.body.appendChild(element);

    await new Promise((resolve) => setTimeout(resolve, 0));

    const input = element.shadowRoot.querySelector("input");
    const div = element.shadowRoot.querySelector("div");

    // Initial value
    expect(input.value).toBe("Initial");
    expect(div.textContent).toBe("Initial");

    // Simulate user input
    input.value = "Updated";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(element.state.name).toBe("Updated");
    expect(div.textContent).toBe("Updated");

    document.body.removeChild(element);
  });

  it("should handle contenteditable data binding", async () => {
    const testHtml = `
      <div contenteditable="true" value={content} data-bind="content">Initial Content</div>
      <script>let content = "Initial Content";</script>
    `;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(testHtml),
      })
    );

    const tag = `contenteditable-${Date.now()}`;
    await registerComponent(tag, "/editable.html");

    const element = document.createElement(tag);
    document.body.appendChild(element);

    await new Promise((resolve) => setTimeout(resolve, 0));

    const editable = element.shadowRoot.querySelector("[contenteditable]");

    // Simulate content change
    editable.focus();
    editable.textContent = "New Content";

    // Try using InputEvent instead of Event
    const inputEvent = new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      composed: true,
      data: "New Content",
      inputType: "insertText",
    });
    editable.dispatchEvent(inputEvent);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(element.state.content).toBe("New Content");

    document.body.removeChild(element);
  });
});
