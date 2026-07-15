/**
 * Real-browser regression test: control elements inside tables.
 *
 * The HTML parser foster-parents unknown elements (<for>, <if>, …) out of
 * <table>/<tbody>/<tr>; happy-dom cannot reproduce the spec-compliant
 * <template>-in-table behavior the fix relies on, so this check runs in
 * real Chromium against the built dist.
 *
 * Run:
 *   npm run build
 *   node tests/e2e/table-controls.e2e.mjs
 *
 * Uses playwright-core from benchmarks/node_modules (cd benchmarks &&
 * npm install) and the Playwright Chromium already cached in
 * ~/Library/Caches/ms-playwright.
 */
import http from "node:http";
import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { join, extname, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import os from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const PORT = 4519;

const require = createRequire(
  pathToFileURL(join(repoRoot, "benchmarks", "package.json"))
);
let chromium;
try {
  ({ chromium } = require("playwright-core"));
} catch {
  console.error("playwright-core not found. Run: cd benchmarks && npm install");
  process.exit(1);
}

if (!existsSync(join(repoRoot, "dist", "index.js"))) {
  console.error("dist/index.js not found. Run: npm run build");
  process.exit(1);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".map": "application/json",
};

const server = http.createServer((req, res) => {
  let f = join(repoRoot, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!f.startsWith(repoRoot)) return res.writeHead(403).end();
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
  if (!existsSync(f)) return res.writeHead(404).end("not found");
  res.writeHead(200, { "Content-Type": MIME[extname(f)] ?? "application/octet-stream" });
  createReadStream(f).pipe(res);
});
await new Promise((ok) => server.listen(PORT, ok));

function findChromium() {
  const cache = join(os.homedir(), "Library/Caches/ms-playwright");
  if (!existsSync(cache)) return null;
  const bins = [];
  for (const dir of readdirSync(cache)) {
    const rev = dir.match(/^chromium_headless_shell-(\d+)$/)?.[1];
    if (rev) {
      const bin = join(cache, dir, "chrome-headless-shell-mac-arm64/chrome-headless-shell");
      if (existsSync(bin)) bins.push({ rev: +rev, bin });
    }
  }
  bins.sort((a, b) => b.rev - a.rev);
  return bins[0]?.bin ?? null;
}

const executablePath = findChromium();
if (!executablePath) {
  console.error("No cached Playwright Chromium found.");
  process.exit(1);
}

const browser = await chromium.launch({ executablePath, headless: true });
const page = await (await browser.newContext()).newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));

await page.goto(`http://localhost:${PORT}/tests/e2e/fixtures/table-controls.html`);
await page.waitForFunction(() => window.__componentsReady === true, null, { timeout: 10000 });
// Let the reactive scheduler flush the initial render.
await page.waitForFunction(
  () => document.querySelectorAll("table-rows-light tbody tr").length > 0,
  null,
  { timeout: 5000 }
);

const result = await page.evaluate(() => {
  const readRows = (root) =>
    Array.from(root.querySelectorAll("tbody tr")).map((tr) => ({
      id: tr.querySelector(".rid")?.textContent.trim(),
      name: tr.querySelector(".rname")?.textContent.trim(),
      active: tr.querySelector(".ractive")?.textContent.trim(),
    }));
  const light = document.querySelector("table-rows-light");
  const shadow = document.querySelector("table-rows-shadow");
  return {
    light: readRows(light),
    lightHoisted: !!light.querySelector(":scope > for, :scope > table ~ *"),
    shadow: shadow.shadowRoot ? readRows(shadow.shadowRoot) : null,
  };
});

await browser.close();
server.close();

const expected = [
  { id: "1", name: "Alice", active: "✅" },
  { id: "2", name: "Bob", active: "⬜" },
  { id: "3", name: "Carol", active: "✅" },
];

let failed = false;
const assert = (cond, msg) => {
  if (!cond) {
    failed = true;
    console.error("  ✗", msg);
  } else {
    console.log("  ✓", msg);
  }
};

console.log("table-controls e2e (real Chromium):");
assert(pageErrors.length === 0, `no page errors ${pageErrors.length ? "— got: " + pageErrors.join("; ") : ""}`);
assert(
  JSON.stringify(result.light) === JSON.stringify(expected),
  `light DOM renders 3 keyed rows with conditional cells (got ${JSON.stringify(result.light)})`
);
assert(!result.lightHoisted, "no elements foster-parented out of the table");
assert(
  JSON.stringify(result.shadow) === JSON.stringify(expected),
  `shadow DOM renders 3 keyed rows with conditional cells (got ${JSON.stringify(result.shadow)})`
);

process.exit(failed ? 1 : 0);
