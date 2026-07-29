#!/usr/bin/env node
/**
 * Verifies the CSP guarantee against the built output rather than trusting it.
 *
 * `ladrillosjs/csp` must contain no runtime code generation. That is only true
 * as long as nothing in its import graph reaches `runtimeBackend`, which is
 * easy to break by accident — one stray import from a shared module and the
 * bundler folds `Function` back into a chunk the CSP entry loads.
 *
 * Detection deliberately does not rely on the literal text `new Function`.
 * After minification the async variant appears as `new n(...)`, where `n` came
 * from `Object.getPrototypeOf(async function(){}).constructor`, so that
 * construction is matched too.
 *
 * The script also asserts the opposite for the default entry: if `dist/index.js`
 * ever stops containing codegen, the runtime build is broken and the CSP check
 * would be passing vacuously.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const DIST = resolve(process.cwd(), "dist");

/** Ways a bundle can turn a string into code. */
const CODEGEN_PATTERNS = [
    { name: "new Function", re: /\bnew\s+Function\s*\(/ },
    { name: "Function() call", re: /(?<![.\w$])Function\s*\(\s*["'`]/ },
    { name: "direct eval", re: /(?<![.\w$])eval\s*\(/ },
    { name: "indirect eval", re: /\(\s*0\s*,\s*eval\s*\)/ },
    {
        name: "AsyncFunction constructor",
        re: /getPrototypeOf\s*\(\s*async\s+function/,
    },
];

/** Follows relative imports from an entry and returns every file reached. */
function importGraph(entry)
{
    const seen = new Set();
    const queue = [entry];

    while (queue.length > 0)
    {
        const file = queue.pop();
        if (seen.has(file) || !existsSync(file)) continue;
        seen.add(file);

        const source = readFileSync(file, "utf8");
        // Covers `from"./x.js"`, `import"./x.js"` and `import("./x.js")`.
        for (const m of source.matchAll(/["'](\.\.?\/[^"']+\.js)["']/g))
        {
            queue.push(resolve(dirname(file), m[1]));
        }
    }

    return [...seen];
}

function findCodegen(files)
{
    const hits = [];
    for (const file of files)
    {
        const source = readFileSync(file, "utf8");
        for (const { name, re } of CODEGEN_PATTERNS)
        {
            const match = source.match(re);
            if (match)
            {
                hits.push({ file, name, index: match.index, source });
            }
        }
    }
    return hits;
}

function rel(file)
{
    return file.slice(resolve(process.cwd()).length + 1);
}

let failed = false;

// 1. The CSP entry and everything it loads must be free of codegen.
const cspEntry = join(DIST, "csp.js");
if (!existsSync(cspEntry))
{
    console.error("✗ dist/csp.js not found — run `npm run build` first.");
    process.exit(1);
}

const cspFiles = importGraph(cspEntry);
const cspHits = findCodegen(cspFiles);

console.log(`Checking ladrillosjs/csp (${cspFiles.length} chunks)`);
for (const file of cspFiles) console.log(`    ${rel(file)}`);

if (cspHits.length > 0)
{
    failed = true;
    console.error("\n✗ Runtime code generation reached the CSP build:\n");
    for (const hit of cspHits)
    {
        const snippet = hit.source
            .slice(Math.max(0, hit.index - 40), hit.index + 60)
            .replace(/\n/g, " ");
        console.error(`  ${rel(hit.file)} — ${hit.name}`);
        console.error(`    …${snippet}…\n`);
    }
    console.error(
        "  Something in the csp.ts import graph now reaches runtimeBackend.\n" +
        "  Find it with: npx vite build --config vite.npm.config.ts\n" +
        "  then inspect which chunk carries the Function constructor.\n"
    );
} else
{
    console.log("\n✓ No code generation in the CSP build");
}

// 2. The default entry must still HAVE codegen. Without this, deleting the
//    runtime backend entirely would make check 1 pass while shipping a
//    framework that cannot compile anything.
const indexEntry = join(DIST, "index.js");
const indexHits = findCodegen(importGraph(indexEntry));

if (indexHits.length === 0)
{
    failed = true;
    console.error(
        "\n✗ dist/index.js contains no code generation.\n" +
        "  The default build compiles components in the browser, so this means\n" +
        "  the runtime backend is no longer installed — and the CSP check above\n" +
        "  passed for the wrong reason."
    );
} else
{
    console.log(
        `✓ Default build still compiles at runtime (${indexHits[0].name} in ${rel(
            indexHits[0].file
        )})`
    );
}

process.exit(failed ? 1 : 0);
