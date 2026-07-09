// Zero-dependency static file server with permissive CORS headers.
// Usage: node scripts/cors-server.mjs <rootDir> <port> [fallbackRootDir]
// If a file is not found under <rootDir>, it is looked up under
// [fallbackRootDir]. This lets the REPL be served at / from samples/repl
// while still resolving shared assets (e.g. /dist-cdn) from the repo root.
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = process.argv[2] ?? ".";
const port = Number(process.argv[3] ?? 3000);
const fallbackRoot = process.argv[4];
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
        const body = await resolveFile(root, p) ??
            (fallbackRoot ? await resolveFile(fallbackRoot, p) : null);
        if (body === null)
        {
            res.writeHead(404);
            return res.end("Not found");
        }
        res.writeHead(200, {
            "Content-Type": types[extname(body.file)] || "application/octet-stream",
        });
        res.end(body.data);
    } catch
    {
        res.writeHead(404);
        res.end("Not found");
    }
});

async function resolveFile(base, p)
{
    try
    {
        let file = join(base, p);
        const s = await stat(file);
        if (s.isDirectory()) file = join(file, "index.html");
        return { file, data: await readFile(file) };
    } catch
    {
        return null;
    }
}

server.on("error", (e) =>
{
    console.error("LISTEN ERROR:", e.code);
    process.exit(1);
});
server.listen(port, "127.0.0.1", () =>
    console.log(`serving ${root} on http://127.0.0.1:${port}`)
);
