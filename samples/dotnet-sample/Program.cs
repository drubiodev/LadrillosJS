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

app.MapGet("/api/search", (string query) =>
{
  // Dummy search results
  var results = new[]
  {
        new { Id = 1, Name = "Result 1 for " + query },
        new { Id = 2, Name = "Result 2 for " + query },
        new { Id = 3, Name = "Result 3 for " + query }
    };
  return Results.Json(results);
});

app.Run();
