import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerComponent } from "ladrillosjs";

describe("Event Handling", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should handle onclick events with method references", async () => {
    const testHtml = `
      <button onclick="handleClick">Click is {clicked}</button>
      <script>
        let clicked = false;
        const handleClick = () => { clicked = true; };
      </script>
    `;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(testHtml),
      })
    );

    const tag = `click-test-${Date.now()}`;
    await registerComponent(tag, "/click.html");

    const element = document.createElement(tag);
    document.body.appendChild(element);

    await new Promise((resolve) => setTimeout(resolve, 0));

    const button = element.shadowRoot.querySelector("button");
    button.click();

    expect(element.state.clicked).toBe(true);

    document.body.removeChild(element);
  });

  it("should handle custom event emission and listening", async () => {
    const testHtml = `<div></div><script></script>`;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(testHtml),
      })
    );

    const tag = `event-emitter-${Date.now()}`;
    await registerComponent(tag, "/emitter.html");

    const element = document.createElement(tag);
    document.body.appendChild(element);

    await new Promise((resolve) => setTimeout(resolve, 0));

    const eventData = { message: "Hello" };
    let receivedData = null;

    element.listen("custom-event", (data) => {
      receivedData = data;
    });

    element.emit("custom-event", eventData);

    expect(receivedData).toEqual(eventData);

    document.body.removeChild(element);
  });
});
