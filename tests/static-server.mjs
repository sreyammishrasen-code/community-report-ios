import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { once } from "node:events";
export async function startStatic() {
  const root = resolve("dist");
  const server = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      // No release favicon is configured yet. Match hosts that return an empty
      // response for the browser's implicit icon request, not a missing app asset.
      if (path === "/favicon.ico") {
        res.writeHead(204).end();
        return;
      }
      let file = resolve(root, `.${path}`);
      if (!file.startsWith(root + "/") && file !== root) {
        res.writeHead(403).end();
        return;
      }
      if (!extname(file)) file = resolve(root, "index.html");
      const data = await readFile(file);
      const types = {
        ".html": "text/html",
        ".js": "application/javascript",
        ".png": "image/png",
        ".ttf": "font/ttf",
        ".json": "application/json",
        ".css": "text/css",
      };
      res.writeHead(200, {
        "Content-Type": types[extname(file)] ?? "application/octet-stream",
      });
      res.end(data);
    } catch {
      res.writeHead(404).end();
    }
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}
