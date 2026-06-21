#!/usr/bin/env node
// Claude Code PostToolUse hook handler for claudecode-md-reviewer.
//
// Reads the hook JSON from stdin; if a Markdown file was just written AND the
// reviewer server is already running, it enqueues that file into the review
// queue. It NEVER opens a browser and NEVER starts a server — so it stays silent
// during normal coding and only collects pushes when you already have the
// reviewer open. Install it with:  md-reviewer --hook
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PORT = Number(process.env.MDR_PORT) || 8771;
const BASE = `http://127.0.0.1:${PORT}`;
const INFO = path.join(os.tmpdir(), "md-reviewer-server" + (PORT === 8771 ? "" : "-" + PORT) + ".json");

function readStdin() {
  return new Promise((resolve) => {
    let d = "";
    process.stdin.on("data", (c) => (d += c));
    process.stdin.on("end", () => resolve(d));
    process.stdin.on("error", () => resolve(d));
    setTimeout(() => resolve(d), 2000); // safety: never hang the hook
  });
}

(async function main() {
  let payload = {};
  try { payload = JSON.parse(await readStdin()); } catch (_) { return; }
  const ti = payload.tool_input || payload.toolInput || {};
  const file = ti.file_path || ti.filePath || ti.path || "";
  if (!/\.md$/i.test(file)) return;                              // only Markdown
  if (/[\\/](node_modules|\.git)[\\/]/.test(file)) return;       // skip noise
  let abs;
  try { abs = path.resolve(file); } catch (_) { return; }
  if (!fs.existsSync(abs)) return;

  let info;
  try { info = JSON.parse(fs.readFileSync(INFO, "utf8")); } catch (_) { return; } // server not running → silent
  try {
    const ping = await fetch(`${BASE}/api/ping`, { signal: AbortSignal.timeout(800) });
    if (!ping.ok) return;
  } catch (_) { return; }                                        // can't reach → do nothing

  try {
    await fetch(`${BASE}/api/enqueue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: abs, token: info.token }),
      signal: AbortSignal.timeout(2000),
    });
  } catch (_) { /* best-effort */ }
})();
