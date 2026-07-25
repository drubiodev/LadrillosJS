using System.Text;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.UseStaticFiles();

// camelCase on the way out so the JSON island / API match what the
// components read (o.id, o.total, ...); case-insensitive on the way in so the
// lowercase source file deserializes into the PascalCase record.
var json = new JsonSerializerOptions
{
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    PropertyNameCaseInsensitive = true,
};

List<Order> LoadOrders() =>
    JsonSerializer.Deserialize<List<Order>>(File.ReadAllText("data/orders.json"), json) ?? [];

// The page shell is rendered by C#. LadrillosJS never sees this file — it only
// receives already-computed values (attributes + a JSON island). C# owns the
// server, the .html components own the UI. Note we never touch a component's
// { } bindings from C#: those are JS expressions, not string templates.
app.MapGet("/", () => Results.Content(RenderPage(LoadOrders(), json), "text/html; charset=utf-8"));

// Same data as JSON, for the client-side "Refresh" / filter interactions.
app.MapGet("/api/orders", (string? status) =>
{
    var orders = LoadOrders();
    if (!string.IsNullOrWhiteSpace(status) && status != "all")
        orders = orders.Where(o => o.Status == status).ToList();
    return Results.Json(orders, json);
});

app.Run();

static string RenderPage(List<Order> orders, JsonSerializerOptions json)
{
    var total = orders.Count;
    var revenue = orders.Sum(o => o.Total);
    var pending = orders.Count(o => o.Status == "pending");

    // Seam 3 — server-rendered fallback rows. Real HTML in the initial
    // response, so crawlers and the first paint see order content before any JS
    // runs. On mount the <order-table> island replaces these with the
    // interactive version.
    var rows = new StringBuilder();
    foreach (var o in orders)
        rows.Append(
            $"<tr><td>#{o.Id}</td><td>{o.Customer}</td><td>${o.Total:N2}</td><td>{o.Status}</td></tr>");

    // Seam 2 — JSON island. The same data serialized once; the island reads it
    // on mount for an instant render (no fetch, no flash).
    var seed = JsonSerializer.Serialize(orders, json);

    // Raw string uses {{ }} for C# interpolation, so it never collides with a
    // component's single-brace { } bindings.
    return $$"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Orders — LadrillosJS + .NET islands</title>
      <link rel="stylesheet" href="/main.css" />
      <script type="module">
        import { registerComponents } from "https://cdn.jsdelivr.net/npm/ladrillosjs@2/dist/index.js";
        await registerComponents([
          // Shadow DOM (default): encapsulated, but its content is NOT in the
          // crawlable initial HTML — fine for KPIs.
          { name: "stat-card", path: "/components/stat-card.html" },
          // Light DOM: styles/content live in the page, so the server-rendered
          // fallback rows inside <order-table> are crawlable until JS upgrades.
          { name: "order-table", path: "/components/order-table.html", useShadowDOM: false },
        ]);
      </script>
    </head>
    <body>
      <main>
        <header>
          <h1>Orders</h1>
          <p>Rendered by ASP.NET; made interactive by LadrillosJS islands.</p>
        </header>

        <!-- Seam 1 — attributes-as-props. C# fills the attributes; the
             component reads them as script variables. This is the natural
             server/client seam and needs no new framework machinery. -->
        <section class="kpis">
          <stat-card label="Total orders" value="{{total}}" hint="all time"></stat-card>
          <stat-card label="Revenue" value="${{revenue:N2}}" hint="all time"></stat-card>
          <stat-card label="Pending" value="{{pending}}" hint="awaiting shipment"></stat-card>
        </section>

        <!-- Seam 2 + 3 — the island is seeded by the JSON below, and the rows
             inside the tag are the server-rendered SEO fallback. -->
        <order-table>
          <table>
            <thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>{{rows}}</tbody>
          </table>
        </order-table>

        <script type="application/json" id="orders-data">{{seed}}</script>
      </main>
    </body>
    </html>
    """;
}

record Order(string Id, string Customer, decimal Total, string Status);
