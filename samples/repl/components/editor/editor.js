import * as monaco from "https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/+esm";
import { EVENTS } from "../../common/events.js";
import { EXAMPLES, EXAMPLE_NAMES } from "../../common/examples.js";

// The ESM CDN build spins up web workers for language tooling.
// getWorker is fully self-contained (no outer closure refs) because Monaco
// invokes it later, outside this module's lexical scope.
// NOTE: the import keyword is split so Ladrillos' module-import scanner
// doesn't mistake the Blob source for a real static import.
self.MonacoEnvironment = {
    getWorker(_id, label)
    {
        const CDN = "https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/esm/vs";
        let path = "editor/editor.worker.js";
        if (label === "json") path = "language/json/json.worker.js";
        else if (label === "css" || label === "scss" || label === "less") path = "language/css/css.worker.js";
        else if (label === "html" || label === "handlebars" || label === "razor") path = "language/html/html.worker.js";
        else if (label === "typescript" || label === "javascript") path = "language/typescript/ts.worker.js";
        const src = ("im" + "port") + " " + JSON.stringify(`${CDN}/${path}`) + ";";
        const url = URL.createObjectURL(new Blob([src], { type: "application/javascript" }));
        return new Worker(url, { type: "module" });
    }
};

// Source of truth for the open files. Each file is a component:
// its tab name is the custom-element tag, its Monaco model holds the source.
let editor;
let files = [];
let activeIndex = 0;
let newFileSeq = 0;
let debounceTimer;

function makeFile(tag, code)
{
    return { tag, model: monaco.editor.createModel(code, "html") };
}

// Tell the tab strip about the current files + selection.
function emitTabs()
{
    $emit(EVENTS.FILES_CHANGED, {
        tabs: files.map((f) => ({ tag: f.tag })),
        activeIndex: activeIndex,
    });
}

// Ask the preview to rebuild from the current sources.
function run()
{
    if (!editor || files.length === 0) return;
    $emit(EVENTS.PREVIEW_BUILD, {
        files: files.map((f) => ({ tag: f.tag, code: f.model.getValue() })),
    });
}

function loadExample(name)
{
    for (const f of files) f.model.dispose();
    files = EXAMPLES[name].map((f) => makeFile(f.name, f.code));
    activeIndex = 0;
    editor.setModel(files[0].model);
    emitTabs();
    run();
}

function selectFile(i)
{
    activeIndex = i;
    editor.setModel(files[i].model);
    emitTabs();
    editor.focus();
}

function addFile()
{
    const tag = uniqueTag("my-component");
    files = [...files, makeFile(tag, defaultFileCode(tag))];
    selectFile(files.length - 1);
    run();
}

function removeFile(i)
{
    if (i === 0 || files.length <= 1) return; // keep the root file
    files[i].model.dispose();
    files = files.filter((_, j) => j !== i);
    activeIndex = Math.min(activeIndex, files.length - 1);
    editor.setModel(files[activeIndex].model);
    emitTabs();
    run();
}

function renameFile(i)
{
    const current = files[i].tag;
    const next = (
        window.prompt(
            "Component tag name (lowercase, must contain a hyphen):",
            current
        ) || ""
    ).trim();
    if (!next || next === current) return;
    if (!/^[a-z][a-z0-9]*-[a-z0-9-]*$/.test(next))
    {
        $emit(
            EVENTS.PREVIEW_ERROR,
            `Invalid tag "${next}". Custom element names must be lowercase and contain a hyphen, e.g. "user-card".`
        );
        return;
    }
    if (files.some((f, j) => j !== i && f.tag === next))
    {
        $emit(EVENTS.PREVIEW_ERROR, `A file named "${next}" already exists.`);
        return;
    }
    files[i].tag = next;
    emitTabs();
    run();
}

function uniqueTag(base)
{
    let n = ++newFileSeq;
    let tag = `${base}-${n}`;
    while (files.some((f) => f.tag === tag)) tag = `${base}-${++n}`;
    return tag;
}

function defaultFileCode(tag)
{
    return [
        `<div class="box">`,
        `  <p>Hello from &lt;${tag}&gt;</p>`,
        `</div>`,
        ``,
        `<style>`,
        `  .box { font-family: system-ui; padding: 1rem; }`,
        `</style>`,
    ].join("\n");
}

// React to header + tab-strip actions over the event bus.
$listen(EVENTS.EXAMPLE_SELECT, (name) => loadExample(name));
$listen(EVENTS.RUN, () => run());
$listen(EVENTS.TAB_SELECT, (i) => selectFile(i));
$listen(EVENTS.TAB_CLOSE, (i) => removeFile(i));
$listen(EVENTS.TAB_RENAME, (i) => renameFile(i));
$listen(EVENTS.FILE_ADD, () => addFile());

// Wait for the template (and $refs) to be ready before mounting Monaco,
// then render the first example.
$host.addEventListener("ladrillos:ready", () =>
{
    editor = monaco.editor.create($refs.editorHost, {
        language: "html", // highlights embedded <script> and <style> too
        theme: "vs-dark",
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

    // Debounced live re-run on edit.
    editor.onDidChangeModelContent(() =>
    {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(run, 400);
    });

    loadExample(EXAMPLE_NAMES[0]);
});
