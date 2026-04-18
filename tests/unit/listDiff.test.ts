import { describe, it, expect } from "vitest";
import {
  diffKeyed,
  diffUnkeyed,
  createKeyGetter,
} from "../../src/core/diff/listDiff";

describe("listDiff", () => {
  describe("diffKeyed", () => {
    const byId = (item: { id: number }) => item.id;

    it("returns no mutation operations for identical arrays", () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const ops = diffKeyed(items, items, byId);
      expect(ops.filter((o) => o.type === "insert")).toHaveLength(0);
      expect(ops.filter((o) => o.type === "remove")).toHaveLength(0);
      expect(ops.filter((o) => o.type === "move")).toHaveLength(0);
    });

    it("detects appended items", () => {
      const ops = diffKeyed(
        [{ id: 1 }, { id: 2 }],
        [{ id: 1 }, { id: 2 }, { id: 3 }],
        byId,
      );
      const insertOps = ops.filter((o) => o.type === "insert");
      expect(insertOps).toHaveLength(1);
      expect(insertOps[0].key).toBe(3);
      expect(insertOps[0].newIndex).toBe(2);
    });

    it("detects removed items", () => {
      const ops = diffKeyed(
        [{ id: 1 }, { id: 2 }, { id: 3 }],
        [{ id: 1 }, { id: 3 }],
        byId,
      );
      const removeOps = ops.filter((o) => o.type === "remove");
      expect(removeOps).toHaveLength(1);
      expect(removeOps[0].key).toBe(2);
    });

    it("detects moved items when items are reordered", () => {
      const ops = diffKeyed(
        [{ id: 1 }, { id: 2 }, { id: 3 }],
        [{ id: 3 }, { id: 1 }, { id: 2 }],
        byId,
      );
      expect(ops.some((o) => o.type === "move")).toBe(true);
    });

    it("handles full replacement", () => {
      const ops = diffKeyed(
        [{ id: 1 }, { id: 2 }],
        [{ id: 3 }, { id: 4 }],
        byId,
      );
      expect(ops.filter((o) => o.type === "remove")).toHaveLength(2);
      expect(ops.filter((o) => o.type === "insert")).toHaveLength(2);
    });

    it("handles empty -> populated", () => {
      const ops = diffKeyed([], [{ id: 1 }, { id: 2 }], byId);
      expect(ops).toHaveLength(2);
      expect(ops.every((o) => o.type === "insert")).toBe(true);
    });

    it("handles populated -> empty", () => {
      const ops = diffKeyed([{ id: 1 }, { id: 2 }], [], byId);
      expect(ops).toHaveLength(2);
      expect(ops.every((o) => o.type === "remove")).toBe(true);
    });
  });

  describe("diffUnkeyed", () => {
    it("emits inserts when new is longer", () => {
      const ops = diffUnkeyed(2, 4, ["a", "b", "c", "d"]);
      expect(ops.filter((o) => o.type === "insert")).toHaveLength(2);
      expect(ops.filter((o) => o.type === "update")).toHaveLength(2);
    });

    it("emits removes when new is shorter", () => {
      const ops = diffUnkeyed(4, 2, ["a", "b"]);
      expect(ops.filter((o) => o.type === "remove")).toHaveLength(2);
    });

    it("emits only updates for equal lengths", () => {
      const ops = diffUnkeyed(3, 3, ["x", "y", "z"]);
      expect(ops.filter((o) => o.type === "update")).toHaveLength(3);
    });
  });

  describe("createKeyGetter", () => {
    it("returns an index-based getter when no key expression is given", () => {
      const getKey = createKeyGetter(undefined, "item");
      expect(getKey({ id: 1 }, 0)).toBe(0);
      expect(getKey({ id: 2 }, 5)).toBe(5);
    });

    it("extracts nested keys from the item", () => {
      const getKey = createKeyGetter<{ id: number }>("item.id", "item");
      expect(getKey({ id: 42 }, 0)).toBe(42);
    });

    it("handles deeply nested keys", () => {
      const getKey = createKeyGetter<any>("item.meta.slug", "item");
      expect(getKey({ meta: { slug: "hello" } }, 0)).toBe("hello");
    });

    it("returns undefined when the key path is missing", () => {
      const getKey = createKeyGetter<any>("item.missing", "item");
      expect(getKey({}, 0)).toBeUndefined();
    });
  });
});
