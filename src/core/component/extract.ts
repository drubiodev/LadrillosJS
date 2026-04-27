import { LadrillosComponent } from "../../types";
import { REGEX_PATTERNS } from "../../utils/regex";

const parser = new DOMParser();

/**
 * Extracts loop variable names from <for each="..."> built-in elements.
 * These are locally scoped variables that should NOT be treated as state variables.
 *
 * Examples:
 *   <for each="item in items">           → ["item"]
 *   <for each="(item, index) in items">  → ["item", "index"]
 *   <for each="(user, i) in users">      → ["user", "i"]
 */
function extractLoopVariables(template: string): Set<string> {
  const loopVars = new Set<string>();

  // Match the `each="..."` attribute on <for> elements.
  const forRegex = /<for\b[^>]*?\beach\s*=\s*["']([^"']+)["'][^>]*>/gi;

  let match;
  while ((match = forRegex.exec(template)) !== null) {
    const forExpr = match[1].trim();

    // Check for destructured form: (item, index) in array
    const destructuredMatch = forExpr.match(
      /^\(\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*,\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\)\s+in\s+/
    );
    if (destructuredMatch) {
      loopVars.add(destructuredMatch[1]); // item variable
      loopVars.add(destructuredMatch[2]); // index variable
      continue;
    }

    // Check for simple form: item in array
    const simpleMatch = forExpr.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s+in\s+/);
    if (simpleMatch) {
      loopVars.add(simpleMatch[1]); // item variable
    }
  }

  return loopVars;
}

/**
 * Extracts simple variable names from template bindings.
 * Only extracts top-level identifiers (e.g., 'title' from {title}, 'name' from {name.first}).
 * Ignores complex expressions, function calls, and literals.
 *
 * IMPORTANT: Excludes loop variables from $for directives, as those are locally
 * scoped and should not be transformed to __state__ access.
 */
function extractTemplateBindingVariables(template: string): string[] {
  const variables = new Set<string>();
  const loopVariables = extractLoopVariables(template);
  const matches = template.matchAll(REGEX_PATTERNS.bindings);

  for (const match of matches) {
    const expression = match[1].trim();
    // Extract the first identifier (handles both 'title' and 'user.name' -> 'user')
    const identifierMatch = expression.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)/);
    if (identifierMatch) {
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
      if (!skipList.includes(varName) && !loopVariables.has(varName)) {
        variables.add(varName);
      }
    }
  }

  return Array.from(variables);
}

export async function parseComponent(
  source: string,
  name: string,
  componentUrl?: string
): Promise<LadrillosComponent> {
  const doc = parseHTML(source);

  // get scripts
  const scriptEls = Array.from(doc.querySelectorAll("script"));

  // Collect inline scripts (with content)
  const inlineScripts = scriptEls
    .filter((s) => !s.src)
    .map((s) => {
      const content = (s.textContent ?? "").trim();
      const type = s.getAttribute("type");
      return { content, type };
    })
    .filter((s) => s.content.length > 0);

  // Detect Vite-transformed module scripts (html-proxy)
  // These are inline scripts that Vite extracted to external files
  const viteProxyScripts = scriptEls.filter((s) => {
    const src = s.getAttribute("src") || "";
    return src.includes("html-proxy") && s.getAttribute("type") === "module";
  });

  // Fetch content from Vite proxy scripts
  const fetchedScripts = await Promise.all(
    viteProxyScripts.map(async (s) => {
      const src = s.getAttribute("src") || "";
      try {
        const response = await fetch(src);
        if (response.ok) {
          const content = await response.text();
          return { content: content.trim(), type: "module" };
        }
      } catch (e) {
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
  const externalScripts = scriptEls
    .filter((s) => {
      if (!s.src) return false;
      const src = s.getAttribute("src") || "";
      // Skip Vite client and proxy scripts
      if (src.includes("@vite/client")) return false;
      if (src.includes("html-proxy")) return false;
      return true;
    })
    .map((s) => {
      const type = s.getAttribute("type");
      let src = s.src;

      // If the parser keeps a relative src, resolve it against the component URL.
      if (componentUrl) {
        try {
          src = new URL(
            s.getAttribute("src") ?? s.src,
            componentUrl
          ).toString();
        } catch {
          // ignore resolution errors; keep original
        }
      }

      // Check if the script has the 'external' attribute
      // These scripts should be loaded as-is without framework processing
      const external = s.hasAttribute("external");

      return { src, type, external };
    })
    .filter((s) => s.src.length > 0);

  scriptEls.forEach((s) => s.remove());

  // get external stylesheets (<link rel="stylesheet">)
  const linkEls = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'));
  const externalStyles = linkEls
    .map((l) => {
      let href = l.getAttribute("href") || "";
      const rel = l.getAttribute("rel") || "stylesheet";

      // Resolve relative URLs against component URL
      if (componentUrl && href && !href.startsWith("http")) {
        try {
          href = new URL(href, componentUrl).toString();
        } catch {
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

  if (templateEl) {
    // Clone the template content and serialize it
    const tempDiv = document.createElement("div");
    tempDiv.appendChild(templateEl.content.cloneNode(true));
    html = tempDiv.innerHTML.trim();
  } else {
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

function parseHTML(source: string): Document {
  return parser.parseFromString(source, "text/html");
}
