## Context

Builds on the reviewer front-end (`reviewer.html/css/js` + `server.cjs`). Relevant
current facts:
- Left nav sections are static `.navsec` blocks: `.navsec-h` (header) + a
  `.navsec-list` (`#favList` / `#hList` / `#pList` / `#qList`), rendered by
  `renderSidebar()`.
- Markdown is rendered by a custom `renderMarkdown()`; fenced code becomes
  `<pre data-line><code>…</code></pre>`. `renderDoc()` calls it then
  `applyHighlights()`.
- Static assets (`reviewer.css/js`) are served from same-name routes, no token.
- The CLI/launcher and `server.cjs` already share platform branching elsewhere.
- Zero runtime npm dependencies; assets are vendored and served locally.

## Goals / Non-Goals

**Goals:**
- Tidy long sidebars via collapsible sections with sensible defaults + memory.
- A real "open a window to pick a .md" that yields an absolute path the server
  can use, cross-platform with Windows first-class.
- Render mermaid diagrams offline, without breaking the zero-CDN / local-only
  posture.

**Non-Goals:**
- No change to annotation format, security model, or prior change's features.
- Not building an in-app filesystem browser (native dialog chosen instead).
- Not supporting every diagram tool — mermaid only.

## Decisions

**D1. Collapsible sections via a class toggle + per-section persistence**
- Wrap each collapsible section's header as a clickable toggle with a caret
  (▾ expanded / ▸ collapsed). Toggling adds `.collapsed` to the `.navsec`;
  CSS `.navsec.collapsed .navsec-list{display:none}`.
- Persist each in `localStorage`: `mdr-sec-fav`, `mdr-sec-hist`, `mdr-sec-pin`
  (`"1"` = collapsed). Defaults when unset: **hist + pin collapsed**, fav expanded.
- Apply collapse to favorites / history / pinned. Queue stays always-visible
  (it is the primary push target and usually short).
- Alternative: collapse via height animation → deferred (display toggle is simplest
  and flicker-free).

**D2. In-app file browser via `GET /api/browse`**
- Endpoint (token-protected) lists one directory level: `{ ok, dir, parent,
  entries:[{name,path,isDir}] }`. `dir` defaults to the user's home; `dir=::drives`
  (Windows) returns the available drive roots; `parent` is the up-target (or
  `::drives` at a Windows drive root, `null` at a POSIX root). Hidden entries are
  skipped; only subfolders and `.md` files are returned.
- The reviewer `…` button opens a modal that calls `/api/browse`, renders folders
  + `.md` files with a `..` row, navigates on folder click, and on a file click
  sets the path input and `loadFile()`s it. Closes on ✕ / backdrop / Esc.
- **Why not a native OS dialog** (the first approach, reverted): showing a native
  dialog from the background/no-console server process proved unreliable on Windows
  — `windowsHide` builds the dialog hidden (SW_HIDE) so `ShowDialog` hangs; without
  it the background process can't take foreground (foreground lock); and forcing it
  via `GetForegroundWindow`/`SetForegroundWindow` P/Invoke is blocked by AMSI as
  "malicious content". The in-app browser sidesteps all three and is cross-platform.
- Alternative: `<input type=file>` → impossible (browsers never expose the absolute
  path the server needs).

**D3. Mermaid: vendored bundle, lazy-initialized**
- Vendor `vendor/mermaid.min.js` (a self-contained build exposing global
  `mermaid`); server serves it at `/vendor/mermaid.min.js` (static, no token, like
  the other assets). Added to `package.json` `files`.
- `renderMarkdown()`: a fence whose info string is `mermaid` emits
  `<div class="mermaid" data-line="N"><!-- raw code --></div>` (raw mermaid source
  as text content) instead of `<pre><code>`.
- After `renderDoc()`, if any `.mermaid` node exists: lazy-load the vendored script
  once (inject `<script>` if `window.mermaid` is undefined), `mermaid.initialize({
  startOnLoad:false, securityLevel:"strict", theme: <dark?"dark":"default"> })`,
  then `mermaid.run({ nodes })`. Wrap per-diagram so a parse error falls back to
  rendering that block as a `<pre><code>` instead of breaking the page.
- Theme follows `prefers-color-scheme` to match the app.
- Rationale: vendored = offline + no external calls (user-selected, consistent with
  127.0.0.1-only design). Lazy-load avoids parsing ~2.7MB when a doc has no mermaid.
- Alternative: CDN lazy-load → rejected by the user (privacy/offline).

## Risks / Trade-offs

- Native dialog spawned from a hidden server may open behind the browser window →
  document it; user alt-tabs. STA/2>nul handled so it never hangs the request.
- `/api/pick` blocks its request until the user picks/cancels → fine for a
  single-user local tool; client shows a pending state and ignores double-clicks.
- Vendored mermaid grows the package ~100× (28KB → ~2.7MB) → accepted trade-off,
  noted in README/CHANGELOG.
- Mermaid version pinned at vendor time; updates are manual (re-vendor). Acceptable.
- Annotating inside a rendered SVG diagram is impractical; block-level line
  targeting (`data-line`) still works for locating. Minor.

## Migration Plan

Additive, backward-compatible. New endpoint, new static asset, new localStorage
keys. Existing installs unaffected until used. Rollback = revert the three
front-end files + the `server.cjs` additions + remove `vendor/`.

## Open Questions

- Exact vendored mermaid version → pick a current stable build that exposes a
  global `mermaid` via plain `<script>` (verify at vendor time); pin it and record
  the version in CHANGELOG.
