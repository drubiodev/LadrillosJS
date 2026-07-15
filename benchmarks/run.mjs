/**
 * Benchmark runner.
 *
 * Serves the repo root over HTTP, drives each framework page in headless
 * Chromium via playwright-core, and writes results.json + results.md.
 *
 *   cd benchmarks && npm install && npm run bench
 */
import http from "node:http";
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { join, extname, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { chromium } from "playwright-core";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const PORT = 4517;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".map": "application/json",
};

function startServer()
{
  const server = http.createServer((req, res) =>
  {
    const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let filePath = join(repoRoot, urlPath);
    if (!filePath.startsWith(repoRoot))
    {
      res.writeHead(403).end();
      return;
    }
    if (existsSync(filePath) && statSync(filePath).isDirectory())
    {
      filePath = join(filePath, "index.html");
    }
    if (!existsSync(filePath))
    {
      res.writeHead(404).end("not found: " + urlPath);
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[extname(filePath)] ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });
    createReadStream(filePath).pipe(res);
  });
  return new Promise((ok) => server.listen(PORT, () => ok(server)));
}

function findChromium()
{
  const cache = join(os.homedir(), "Library/Caches/ms-playwright");
  const candidates = [];
  if (existsSync(cache))
  {
    for (const dir of readdirSync(cache))
    {
      const rev = dir.match(/^chromium_headless_shell-(\d+)$/)?.[1];
      if (rev)
      {
        const bin = join(cache, dir, "chrome-headless-shell-mac-arm64/chrome-headless-shell");
        if (existsSync(bin)) candidates.push({ rev: +rev, bin });
      }
      const rev2 = dir.match(/^chromium-(\d+)$/)?.[1];
      if (rev2)
      {
        const bin = join(cache, dir, "chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium");
        if (existsSync(bin)) candidates.push({ rev: +rev2 - 0.5, bin });
      }
    }
  }
  candidates.sort((a, b) => b.rev - a.rev);
  return candidates[0]?.bin ?? null;
}

const FRAMEWORKS = [
  { id: "ladrillos", label: "LadrillosJS", url: `/benchmarks/ladrillos/` },
  { id: "react", label: "React 18.3 (keyed, memoized rows)", url: `/benchmarks/react/` },
  { id: "vanilla", label: "Vanilla JS (hand-optimized)", url: `/benchmarks/vanilla/` },
];

async function benchFramework(browser, fw)
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const jsLoaded = new Set();
  const startupLog = [];
  page.on("response", (r) =>
  {
    const path = new URL(r.url()).pathname;
    if (path.endsWith(".js")) jsLoaded.add(path);
    if (!r.ok()) startupLog.push(`HTTP ${r.status()} ${r.url()}`);
  });
  page.on("requestfailed", (r) =>
    startupLog.push(`Request failed: ${r.url()} (${r.failure()?.errorText ?? "unknown error"})`)
  );
  page.on("console", (message) =>
  {
    if (message.type() === "error" || message.type() === "warning")
    {
      startupLog.push(`Console ${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (e) => startupLog.push(`Page error: ${e.message}`));

  await page.goto(`http://localhost:${PORT}${fw.url}`);
  try
  {
    await page.waitForFunction(() => window.benchReady === true && !!window.__bench, null, {
      timeout: 15000,
    });
  } catch (error)
  {
    const state = await page.evaluate(() => ({
      benchReady: window.benchReady,
      hasHarness: !!window.__bench,
      hasBenchApi: !!window.benchApi,
      benchTableDefined: !!customElements.get("bench-table"),
      body: document.body.innerHTML,
    }));
    throw new Error(
      `${fw.label} did not become ready.\n${startupLog.map((line) => `  ${line}`).join("\n")}\n` +
      `  State: ${JSON.stringify(state)}`,
      { cause: error }
    );
  }

  console.log(`  running ${fw.label} ...`);
  const { results, heapMB } = await page.evaluate(
    () => window.__bench.runBench({ samples: 10, warmup: 3 }),
    null
  );

  // Framework JS weight: gzip of every .js file the page actually loaded
  // (excluding the shared benchmark harness itself).
  let gzipBytes = 0;
  for (const path of jsLoaded)
  {
    if (path.includes("/benchmarks/shared/")) continue;
    const file = join(repoRoot, path);
    if (existsSync(file)) gzipBytes += gzipSync(readFileSync(file), { level: 9 }).length;
  }

  await context.close();
  return { ...fw, results, heapMB, gzipKB: +(gzipBytes / 1024).toFixed(1) };
}

const server = await startServer();
const executablePath = findChromium();
if (!executablePath)
{
  console.error("No cached Playwright Chromium found. Run: npx playwright-core install chromium");
  process.exit(1);
}
console.log("Using browser:", executablePath);

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: [
    "--enable-precise-memory-info",
    "--js-flags=--expose-gc",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-ipc-flooding-protection",
  ],
});

const all = [];
for (const fw of FRAMEWORKS)
{
  all.push(await benchFramework(browser, fw));
}
await browser.close();
server.close();

// ---- report ----------------------------------------------------------
const opNames = Object.keys(all[0].results);
const pad = (s, n) => String(s).padEnd(n);

let md = `| Operation | ${all.map((f) => f.label).join(" | ")} |\n`;
md += `|---|${all.map(() => "---:").join("|")}|\n`;
for (const op of opNames)
{
  md += `| ${op} | ${all.map((f) => `${f.results[op].median} ms`).join(" | ")} |\n`;
}
md += `| **JS payload (min+gzip)** | ${all
  .map((f) => (f.id === "vanilla" ? "~1 KB" : `**${f.gzipKB} KB**`))
  .join(" | ")} |\n`;
if (all.every((f) => f.heapMB != null))
{
  md += `| JS heap after 1,000 rows | ${all.map((f) => `${f.heapMB} MB`).join(" | ")} |\n`;
}

console.log("\nMedians (ms), lower is better\n");
console.log(pad("operation", 40) + all.map((f) => pad(f.id, 14)).join(""));
for (const op of opNames)
{
  console.log(pad(op, 40) + all.map((f) => pad(f.results[op].median, 14)).join(""));
}
console.log(pad("JS payload gzip KB", 40) + all.map((f) => pad(f.gzipKB, 14)).join(""));
if (all.every((f) => f.heapMB != null))
{
  console.log(pad("heap after 1k rows MB", 40) + all.map((f) => pad(f.heapMB, 14)).join(""));
}

const meta = {
  date: new Date().toISOString(),
  machine: `${os.type()} ${os.arch()}, ${os.cpus()[0]?.model ?? "unknown CPU"}`,
  browser: executablePath.includes("headless_shell") ? "Chromium (headless shell)" : "Chromium",
  ladrillosVersion: JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")).version,
};

await writeFile(join(__dirname, "results.json"), JSON.stringify({ meta, all }, null, 2));
await writeFile(join(__dirname, "results.md"), md);
console.log("\nWrote benchmarks/results.json and benchmarks/results.md");
console.log(`\n${meta.machine} · ${meta.browser} · ladrillosjs@${meta.ladrillosVersion}`);
