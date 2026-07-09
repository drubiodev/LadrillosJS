// Zero-dependency static file server with permissive CORS headers.
// Usage: node scripts/cors-server.mjs <rootDir> <port>
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = process.argv[2] ?? ".";
const port = Number(process.argv[3] ?? 3000);
const types = {
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".html": "text/html",
    ".css": "text/css",
    ".json": "application/json",
    ".map": "application/json",
    ".svg": "image/svg+xml",
};

const server = http.createServer(async (req, res) =>
{
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    if (req.method === "OPTIONS")
    {
        res.writeHead(204);
        return res.end();
    }
    try
    {
        let p = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
        if (p.endsWith("/")) p += "index.html";
        let file = join(root, p);
        const s = await stat(file);
        if (s.isDirectory()) file = join(file, "index.html");
        const body = await readFile(file);
        res.writeHead(200, {
            "Content-Type": types[extname(file)] || "application/octet-stream",
        });
        res.end(body);
    } catch
    {
        res.writeHead(404);
        res.end("Not found");
    }
});

server.on("error", (e) =>
{
    console.error("LISTEN ERROR:", e.code);
    process.exit(1);
});
server.listen(port, "127.0.0.1", () =>
    console.log(`serving ${root} on http://127.0.0.1:${port}`)
);
