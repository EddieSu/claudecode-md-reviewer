#!/usr/bin/env node
"use strict";
// claudecode-md-reviewer CLI — cross-platform launcher.
//   md-reviewer <file.md>   ensure server, enqueue the file, open the reviewer
//   md-reviewer             open the reviewer with no file (paste a path in the bar)
// Logic mirrors the original review.ps1 but runs anywhere Node 18+ does.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const PORT = Number(process.env.MDR_PORT) || 8771;    // 與 server.cjs 一致；MDR_PORT 可改埠
const BASE = `http://127.0.0.1:${PORT}`;
const INFO = path.join(os.tmpdir(), "md-reviewer-server"+(PORT===8771?"":"-"+PORT)+".json");
const SERVER = path.join(__dirname, "..", "server.cjs");

function fail(msg) { process.stderr.write(`md-reviewer: ${msg}\n`); process.exit(1); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function ping() {
  try {
    const r = await fetch(`${BASE}/api/ping`, { signal: AbortSignal.timeout(1000) });
    return r.ok;
  } catch (_) { return false; }
}

// Start the server (detached, survives this process) only if one isn't already up.
// Returns true if we started it this invocation, false if we reused a running one.
async function ensureServer() {
  if (await ping()) return false;
  if (!fs.existsSync(SERVER)) fail(`server.cjs not found (broken install?): ${SERVER}`);
  const child = spawn(process.execPath, [SERVER], { detached: true, stdio: "ignore" });
  child.unref();
  for (let i = 0; i < 40; i++) { await sleep(200); if (await ping()) return true; }
  fail("server start timed out");
}

function readToken() {
  try { return JSON.parse(fs.readFileSync(INFO, "utf8")).token; }
  catch (_) { fail("could not read server token (temp info file missing?)"); }
}

async function enqueue(absPath, token) {
  try {
    const r = await fetch(`${BASE}/api/enqueue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: absPath, token }),
      signal: AbortSignal.timeout(3000),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      process.stderr.write(`md-reviewer: enqueue failed (${r.status}) ${t}\n`);
    }
  } catch (e) { process.stderr.write(`md-reviewer: enqueue failed: ${e.message}\n`); }
}

function printUrl(url) {
  process.stdout.write(`Open this URL in your browser to start reviewing:\n  ${url}\n`);
}

// Open the default browser per platform; on any failure, fall back to printing the URL.
function openBrowser(url) {
  const plat = process.platform;
  let cmd, args;
  if (plat === "win32") { cmd = "cmd"; args = ["/c", "start", "", url]; }
  else if (plat === "darwin") { cmd = "open"; args = [url]; }
  else { cmd = "xdg-open"; args = [url]; }
  try {
    const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
    child.on("error", () => printUrl(url));
    child.unref();
  } catch (_) { printUrl(url); }
}

function usage() {
  process.stdout.write(
    "claudecode-md-reviewer\n\n" +
    "Usage:\n" +
    "  md-reviewer <file.md>   ensure server, enqueue the file, open the reviewer\n" +
    "  md-reviewer             open the reviewer (paste a .md path in the bar)\n" +
    "  md-reviewer -h          show this help\n"
  );
}

(async function main() {
  const arg = process.argv[2];
  if (arg === "-h" || arg === "--help") { usage(); return; }

  let absPath = null;
  if (arg) {
    absPath = path.resolve(arg);
    if (!/\.md$/i.test(absPath)) fail(`not a .md file: ${arg}`);
    if (!fs.existsSync(absPath)) fail(`file not found: ${arg}`);
  }

  const started = await ensureServer();
  const token = readToken();
  if (absPath) await enqueue(absPath, token);

  // Open a tab when launching manually (no file), or when we just started the
  // server this invocation. If the server was already up, a reviewer tab is
  // already open and polling — only enqueue, don't spawn another tab.
  if (!absPath || started) {
    let url = `${BASE}/?token=${encodeURIComponent(token)}`;
    if (absPath) url += `&file=${encodeURIComponent(absPath)}`;
    openBrowser(url);
  } else {
    process.stdout.write(`Queued for review: ${absPath} (reviewer is already open; it will appear under "本次待審")\n`);
  }
})();
