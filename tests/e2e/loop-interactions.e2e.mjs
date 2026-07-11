/**
 * Real-browser regression test: loop event handlers across the row
 * lifecycle — freshly created rows, keyed reuse with NEW item objects
 * (relabel), keyed moves (swap), $on: modifier directives, bubbling order,
 * stopPropagation, and non-keyed index handlers after a removal.
 *
 * The whole suite runs TWICE: once with per-element listeners (default)
 * and once with opt-in event delegation (?delegate=1 →
 * configure({ delegateLoopEvents: true })). Both modes must behave
 * identically for every assertion.
 *
 * Run:
 *   npm run build
 *   node tests/e2e/loop-interactions.e2e.mjs
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
const PORT = 4521;

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
let failed = false;

async function runSuite(mode, query) {
  const page = await (await browser.newContext()).newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));

  await page.goto(
    `http://localhost:${PORT}/tests/e2e/fixtures/loop-interactions.html${query}`
  );
  await page.waitForFunction(
    () => window.__componentsReady === true && window.__loopReady === true,
    null,
    { timeout: 10000 }
  );
  await page.waitForFunction(
    () => document.querySelectorAll("loop-clicks .krow").length === 4,
    null,
    { timeout: 5000 }
  );

  const labels = () =>
    page.$$eval("loop-clicks .klabel", (els) => els.map((e) => e.textContent));
  const plainRows = () =>
    page.$$eval("loop-clicks .prow", (els) => els.map((e) => e.textContent));
  const probe = (key) => page.evaluate((k) => window.__probe[k], key);

  const assert = (cond, msg) => {
    if (!cond) {
      failed = true;
      console.error(`  ✗ [${mode}]`, msg);
    } else {
      console.log(`  ✓ [${mode}]`, msg);
    }
  };
  const eq = (a, b, msg) =>
    assert(JSON.stringify(a) === JSON.stringify(b), `${msg} (got ${JSON.stringify(a)})`);

  // 1. Initial render
  eq(await labels(), ["a1", "b2", "c3", "d4"], "keyed rows render");
  eq(await plainRows(), ["x:0", "y:1", "z:2"], "non-keyed rows render with index");

  // 2. Click a freshly created row → handler sees its item; click bubbles
  //    to the row root's own onclick afterwards (inner → outer order).
  await page.click("loop-clicks .krow:nth-child(2) .klabel");
  eq(await probe("lastPick"), "2:b2", "click on created row passes current item");
  eq(await probe("lastRowClick"), 2, "click bubbles to the row root handler");
  await page.waitForFunction(
    () => document.querySelector("loop-clicks .krow:nth-child(2)").classList.contains("sel"),
    null,
    { timeout: 5000 }
  );
  assert(true, "selection class updates after handler mutates state");

  // 3. $on:click.stop on an inner element must NOT reach the row handler
  await page.evaluate(() => {
    window.__probe.lastRowClick = null;
  });
  await page.click("loop-clicks .krow:nth-child(3) .kstop");
  eq(await probe("lastStop"), 3, "$on:click.stop handler fires");
  eq(await probe("lastRowClick"), null, ".stop prevents the row root handler from firing");

  // 4. Relabel: same keys, NEW item objects → reused row's handler must see the new item
  await page.evaluate(() => window.__loopApi.relabel());
  await page.waitForFunction(
    () => document.querySelector("loop-clicks .klabel")?.textContent === "a1!",
    null,
    { timeout: 5000 }
  );
  await page.click("loop-clicks .krow:nth-child(2) .klabel");
  eq(await probe("lastPick"), "2:b2!", "reused row handler reads CURRENT item after relabel");

  // 5. Swap rows 2 and 4 → moved element's handler must follow its item
  await page.evaluate(() => window.__loopApi.swapRows());
  await page.waitForFunction(
    () => document.querySelector("loop-clicks .krow:nth-child(2) .klabel")?.textContent === "d4!",
    null,
    { timeout: 5000 }
  );
  eq(await labels(), ["a1!", "d4!", "c3!", "b2!"], "swap reorders rows");
  await page.click("loop-clicks .krow:nth-child(2) .klabel");
  eq(await probe("lastPick"), "4:d4!", "moved row handler reads its own item");

  // 6. $on:click.prevent directive in a loop
  await page.click("loop-clicks .krow:nth-child(3) .kprev");
  eq(await probe("lastMark"), 3, "$on:click directive handler fires with loop item");
  const hash = await page.evaluate(() => location.hash);
  eq(hash, "", ".prevent modifier stops the default navigation");

  // 7. Non-keyed removal → positionally reused element's handler sees new item+index
  await page.evaluate(() => window.__loopApi.dropFirstName());
  await page.waitForFunction(
    () => document.querySelectorAll("loop-clicks .prow").length === 2,
    null,
    { timeout: 5000 }
  );
  eq(await plainRows(), ["y:0", "z:1"], "non-keyed rows shift after removal");
  await page.click("loop-clicks .prow:nth-child(1)");
  eq(await probe("lastIndexPick"), "y@0", "reused non-keyed row handler reads current item and index");

  assert(
    pageErrors.length === 0,
    `no page errors ${pageErrors.length ? "— got: " + pageErrors.join("; ") : ""}`
  );

  await page.context().close();
}

console.log("loop-interactions e2e (real Chromium):");
await runSuite("direct", "");
await runSuite("delegated", "?delegate=1");

await browser.close();
server.close();
process.exit(failed ? 1 : 0);
