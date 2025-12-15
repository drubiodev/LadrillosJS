import { BindingDescriptor } from "../../types";

export function analyzeBinding(
  raw: string
): BindingDescriptor["bindings"][number] {
  const trimmed = raw.trim();

  // Try to detect a top-level call expression: <callee>(<args>)
  const call = tryParseTopLevelCall(trimmed);
  if (call) {
    return {
      raw: trimmed,
      path: call.calleePath,
      isFunction: true,
      isExpression: true,
      functionArgs: call.args,
    };
  }

  // Try to detect a simple dotted path: foo.bar.baz
  const path = tryParsePath(trimmed);
  if (path) {
    return {
      raw: trimmed,
      path,
      isFunction: false,
      isExpression: false,
    };
  }

  // Otherwise, treat as an expression (ternaries, arithmetic, method chains, etc.)
  // For expressions we can't safely extract a single "path".
  return {
    raw: trimmed,
    path: [],
    isExpression: true,
  };
}

function tryParsePath(raw: string): string[] | null {
  // Allow identifiers like foo, $foo, _foo, foo123, and dotted paths.
  const re = /^[$A-Z_][0-9A-Z_$]*(?:\s*\.\s*[$A-Z_][0-9A-Z_$]*)*$/i;
  if (!re.test(raw)) return null;
  return raw
    .split(".")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function tryParseTopLevelCall(
  raw: string
): { calleePath: string[]; args: string[] } | null {
  // Find the first "(" at top-level (not in quotes / nested structures)
  const openIndex = findFirstTopLevelChar(raw, "(");
  if (openIndex < 0) return null;

  // Ensure the raw ends with a matching ")" at top-level
  const closeIndex = findMatchingParenIndex(raw, openIndex);
  if (closeIndex < 0) return null;
  if (raw.slice(closeIndex + 1).trim().length !== 0) return null;

  const calleeRaw = raw.slice(0, openIndex).trim();
  const calleePath = tryParsePath(calleeRaw);
  if (!calleePath) return null;

  const argsRaw = raw.slice(openIndex + 1, closeIndex);
  const args = splitTopLevelArgs(argsRaw);

  return { calleePath, args };
}

function splitTopLevelArgs(argsRaw: string): string[] {
  const args: string[] = [];
  let current = "";

  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;

  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escape = false;

  for (let i = 0; i < argsRaw.length; i++) {
    const ch = argsRaw[i];

    if (escape) {
      current += ch;
      escape = false;
      continue;
    }

    if (ch === "\\") {
      current += ch;
      escape = true;
      continue;
    }

    if (!inDouble && !inTemplate && ch === "'") {
      inSingle = !inSingle;
      current += ch;
      continue;
    }

    if (!inSingle && !inTemplate && ch === '"') {
      inDouble = !inDouble;
      current += ch;
      continue;
    }

    // Template literals can contain commas in ${...}; we treat backticks as string boundaries.
    if (!inSingle && !inDouble && ch === "`") {
      inTemplate = !inTemplate;
      current += ch;
      continue;
    }

    if (!inSingle && !inDouble && !inTemplate) {
      if (ch === "(") parenDepth++;
      else if (ch === ")") parenDepth = Math.max(0, parenDepth - 1);
      else if (ch === "[") bracketDepth++;
      else if (ch === "]") bracketDepth = Math.max(0, bracketDepth - 1);
      else if (ch === "{") braceDepth++;
      else if (ch === "}") braceDepth = Math.max(0, braceDepth - 1);

      // Split only on commas at top-level.
      if (
        ch === "," &&
        parenDepth === 0 &&
        bracketDepth === 0 &&
        braceDepth === 0
      ) {
        const value = current.trim();
        if (value.length > 0) args.push(value);
        current = "";
        continue;
      }
    }

    current += ch;
  }

  const last = current.trim();
  if (last.length > 0) args.push(last);

  return args;
}

function findFirstTopLevelChar(source: string, target: string): number {
  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;

  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escape = false;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];

    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }

    if (!inDouble && !inTemplate && ch === "'") {
      inSingle = !inSingle;
      continue;
    }
    if (!inSingle && !inTemplate && ch === '"') {
      inDouble = !inDouble;
      continue;
    }
    if (!inSingle && !inDouble && ch === "`") {
      inTemplate = !inTemplate;
      continue;
    }

    if (inSingle || inDouble || inTemplate) continue;

    if (ch === "(") parenDepth++;
    else if (ch === ")") parenDepth = Math.max(0, parenDepth - 1);
    else if (ch === "[") bracketDepth++;
    else if (ch === "]") bracketDepth = Math.max(0, bracketDepth - 1);
    else if (ch === "{") braceDepth++;
    else if (ch === "}") braceDepth = Math.max(0, braceDepth - 1);

    if (
      ch === target &&
      parenDepth === 0 &&
      bracketDepth === 0 &&
      braceDepth === 0
    ) {
      return i;
    }
  }

  return -1;
}

function findMatchingParenIndex(source: string, openIndex: number): number {
  // Assumes source[openIndex] === '(' and that it's top-level.
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escape = false;

  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];

    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }

    if (!inDouble && !inTemplate && ch === "'") {
      inSingle = !inSingle;
      continue;
    }
    if (!inSingle && !inTemplate && ch === '"') {
      inDouble = !inDouble;
      continue;
    }
    if (!inSingle && !inDouble && ch === "`") {
      inTemplate = !inTemplate;
      continue;
    }
    if (inSingle || inDouble || inTemplate) continue;

    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return i;
      if (depth < 0) return -1;
    }
  }

  return -1;
}
