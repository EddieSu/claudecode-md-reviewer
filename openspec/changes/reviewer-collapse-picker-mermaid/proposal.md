## Why

Three more reviewer usability/capability gaps:

1. The left sidebar sections (favorites / history / pinned) are always fully
   expanded; with many entries the list gets long and the sections you care about
   scroll away.
2. Opening a file requires pasting an **absolute path** — there is no file picker.
   (Browsers cannot hand a web page a picked file's absolute path, and this tool's
   server reads/writes by absolute path, so a plain `<input type="file">` cannot
   work.)
3. ` ```mermaid ` code blocks render as raw code, not diagrams.

## What Changes

- **Collapsible sidebar sections**: the favorites / history / pinned section
  headers become toggles that collapse/expand their list, with per-section state
  persisted. **History and pinned default to collapsed**; favorites defaults to
  expanded. (Queue stays always-visible.)
- **File open browser**: add a `…` button next to the path input that opens an
  **in-app file browser** (a modal) to navigate folders and pick a `.md` by
  absolute path, which is then loaded. New token-protected `GET /api/browse`
  lists one directory level (subfolders + `.md`); on Windows the top level lists
  drives. (A native OS dialog was tried first but reverted — it is unreliable from
  a background server process on Windows; see design D2.)
- **Mermaid rendering**: ` ```mermaid ` fenced blocks render as diagrams using a
  **vendored** `mermaid` bundle (no external/CDN calls, works offline — consistent
  with the local-only design). The library is lazy-initialized only when a
  document actually contains a mermaid block; invalid diagrams fall back to the
  original code block.

## Capabilities

### New Capabilities
- `collapsible-sidebar-sections`: per-section collapse/expand in the left nav,
  persisted, with history + pinned collapsed by default.
- `native-file-open`: a `…` button that opens an in-app file browser (modal) to
  navigate and pick a `.md`, loaded by absolute path; `GET /api/browse` lists one
  directory level, with Windows drive roots at the top.
- `mermaid-rendering`: render mermaid fenced code blocks as diagrams from a
  vendored bundle, lazy-initialized, with fallback to code on error.

### Modified Capabilities
<!-- 無既有 main specs（前面 change 尚未 archive，openspec/specs/ 為空）。 -->

## Impact

- **Front end**: `reviewer.html` (`…` button, vendored mermaid asset reference),
  `reviewer.css` (collapse caret/affordance, mermaid container), `reviewer.js`
  (section collapse + persistence, `/api/pick` call, mermaid emit + lazy load).
- **Server**: `server.cjs` — new `GET /api/pick` (token-protected, per-platform
  native dialog), and a static route to serve the vendored `mermaid.min.js`.
- **Package**: add `vendor/` (mermaid bundle, ~2.7MB) to the `files` whitelist —
  package grows from ~28KB to ~2.7MB (the accepted trade-off for offline mermaid).
- **Persistence**: new `localStorage` keys for section collapse state.
- **Non-Goals**: no change to the annotation format, the local-only security
  model, or the i18n/favorites/right-collapse work from the previous change.
