/**
 * Keyed List Diffing Algorithm
 *
 * Uses a simplified LIS (Longest Increasing Subsequence) approach
 * for optimal DOM operations.
 *
 * Benefits:
 * - Minimizes DOM operations (moves instead of recreate)
 * - Preserves element state (focus, scroll, animations)
 * - O(n) best case, O(n log n) worst case
 *
 * Usage with $for:
 *   $for="item in items track by item.id"
 *                          ^^^^^^^^^^^^^^
 *                          Key expression for efficient diffing
 */

// ============================================================================
// Types
// ============================================================================

export interface DiffOperation
{
  type: "insert" | "remove" | "move" | "update";
  /** Index in the old array (for remove/move/update) */
  oldIndex?: number;
  /** Index in the new array (for insert/move/update) */
  newIndex?: number;
  /** The item data */
  item?: unknown;
  /** Key for keyed operations */
  key?: unknown;
}

interface KeyedItem
{
  key: unknown;
  item: unknown;
  index: number;
}

// ============================================================================
// Keyed Diffing
// ============================================================================

/**
 * Computes the minimal set of DOM operations to transform oldItems into newItems.
 * Uses keys for identity matching - items with the same key are considered the same.
 *
 * @param oldItems - Previous array items
 * @param newItems - New array items
 * @param getKey - Function to extract a unique key from an item
 * @returns Array of operations to perform
 *
 * @example
 * const ops = diffKeyed(
 *   [{ id: 1, name: 'A' }, { id: 2, name: 'B' }],
 *   [{ id: 2, name: 'B' }, { id: 1, name: 'A' }, { id: 3, name: 'C' }],
 *   item => item.id
 * );
 * // ops = [
 * //   { type: 'move', oldIndex: 1, newIndex: 0, key: 2 },
 * //   { type: 'move', oldIndex: 0, newIndex: 1, key: 1 },
 * //   { type: 'insert', newIndex: 2, key: 3, item: { id: 3, name: 'C' } }
 * // ]
 */
export function diffKeyed<T>(
  oldItems: T[],
  newItems: T[],
  getKey: (item: T, index: number) => unknown
): DiffOperation[]
{
  const operations: DiffOperation[] = [];

  // Build key -> index maps
  const oldKeyToIndex = new Map<unknown, number>();
  const newKeyToIndex = new Map<unknown, number>();

  for (let i = 0; i < oldItems.length; i++)
  {
    oldKeyToIndex.set(getKey(oldItems[i], i), i);
  }

  for (let i = 0; i < newItems.length; i++)
  {
    newKeyToIndex.set(getKey(newItems[i], i), i);
  }

  // Track which old items have been matched
  const matchedOld = new Set<number>();
  const matchedNew = new Set<number>();

  // Phase 1: Find items to remove (in old but not in new)
  for (let i = 0; i < oldItems.length; i++)
  {
    const key = getKey(oldItems[i], i);
    if (!newKeyToIndex.has(key))
    {
      operations.push({
        type: "remove",
        oldIndex: i,
        key,
        item: oldItems[i],
      });
    }
  }

  // Phase 2: Find items to insert (in new but not in old)
  for (let i = 0; i < newItems.length; i++)
  {
    const key = getKey(newItems[i], i);
    if (!oldKeyToIndex.has(key))
    {
      operations.push({
        type: "insert",
        newIndex: i,
        key,
        item: newItems[i],
      });
      matchedNew.add(i);
    }
  }

  // Phase 3: Find moves using LIS for minimal operations
  // Build array of new positions for matched items
  const newPositions: number[] = [];
  const oldToNew: number[] = [];

  for (let i = 0; i < oldItems.length; i++)
  {
    const key = getKey(oldItems[i], i);
    const newIdx = newKeyToIndex.get(key);
    if (newIdx !== undefined)
    {
      newPositions.push(newIdx);
      oldToNew[i] = newIdx;
    }
  }

  // Find LIS to determine which items don't need to move
  const lisIndices = longestIncreasingSubsequence(newPositions);
  const lisSet = new Set(lisIndices.map((i) => newPositions[i]));

  // Items not in LIS need to be moved
  let oldIdx = 0;
  for (const newPos of newPositions)
  {
    while (
      oldIdx < oldItems.length &&
      !newKeyToIndex.has(getKey(oldItems[oldIdx], oldIdx))
    )
    {
      oldIdx++;
    }

    if (oldIdx < oldItems.length)
    {
      const key = getKey(oldItems[oldIdx], oldIdx);
      const oldIndex = oldIdx;
      const newIndex = newKeyToIndex.get(key)!;

      if (!lisSet.has(newIndex))
      {
        operations.push({
          type: "move",
          oldIndex,
          newIndex,
          key,
          item: oldItems[oldIndex],
        });
      }
      oldIdx++;
    }
  }

  // Phase 4: Find updates (same key but different content)
  for (let i = 0; i < newItems.length; i++)
  {
    const key = getKey(newItems[i], i);
    const oldIdx = oldKeyToIndex.get(key);
    if (oldIdx !== undefined)
    {
      const oldItem = oldItems[oldIdx];
      const newItem = newItems[i];
      // Only mark as update if content actually changed
      if (!shallowEqual(oldItem, newItem))
      {
        operations.push({
          type: "update",
          oldIndex: oldIdx,
          newIndex: i,
          key,
          item: newItem,
        });
      }
    }
  }

  return operations;
}

/**
 * Simpler diff for non-keyed lists.
 * Less efficient but works when items don't have stable identity.
 *
 * @param oldLength - Previous array length
 * @param newLength - New array length
 * @param newItems - New array items
 * @returns Array of operations
 */
export function diffUnkeyed<T>(
  oldLength: number,
  newLength: number,
  newItems: T[]
): DiffOperation[]
{
  const operations: DiffOperation[] = [];

  // Items to remove
  for (let i = newLength; i < oldLength; i++)
  {
    operations.push({ type: "remove", oldIndex: i });
  }

  // Items to insert
  for (let i = oldLength; i < newLength; i++)
  {
    operations.push({ type: "insert", newIndex: i, item: newItems[i] });
  }

  // All remaining items need update
  for (let i = 0; i < Math.min(oldLength, newLength); i++)
  {
    operations.push({
      type: "update",
      oldIndex: i,
      newIndex: i,
      item: newItems[i],
    });
  }

  return operations;
}

// ============================================================================
// LIS Algorithm (for optimal move detection)
// ============================================================================

/**
 * Finds the Longest Increasing Subsequence.
 * Used to determine which items are already in correct relative order.
 *
 * @param arr - Array of numbers
 * @returns Indices of the LIS in the original array
 */
function longestIncreasingSubsequence(arr: number[]): number[]
{
  if (arr.length === 0) return [];

  const n = arr.length;
  const dp: number[] = new Array(n).fill(1);
  const parent: number[] = new Array(n).fill(-1);
  let maxLength = 1;
  let maxIndex = 0;

  for (let i = 1; i < n; i++)
  {
    for (let j = 0; j < i; j++)
    {
      if (arr[j] < arr[i] && dp[j] + 1 > dp[i])
      {
        dp[i] = dp[j] + 1;
        parent[i] = j;
      }
    }
    if (dp[i] > maxLength)
    {
      maxLength = dp[i];
      maxIndex = i;
    }
  }

  // Reconstruct the LIS
  const result: number[] = [];
  let current = maxIndex;
  while (current !== -1)
  {
    result.unshift(current);
    current = parent[current];
  }

  return result;
}

/**
 * Computes the set of positions that form the longest increasing subsequence
 * of `source`, ignoring entries whose value is < 0 (used to mark brand-new
 * items that must always be (re)inserted).
 *
 * The loop renderer uses this to decide which reused elements are already in
 * correct relative DOM order and can therefore stay put — only the remaining
 * elements need to be moved. This turns an in-order content update into zero
 * DOM moves and minimizes moves for partial reorders.
 *
 * Runs in O(n log n) using patience sorting with predecessor links.
 *
 * @param source - For each new position, the element's previous index, or -1 if new
 * @returns Set of new-position indices that should NOT be moved
 */
export function getStableIndices(source: number[]): Set<number>
{
  const n = source.length;
  const result = new Set<number>();
  if (n === 0) return result;

  // Fast path: reused indices already in increasing order (the common case —
  // pure content updates, appends, single removes). Every reused element is
  // then stable by definition, so the patience sort below can be skipped.
  let prevValue = -1;
  let inOrder = true;
  for (let i = 0; i < n; i++)
  {
    const value = source[i];
    if (value < 0) continue;
    if (value <= prevValue)
    {
      inOrder = false;
      break;
    }
    prevValue = value;
  }
  if (inOrder)
  {
    for (let i = 0; i < n; i++)
    {
      if (source[i] >= 0) result.add(i);
    }
    return result;
  }

  // piles[k] holds the position with the smallest tail value for an increasing
  // run of length k + 1. prev links each position to its predecessor in the run.
  const piles: number[] = [];
  const prev: number[] = new Array(n).fill(-1);

  for (let i = 0; i < n; i++)
  {
    const value = source[i];
    if (value < 0) continue; // new element — never part of the stable run

    // Binary search for the first pile whose tail value is >= value.
    let lo = 0;
    let hi = piles.length;
    while (lo < hi)
    {
      const mid = (lo + hi) >> 1;
      if (source[piles[mid]] < value) lo = mid + 1;
      else hi = mid;
    }

    if (lo > 0) prev[i] = piles[lo - 1];
    piles[lo] = i;
  }

  // Walk the predecessor chain back from the last pile to collect the LIS.
  let cur = piles.length > 0 ? piles[piles.length - 1] : -1;
  while (cur !== -1)
  {
    result.add(cur);
    cur = prev[cur];
  }

  return result;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Shallow equality check for detecting content changes.
 */
function shallowEqual(a: unknown, b: unknown): boolean
{
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== "object") return a === b;

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;

  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);

  if (aKeys.length !== bKeys.length) return false;

  for (const key of aKeys)
  {
    if (aObj[key] !== bObj[key]) return false;
  }

  return true;
}

/**
 * Creates a key getter function from a key expression.
 *
 * @param keyExpr - Key expression (e.g., "item.id" or just "id" if item is scope)
 * @param itemName - The loop variable name (e.g., "item")
 * @returns A function that extracts the key from an item
 *
 * @example
 * const getKey = createKeyGetter("item.id", "item");
 * getKey({ id: 123, name: "foo" }) // 123
 */
export function createKeyGetter<T>(
  keyExpr: string | undefined,
  itemName: string
): (item: T, index: number) => unknown
{
  if (!keyExpr)
  {
    // No key expression - use index as key (not ideal but functional)
    return (_item, index) => index;
  }

  // Handle "item.id" -> extract "id" from item
  // Handle just "id" -> assume it's a property of item
  const path = keyExpr.startsWith(itemName + ".")
    ? keyExpr.slice(itemName.length + 1).split(".")
    : keyExpr.split(".");

  return (item: T) =>
  {
    let value: unknown = item;
    for (const key of path)
    {
      if (value === null || value === undefined) return undefined;
      value = (value as Record<string, unknown>)[key];
    }
    return value;
  };
}

/**
 * Applies diff operations to a list of DOM elements.
 * This is the main integration point with the loop renderer.
 *
 * @param container - Parent element containing the list
 * @param elements - Current rendered elements
 * @param operations - Diff operations to apply
 * @param createFn - Function to create a new element for an item
 * @param updateFn - Function to update an existing element
 * @returns The new array of elements
 */
export function applyDiffOperations<T>(
  container: Element | ShadowRoot,
  elements: Element[],
  operations: DiffOperation[],
  createFn: (item: T, index: number) => Element,
  updateFn: (element: Element, item: T, index: number) => void
): Element[]
{
  const newElements = [...elements];

  // Sort operations to ensure correct order:
  // 1. Removes (from end to start to preserve indices)
  // 2. Updates (in place)
  // 3. Inserts (from start to end)
  // 4. Moves (handled by insert after remove)
  const removes = operations
    .filter((op) => op.type === "remove")
    .sort((a, b) => (b.oldIndex ?? 0) - (a.oldIndex ?? 0));
  const updates = operations.filter((op) => op.type === "update");
  const inserts = operations.filter(
    (op) => op.type === "insert" || op.type === "move"
  );

  // Apply removes
  for (const op of removes)
  {
    if (op.oldIndex !== undefined)
    {
      const element = newElements[op.oldIndex];
      if (element)
      {
        element.remove();
      }
      newElements.splice(op.oldIndex, 1);
    }
  }

  // Apply updates
  for (const op of updates)
  {
    if (op.newIndex !== undefined && op.item !== undefined)
    {
      const element = newElements[op.oldIndex!];
      if (element)
      {
        updateFn(element, op.item as T, op.newIndex);
      }
    }
  }

  // Apply inserts
  for (const op of inserts)
  {
    if (op.newIndex !== undefined && op.item !== undefined)
    {
      const element = createFn(op.item as T, op.newIndex);
      const referenceElement = newElements[op.newIndex];
      if (referenceElement)
      {
        container.insertBefore(element, referenceElement);
      } else
      {
        container.appendChild(element);
      }
      newElements.splice(op.newIndex, 0, element);
    }
  }

  return newElements;
}
