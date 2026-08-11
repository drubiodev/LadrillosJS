import path from "node:path";
import { defineConfig } from "vite";
import ladrillos from "@ladrillosjs/vite-plugin";

/**
 * The policy this sample runs under. No 'unsafe-eval' and no 'unsafe-inline',
 * plus Trusted Types enforcement.
 *
 * `trusted-types ladrillosjs` allows the policy the framework creates for its
 * own HTML sinks. Drop that line and the page stops rendering, which is the
 * point of enforcing it.
 */
const POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "object-src 'none'",
  "base-uri 'none'",
  "require-trusted-types-for 'script'",
  "trusted-types ladrillosjs",
].join("; ");

/**
 * In production a CSP belongs in a response header. A <meta> tag is used here
 * only so `vite preview` serves the sample under the policy with no server.
 *
 * Build-only on purpose: `vite serve` needs a websocket for HMR, and the
 * plugin does not precompile during dev unless you pass `dev: true`, so a dev
 * page would still be compiling components in the browser.
 */
function injectCspMeta() {
  return {
    name: "csp-meta",
    apply: "build",
    transformIndexHtml() {
      return [
        {
          tag: "meta",
          attrs: { "http-equiv": "Content-Security-Policy", content: POLICY },
          injectTo: "head-prepend",
        },
      ];
    },
  };
}

export default defineConfig({
  plugins: [
    // strict: refuse to build if any registration could not be precompiled,
    // because a single missed one puts 'unsafe-eval' back on the page.
    ladrillos({ strict: true }),
    injectCspMeta(),
  ],
  resolve: {
    // Samples run against the framework source rather than a published build.
    // A real project deletes this block and just installs `ladrillosjs`.
    alias: { ladrillosjs: path.resolve(import.meta.dirname, "../../src") },
    preserveSymlinks: true,
  },
  server: {
    fs: { allow: [path.resolve(import.meta.dirname, "../..")] },
  },
});
