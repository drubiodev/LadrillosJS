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
import
  {
    extractVariableNames,
    extractFunctionNames,
    extractFunctionDefinitions,
  } from "../core/js/scriptParser";
import
  {
    stripImports,
    stripExports,
    extractDeclaredNames,
    parseImports,
  } from "../core/js/moduleExecutor";
import { transformCodeToStateAccess } from "../utils/stateTransform";
import { EVENT_ATTRIBUTE_SET } from "../utils/jsevents";
import type { LadrillosComponent } from "../types";

export interface EmittedKeys
{
  evaluators: string[];
  handlers: string[];
  setups: string[];
}

export interface EmitResult
{
  /** ES module source. Import it for its side effect of registering artifacts. */
  code: string;
  /** The parsed component as JSON — what `defineCompiled` consumes. */
  descriptor: string;
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

/**
 * Names a module script receives as parameters that are *not* real globals, so
 * an artifact must declare them as deps or they would not resolve at all.
 *
 * Ordinary globals the runtime also injects (`console`, `Math`, `fetch`, …) are
 * deliberately omitted: leaving them undeclared lets them resolve through the
 * normal scope chain to the very same object. This is only safe because
 * SHADOWED_GLOBALS is empty — if the framework ever shadows a global again,
 * those names must be added here or emitted code will diverge from the runtime.
 */
const MODULE_INJECTED = new Set([
  "__state__",
  "$host",
  "$refs",
  "$emit",
  "$listen",
  "$use",
  "registerComponent",
  "registerComponents",
  "ladrillosjs",
]);

/** Local binding names introduced by a module script's import statements. */
function importNamesFor(code: string): string[]
{
  const names: string[] = [];
  for (const parsed of parseImports(code))
  {
    for (const binding of parsed.imports)
    {
      if (binding.local && !names.includes(binding.local)) names.push(binding.local);
    }
  }
  return names;
}

/** Identifiers the expression mentions that the runtime will actually supply. */
function depsFor(
  expression: string,
  available: ReadonlySet<string>
): string[]
{
  const found = expression.match(IDENTIFIER_G) ?? [];
  const deps: string[] = [];
  for (const name of found)
  {
    if (RESERVED.has(name)) continue;
    if (!available.has(name)) continue;
    if (!deps.includes(name)) deps.push(name);
  }
  return deps;
}

function stripBindingBraces(expression: string): string
{
  const trimmed = expression.trim();
  return trimmed.startsWith("{") && trimmed.endsWith("}")
    ? trimmed.slice(1, -1).trim()
    : trimmed;
}

/** Mirrors the runtime's `parseForExpression` closely enough to find loop names. */
function parseFor(
  expression: string
): { item: string; index?: string; array: string } | null
{
  const match = expression.match(/([\s\S]*?)\s+(?:in|of)\s+([\s\S]+)$/);
  if (!match) return null;

  let [, lhs, rhs] = match;
  const trackMatch = rhs.match(/\s+track\s+by\s+(.+)$/i);
  if (trackMatch) rhs = rhs.slice(0, trackMatch.index).trim();

  lhs = lhs.trim().replace(/^\(|\)$/g, "");
  const parts = lhs.split(",").map((p) => p.trim()).filter(Boolean);

  return { item: parts[0], index: parts[1], array: rhs.trim() };
}

interface Collected
{
  evaluators: Map<string, string[]>;
  handlers: Map<string, { code: string; deps: string[] }>;
}

function collect(
  component: LadrillosComponent,
  stateNames: ReadonlySet<string>
): Collected
{
  const evaluators = new Map<string, string[]>();
  const handlers = new Map<string, { code: string; deps: string[] }>();

  const tpl = document.createElement("template");
  tpl.innerHTML = component.template;

  const addEvaluator = (raw: string, extra: ReadonlySet<string>): void =>
  {
    const expression = raw.trim();
    if (!expression || evaluators.has(expression)) return;
    const available = new Set([...stateNames, ...extra]);
    evaluators.set(expression, depsFor(expression, available));
  };

  const addHandler = (raw: string): void =>
  {
    const code = raw.trim();
    if (!code) return;
    const key = `handler:${code}`;
    if (handlers.has(key)) return;
    handlers.set(key, { code, deps: ["__state__", "$refs", "$host", "event"] });
  };

  const scanText = (text: string, scope: ReadonlySet<string>): void =>
  {
    for (const m of text.matchAll(/{([^}]+)}/g)) addEvaluator(m[1], scope);
  };

  const walk = (node: Element, scope: ReadonlySet<string>): void =>
  {
    let childScope = scope;

    if (node.tagName.toLowerCase() === "for")
    {
      const each = node.getAttribute("each");
      const parsed = each ? parseFor(each) : null;
      if (parsed)
      {
        addEvaluator(parsed.array, scope);
        childScope = new Set([...scope, parsed.item]);
        if (parsed.index) childScope = new Set([...childScope, parsed.index]);

        const key = node.getAttribute("key");
        if (key) addEvaluator(key, childScope);
      }
    }

    for (const attr of Array.from(node.attributes))
    {
      const name = attr.name;
      const value = attr.value;

      if (EVENT_ATTRIBUTE_SET.has(name) || name.startsWith("$on:"))
      {
        addHandler(value);
        continue;
      }
      if (name === "condition")
      {
        addEvaluator(stripBindingBraces(value), childScope);
        continue;
      }
      if (name === "$bind")
      {
        addEvaluator(stripBindingBraces(value), childScope);
        continue;
      }
      if (name === "each" || name === "key" || name === "$ref") continue;

      if (value.includes("{")) scanText(value, childScope);
    }

    for (const child of Array.from(node.children)) walk(child, childScope);
  };

  const rootScope: ReadonlySet<string> = stateNames;
  for (const child of Array.from(tpl.content.children))
  {
    walk(child as Element, rootScope);
  }

  // Text nodes anywhere in the template, with loop scope applied.
  const walkText = (node: Node, scope: ReadonlySet<string>): void =>
  {
    for (const child of Array.from(node.childNodes))
    {
      if (child.nodeType === 3)
      {
        scanText(child.textContent ?? "", scope);
        continue;
      }
      if (child.nodeType !== 1) continue;

      const el = child as Element;
      let childScope = scope;
      if (el.tagName.toLowerCase() === "for")
      {
        const parsed = parseFor(el.getAttribute("each") ?? "");
        if (parsed)
        {
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
): EmitResult
{
  const runtimeImport = options.runtimeImport ?? "ladrillosjs/csp";
  const format = options.format ?? "module";

  const regularScripts = component.scripts.filter((s) => s.type !== "module");
  const moduleScripts = component.scripts.filter((s) => s.type === "module");
  const hasModuleScripts = moduleScripts.length > 0;

  const regularContent = regularScripts.map((s) => s.content).join("\n");

  // Module scripts contribute state too: their top-level bindings are written
  // into __state__ before any binding is evaluated, so expressions can name them.
  const moduleVars: string[] = [];
  const moduleFuncs: string[] = [];
  for (const script of moduleScripts)
  {
    const declared = extractDeclaredNames(stripExports(stripImports(script.content)));
    moduleVars.push(...declared.variables);
    moduleFuncs.push(...declared.functions);
  }

  const stateNames = new Set<string>([
    ...extractVariableNames(regularContent),
    ...extractFunctionNames(regularContent),
    ...moduleVars,
    ...moduleFuncs,
    ...(component.templateBindings ?? []),
  ]);

  const { evaluators, handlers } = collect(component, stateNames);

  const evaluatorEntries = [...evaluators].map(([expression, deps]) =>
  {
    const params = deps.join(", ");
    return `  ${JSON.stringify(expression)}: { deps: ${JSON.stringify(
      deps
    )}, fn: (${params}) => (${expression}) },`;
  });

  // Handlers mirror the runtime wrapper. For regular scripts the runtime
  // re-creates the component's functions so they see current values; for module
  // scripts it destructures them off __state__ instead, because those functions
  // close over the module's imports and must not be rebuilt. The state
  // transform deliberately leaves call expressions alone, so `addItem()` only
  // resolves if the name is bound — hence the destructure rather than a rewrite.
  const allVariables = [...stateNames];
  const stateFunctions = [
    ...new Set([...extractFunctionNames(regularContent), ...moduleFuncs]),
  ];
  const funcDefs = hasModuleScripts
    ? stateFunctions.length
      ? `const { ${stateFunctions.join(", ")} } = __state__;`
      : ""
    : transformCodeToStateAccess(
      extractFunctionDefinitions(regularContent, []),
      allVariables,
      { rewriteDeclarations: false }
    );

  const handlerEntries = [...handlers].map(([key, { code, deps }]) =>
  {
    const body = transformCodeToStateAccess(code, allVariables, {
      rewriteDeclarations: false,
    });
    return `  ${JSON.stringify(key)}: { deps: ${JSON.stringify(
      deps
    )}, fn: (${deps.join(", ")}) => { ${funcDefs}\n${body}; } },`;
  });

  // The runtime runs each <script> separately, so each one is its own artifact
  // keyed by its own source — joining them would produce a key nothing requests.
  const setupEntries: string[] = [];
  const setupKeys: string[] = [];

  for (const script of regularScripts)
  {
    const content = script.content;
    if (!content.trim()) continue;
    const vars = [
      ...new Set([
        ...extractVariableNames(content),
        ...(component.templateBindings ?? []),
      ]),
    ];
    const transformed = transformCodeToStateAccess(content, vars);
    const key = `state:${content}`;
    setupKeys.push(key);
    setupEntries.push(
      `  ${JSON.stringify(
        key
      )}: { deps: ["__state__"], fn: (__state__) => { ${transformed} } },`
    );
  }

  for (const script of moduleScripts)
  {
    const content = script.content;
    if (!content.trim()) continue;

    const executable = stripExports(stripImports(content));
    const { variables, functions } = extractDeclaredNames(executable);
    const transformed = transformCodeToStateAccess(executable, variables);
    const returnStatement = functions.length
      ? `return { ${functions.join(", ")} };`
      : `return {};`;

    // Imports stay resolved by the runtime and arrive as parameters, so the
    // component URL still anchors relative specifiers exactly as before.
    const available = new Set([...MODULE_INJECTED, ...importNamesFor(content)]);
    const deps = depsFor(`${transformed}\n${returnStatement}`, available);
    if (!deps.includes("__state__")) deps.unshift("__state__");

    const key = `module:${content}`;
    setupKeys.push(key);
    setupEntries.push(
      `  ${JSON.stringify(key)}: { deps: ${JSON.stringify(
        deps
      )}, fn: async (${deps.join(
        ", "
      )}) => { ${transformed}\n${returnStatement} } },`
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

  // Everything `parseComponent` would have derived from the .html file, so the
  // CSP runtime needs neither the fetch nor the HTML parser.
  const descriptor = JSON.stringify(
    {
      tagName: component.tagName,
      template: component.template,
      scripts: component.scripts,
      externalScripts: component.externalScripts,
      externalStyles: component.externalStyles,
      styles: component.styles,
      sourcePath: component.sourcePath,
      templateBindings: component.templateBindings,
    },
    null,
    2
  );

  // `table` emits a self-contained module with no imports, so it can be loaded
  // by any JS engine without resolving the framework — used by the conformance
  // tests to prove the output really is plain static JavaScript.
  const code =
    format === "table"
      ? `// Generated by @ladrillosjs/compiler. Do not edit.\nexport default ${table};\n`
      : `// Generated by @ladrillosjs/compiler. Do not edit.
import { registerArtifacts, defineCompiled } from ${JSON.stringify(runtimeImport)};

export const component = ${descriptor};

registerArtifacts(${table});

/** Defines the custom element. Importing this module only registers artifacts. */
export default function define(options) {
  defineCompiled(component, options);
}
`;

  return {
    code,
    descriptor,
    keys: {
      evaluators: [...evaluators.keys()],
      handlers: [...handlers.keys()],
      setups: setupKeys,
    },
  };
}
