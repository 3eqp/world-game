const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 8080);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const MAX_BODY_BYTES = 2 * 1024 * 1024;

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function safeSaveFileForKey(key) {
  const clean = String(key || "default").replace(/[^a-z0-9_-]+/gi, "_").slice(0, 80) || "default";
  return path.join(DATA_DIR, `${clean}.json`);
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const typeMap = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".svg": "image/svg+xml"
    };
    res.writeHead(200, {
      "Content-Type": typeMap[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=300"
    });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Body too large"));
        req.destroy();
        return;
      }
      raw += chunk;
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

function resolveStaticPath(pathname) {
  if (pathname === "/") {
    return path.join(ROOT, "index.html");
  }
  const rel = pathname.replace(/^\/+/, "");
  const filePath = path.resolve(ROOT, rel);
  if (!filePath.startsWith(ROOT)) {
    return null;
  }
  return filePath;
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "POST" && reqUrl.pathname === "/api/save") {
    try {
      const raw = await readBody(req);
      const parsed = JSON.parse(raw || "{}");
      if (!parsed || typeof parsed !== "object" || typeof parsed.key !== "string" || !parsed.payload) {
        sendJson(res, 400, { error: "Invalid payload" });
        return;
      }
      const filePath = safeSaveFileForKey(parsed.key);
      fs.writeFileSync(filePath, JSON.stringify(parsed.payload), "utf8");
      sendJson(res, 200, { ok: true });
      return;
    } catch (_err) {
      sendJson(res, 500, { error: "Could not save" });
      return;
    }
  }

  if (req.method === "GET" && reqUrl.pathname === "/api/load") {
    try {
      const key = reqUrl.searchParams.get("key") || "default";
      const filePath = safeSaveFileForKey(key);
      if (!fs.existsSync(filePath)) {
        sendJson(res, 404, { error: "No save" });
        return;
      }
      const raw = fs.readFileSync(filePath, "utf8");
      sendJson(res, 200, JSON.parse(raw));
      return;
    } catch (_err) {
      sendJson(res, 500, { error: "Could not load" });
      return;
    }
  }

  if (req.method === "GET") {
    const filePath = resolveStaticPath(reqUrl.pathname);
    if (!filePath) {
      sendJson(res, 400, { error: "Bad path" });
      return;
    }
    sendFile(res, filePath);
    return;
  }

  sendJson(res, 405, { error: "Method not allowed" });
});

server.listen(PORT, () => {
  console.log(`world-game server listening on http://localhost:${PORT}`);
});
