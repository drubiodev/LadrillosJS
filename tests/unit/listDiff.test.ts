import { describe, it, expect } from "vitest";
import
  {
    diffKeyed,
    diffUnkeyed,
    createKeyGetter,
    getStableIndices,
  } from "../../src/core/diff/listDiff";

describe("listDiff", () =>
{
  describe("diffKeyed", () =>
  {
    const byId = (item: { id: number }) => item.id;

    it("returns no mutation operations for identical arrays", () =>
    {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const ops = diffKeyed(items, items, byId);
      expect(ops.filter((o) => o.type === "insert")).toHaveLength(0);
      expect(ops.filter((o) => o.type === "remove")).toHaveLength(0);
      expect(ops.filter((o) => o.type === "move")).toHaveLength(0);
    });

    it("detects appended items", () =>
    {
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

    it("detects removed items", () =>
    {
      const ops = diffKeyed(
        [{ id: 1 }, { id: 2 }, { id: 3 }],
        [{ id: 1 }, { id: 3 }],
        byId,
      );
      const removeOps = ops.filter((o) => o.type === "remove");
      expect(removeOps).toHaveLength(1);
      expect(removeOps[0].key).toBe(2);
    });

    it("detects moved items when items are reordered", () =>
    {
      const ops = diffKeyed(
        [{ id: 1 }, { id: 2 }, { id: 3 }],
        [{ id: 3 }, { id: 1 }, { id: 2 }],
        byId,
      );
      expect(ops.some((o) => o.type === "move")).toBe(true);
    });

    it("handles full replacement", () =>
    {
      const ops = diffKeyed(
        [{ id: 1 }, { id: 2 }],
        [{ id: 3 }, { id: 4 }],
        byId,
      );
      expect(ops.filter((o) => o.type === "remove")).toHaveLength(2);
      expect(ops.filter((o) => o.type === "insert")).toHaveLength(2);
    });

    it("handles empty -> populated", () =>
    {
      const ops = diffKeyed([], [{ id: 1 }, { id: 2 }], byId);
      expect(ops).toHaveLength(2);
      expect(ops.every((o) => o.type === "insert")).toBe(true);
    });

    it("handles populated -> empty", () =>
    {
      const ops = diffKeyed([{ id: 1 }, { id: 2 }], [], byId);
      expect(ops).toHaveLength(2);
      expect(ops.every((o) => o.type === "remove")).toBe(true);
    });
  });

  describe("diffUnkeyed", () =>
  {
    it("emits inserts when new is longer", () =>
    {
      const ops = diffUnkeyed(2, 4, ["a", "b", "c", "d"]);
      expect(ops.filter((o) => o.type === "insert")).toHaveLength(2);
      expect(ops.filter((o) => o.type === "update")).toHaveLength(2);
    });

    it("emits removes when new is shorter", () =>
    {
      const ops = diffUnkeyed(4, 2, ["a", "b"]);
      expect(ops.filter((o) => o.type === "remove")).toHaveLength(2);
    });

    it("emits only updates for equal lengths", () =>
    {
      const ops = diffUnkeyed(3, 3, ["x", "y", "z"]);
      expect(ops.filter((o) => o.type === "update")).toHaveLength(3);
    });
  });

  describe("createKeyGetter", () =>
  {
    it("returns an index-based getter when no key expression is given", () =>
    {
      const getKey = createKeyGetter(undefined, "item");
      expect(getKey({ id: 1 }, 0)).toBe(0);
      expect(getKey({ id: 2 }, 5)).toBe(5);
    });

    it("extracts nested keys from the item", () =>
    {
      const getKey = createKeyGetter<{ id: number }>("item.id", "item");
      expect(getKey({ id: 42 }, 0)).toBe(42);
    });

    it("handles deeply nested keys", () =>
    {
      const getKey = createKeyGetter<any>("item.meta.slug", "item");
      expect(getKey({ meta: { slug: "hello" } }, 0)).toBe("hello");
    });

    it("returns undefined when the key path is missing", () =>
    {
      const getKey = createKeyGetter<any>("item.missing", "item");
      expect(getKey({}, 0)).toBeUndefined();
    });
  });

  describe("getStableIndices", () =>
  {
    it("returns an empty set for an empty source", () =>
    {
      expect(getStableIndices([]).size).toBe(0);
    });

    it("keeps every position when already in order", () =>
    {
      const stable = getStableIndices([0, 1, 2, 3]);
      expect([...stable].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
    });

    it("excludes new items (-1) from the stable run", () =>
    {
      // positions 0,2 reuse old 0,1; position 1 is new
      const stable = getStableIndices([0, -1, 1]);
      expect(stable.has(1)).toBe(false);
      expect(stable.has(0)).toBe(true);
      expect(stable.has(2)).toBe(true);
    });

    it("returns a single stable element for a full reversal", () =>
    {
      const stable = getStableIndices([3, 2, 1, 0]);
      expect(stable.size).toBe(1);
    });

    it("identifies the longest increasing run for a partial reorder", () =>
    {
      // old [A,B,C,D,E] -> new [A,C,D,E,B]; source = old indices of new order
      const stable = getStableIndices([0, 2, 3, 4, 1]);
      // A,C,D,E (positions 0..3) form the stable run; B (pos 4) moves
      expect(stable.has(4)).toBe(false);
      expect([...stable].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
    });

    it("produces the correct final order when used to place elements", () =>
    {
      // Simulate the renderer's forward placement using a plain array as DOM.
      const place = (oldOrder: string[], newOrder: string[]): string[] =>
      {
        const oldIndex = new Map(oldOrder.map((v, i) => [v, i] as const));
        const source = newOrder.map((v) =>
          oldIndex.has(v) ? oldIndex.get(v)! : -1,
        );
        const stable = getStableIndices(source);
        const dom = [...oldOrder]; // current DOM order
        let prevIdx = -1; // placeholder anchor
        for (let i = 0; i < newOrder.length; i++)
        {
          const el = newOrder[i];
          if (stable.has(i))
          {
            prevIdx = dom.indexOf(el);
            continue;
          }
          // remove el from wherever it is (or it's new), insert after prev
          const at = dom.indexOf(el);
          if (at !== -1) dom.splice(at, 1);
          const insertAt = dom.indexOf(newOrder[i - 1]) + 1;
          dom.splice(insertAt < 0 ? 0 : insertAt, 0, el);
          prevIdx = dom.indexOf(el);
        }
        void prevIdx;
        return dom;
      };

      expect(place(["A", "B", "C"], ["C", "A", "B"])).toEqual(["C", "A", "B"]);
      expect(place(["A", "B", "C", "D", "E"], ["A", "C", "D", "E", "B"])).toEqual(
        ["A", "C", "D", "E", "B"],
      );
      expect(place(["A", "B", "C", "D"], ["D", "C", "B", "A"])).toEqual([
        "D",
        "C",
        "B",
        "A",
      ]);
      // insertion of a new element X
      expect(place(["A", "B", "C"], ["A", "X", "B", "C"])).toEqual([
        "A",
        "X",
        "B",
        "C",
      ]);
    });
  });
});
