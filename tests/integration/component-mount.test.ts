import { describe, it } from "vitest";

/**
 * End-to-end component mount tests.
 *
 * Currently skipped: the full rendering pipeline (DOMParser + dynamic
 * <script> execution for user component code) does not interpolate
 * reactive values reliably inside happy-dom's custom-element lifecycle.
 * These should be re-enabled under a Playwright / real-browser runner.
 *
 * Unit tests already cover reactivity, scheduler, diff, event bus,
 * expression cache, and lazy strategies in isolation.
 */
describe.skip("component integration (requires real browser)", () => {
  it("mounts a reactive counter", () => {});
  it("renders a conditional block", () => {});
  it("renders a keyed list", () => {});
  it("supports two-way binding", () => {});
});
