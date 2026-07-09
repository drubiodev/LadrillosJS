import { EVENTS } from "../../common/events.js";

// The same dev IIFE build the shell loads; the sandboxed iframe fetches its
// own copy so the user's components run in a fully isolated document.
// Resolved against the page URL so it works on whatever port serves the repo.
const LADRILLOS_SRC = new URL(
    "../../dist-cdn/ladrillos.dev.iife.js",
    location.href
).href;

let errorMsg = "";
let activeBlobUrls = [];

// Build & mount the preview: register every file as a component, then
// instantiate the first one (the "root") inside the sandboxed iframe.
function build(files) {
    if (!files || files.length === 0) return;
    errorMsg = "";

    // Each file becomes a same-origin blob the sandbox can fetch. With
    // `allow-same-origin` + `srcdoc`, the iframe inherits our origin, so the
    // blob URLs are fetchable inside the sandbox.
    for (const u of activeBlobUrls) URL.revokeObjectURL(u);
    activeBlobUrls = [];
    const regs = files.map((f) => {
        const base = URL.createObjectURL(
            new Blob([f.code], { type: "text/html" })
        );
        activeBlobUrls.push(base);
        // `#.html` makes the loader treat the blob as a direct .html source
        // instead of trying the folder/index.html convention.
        return { tag: f.tag, url: base + "#.html" };
    });
    const rootTag = regs[0].tag;

    const doc = `<!DOCTYPE html>
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
    <script src="${LADRILLOS_SRC}"><\/script>
    <script type="module">
      const post = (message) =>
        parent.postMessage({ __repl: "error", message }, "*");

      ladrillosjs.configure({ onError: (err) => post(err?.message || String(err)) });
      window.addEventListener("error", (e) => post(e.message));
      window.addEventListener("unhandledrejection", (e) =>
        post(e.reason?.message || String(e.reason))
      );

      const files = ${JSON.stringify(regs)};
      try {
        // Register every component first, then mount the root element.
        for (const f of files) {
          await ladrillosjs.registerComponent(f.tag, f.url, true);
        }
        document
          .getElementById("mount")
          .appendChild(document.createElement("${rootTag}"));
      } catch (e) {
        post(e?.message || String(e));
      }
    <\/script>
  </body>
</html>`;

    $refs.frame.srcdoc = doc;
}

// Rebuild when the editor sends fresh sources.
$listen(EVENTS.PREVIEW_BUILD, (data) => build(data.files));

// Show editor-side messages (e.g. rename validation) in the error strip.
$listen(EVENTS.PREVIEW_ERROR, (msg) => {
    errorMsg = msg;
});

// Surface framework/runtime errors reported from inside the sandbox.
window.addEventListener("message", (e) => {
    if (e.data && e.data.__repl === "error" && e.data.message) {
        errorMsg = e.data.message;
    }
});
