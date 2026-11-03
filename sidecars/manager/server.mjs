import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.ANTIGRAVITY_SIDECAR_WEB_PORT || 38942);

function runCommand(cmd, args) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { shell: false });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => { stdout += d.toString(); });
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  // API: Get plugins status
  if (url.pathname === "/api/plugins" && req.method === "GET") {
    const { code, stdout } = await runCommand("agy", ["plugin", "list", "--json"]);
    if (code === 0) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(stdout);
    } else {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Failed to list plugins" }));
    }
    return;
  }

  // API: Run dual-phase update
  if (url.pathname === "/api/update" && req.method === "POST") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    });

    const proc = spawn("/home/jingxue/.local/bin/antigravity-plugins-update", [], { shell: false });

    proc.stdout.on("data", (data) => {
      res.write(`data: ${JSON.stringify({ type: "stdout", text: data.toString() })}\n\n`);
    });

    proc.stderr.on("data", (data) => {
      res.write(`data: ${JSON.stringify({ type: "stderr", text: data.toString() })}\n\n`);
    });

    proc.on("close", (code) => {
      res.write(`data: ${JSON.stringify({ type: "done", code })}\n\n`);
      res.end();
    });
    return;
  }

  // Main UI
  if (url.pathname === "/" || url.pathname === "/index.html") {
    try {
      const html = await readFile(join(__dirname, "index.html"), "utf8");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    } catch (err) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error: " + err.message);
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Plugin Manager Sidecar running on http://127.0.0.1:${PORT}`);
});
