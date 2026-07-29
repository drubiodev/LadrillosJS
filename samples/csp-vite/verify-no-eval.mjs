/**
 * Fails the build if anything in `dist/` can generate code at runtime.
 *
 * The point of this sample is that the page runs under `script-src 'self'`
 * with no `'unsafe-eval'`. That claim is only worth making if it is checked,
 * so `npm run verify` greps the emitted bundles for the constructs a CSP
 * would reject.
 *
 * Usage: npm run build && npm run verify
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const assetsDir = join(import.meta.dirname, "dist", "assets");
const indexHtml = join(import.meta.dirname, "dist", "index.html");

if (!existsSync(assetsDir))
{
  console.error("dist/assets not found — run `npm run build` first.");
  process.exit(1);
}

/**
 * `eval(` on its own would also match `.eval(` on an unrelated object, so the
 * patterns below are anchored on the exact forms a bundler emits.
 */
const FORBIDDEN = [
  { name: "Function constructor", pattern: /\bnew Function\s*\(/ },
  { name: "Function() without new", pattern: /[^.\w]Function\s*\(\s*["'`]/ },
  { name: "indirect eval", pattern: /\(\s*0\s*,\s*eval\s*\)/ },
  { name: "direct eval", pattern: /[^.\w]eval\s*\(/ },
];

const files = readdirSync(assetsDir).filter((name) => name.endsWith(".js"));

if (files.length === 0)
{
  console.error("No JavaScript emitted in dist/assets — nothing to verify.");
  process.exit(1);
}

let failures = 0;

for (const file of files)
{
  const source = readFileSync(join(assetsDir, file), "utf8");

  for (const { name, pattern } of FORBIDDEN)
  {
    if (pattern.test(source))
    {
      console.error(`  ✗ ${file}: contains ${name}`);
      failures++;
    }
  }
}

// The policy itself lives in vite.config.js and is injected at build time, so
// verify it actually landed rather than trusting the plugin ran.
const html = readFileSync(indexHtml, "utf8");
const REQUIRED_DIRECTIVES = [
  "script-src &#39;self&#39;",
  "require-trusted-types-for &#39;script&#39;",
];

for (const directive of REQUIRED_DIRECTIVES)
{
  if (!html.includes(directive))
  {
    console.error(`  ✗ dist/index.html: missing CSP directive ${directive}`);
    failures++;
  }
}

if (failures > 0)
{
  console.error(`\n✗ ${failures} problem(s) found.`);
  process.exit(1);
}

console.log(
  `✓ ${files.length} bundle(s) contain no runtime code generation, ` +
    "and the CSP meta tag is present.",
);
