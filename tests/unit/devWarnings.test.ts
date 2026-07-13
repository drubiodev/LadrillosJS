import { describe, expect, it, vi } from "vitest";
import { configure } from "../../src/core/configure";
import
  {
    ErrorCode,
    LadrillosError,
    createError,
    error,
    expressionError,
    warn,
  } from "../../src/utils/devWarnings";

describe("developer diagnostics", () =>
{
  it("prints a stable code, context, fix, and documentation link for warnings", () =>
  {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => { });

    try
    {
      warn(
        "The component is already registered.",
        { tagName: "user-card", sourcePath: "/components/user-card.html" },
        {
          code: ErrorCode.COMPONENT_ALREADY_REGISTERED,
          hint: "Remove the duplicate registration call.",
        },
      );

      const output = spy.mock.calls.flat().join(" ");
      expect(output).toContain("LJS503");
      expect(output).toContain("<user-card>");
      expect(output).toContain("user-card.html");
      expect(output).toContain("How to fix: Remove the duplicate registration call.");
      expect(output).toContain("docs/21-error-handling.md#ljs503");
    } finally
    {
      spy.mockRestore();
    }
  });

  it("dispatches a LadrillosError with diagnostic metadata", () =>
  {
    const cause = new TypeError("Network request failed");
    const captured: Error[] = [];
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => { });

    try
    {
      configure({ onError: (diagnostic) => captured.push(diagnostic) });
      error(
        "Could not load the component.",
        { tagName: "user-card", sourcePath: "/components/user-card.html" },
        cause,
        {
          code: ErrorCode.COMPONENT_LOAD_FAILED,
          hint: "Check the path and make sure the server returns HTML.",
        },
      );

      expect(captured).toHaveLength(1);
      expect(captured[0]).toBeInstanceOf(LadrillosError);
      expect(captured[0]).toMatchObject({
        name: "LadrillosError",
        code: ErrorCode.COMPONENT_LOAD_FAILED,
        docsUrl: expect.stringContaining(
          "docs/21-error-handling.md#ljs501",
        ),
        hint: "Check the path and make sure the server returns HTML.",
        cause,
      });
    } finally
    {
      configure({ onError: null });
      consoleSpy.mockRestore();
    }
  });

  it("creates the same rich error shape for thrown framework errors", () =>
  {
    const diagnostic = createError(
      "Component was not found.",
      ErrorCode.COMPONENT_NOT_FOUND,
      { tagName: "missing-card" },
      "Register the component before trying to load it.",
    );

    expect(diagnostic).toBeInstanceOf(LadrillosError);
    expect(diagnostic.message).toContain("LJS502");
    expect(diagnostic.hint).toBe(
      "Register the component before trying to load it.",
    );
  });

  it("routes expression failures through the configured error handler", () =>
  {
    const captured: Error[] = [];
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => { });
    configure({ onError: (diagnostic) => captured.push(diagnostic) });

    try
    {
      expressionError("user.name", new ReferenceError("user is not defined"), {
        context: { tagName: "user-card" },
      });

      expect(captured).toHaveLength(1);
      expect(captured[0]).toMatchObject({
        name: "LadrillosError",
        code: ErrorCode.EXPRESSION_UNDEFINED_VAR,
        componentContext: { tagName: "user-card" },
      });
      expect(captured[0].cause).toBeInstanceOf(ReferenceError);
    } finally
    {
      configure({ onError: null });
      consoleSpy.mockRestore();
    }
  });
});