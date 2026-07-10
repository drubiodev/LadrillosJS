import { describe, it, expect } from "vitest";
import {
  escapeControlTags,
  restoreControlTags,
} from "../../src/core/html/controlTagEscape";
import { parseComponent } from "../../src/core/component/extract";
import { loadTemplate } from "../../src/core/html/htmlparser";

/**
 * Regression tests for control elements inside tables.
 *
 * The HTML parser's table insertion modes foster-parent unknown elements
 * (<for>, <if>, <else-if>, <else>, <show>) out of <table>/<tbody>/<tr>
 * before the framework sees the tree. The fix escapes control tags to
 * <template data-l-ctrl="…"> placeholders before parsing (templates are
 * spec-legal anywhere in a table) and rebuilds the real elements with DOM
 * APIs afterwards.
 *
 * LIMITATION: happy-dom's parser is not spec-compliant here — it
 * foster-parents even <template> out of <tbody> (real browsers keep it,
 * per the HTML spec). Tests that need in-table placeholder parsing build
 * the placeholder DOM programmatically instead; full end-to-end coverage
 * in real Chromium lives in tests/e2e/table-controls.e2e.mjs.
 */

const TABLE_LOOP = `<table><tbody>
  <for each="row in rows" key="row.id">
    <tr><td class="id">{row.id}</td><td>{row.name}</td></tr>
  </for>
</tbody></table>`;

// Sanity check: without the escape, the parser really does mangle this.
it("parser foster-parents <for> out of tables (bug precondition)", () => {
  const tpl = document.createElement("template");
  tpl.innerHTML = TABLE_LOOP;
  expect(tpl.content.querySelector("tbody > for")).toBeNull();
  expect(tpl.content.querySelector("for")).not.toBeNull();
});

describe("escapeControlTags", () => {
  it("rewrites control open/close tags to template placeholders", () => {
    const out = escapeControlTags(`<for each="x in xs"><li>{x}</li></for>`);
    expect(out).toBe(
      `<template data-l-ctrl="for" each="x in xs"><li>{x}</li></template>`
    );
  });

  it("is quote-aware: attribute values containing > survive", () => {
    const out = escapeControlTags(`<if condition="i > 0">big</if>`);
    expect(out).toBe(
      `<template data-l-ctrl="if" condition="i > 0">big</template>`
    );
  });

  it("handles <else-if> before <else> and <if>", () => {
    const out = escapeControlTags(
      `<if condition="a">A</if><else-if condition="b">B</else-if><else>C</else>`
    );
    expect(out).toBe(
      `<template data-l-ctrl="if" condition="a">A</template>` +
        `<template data-l-ctrl="else-if" condition="b">B</template>` +
        `<template data-l-ctrl="else">C</template>`
    );
  });

  it("does not touch lookalike tags (<form>, <i>, <span>)", () => {
    const src = `<form><i>x</i><span>if</span></form>`;
    expect(escapeControlTags(src)).toBe(src);
  });

  it("leaves script bodies, style bodies, and comments alone", () => {
    const src =
      `<script>let s = '<for each="x in y">';</script>` +
      `<style>/* <if> */ .a{}</style>` +
      `<!-- <show condition="x">hidden</show> -->` +
      `<show condition="ok">shown</show>`;
    const out = escapeControlTags(src);
    expect(out).toContain(`let s = '<for each="x in y">';`);
    expect(out).toContain(`/* <if> */`);
    expect(out).toContain(`<!-- <show condition="x">hidden</show> -->`);
    expect(out).toContain(`<template data-l-ctrl="show" condition="ok">`);
  });
});

describe("restoreControlTags", () => {
  it("round-trips escape → parse → restore outside tables", () => {
    const tpl = document.createElement("template");
    tpl.innerHTML = escapeControlTags(
      `<ul><for each="x in xs" key="x.id"><li>{x.name}</li></for></ul>`
    );
    restoreControlTags(tpl.content);

    const forEl = tpl.content.querySelector("ul > for");
    expect(forEl).not.toBeNull();
    expect(forEl!.getAttribute("each")).toBe("x in xs");
    expect(forEl!.getAttribute("key")).toBe("x.id");
    expect(forEl!.querySelector("li")?.textContent).toBe("{x.name}");
  });

  it("restores nested control elements (for in for, if/else chains)", () => {
    const tpl = document.createElement("template");
    tpl.innerHTML = escapeControlTags(
      `<for each="group in groups"><div>` +
        `<for each="item in group.items"><b>{item}</b></for>` +
        `<if condition="group.open">open</if><else>closed</else>` +
        `</div></for>`
    );
    restoreControlTags(tpl.content);

    const outer = tpl.content.querySelector("for");
    expect(outer).not.toBeNull();
    expect(outer!.querySelector("div > for > b")).not.toBeNull();
    expect(outer!.querySelector("div > if")?.textContent).toBe("open");
    expect(outer!.querySelector("div > else")?.textContent).toBe("closed");
  });

  it("rebuilds a <for> placeholder in place inside <tbody>", () => {
    // Built programmatically: happy-dom's parser (non-spec) foster-parents
    // <template> out of <tbody>; real browsers keep it (verified in the
    // Chromium e2e). This tests the restore logic itself.
    const root = document.createElement("div");
    const table = document.createElement("table");
    const tbody = document.createElement("tbody");
    const ph = document.createElement("template") as HTMLTemplateElement;
    ph.setAttribute("data-l-ctrl", "for");
    ph.setAttribute("each", "row in rows");
    ph.setAttribute("key", "row.id");
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.textContent = "{row.id}";
    tr.appendChild(td);
    ph.content.appendChild(tr);
    tbody.appendChild(ph);
    table.appendChild(tbody);
    root.appendChild(table);

    restoreControlTags(root);

    const forEl = root.querySelector("tbody > for");
    expect(forEl).not.toBeNull();
    expect(forEl!.getAttribute("each")).toBe("row in rows");
    expect(forEl!.querySelector("tr > td")?.textContent).toBe("{row.id}");
    expect(root.querySelector("template[data-l-ctrl]")).toBeNull();
  });

  it("restores control tags inside user-authored <template> content", () => {
    const tpl = document.createElement("template");
    tpl.innerHTML = escapeControlTags(
      `<template id="user"><for each="x in xs"><i>{x}</i></for></template>`
    );
    restoreControlTags(tpl.content);

    const user = tpl.content.querySelector<HTMLTemplateElement>("#user");
    expect(user).not.toBeNull();
    expect(user!.content.querySelector("for > i")).not.toBeNull();
  });
});

describe("parseComponent (extract.ts)", () => {
  it("keeps control elements and bindings intact for list components", async () => {
    const source =
      `<ul><for each="row in rows" key="row.id"><li>{row.name}</li></for></ul>` +
      `<script>let rows = [{ id: 1, name: "a" }];</script>`;
    const component = await parseComponent(source, "list-rows");

    expect(component.template).toContain(`<for each="row in rows"`);
    expect(component.template).toContain(`<li>{row.name}</li>`);
    expect(component.template).not.toContain("data-l-ctrl");
    expect(component.templateBindings).toContain("rows");
  });

  it("round-trips a table component without crashing or losing tags", async () => {
    // Structural in-table placement can't be asserted under happy-dom
    // (see header note); the Chromium e2e covers it. This guards the
    // string round-trip: both the <for> and its <tr> template survive.
    const source = `${TABLE_LOOP}\n<script>let rows = [{ id: 1, name: "a" }];</script>`;
    const component = await parseComponent(source, "bench-rows");

    expect(component.template).toContain(`<for each="row in rows"`);
    expect(component.template).toContain(`<td class="id">{row.id}</td>`);
    expect(component.template).not.toContain("data-l-ctrl");
    expect(component.templateBindings).toContain("rows");
  });

  it("keeps a component that STARTS with a control element in body order", async () => {
    const source =
      `<if condition="ready">yes</if><else>no</else><div id="after">tail</div>` +
      `<script>let ready = true;</script>`;
    const component = await parseComponent(source, "cond-first");

    const idxIf = component.template.indexOf("<if");
    const idxElse = component.template.indexOf("<else");
    const idxDiv = component.template.indexOf('<div id="after"');
    expect(idxIf).toBeGreaterThanOrEqual(0);
    expect(idxElse).toBeGreaterThan(idxIf);
    expect(idxDiv).toBeGreaterThan(idxElse);
  });

  it("still finds a user root <template> wrapper", async () => {
    const source =
      `<template><for each="r in rs"><li>{r}</li></for></template>` +
      `<script>let rs = [1];</script>`;
    const component = await parseComponent(source, "tpl-root");

    expect(component.template).toContain(`<for each="r in rs"`);
    expect(component.template).toContain(`<li>{r}</li>`);
  });
});

describe("loadTemplate (htmlparser.ts)", () => {
  it("mounts control elements outside tables unchanged", () => {
    const host = document.createElement("div");
    loadTemplate(host, `<ul><for each="x in xs"><li>{x}</li></for></ul>`);

    expect(host.querySelector("ul > for > li")).not.toBeNull();
    expect(host.querySelector("template[data-l-ctrl]")).toBeNull();
  });

  it("mounts <if>/<show> inside table cells", () => {
    const host = document.createElement("div");
    loadTemplate(
      host,
      `<table><tbody><tr><td>` +
        `<if condition="done">✅</if><else>⬜</else>` +
        `<show condition="visible">v</show>` +
        `</td></tr></tbody></table>`
    );

    expect(host.querySelector("td > if")).not.toBeNull();
    expect(host.querySelector("td > else")).not.toBeNull();
    expect(host.querySelector("td > show")).not.toBeNull();
  });
});
