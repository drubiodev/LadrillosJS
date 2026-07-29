import { LadrillosComponent } from "../../types";
import { REGEX_PATTERNS } from "../../utils/regex";
import { rewriteImports } from "../js/moduleExecutor";
import
  {
    escapeControlTags,
    restoreControlTags,
    isControlElement,
  } from "../html/controlTagEscape";

// Built on first parse, not at import time: build tools import this module to
// reach parseComponent and install their DOM shim (happy-dom, jsdom) afterwards.
let parser: DOMParser | undefined;

/**
 * Signatures of scripts injected by dev servers / live-reload tooling.
 *
 * When a component's `.html` partial is fetched through a dev server (VS Code
 * Live Preview, Live Server, BrowserSync, webpack-dev-server, …), that server
 * injects its own live-reload / HMR client script into the served HTML. Those
 * scripts are NOT part of the authored component, so they must never be treated
 * as component script content — otherwise the framework tries to inline them and
 * re-execute their code inside the reactive-state sandbox and event-handler
 * builder, which corrupts state extraction and silently breaks every inline /
 * `$on:` handler in the component.
 *
 * `@vite/client` and Vite `html-proxy` scripts are handled separately (Vite
 * proxy scripts are intentionally fetched), so they are not listed here.
 */
const INJECTED_SCRIPT_SRC_MARKERS = [
  "___vscode_livepreview_injected_script", // VS Code Live Preview
  "/livereload.js", // LiveReload / VS Code Live Server
  "browser-sync-client", // BrowserSync
  "browser-sync/dist", // BrowserSync
  "webpack-dev-server", // webpack-dev-server client
  "sockjs-node", // webpack-dev-server / sockjs transport
  "__webpack_hmr", // webpack hot middleware
];

const INJECTED_SCRIPT_CONTENT_MARKERS = [
  "aka.ms/live-preview", // VS Code Live Preview banner
  "Live Preview Extension", // VS Code Live Preview banner
  "___vscode_livepreview", // VS Code Live Preview globals
  "__bs_script__", // BrowserSync
  "browser-sync", // BrowserSync client
  "Browsersync", // BrowserSync client banner
  "browserSync", // BrowserSync client
  "LiveReload", // LiveReload client
  "webpackHotUpdate", // webpack HMR runtime
  "__webpack_hmr", // webpack hot middleware
];

/**
 * `id` attribute values used by dev-server injected scripts.
 */
const INJECTED_SCRIPT_ID_MARKERS = [
  "__bs_script__", // BrowserSync
];

/**
 * Returns true when a `<script>` element was injected by a dev server /
 * live-reload tool rather than authored as part of the component.
 * Checks the external `src` URL, the `id` attribute, and inline content
 * against known markers.
 */
function isDevServerInjectedScript(el: Element): boolean
{
  const src = el.getAttribute("src") || "";
  if (src && INJECTED_SCRIPT_SRC_MARKERS.some((m) => src.includes(m)))
  {
    return true;
  }

  const id = el.getAttribute("id") || "";
  if (id && INJECTED_SCRIPT_ID_MARKERS.includes(id))
  {
    return true;
  }

  const content = el.textContent || "";
  if (
    content &&
    INJECTED_SCRIPT_CONTENT_MARKERS.some((m) => content.includes(m))
  )
  {
    return true;
  }

  return false;
}

/**
 * Extracts loop variable names from <for each="..."> built-in elements.
 * These are locally scoped variables that should NOT be treated as state variables.
 *
 * Examples:
 *   <for each="item in items">           → ["item"]
 *   <for each="(item, index) in items">  → ["item", "index"]
 *   <for each="(user, i) in users">      → ["user", "i"]
 */
function extractLoopVariables(template: string): Set<string>
{
  const loopVars = new Set<string>();

  // Match the `each="..."` attribute on <for> elements.
  const forRegex = /<for\b[^>]*?\beach\s*=\s*["']([^"']+)["'][^>]*>/gi;

  let match;
  while ((match = forRegex.exec(template)) !== null)
  {
    const forExpr = match[1].trim();

    // Check for destructured form: (item, index) in array
    const destructuredMatch = forExpr.match(
      /^\(\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*,\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\)\s+in\s+/
    );
    if (destructuredMatch)
    {
      loopVars.add(destructuredMatch[1]); // item variable
      loopVars.add(destructuredMatch[2]); // index variable
      continue;
    }

    // Check for simple form: item in array
    const simpleMatch = forExpr.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s+in\s+/);
    if (simpleMatch)
    {
      loopVars.add(simpleMatch[1]); // item variable
    }
  }

  return loopVars;
}

/**
 * Extracts the SOURCE collection variable from <for each="... in source">.
 * Unlike the loop item variable (which is locally scoped), the source is a
 * state/prop reference and MUST be registered as an observed prop so a parent
 * can pass it down (e.g. <l-list postList="{postList}">). Without this, a
 * variable used ONLY inside a loop has no accessor and the prop is dropped.
 *
 * Examples:
 *   <for each="post in postList">          → ["postList"]
 *   <for each="(u, i) in users">           → ["users"]
 *   <for each="item in data.items">        → ["data"]   (root identifier)
 */
function extractLoopSourceVariables(template: string): Set<string>
{
  const sources = new Set<string>();
  const forRegex = /<for\b[^>]*?\beach\s*=\s*["']([^"']+)["'][^>]*>/gi;

  let match;
  while ((match = forRegex.exec(template)) !== null)
  {
    const forExpr = match[1].trim();
    // Take everything after the first " in " — that's the source expression.
    const inMatch = forExpr.match(/\bin\b\s+(.+)$/);
    if (!inMatch) continue;
    // Root identifier of the source expression (data.items -> data).
    const rootMatch = inMatch[1].trim().match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)/);
    if (rootMatch)
    {
      sources.add(rootMatch[1]);
    }
  }

  return sources;
}

/**
 * Extracts simple variable names from template bindings.
 * Only extracts top-level identifiers (e.g., 'title' from {title}, 'name' from {name.first}).
 * Ignores complex expressions, function calls, and literals.
 *
 * IMPORTANT: Excludes loop variables from $for directives, as those are locally
 * scoped and should not be transformed to __state__ access.
 */
function extractTemplateBindingVariables(template: string): string[]
{
  const variables = new Set<string>();
  const loopVariables = extractLoopVariables(template);
  const matches = template.matchAll(REGEX_PATTERNS.bindings);

  for (const match of matches)
  {
    const expression = match[1].trim();
    // Extract the first identifier (handles both 'title' and 'user.name' -> 'user')
    const identifierMatch = expression.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)/);
    if (identifierMatch)
    {
      const varName = identifierMatch[1];
      // Skip JavaScript keywords, literals, and common globals
      const skipList = [
        "true",
        "false",
        "null",
        "undefined",
        "new",
        "this",
        "typeof",
        "instanceof",
        "void",
        "delete",
        "in",
        "of",
        "if",
        "else",
        "for",
        "while",
        "do",
        "switch",
        "case",
        "break",
        "continue",
        "return",
        "throw",
        "try",
        "catch",
        "finally",
        "function",
        "class",
        "const",
        "let",
        "var",
        "Math",
        "Date",
        "JSON",
        "Array",
        "Object",
        "String",
        "Number",
        "Boolean",
        "console",
        "window",
        "document",
      ];
      // Skip loop variables (from $for directives) - they are locally scoped
      if (!skipList.includes(varName) && !loopVariables.has(varName))
      {
        variables.add(varName);
      }
    }
  }

  // Include loop SOURCE variables (the collection after `in`) so they are
  // registered as observed props and can be received from a parent component.
  for (const source of extractLoopSourceVariables(template))
  {
    if (!loopVariables.has(source))
    {
      variables.add(source);
    }
  }

  return Array.from(variables);
}

export async function parseComponent(
  source: string,
  name: string,
  componentUrl?: string
): Promise<LadrillosComponent>
{
  const doc = parseHTML(source);

  // get scripts
  const scriptEls = Array.from(doc.querySelectorAll("script"));

  // Drop scripts injected by dev servers / live-reload tooling (VS Code Live
  // Preview, Live Server, BrowserSync, webpack-dev-server, …). These are added
  // to the served HTML by the dev server and are not part of the authored
  // component; ingesting them corrupts reactive-state extraction and silently
  // breaks every inline / $on: event handler in the component.
  const authoredScriptEls = scriptEls.filter(
    (s) => !isDevServerInjectedScript(s)
  );

  // Collect inline scripts (with content)
  const inlineScripts = authoredScriptEls
    .filter((s) => !s.src)
    .map((s) =>
    {
      const content = (s.textContent ?? "").trim();
      const type = s.getAttribute("type");
      return { content, type };
    })
    .filter((s) => s.content.length > 0);

  // Detect Vite-transformed module scripts (html-proxy)
  // These are inline scripts that Vite extracted to external files
  const viteProxyScripts = authoredScriptEls.filter((s) =>
  {
    const src = s.getAttribute("src") || "";
    return src.includes("html-proxy") && s.getAttribute("type") === "module";
  });

  // Fetch content from Vite proxy scripts
  const fetchedScripts = await Promise.all(
    viteProxyScripts.map(async (s) =>
    {
      const src = s.getAttribute("src") || "";
      try
      {
        const response = await fetch(src);
        if (response.ok)
        {
          const content = await response.text();
          return { content: content.trim(), type: "module" };
        }
      } catch (e)
      {
        // Silently fail - script will be skipped
      }
      return null;
    })
  );

  // Combine inline scripts with fetched Vite proxy scripts
  const scripts = [
    ...inlineScripts,
    ...fetchedScripts.filter(
      (s): s is { content: string; type: string } =>
        s !== null && s.content.length > 0
    ),
  ];

  // Filter out Vite-injected scripts and proxy scripts for external scripts list
  const allExternalScripts = authoredScriptEls
    .filter((s) =>
    {
      if (!s.src) return false;
      const src = s.getAttribute("src") || "";
      // Skip Vite client and proxy scripts
      if (src.includes("@vite/client")) return false;
      if (src.includes("html-proxy")) return false;
      return true;
    })
    .map((s) =>
    {
      const type = s.getAttribute("type");
      let src = s.src;

      // If the parser keeps a relative src, resolve it against the component URL.
      if (componentUrl)
      {
        try
        {
          src = new URL(
            s.getAttribute("src") ?? s.src,
            componentUrl
          ).toString();
        } catch
        {
          // ignore resolution errors; keep original
        }
      }

      // Check if the script has the 'external' attribute
      // These scripts should be loaded as-is without framework processing
      const external = s.hasAttribute("external");

      return { src, type, external };
    })
    .filter((s) => s.src.length > 0);

  // Plain external scripts (without the `external` attribute) are fetched
  // and inlined so their declarations participate in the component's reactive
  // state — same as if the user had pasted the code into a <script> tag.
  // This applies to both regular scripts AND `type="module"` scripts; the
  // only practical reason to keep an external file is when you need import
  // statements (which require type="module"). Both kinds end up reactive.
  // Scripts marked with the `external` attribute are left alone and loaded
  // as raw third-party scripts.
  const inlineableExternals = allExternalScripts.filter((s) => !s.external);
  const externalScripts = allExternalScripts.filter((s) => s.external);

  const fetchedInlineExternals = await Promise.all(
    inlineableExternals.map(async (s) =>
    {
      try
      {
        const response = await fetch(s.src);
        if (response.ok)
        {
          let content = (await response.text()).trim();
          if (content.length > 0)
          {
            // For module scripts, rewrite relative imports against the
            // ORIGINAL script URL so they still resolve correctly after
            // the content is inlined into the component.
            if (s.type === "module")
            {
              content = rewriteImports(content, s.src);
            }
            return { content, type: s.type };
          }
        }
      } catch
      {
        // Silently fail - script will be skipped
      }
      return null;
    })
  );

  for (const s of fetchedInlineExternals)
  {
    if (s) scripts.push(s);
  }

  scriptEls.forEach((s) => s.remove());

  // get external stylesheets (<link rel="stylesheet">)
  const linkEls = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'));
  const externalStyles = linkEls
    .map((l) =>
    {
      let href = l.getAttribute("href") || "";
      const rel = l.getAttribute("rel") || "stylesheet";

      // Resolve relative URLs against component URL
      if (componentUrl && href && !href.startsWith("http"))
      {
        try
        {
          href = new URL(href, componentUrl).toString();
        } catch
        {
          // ignore resolution errors; keep original
        }
      }

      return { href, rel };
    })
    .filter((l) => l.href.length > 0);
  linkEls.forEach((l) => l.remove());

  // get styles
  const styleEls = Array.from(doc.querySelectorAll("style"));
  const styles = styleEls
    .map((s) => s.textContent ?? "")
    .join("\n")
    .trim();
  styleEls.forEach((s) => s.remove());

  // Get template content
  // <template> elements have special handling - content is in .content property
  //
  // Only a `<template>` that is a DIRECT child of <body> or <head> counts as
  // the component's root template. A plain `doc.querySelector("template")`
  // would match nested <template> elements inside child custom elements
  // (e.g. a <code-block> that wraps a <template> of source code to display),
  // causing the framework to mistakenly treat that nested template as the
  // component's root and drop everything else.
  //
  // We must also check <head>: when a component file begins with a
  // <template>/<script>/<style> (with no prior flow content), the HTML
  // parser places those elements in <head>. This also happens in dev when
  // Vite injects its client <script> at the top of fetched HTML.
  const findTopLevelTemplate = (parent: Element | null) =>
    parent
      ? (Array.from(parent.children).find(
        (el) => el.tagName === "TEMPLATE"
      ) as HTMLTemplateElement | undefined)
      : undefined;
  const templateEl =
    findTopLevelTemplate(doc.body) ?? findTopLevelTemplate(doc.head);
  let html: string;

  if (templateEl)
  {
    // Clone the template content and serialize it
    const tempDiv = document.createElement("div");
    tempDiv.appendChild(templateEl.content.cloneNode(true));
    html = tempDiv.innerHTML.trim();
  } else
  {
    // Fallback to body innerHTML
    html = doc.body.innerHTML.trim();
  }

  // Extract variable names from template bindings for auto-attribute observation
  const templateBindings = extractTemplateBindingVariables(html);

  return {
    tagName: name,
    template: html,
    scripts,
    externalScripts,
    externalStyles,
    styles: styles,
    sourcePath: componentUrl,
    lazy: false,
    templateBindings,
  };
}

function parseHTML(source: string): Document
{
  // Control elements (<for>, <if>, …) are escaped to <template>
  // placeholders before parsing so the HTML parser's table insertion
  // modes cannot foster-parent them out of <table>/<tbody>/<tr>, then
  // restored with DOM APIs — which parser content rules cannot touch.
  parser ??= new DOMParser();
  const doc = parser.parseFromString(escapeControlTags(source), "text/html");
  restoreControlTags(doc.head);
  restoreControlTags(doc.body);

  // A component that STARTS with a control element gets its placeholder
  // parsed into <head> (templates are metadata content), whereas the raw
  // tag would have opened <body>. Move restored control elements back to
  // the front of <body>, preserving their order.
  const strays = Array.from(doc.head.children).filter(isControlElement);
  const anchor = doc.body.firstChild;
  for (const el of strays)
  {
    doc.body.insertBefore(el, anchor);
  }

  return doc;
}
