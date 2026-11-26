import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { existsSync, readdirSync, readlinkSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.ANTIGRAVITY_SIDECAR_WEB_PORT || 38942);
const PLUGINS_DIR = join(homedir(), ".gemini", "config", "plugins");
const SELF_PLUGIN_DIR = resolve(__dirname, "..", "..");
const SELF_PLUGIN_NAME = basename(SELF_PLUGIN_DIR);

function runCommand(cmd, args, opts = {}) {
  return new Promise((resolvePromise) => {
    const useShell = opts.shell ?? (process.platform === "win32" && !cmd.includes("\\") && !cmd.includes("/"));
    const proc = spawn(cmd, args, {
      cwd: opts.cwd,
      shell: useShell,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (d) => { stdout += d.toString(); });
    proc.stderr?.on("data", (d) => { stderr += d.toString(); });
    proc.on("error", (err) => {
      resolvePromise({ code: 1, stdout, stderr: stderr + err.message });
    });
    proc.on("close", (code) => {
      resolvePromise({ code: code ?? 1, stdout, stderr });
    });
  });
}

function getGitPluginDirs() {
  if (!existsSync(PLUGINS_DIR)) return [];
  const entries = readdirSync(PLUGINS_DIR, { withFileTypes: true });
  const dirs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const full = join(PLUGINS_DIR, entry.name);
    if (existsSync(join(full, ".git"))) {
      dirs.push({ name: entry.name, path: full });
    }
  }
  return dirs;
}

async function getGitHead(dir) {
  const { code, stdout } = await runCommand("git", ["rev-parse", "HEAD"], { cwd: dir });
  return code === 0 ? stdout.trim() : null;
}

async function snapshotGitHeads() {
  const map = new Map();
  for (const d of getGitPluginDirs()) {
    map.set(d.name, await getGitHead(d.path));
  }
  return map;
}

/**
 * Find running sidecar PIDs belonging to a given plugin directory.
 * - Linux: inspects /proc/<pid>/cwd for processes running inside <pluginPath>/sidecars
 * - macOS: uses lsof to inspect cwd
 * - Windows: checks known sidecar-info.json PIDs (e.g., theme-control-center)
 */
async function findPluginSidecarPids(pluginPath) {
  const pids = new Set();
  const normalizedTarget = resolve(pluginPath);
  const sidecarsRoot = join(normalizedTarget, "sidecars");

  if (process.platform === "linux") {
    try {
      const procEntries = readdirSync("/proc", { withFileTypes: true });
      for (const e of procEntries) {
        if (!e.isDirectory() || !/^\d+$/.test(e.name)) continue;
        const pid = Number(e.name);
        if (pid === process.pid) continue;
        try {
          const cwd = readlinkSync(`/proc/${pid}/cwd`);
          if (cwd === normalizedTarget || cwd.startsWith(sidecarsRoot + "/")) {
            pids.add(pid);
          }
        } catch {
          // Permission denied or process exited
        }
      }
    } catch {
      // /proc unavailable
    }
  } else if (process.platform === "darwin") {
    const { code, stdout } = await runCommand("lsof", ["-a", "-d", "cwd", "-Fn", "-c", "node", "-c", "Antigravity"]);
    if (code === 0) {
      let currentPid = null;
      for (const line of stdout.split("\n")) {
        if (line.startsWith("p")) {
          currentPid = Number(line.slice(1));
        } else if (line.startsWith("n") && currentPid && currentPid !== process.pid) {
          const cwd = line.slice(1).trim();
          if (cwd === normalizedTarget || cwd.startsWith(sidecarsRoot + "/")) {
            pids.add(currentPid);
          }
        }
      }
    }
  } else if (process.platform === "win32") {
    // Theme Control Center writes its active sidecar PID here
    if (basename(normalizedTarget) === "antigravity-theme-control-center") {
      try {
        const infoPath = join(homedir(), ".gemini", "config", "custom-ui", "sidecar-info.json");
        if (existsSync(infoPath)) {
          const info = JSON.parse(await readFile(infoPath, "utf8"));
          if (info?.pid && Number(info.pid) !== process.pid) {
            pids.add(Number(info.pid));
          }
        }
      } catch {}
    }
  }

  return Array.from(pids);
}

/**
 * Hot-reload a list of plugin names/directories.
 * Restarts running sidecars (Antigravity's restart_policy: "always" respawns them with updated code).
 * Returns { reloaded: string[], selfReload: boolean }.
 */
async function hotReloadPlugins(pluginNames, log) {
  const unique = Array.from(new Set(pluginNames.filter(Boolean)));
  const reloaded = [];
  let selfReload = false;

  for (const name of unique) {
    if (name === SELF_PLUGIN_NAME || name === "plugin-manager") {
      selfReload = true;
      continue;
    }

    const pluginPath = join(PLUGINS_DIR, name);
    const pids = existsSync(pluginPath) ? await findPluginSidecarPids(pluginPath) : [];
    let restarted = false;

    for (const pid of pids) {
      try {
        process.kill(pid, "SIGTERM");
        restarted = true;
        log(`[hot-reload] 已终止 ${name} 旧版 sidecar (PID ${pid})，等待宿主自动拉起新版...\n`);
      } catch (err) {
        log(`[hot-reload] 终止 ${name} (PID ${pid}) 失败: ${err.message}\n`);
      }
    }

    if (!restarted) {
      // Fallback: toggle enable state via agy CLI if no sidecar PID was found
      const dis = await runCommand("agy", ["plugin", "disable", name]);
      const en = await runCommand("agy", ["plugin", "enable", name]);
      if (dis.code === 0 && en.code === 0) {
        log(`[hot-reload] 已通过 agy plugin 刷新 ${name}\n`);
        restarted = true;
      } else {
        log(`[hot-reload] ${name} 当前无运行中的 sidecar 进程（无需重启）\n`);
      }
    }

    if (restarted) reloaded.push(name);
  }

  if (selfReload) {
    reloaded.push(SELF_PLUGIN_NAME);
  }

  return { reloaded, selfReload };
}

function findUpdateScript() {
  const candidates = [
    join(homedir(), ".local", "bin", "antigravity-plugins-update"),
    "/home/jingxue/.local/bin/antigravity-plugins-update",
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  // API: Get plugins status
  if (url.pathname === "/api/plugins" && req.method === "GET") {
    const { code, stdout } = await runCommand("agy", ["plugin", "list", "--json"]);
    if (code === 0) {
      try {
        const list = JSON.parse(stdout).map((p) => {
          const dir = p.path ? basename(p.path) : p.name;
          return {
            ...p,
            dir,
            isGit: p.path ? existsSync(join(p.path, ".git")) : false,
          };
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(list));
      } catch {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(stdout);
      }
    } else {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Failed to list plugins" }));
    }
    return;
  }

  // API: Manual hot-reload for one or all plugins
  if (url.pathname === "/api/reload" && req.method === "POST") {
    let body = "";
    for await (const chunk of req) body += chunk;
    let payload = {};
    try { payload = body ? JSON.parse(body) : {}; } catch {}

    const targets = Array.isArray(payload.plugins) && payload.plugins.length
      ? payload.plugins
      : getGitPluginDirs().map((d) => d.name);

    const logs = [];
    const { reloaded, selfReload } = await hotReloadPlugins(targets, (msg) => logs.push(msg));

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, reloaded, selfReload, logs: logs.join("") }));

    if (selfReload) {
      setTimeout(() => process.exit(0), 350);
    }
    return;
  }

  // API: Run dual-phase update + automatic hot-reload
  if (url.pathname === "/api/update" && req.method === "POST") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    });

    const sendEvent = (obj) => {
      res.write(`data: ${JSON.stringify(obj)}\n\n`);
    };
    const sendLog = (text, type = "stdout") => sendEvent({ type, text });

    const beforeHeads = await snapshotGitHeads();
    const updateScript = findUpdateScript();
    let updateCode = 0;

    if (updateScript && process.platform !== "win32") {
      sendLog(`[phase 1-2] 执行更新脚本: ${updateScript}\n`);
      updateCode = await new Promise((resolvePromise) => {
        const proc = spawn(updateScript, [], { shell: false });
        proc.stdout.on("data", (d) => sendLog(d.toString(), "stdout"));
        proc.stderr.on("data", (d) => sendLog(d.toString(), "stderr"));
        proc.on("error", (err) => {
          sendLog(`执行更新脚本失败: ${err.message}\n`, "stderr");
          resolvePromise(1);
        });
        proc.on("close", (code) => resolvePromise(code ?? 0));
      });
    } else {
      sendLog("[phase 1] 检查官方与本地插件列表...\n");
      const listRes = await runCommand("agy", ["plugin", "list", "--json"]);
      if (listRes.code === 0) {
        try {
          const items = JSON.parse(listRes.stdout);
          sendLog(`已安装 ${items.length} 个插件。\n`);
        } catch {}
      }

      sendLog("\n[phase 2] 同步 Git 扩展仓库...\n");
      const gitDirs = getGitPluginDirs();
      for (const d of gitDirs) {
        sendLog(`-> git pull (${d.name})...\n`);
        const pullRes = await runCommand("git", ["pull", "--ff-only"], { cwd: d.path });
        if (pullRes.stdout) sendLog(pullRes.stdout);
        if (pullRes.stderr) sendLog(pullRes.stderr, pullRes.code === 0 ? "stdout" : "stderr");
        if (pullRes.code !== 0) updateCode = pullRes.code;
      }
    }

    // Phase 3: Detect updated plugins and hot-reload them
    const afterHeads = await snapshotGitHeads();
    const updatedNames = [];
    for (const [name, afterSha] of afterHeads.entries()) {
      const beforeSha = beforeHeads.get(name);
      if (afterSha && beforeSha !== afterSha) {
        updatedNames.push(name);
      }
    }

    let selfReloading = false;
    let reloaded = [];
    if (updatedNames.length > 0) {
      sendLog(`\n[phase 3] 检测到 ${updatedNames.length} 个插件有更新 (${updatedNames.join(", ")})，开始热重载...\n`);
      const resReload = await hotReloadPlugins(updatedNames, (m) => sendLog(m));
      reloaded = resReload.reloaded;
      selfReloading = resReload.selfReload;
      if (selfReloading) {
        sendLog("[hot-reload] 检测到 Plugin Manager 自身已更新，将在 1 秒后自动重启刷新...\n");
      }
    } else {
      sendLog("\n[phase 3] 所有 Git 插件已是最新版本，无需热重载。\n");
    }

    sendEvent({ type: "done", code: updateCode, updated: updatedNames, reloaded, selfReloading });
    res.end();

    if (selfReloading) {
      setTimeout(() => process.exit(0), 350);
    }
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
