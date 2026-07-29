# LadrillosJS Samples

A collection of samples and demos showcasing what you can build with
**LadrillosJS** — a lightweight, zero-dependency web component framework.

Each sample is self-contained and highlights a different capability, integration,
or real-world use case. Use them as a reference, a starting point, or a way to
compare LadrillosJS with what you already know.

> Looking to start a project rather than read one? Copy a
> [template](../templates) instead — samples demonstrate features, templates
> give you a clean base.

---

## 📦 Available Samples

| Sample | Description | Highlights |
| --- | --- | --- |
| [repl](./repl) | An in-browser playground — edit a component and see it render live. | No build step, live preview, four starter examples |
| [cdn-sample](./cdn-sample) | A no-build app loaded straight from the CDN. | Zero build step, `registerComponents`, Shadow DOM off |
| [csp-vite](./csp-vite) | The same components under a strict CSP, with no `unsafe-eval`. | Build-time compilation, `ladrillosjs/csp`, Trusted Types |
| [cdn-csp](./cdn-csp) | How strict a policy the no-build path can run under. | Strict CSP with no build step, adopted stylesheets, measured trade-offs |
| [embed-widget](./embed-widget) | A pricing widget embedded on a hostile page it does not control. | One-script-tag install, Shadow DOM isolation, per-instance state |
| [dotnet-sample](./dotnet-sample) | LadrillosJS components inside an ASP.NET (.NET) app. | Server framework integration, progressive enhancement |
| [ladrillos-demo](./ladrillos-demo) | A minimal demo project. | Getting started, component basics |
| [vite-basic-site](./vite-basic-site) | A basic site scaffolded with Vite. | Build tooling, module imports |
| [vite-sample](./vite-sample) | A Vite-powered sample with TypeScript. | Vite + TS setup, component authoring |

---

## 🚧 Coming Soon

Planned samples that will showcase the full range of the framework. These map to
the categories top frameworks use to demonstrate their strengths.

| Sample | What it will show | Why it matters |
| --- | --- | --- |
| **TodoMVC** | The universal reference app: `<for>`, `<if>`, `$bind`, events, persistence. | Apples-to-apples comparison with other frameworks. |
| **Progressive Enhancement** | Sprinkle interactive components into a server-rendered page. | The CDN / no-bundler superpower. |
| **Performance Benchmark** | Large table with row swapping and updates. | Backs up the "no virtual DOM, direct DOM" claim. |
| **Framework Interop** | Drop a LadrillosJS component into React / Vue / Svelte. | Proves it's just a standard custom element. |
| **Live Theme Editor** | Adjust design tokens and restyle a whole component gallery instantly. | Showcases tokens + Shadow DOM theming. |
| **Realistic App** | A cohesive dashboard or storefront. | Event bus + lazy loading in a real narrative. |
| **Lazy-Loading Spotlight** | A content-heavy feed/gallery that loads components on demand. | "Fast by default" performance story. |

> Want to contribute a sample? See the [Contributing guide](../README.md#-contributing).

---

## ▶️ Running the Samples

Most samples include their own instructions. In general:

- **REPL** — open `repl/index.html` directly in a browser (it loads LadrillosJS
  from the CDN; no build or server needed).
- **CDN samples** — open `index.html` (some expect a local CDN build; see the
  sample's notes).
- **Vite samples** — `npm install` then `npm run dev` inside the sample folder.
- **csp-vite** — `npm install`, then `npm run build && npm run preview`. The CSP
  is applied at build time, so `npm run dev` will not show the sample under its
  policy.
- **cdn-csp** — `npm run dev:cdn-csp` from the repo root, then open
  <http://127.0.0.1:8081>.
- **embed-widget** — `npm run serve:widget` from the repo root, then open
  <http://127.0.0.1:8145>.
- **.NET sample** — run with `dotnet run` from the sample folder.

---

## 📚 Learn More

- [Documentation](../docs/README.md)
- [Quick Start](../docs/01-quick-start.md)
- [Design System Guide](../docs/19-design-system.md)
