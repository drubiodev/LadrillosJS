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

await ladrillosjs.registerComponents([
    { name: "csp-counter", path: "./components/counter.html" },
    { name: "csp-greeting", path: "./components/greeting.html" },
    { name: "csp-report", path: "./components/report.html" },
]);
