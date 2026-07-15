var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.UseStaticFiles();

app.MapGet("/", () => "Hello World!");

app.MapGet("/search", async context =>
{
  context.Response.ContentType = "text/html";
  await context.Response.SendFileAsync("wwwroot/pages/search.html");
});

// API endpoints

app.MapGet("/api/search", (string? query) =>
{
  var json = File.ReadAllText("data/emails.json");
  var emails = System.Text.Json.JsonSerializer.Deserialize<List<Dictionary<string, string>>>(json) ?? [];

  if (string.IsNullOrWhiteSpace(query))
    return Results.Json(emails);

  var results = emails.Where(e =>
    e.GetValueOrDefault("subject", "").Contains(query, StringComparison.OrdinalIgnoreCase) ||
    e.GetValueOrDefault("body", "").Contains(query, StringComparison.OrdinalIgnoreCase) ||
    e.GetValueOrDefault("from", "").Contains(query, StringComparison.OrdinalIgnoreCase)
  ).ToList();

  return Results.Json(results);
});

app.Run();
