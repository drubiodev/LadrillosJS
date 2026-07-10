/**
 * Table-safe parsing for built-in control elements.
 *
 * The HTML parser's table insertion modes foster-parent anything that is
 * not valid table content out of `<table>`/`<thead>`/`<tbody>`/`<tr>`.
 * Built-in control elements (`<for>`, `<if>`, `<else-if>`, `<else>`,
 * `<show>`) are unknown to the parser, so markup like
 *
 *   <table><tbody>
 *     <for each="row in rows" key="row.id">
 *       <tr><td>{row.id}</td></tr>
 *     </for>
 *   </tbody></table>
 *
 * gets mangled BEFORE the framework ever sees the tree: `<for>` is
 * hoisted out of the table and the raw `<tr>` template is left behind,
 * un-bound. This applies to every parse entry point — `DOMParser` and
 * `template.innerHTML` alike.
 *
 * `<template>` elements, however, ARE valid anywhere inside a table, and
 * their content model is parsed leniently (a bare `<tr>` or `<td>` inside
 * template content survives). So before parsing we rewrite control tags to
 * `<template data-l-ctrl="…">` placeholders at the string level, and after
 * parsing we rebuild the real control elements with DOM APIs — which the
 * parser's content rules cannot touch.
 */

const ESCAPE_ATTR = "data-l-ctrl";

const CONTROL_TAG_NAMES = new Set(["FOR", "IF", "ELSE-IF", "ELSE", "SHOW"]);

/**
 * Open tags of control elements. Attribute scanning skips over quoted
 * values so expressions like condition="i > 0" don't truncate the match.
 * `else-if` must precede `else`/`if` in the alternation.
 */
const OPEN_TAG = /<(for|else-if|if|else|show)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi;

const CLOSE_TAG = /<\/(for|else-if|if|else|show)\s*>/gi;

/**
 * Segments whose text content must never be rewritten: script bodies,
 * style bodies, and HTML comments. A `<for …>` appearing inside a JS
 * string or a commented-out block is not markup.
 */
const OPAQUE_SEGMENTS =
  /(<script\b[\s\S]*?<\/script\s*>|<style\b[\s\S]*?<\/style\s*>|<!--[\s\S]*?-->)/gi;

/** Cheap pre-check so templates without control tags skip the rewrite. */
const HAS_CONTROL_TAG = /<\/?(?:for|if|else|show)\b/i;

/**
 * Rewrites control-element tags to `<template data-l-ctrl="…">`
 * placeholders so the HTML parser cannot foster-parent them out of table
 * contexts. Must be paired with {@link restoreControlTags} on the parsed
 * tree.
 */
export function escapeControlTags(html: string): string
{
  if (!HAS_CONTROL_TAG.test(html))
  {
    return html;
  }

  return html
    .split(OPAQUE_SEGMENTS)
    .map((segment, i) =>
    {
      // Odd indices are the captured opaque segments — pass through.
      if (i % 2 === 1)
      {
        return segment;
      }
      return segment
        .replace(
          OPEN_TAG,
          (_m, name: string, attrs: string) =>
            `<template ${ESCAPE_ATTR}="${name.toLowerCase()}"${attrs}>`
        )
        .replace(CLOSE_TAG, "</template>");
    })
    .join("");
}

/**
 * Rebuilds real control elements from the placeholders produced by
 * {@link escapeControlTags}. Runs until no placeholder remains: restoring
 * an outer placeholder moves its (previously inert) template content into
 * the live tree, exposing any nested placeholders to the next iteration.
 * User-authored `<template>` elements are recursed into so control tags
 * inside their inert content are restored as well.
 */
export function restoreControlTags(root: ParentNode): void
{
  let placeholder: HTMLTemplateElement | null;
  while (
    (placeholder = root.querySelector<HTMLTemplateElement>(
      `template[${ESCAPE_ATTR}]`
    ))
  )
  {
    const doc = placeholder.ownerDocument;
    const el = doc.createElement(placeholder.getAttribute(ESCAPE_ATTR)!);
    for (const attr of Array.from(placeholder.attributes))
    {
      if (attr.name !== ESCAPE_ATTR)
      {
        el.setAttribute(attr.name, attr.value);
      }
    }
    // Appending the content fragment MOVES its children into the element.
    el.appendChild(placeholder.content);
    placeholder.replaceWith(el);
  }

  for (const tpl of Array.from(root.querySelectorAll("template")))
  {
    restoreControlTags((tpl as HTMLTemplateElement).content);
  }
}

/**
 * Returns true when the element is a restored control element
 * (`<for>`, `<if>`, `<else-if>`, `<else>`, `<show>`).
 */
export function isControlElement(el: Element): boolean
{
  return CONTROL_TAG_NAMES.has(el.tagName);
}
