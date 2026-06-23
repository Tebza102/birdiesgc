const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const rootDir = process.cwd();
const portArgIndex = process.argv.indexOf("--port");
const cliPort = portArgIndex !== -1 ? Number(process.argv[portArgIndex + 1]) : null;
const port = Number(process.env.PORT || cliPort || 4173);

const mimeTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon"
};

function sendFile(res, filePath) {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
            res.end("Not found");
            return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
        res.end(data);
    });
}

const server = http.createServer((req, res) => {
    const parsed = url.parse(req.url || "/");
    let pathname = decodeURIComponent(parsed.pathname || "/");

    if (pathname === "/events") pathname = "/events.html";
    if (pathname === "/") pathname = "/index.html";

    const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(rootDir, safePath);

    if (!filePath.startsWith(rootDir)) {
        res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Forbidden");
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (!err && stats.isFile()) {
            sendFile(res, filePath);
            return;
        }

        if (!err && stats.isDirectory()) {
            const indexPath = path.join(filePath, "index.html");
            sendFile(res, indexPath);
            return;
        }

        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
    });
});

server.listen(port, () => {
    console.log(`Birdie Squad dev server running at http://localhost:${port}`);
});

