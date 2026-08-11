/**
 * <monaco-editor> — a self-contained, embeddable LadrillosJS playground.
 *
 * Write your component source inside one or more <template> children; the
 * element renders a Monaco editor on the left, a live sandboxed preview on the
 * right, and a draggable divider between them.
 *
 *   <monaco-editor height="500px">
 *     <template>
 *       <div>{count}</div>
 *       <script>let count = 0;<\/script>
 *     </template>
 *   </monaco-editor>
 *
 * <template> is required because its contents are inert: the browser will not
 * run the <script> or apply the <style> in the host page.
 *
 * This file is a PLAIN ES module. It is pulled in by the component's inline
 * module script (`import { mount } from "./monaco-editor.js"`), so LadrillosJS
 * loads it with a native import() and none of its code goes through the
 * script→state transform.
 */

const MONACO_VERSION = "0.55.1";
const MONACO_ESM = `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/+esm`;
const MONACO_WORKERS = `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/esm/vs`;

/** LadrillosJS build the preview iframe boots. Override with `runtime="..."`. */
const DEFAULT_RUNTIME = "https://cdn.jsdelivr.net/npm/ladrillosjs@2/dist/index.js";

const REBUILD_DELAY = 400;

// Monaco's ESM build spins up web workers for its language services.
// getWorker is fully self-contained because Monaco calls it outside this
// module's lexical scope. The `import` keyword is split so the framework's
// module-import scanner doesn't mistake the Blob source for a real import.
if (!self.MonacoEnvironment)
{
    self.MonacoEnvironment = {
        getWorker(_id, label)
        {
            const CDN = "https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/esm/vs";
            let path = "editor/editor.worker.js";
            if (label === "json") path = "language/json/json.worker.js";
            else if (label === "css" || label === "scss" || label === "less")
                path = "language/css/css.worker.js";
            else if (label === "html" || label === "handlebars" || label === "razor")
                path = "language/html/html.worker.js";
            else if (label === "typescript" || label === "javascript")
                path = "language/typescript/ts.worker.js";
            const src = "im" + "port" + " " + JSON.stringify(`${CDN}/${path}`) + ";";
            const url = URL.createObjectURL(
                new Blob([src], { type: "application/javascript" })
            );
            return new Worker(url, { type: "module" });
        },
    };
}

// Monaco is fetched once and shared by every instance on the page.
let monacoPromise = null;
function loadMonaco()
{
    if (!monacoPromise)
    {
        monacoPromise = import(MONACO_ESM).then((monaco) =>
        {
            // Monaco's stylesheet resolves its icon font relative to the *page*, so
            // re-declare codicon against the CDN copy (after its own styles land,
            // otherwise the relative — and 404ing — declaration wins).
            const font = document.createElement("style");
            font.textContent = `@font-face { font-family: codicon; font-display: block; src: url("${MONACO_WORKERS}/base/browser/ui/codicons/codicon/codicon.ttf") format("truetype"); }`;
            document.head.appendChild(font);
            return monaco;
        });
    }
    return monacoPromise;
}

let tagSeq = 0;

/**
 * Called from the component's inline module script.
 * @param {HTMLElement} host   the <monaco-editor> element ($host)
 * @param {object} refs        the component's $refs proxy
 */
export function mount(host, refs)
{
    // $refs are only wired up once the template has been scanned.
    host.addEventListener("ladrillos:ready", () => init(host, refs), {
        once: true,
    });
}

async function init(host, refs)
{
    const sources = readSources(host);
    if (sources.length === 0) return;

    const monaco = await loadMonaco();

    const layout = host.getAttribute("layout") === "vertical" ? "vertical" : "horizontal";
    const theme = host.getAttribute("theme") || "vs-dark";
    const runtime = host.getAttribute("runtime") || DEFAULT_RUNTIME;
    const height = host.getAttribute("height");
    const split = clamp(Number(host.getAttribute("split")) || 50, 15, 85) / 100;

    if (height) host.style.setProperty("--lme-height", height);
    refs.root.dataset.layout = layout;
    applySplit(refs.root, split);

    const files = sources.map((src) => ({
        tag: src.tag,
        model: monaco.editor.createModel(src.code, "html"),
    }));
    let activeIndex = 0;
    let rebuildTimer = 0;
    let blobUrls = [];

    const editor = monaco.editor.create(refs.editorHost, {
        model: files[0].model,
        theme: theme,
        automaticLayout: true,
        minimap: { enabled: false },
        fontFamily:
            'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
        fontSize: 13,
        lineHeight: 21,
        tabSize: 2,
        scrollBeyondLastLine: false,
        padding: { top: 12, bottom: 12 },
        scrollbar: {
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
            useShadows: false,
        },
    });

    const build = () =>
    {
        showError(refs, "");
        blobUrls.forEach(URL.revokeObjectURL);
        blobUrls = files.map((f) =>
            URL.createObjectURL(new Blob([f.model.getValue()], { type: "text/html" }))
        );
        // `#.html` makes the loader treat the blob as a direct .html source instead
        // of trying the folder/index.html convention.
        const regs = files.map((f, i) => ({ tag: f.tag, url: `${blobUrls[i]}#.html` }));
        refs.frame.srcdoc = previewDocument(regs, runtime);
    };

    const selectFile = (i) =>
    {
        activeIndex = i;
        editor.setModel(files[i].model);
        renderTabs(refs.tabs, files, activeIndex, selectFile);
        editor.focus();
    };

    renderTabs(refs.tabs, files, activeIndex, selectFile);

    editor.onDidChangeModelContent(() =>
    {
        clearTimeout(rebuildTimer);
        rebuildTimer = setTimeout(build, REBUILD_DELAY);
    });

    refs.resetBtn.addEventListener("click", () =>
    {
        files.forEach((f, i) => f.model.setValue(sources[i].code));
        selectFile(0);
    });

    wireResizer(refs.root, refs.resizer, layout);
    wirePreviewErrors(refs);
    build();
}

/* ── Source extraction ─────────────────────────────────────────── */

/**
 * Reads the code the author wrote inside the element. Results are cached on the
 * host because the light-DOM template render consumes the original children,
 * so a disconnect/reconnect cycle could not read them a second time.
 */
function readSources(host)
{
    if (host.__lmeSources) return host.__lmeSources;

    const children = host.__originalChildren;
    const sources = [];

    if (children)
    {
        for (const tpl of children.querySelectorAll("template"))
        {
            const code = dedent(tpl.innerHTML);
            if (code) sources.push({ tag: normalizeTag(tpl.getAttribute("data-tag")), code: code });
        }

        // No <template>? Fall back to the raw markup so trivial snippets still work.
        // Any <script>/<style> in there already ran in the host page, hence the warning.
        if (sources.length === 0)
        {
            const raw = dedent(host.__originalHTML || "");
            if (raw)
            {
                console.warn(
                    "[monaco-editor] Wrap the source in a <template> so its <script> and <style> stay inert."
                );
                sources.push({ tag: normalizeTag(null), code: raw });
            }
        }
    }

    host.__lmeSources = sources;
    return sources;
}

function normalizeTag(tag)
{
    const clean = (tag || "").trim().toLowerCase();
    if (/^[a-z][a-z0-9]*-[a-z0-9-]*$/.test(clean)) return clean;
    return `demo-component-${++tagSeq}`;
}

/** Strips the shared leading indentation the author's HTML nesting added. */
function dedent(text)
{
    const lines = text.replace(/\t/g, "  ").split("\n");
    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    const indent = lines
        .filter((l) => l.trim())
        .reduce((min, l) => Math.min(min, l.length - l.trimStart().length), Infinity);
    if (!isFinite(indent) || indent === 0) return lines.join("\n");
    return lines.map((l) => l.slice(indent)).join("\n");
}

/* ── Preview ───────────────────────────────────────────────────── */

/**
 * Builds the sandbox document: register every file as a component, then mount
 * the first one (the "root"). `allow-same-origin` is required so the frame can
 * fetch the parent-created blob URLs — the code being run is the author's own.
 */
function previewDocument(regs, runtime)
{
    const isIife = /\.iife\.js($|[?#])/.test(runtime);
    const loadRuntime = isIife
        ? `window.ladrillosjs`
        : `await import(${JSON.stringify(runtime)})`;

    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body { margin: 0; }
      body { padding: 8px; font-family: system-ui, sans-serif; }
    </style>
  </head>
  <body>
    <div id="mount"></div>
    ${isIife ? `<script src="${runtime}"><\/script>` : ""}
    <script type="module">
      const post = (message) => parent.postMessage({ __lme: "error", message }, "*");
      const lib = ${loadRuntime};

      lib.configure?.({ onError: (err) => post(err?.message || String(err)) });
      window.addEventListener("error", (e) => post(e.message));
      window.addEventListener("unhandledrejection", (e) =>
        post(e.reason?.message || String(e.reason))
      );

      try {
        for (const f of ${JSON.stringify(regs)}) {
          await lib.registerComponent(f.tag, f.url, true);
        }
        document
          .getElementById("mount")
          .appendChild(document.createElement(${JSON.stringify(regs[0].tag)}));
      } catch (e) {
        post(e?.message || String(e));
      }
    <\/script>
  </body>
</html>`;
}

function wirePreviewErrors(refs)
{
    window.addEventListener("message", (e) =>
    {
        if (e.source !== refs.frame.contentWindow) return;
        if (e.data && e.data.__lme === "error" && e.data.message)
        {
            showError(refs, e.data.message);
        }
    });
}

function showError(refs, message)
{
    refs.errorEl.textContent = message;
    refs.errorEl.classList.toggle("is-visible", Boolean(message));
}

/* ── Tabs ──────────────────────────────────────────────────────── */

function renderTabs(container, files, activeIndex, onSelect)
{
    container.textContent = "";
    files.forEach((file, i) =>
    {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "lme__tab" + (i === activeIndex ? " is-active" : "");
        btn.textContent = `${file.tag}.html`;
        btn.addEventListener("click", () => onSelect(i));
        container.appendChild(btn);
    });
}

/* ── Split / resize ────────────────────────────────────────────── */

function applySplit(root, fraction)
{
    const track = `${fraction}fr 6px ${1 - fraction}fr`;
    if (isVertical(root)) root.style.gridTemplateRows = track;
    else root.style.gridTemplateColumns = track;
}

// The stacked layout is used both when the author asks for it and when the
// responsive breakpoint kicks in.
function isVertical(root)
{
    return (
        root.dataset.layout === "vertical" || matchMedia("(max-width: 800px)").matches
    );
}

function wireResizer(root, resizer, layout)
{
    resizer.addEventListener("pointerdown", (e) =>
    {
        e.preventDefault();
        const vertical = isVertical(root);
        const rect = root.getBoundingClientRect();
        resizer.setPointerCapture(e.pointerId);
        resizer.classList.add("is-dragging");
        root.classList.add("is-resizing");

        const onMove = (ev) =>
        {
            const frac = vertical
                ? (ev.clientY - rect.top) / rect.height
                : (ev.clientX - rect.left) / rect.width;
            const f = clamp(frac, 0.15, 0.85);
            const track = `${f}fr 6px ${1 - f}fr`;
            if (vertical) root.style.gridTemplateRows = track;
            else root.style.gridTemplateColumns = track;
        };

        const onUp = () =>
        {
            resizer.releasePointerCapture(e.pointerId);
            resizer.classList.remove("is-dragging");
            root.classList.remove("is-resizing");
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
    });

    // Crossing the breakpoint swaps rows <-> columns; drop the stale inline
    // sizing so the stylesheet takes over cleanly.
    if (layout === "horizontal")
    {
        matchMedia("(max-width: 800px)").addEventListener("change", () =>
        {
            root.style.gridTemplateColumns = "";
            root.style.gridTemplateRows = "";
        });
    }
}

function clamp(value, min, max)
{
    return Math.max(min, Math.min(max, value));
}
