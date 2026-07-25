# LadrillosJS + .NET 10 — the islands pattern

A minimal ASP.NET (.NET 10) app that renders the page shell on the server and
uses **LadrillosJS components as interactive islands**. .NET owns routing,
data, and the initial HTML; LadrillosJS owns the UI. No SSR engine, no Node,
and **no changes to the framework** — it uses seams that already exist.

> Prefer this over `../dotnet-sample`, which targets the deprecated v1 IIFE
> global. This sample uses the v2 ESM API.

## Run it

```bash
cd samples/dotnet-islands
dotnet run
```

Then open the URL it prints (default `http://localhost:5017`). Requires the
.NET 10 SDK; components load from the jsDelivr CDN, so you need network access.

## The three seams

Everything the server produces is the **shell + data**. The `.html` component
files are never touched by C# — their `{ }` bindings are JavaScript
expressions, not string templates, so C# must never try to fill them.

1. **Attributes-as-props** — the KPI row.
   `Program.cs` emits `<stat-card label="Revenue" value="$48,201.24">`, and
   `stat-card.html` reads `label` / `value` as script variables. This is the
   natural server → client seam and needs zero new machinery.

2. **JSON island** — the orders table seed.
   C# serializes the orders once into
   `<script type="application/json" id="orders-data">`. On mount,
   `order-table.html` does `JSON.parse(...)` and renders instantly — no fetch,
   no loading flash.

3. **Server-rendered fallback** — SEO / first paint.
   The rows *inside* `<order-table>…</order-table>` are real HTML in the initial
   response, so crawlers and the first paint see order content before any JS
   runs. On mount the island replaces them with the interactive version. This is
   why `order-table` is registered with `useShadowDOM: false` — light DOM keeps
   that fallback in the crawlable document. (The `stat-card`s use the default
   Shadow DOM; their content is encapsulated and *not* in the initial HTML,
   which is fine for KPIs.)

The **Refresh from API** button shows the fourth, familiar path: the same data
over `GET /api/orders`, fetched client-side for live updates. Server-seeded
first render and client-side interactivity coexist.

## Why not have C# render the components?

Because a binding like `{count * 2}` or `{isLoggedIn ? 'Hi' : 'Bye'}` is
JavaScript. C# string replacement works for `{name}` and then silently breaks
on the first real expression, and it forks your template semantics between
server and client. Rendering the *components themselves* on the server means
running JavaScript on the server (a Node SSR sidecar behind YARP, or V8 via
ClearScript in-process) plus a hydration mode in LadrillosJS — a deliberate
project, not a .NET-side hack. This islands pattern gets you SEO and fast first
paint without any of that.
