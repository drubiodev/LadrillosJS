var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.UseStaticFiles();

app.MapGet("/", () => "Hello World!");

app.MapGet("/search", async context =>
{
  context.Response.ContentType = "text/html";
  await context.Response.SendFileAsync("wwwroot/pages/search.html");
});

app.Run();
