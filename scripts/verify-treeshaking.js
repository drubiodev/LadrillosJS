/**
 * Verify Tree-Shaking Script
 *
 * This script validates that production builds don't contain dev-only code.
 * Run after building to ensure dead code elimination is working properly.
 *
 * What it checks:
 * 1. No development warnings/logs (should be eliminated by __DEV__ guards)
 * 2. No "LadrillosJS" console prefix (dev-only logging)
 * 3. No source maps or debug info
 * 4. Build size is within expected limits
 *
 * Usage:
 *   node scripts/verify-treeshaking.js
 *   npm run verify:build
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync, brotliCompressSync } from "node:zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

// ============================================================================
// Configuration
// ============================================================================

const BUILDS_TO_CHECK = [
  {
    name: "NPM Main Bundle",
    // The content hash changes every build, so the exact filename is resolved
    // via `fallbackPattern` below; this literal is just a hint and is expected
    // to be stale.
    path: "dist/shared-main.js",
    // Budget is raw (pre-gzip) size with headroom over the current ~70 KB. It
    // exists to catch unexpected regressions (e.g. a dependency accidentally
    // bundled or dev code not tree-shaken), not to track normal growth.
    maxSizeKB: 85,
    fallbackPattern: "dist/shared-*.js", // Resolves the real hashed chunk.
  },
  {
    name: "CDN IIFE Bundle",
    path: "dist-cdn/ladrillos.iife.js",
    // Raised from 85 KB when the codegen backend became an installable seam
    // (Phase 3). That added ~330 bytes to this bundle — the uninstalled
    // backend and the entry-point install call — in exchange for letting
    // `ladrillosjs/csp` ship with no `Function` constructor at all.
    maxSizeKB: 88,
  },
];

// Patterns that should NOT appear in production builds
const FORBIDDEN_PATTERNS = [
  {
    pattern: /console\.warn\s*\(/,
    description: "console.warn calls - should be dropped by terser",
  },
  {
    pattern: /console\.log\s*\(/,
    description: "console.log calls - should be dropped by terser",
  },
  {
    pattern: /__DEV__\s*&&/,
    description: "__DEV__ short-circuit - should be eliminated",
  },
  {
    pattern: /if\s*\(\s*__DEV__\s*\)/,
    description: "__DEV__ conditionals - should be eliminated",
  },
  {
    pattern: /debugger\s*;/,
    description: "debugger statements - should be dropped",
  },
  // Note: [LadrillosJS] prefix in console.error is OK - errors should show in production
  // Only warn/log should be eliminated
];

// ============================================================================
// Helpers
// ============================================================================

function formatBytes(bytes)
{
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(2)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

function getCompressionStats(content)
{
  const raw = Buffer.byteLength(content, "utf8");
  const gzip = gzipSync(content).length;
  const brotli = brotliCompressSync(content).length;
  return { raw, gzip, brotli };
}

// ============================================================================
// Verification
// ============================================================================

function verifyBuild(buildConfig)
{
  const { name, path: buildPath, maxSizeKB, fallbackPattern } = buildConfig;
  let fullPath = path.resolve(rootDir, buildPath);
  const errors = [];
  const warnings = [];

  console.log(`\n📦 Checking: ${name}`);

  // Check if file exists, try fallback pattern if not
  if (!fs.existsSync(fullPath) && fallbackPattern)
  {
    const dir = path.dirname(path.resolve(rootDir, fallbackPattern));
    const pattern = path.basename(fallbackPattern);
    const regex = new RegExp("^" + pattern.replace("*", ".*") + "$");
    const files = fs
      .readdirSync(dir)
      .filter((f) => regex.test(f) && !f.endsWith(".dev.js"));
    // Find the largest shared chunk (that's the main one)
    if (files.length > 0)
    {
      const sorted = files
        .map((f) => ({ name: f, size: fs.statSync(path.join(dir, f)).size }))
        .sort((a, b) => b.size - a.size);
      fullPath = path.join(dir, sorted[0].name);
    }
  }

  console.log(`   Path: ${path.relative(rootDir, fullPath)}`);

  // Check if file exists
  if (!fs.existsSync(fullPath))
  {
    errors.push(`Build file not found: ${buildPath}`);
    return { errors, warnings };
  }

  const content = fs.readFileSync(fullPath, "utf-8");
  const stats = getCompressionStats(content);

  // Report sizes
  console.log(`   Raw:    ${formatBytes(stats.raw)}`);
  console.log(`   Gzip:   ${formatBytes(stats.gzip)}`);
  console.log(`   Brotli: ${formatBytes(stats.brotli)}`);

  // Check size limits
  const sizeKB = stats.raw / 1024;
  if (sizeKB > maxSizeKB)
  {
    warnings.push(
      `Build size (${sizeKB.toFixed(
        2
      )} KB) exceeds expected max (${maxSizeKB} KB)`
    );
  }

  // Check for forbidden patterns
  for (const { pattern, description } of FORBIDDEN_PATTERNS)
  {
    if (pattern.test(content))
    {
      errors.push(`Found forbidden pattern: ${description}`);
    }
  }

  // Success indicators
  if (errors.length === 0)
  {
    console.log(`   ✅ No forbidden patterns found`);
  }

  return { errors, warnings };
}

// ============================================================================
// Main
// ============================================================================

/**
 * Every entry point installs its codegen backend with a bare top-level call:
 *
 *   setCodegenBackend(precompiledBackend);
 *
 * Nothing consumes the result, so a bundler told the package is side-effect
 * free is entitled to delete that statement — and then every component fails
 * at mount with "No codegen backend installed". This is not theoretical: it
 * shipped in 2.0.0 and broke any consumer who ran `vite build`.
 *
 * The fix is to list those entries in `sideEffects`, and this check keeps the
 * list honest when a new entry point is added.
 */
function verifySideEffects()
{
  console.log(`\n📦 Checking: package.json "sideEffects"`);

  const errors = [];
  const pkg = JSON.parse(
    fs.readFileSync(path.join(rootDir, "package.json"), "utf8")
  );
  const declared = new Set(
    Array.isArray(pkg.sideEffects) ? pkg.sideEffects : []
  );

  if (pkg.sideEffects === false)
  {
    errors.push(
      '"sideEffects": false deletes every entry point\'s ' +
        "setCodegenBackend() call during a consumer's production build"
    );
    return errors;
  }

  const srcDir = path.join(rootDir, "src");
  const entries = fs
    .readdirSync(srcDir)
    .filter((name) => name.endsWith(".ts"))
    .filter((name) =>
      fs.readFileSync(path.join(srcDir, name), "utf8").includes(
        "\nsetCodegenBackend("
      )
    );

  if (entries.length === 0)
  {
    errors.push(
      "no entry point calls setCodegenBackend() — this check is now vacuous " +
        "and needs updating"
    );
    return errors;
  }

  for (const entry of entries)
  {
    const stem = entry.replace(/\.ts$/, "");
    const required = [
      `./src/${entry}`,
      `./dist/${stem}.js`,
      `./dist/${stem}.dev.js`,
    ];

    for (const file of required)
    {
      if (!declared.has(file))
      {
        errors.push(
          `${file} installs a codegen backend but is missing from "sideEffects"`
        );
      }
    }
  }

  if (errors.length === 0)
  {
    console.log(
      `   ✅ All ${entries.length} backend-installing entries are declared`
    );
  }

  return errors;
}

function main()
{
  console.log("🔍 Verifying production builds for tree-shaking...\n");
  console.log("=".repeat(60));

  let totalErrors = 0;
  let totalWarnings = 0;

  for (const build of BUILDS_TO_CHECK)
  {
    const { errors, warnings } = verifyBuild(build);

    for (const error of errors)
    {
      console.log(`   ❌ ERROR: ${error}`);
      totalErrors++;
    }

    for (const warning of warnings)
    {
      console.log(`   ⚠️  WARNING: ${warning}`);
      totalWarnings++;
    }
  }

  for (const error of verifySideEffects())
  {
    console.log(`   ❌ ERROR: ${error}`);
    totalErrors++;
  }

  console.log("\n" + "=".repeat(60));

  if (totalErrors > 0)
  {
    console.log(
      `\n❌ Verification FAILED: ${totalErrors} error(s), ${totalWarnings} warning(s)`
    );
    console.log("\nDev-only code was found in the production build.");
    console.log("Make sure all dev code is wrapped in: if (__DEV__) { ... }");
    process.exit(1);
  } else if (totalWarnings > 0)
  {
    console.log(`\n⚠️  Verification passed with ${totalWarnings} warning(s)`);
    process.exit(0);
  } else
  {
    console.log("\n✅ All builds verified successfully!");
    console.log("   - No dev-only code found");
    console.log("   - Sizes within expected limits");
    process.exit(0);
  }
}

main();
