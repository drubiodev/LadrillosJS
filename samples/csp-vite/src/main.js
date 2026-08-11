/**
 * Importing from `ladrillosjs/csp` rather than `ladrillosjs` is what keeps the
 * runtime compiler out of the bundle. The plugin rewrites the registrations
 * below into imports of precompiled artifacts, so nothing here is fetched or
 * compiled in the browser.
 *
 * These paths must be plain string literals — that is how the plugin finds
 * them. See the README for what it will and will not precompile.
 */
import { registerComponent } from "ladrillosjs/csp";

// Buffer violations fired before the report component mounts. Nothing in the
// framework needs this; it exists so the page can show you its own CSP result.
globalThis.__cspViolations = [];
globalThis.addEventListener("securitypolicyviolation", (event) =>
{
    globalThis.__cspViolations.push({
        directive: event.effectiveDirective,
        blocked: event.blockedURI || "inline",
    });
});

registerComponent("csp-counter", "./components/counter.html");
registerComponent("csp-greeting", "./components/greeting.html");
registerComponent("csp-report", "./components/report.html");
