/**
 * Ahead-of-time emitter: turns a parsed component into a JavaScript module that
 * registers precompiled artifacts, so the runtime never needs `Function` and
 * the page never needs `script-src 'unsafe-eval'`.
 *
 * This runs at BUILD time (Node + happy-dom, or a browser). It deliberately
 * reuses the same pure helpers the runtime uses — `extractVariableNames`,
 * `extractFunctionDefinitions`, `transformCodeToStateAccess` — so the two paths
 * cannot drift apart in how they rewrite user code.
 *
 * @see src/core/js/precompiled.ts for the calling convention.
 */
import {
  extractVariableNames,
  extractFunctionDefinitions,
} from "../core/js/scriptParser";
import { transformCodeToStateAccess } from "../utils/stateTransform";
import { EVENT_ATTRIBUTE_SET } from "../utils/jsevents";
import type { LadrillosComponent } from "../types";

export interface EmittedKeys {
  evaluators: string[];
  handlers: string[];
  setups: string[];
}

export interface EmitResult {
  /** ES module source. Import it for its side effect of registering artifacts. */
  code: string;
  keys: EmittedKeys;
}

/** Names that must never become artifact parameters, or they'd shadow the real global. */
const RESERVED = new Set([
  "true",
  "false",
  "null",
  "undefined",
  "this",
  "new",
  "typeof",
  "instanceof",
  "in",
  "of",
  "void",
  "delete",
  "return",
]);

const IDENTIFIER_G = /[A-Za-z_$][\w$]*/g;

/** Identifiers the expression mentions that the runtime will actually supply. */
function depsFor(
  expression: string,
  available: ReadonlySet<string>
): string[] {
  const found = expression.match(IDENTIFIER_G) ?? [];
  const deps: string[] = [];
  for (const name of found) {
    if (RESERVED.has(name)) continue;
    if (!available.has(name)) continue;
    if (!deps.includes(name)) deps.push(name);
  }
  return deps;
}

function stripBindingBraces(expression: string): string {
  const trimmed = expression.trim();
  return trimmed.startsWith("{") && trimmed.endsWith("}")
    ? trimmed.slice(1, -1).trim()
    : trimmed;
}

/** Mirrors the runtime's `parseForExpression` closely enough to find loop names. */
function parseFor(
  expression: string
): { item: string; index?: string; array: string } | null {
  const match = expression.match(/([\s\S]*?)\s+(?:in|of)\s+([\s\S]+)$/);
  if (!match) return null;

  let [, lhs, rhs] = match;
  const trackMatch = rhs.match(/\s+track\s+by\s+(.+)$/i);
  if (trackMatch) rhs = rhs.slice(0, trackMatch.index).trim();

  lhs = lhs.trim().replace(/^\(|\)$/g, "");
  const parts = lhs.split(",").map((p) => p.trim()).filter(Boolean);

  return { item: parts[0], index: parts[1], array: rhs.trim() };
}

interface Collected {
  evaluators: Map<string, string[]>;
  handlers: Map<string, { code: string; deps: string[] }>;
}

function collect(
  component: LadrillosComponent,
  stateNames: ReadonlySet<string>
): Collected {
  const evaluators = new Map<string, string[]>();
  const handlers = new Map<string, { code: string; deps: string[] }>();

  const tpl = document.createElement("template");
  tpl.innerHTML = component.template;

  const addEvaluator = (raw: string, extra: ReadonlySet<string>): void => {
    const expression = raw.trim();
    if (!expression || evaluators.has(expression)) return;
    const available = new Set([...stateNames, ...extra]);
    evaluators.set(expression, depsFor(expression, available));
  };

  const addHandler = (raw: string): void => {
    const code = raw.trim();
    if (!code) return;
    const key = `handler:${code}`;
    if (handlers.has(key)) return;
    handlers.set(key, { code, deps: ["__state__", "$refs", "$host", "event"] });
  };

  const scanText = (text: string, scope: ReadonlySet<string>): void => {
    for (const m of text.matchAll(/{([^}]+)}/g)) addEvaluator(m[1], scope);
  };

  const walk = (node: Element, scope: ReadonlySet<string>): void => {
    let childScope = scope;

    if (node.tagName.toLowerCase() === "for") {
      const each = node.getAttribute("each");
      const parsed = each ? parseFor(each) : null;
      if (parsed) {
        addEvaluator(parsed.array, scope);
        childScope = new Set([...scope, parsed.item]);
        if (parsed.index) childScope = new Set([...childScope, parsed.index]);

        const key = node.getAttribute("key");
        if (key) addEvaluator(key, childScope);
      }
    }

    for (const attr of Array.from(node.attributes)) {
      const name = attr.name;
      const value = attr.value;

      if (EVENT_ATTRIBUTE_SET.has(name) || name.startsWith("$on:")) {
        addHandler(value);
        continue;
      }
      if (name === "condition") {
        addEvaluator(stripBindingBraces(value), childScope);
        continue;
      }
      if (name === "$bind") {
        addEvaluator(stripBindingBraces(value), childScope);
        continue;
      }
      if (name === "each" || name === "key" || name === "$ref") continue;

      if (value.includes("{")) scanText(value, childScope);
    }

    for (const child of Array.from(node.children)) walk(child, childScope);
  };

  const rootScope: ReadonlySet<string> = stateNames;
  for (const child of Array.from(tpl.content.children)) {
    walk(child as Element, rootScope);
  }

  // Text nodes anywhere in the template, with loop scope applied.
  const walkText = (node: Node, scope: ReadonlySet<string>): void => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) {
        scanText(child.textContent ?? "", scope);
        continue;
      }
      if (child.nodeType !== 1) continue;

      const el = child as Element;
      let childScope = scope;
      if (el.tagName.toLowerCase() === "for") {
        const parsed = parseFor(el.getAttribute("each") ?? "");
        if (parsed) {
          childScope = new Set([...scope, parsed.item]);
          if (parsed.index) childScope = new Set([...childScope, parsed.index]);
        }
      }
      walkText(el, childScope);
    }
  };
  walkText(tpl.content, rootScope);

  return { evaluators, handlers };
}

/** Emits an ES module that registers this component's artifacts. */
export function emitComponent(
  component: LadrillosComponent,
  options: { runtimeImport?: string; format?: "module" | "table" } = {}
): EmitResult {
  const runtimeImport = options.runtimeImport ?? "ladrillosjs/csp";
  const format = options.format ?? "module";

  const scriptContent = component.scripts.map((s) => s.content).join("\n");
  const declared = extractVariableNames(scriptContent);
  const stateNames = new Set<string>([
    ...declared,
    ...(component.templateBindings ?? []),
  ]);

  const { evaluators, handlers } = collect(component, stateNames);

  const evaluatorEntries = [...evaluators].map(([expression, deps]) => {
    const params = deps.join(", ");
    return `  ${JSON.stringify(expression)}: { deps: ${JSON.stringify(
      deps
    )}, fn: (${params}) => (${expression}) },`;
  });

  // Handlers mirror the runtime wrapper: script functions are re-declared so
  // the handler sees current values, then the body is rewritten to write
  // straight through to reactive state instead of destructured copies.
  const allVariables = [...stateNames];
  const funcDefs = transformCodeToStateAccess(
    extractFunctionDefinitions(scriptContent, []),
    allVariables,
    { rewriteDeclarations: false }
  );

  const handlerEntries = [...handlers].map(([key, { code, deps }]) => {
    const body = transformCodeToStateAccess(code, allVariables, {
      rewriteDeclarations: false,
    });
    return `  ${JSON.stringify(key)}: { deps: ${JSON.stringify(
      deps
    )}, fn: (${deps.join(", ")}) => { ${funcDefs}\n${body}; } },`;
  });

  const setupEntries: string[] = [];
  if (scriptContent.trim()) {
    const transformed = transformCodeToStateAccess(
      scriptContent,
      allVariables
    );
    setupEntries.push(
      `  ${JSON.stringify(
        `state:${scriptContent}`
      )}: { deps: ["__state__"], fn: (__state__) => { ${transformed} } },`
    );
  }

  const table = `{
  evaluators: {
${evaluatorEntries.join("\n")}
  },
  handlers: {
${handlerEntries.join("\n")}
  },
  setups: {
${setupEntries.join("\n")}
  },
}`;

  // `table` emits a self-contained module with no imports, so it can be loaded
  // by any JS engine without resolving the framework — used by the conformance
  // tests to prove the output really is plain static JavaScript.
  const code =
    format === "table"
      ? `// Generated by @ladrillosjs/compiler. Do not edit.\nexport default ${table};\n`
      : `// Generated by @ladrillosjs/compiler. Do not edit.
import { registerArtifacts } from ${JSON.stringify(runtimeImport)};

registerArtifacts(${table});
`;

  return {
    code,
    keys: {
      evaluators: [...evaluators.keys()],
      handlers: [...handlers.keys()],
      setups: scriptContent.trim() ? [`state:${scriptContent}`] : [],
    },
  };
}
