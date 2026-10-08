# Changelog

All notable changes to this project are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

## [0.6.0] - 2026-10-08

### Added
- **Review-complete record per document.** A header button marks the open
  document as review complete. The record (time + a SHA-256 fingerprint of the
  text that was on screen) is stored in the document's `.review.json` as a new
  `review` field, so it is persistent and travels with the document through git
  or a synced folder. If the text changes afterwards, the document shows as
  **changed since review** (header button and a **Changed** label in the left
  list; **Reviewed** when it still matches). Marking with unresolved annotations
  asks first, adding a new annotation removes the record, marking takes the
  document out of "To review", and marking is refused when the file on disk is
  newer than the page. Line endings, BOM and trailing spaces are ignored, so
  Windows and macOS checkouts agree. New endpoint `POST /api/review`.
- **Old/new difference in annotation cards.** New annotations remember the
  Markdown source of their paragraph and its neighbours (`context`). When the
  document is revised, each card shows whether the paragraph is unchanged (the
  highlight follows it if it moved), **changed** (word-level difference, removed
  text struck through and added text highlighted), or **removed** (old text shown,
  no highlight). The page notices when the open file changes on disk and offers a
  reload. "Copy for Claude" marks changed/removed annotations.
- **Back-to-top button** in the bottom-right of the reading pane, shown after
  scrolling down one screen.
- `npm test` runs `test/diff.test.cjs` (matching and difference checks).

### Fixed
- **Line numbers after an inline HTML comment.** Text following `<!-- ... -->` on
  the same line shifted every later block's line number by one, so highlights,
  "Go to" and the `line` written to `.review.json` were off. Fixed.
- **A `.review.json` that cannot be parsed is no longer overwritten.** It used to
  be treated as empty and replaced on the next save (for example after a git
  merge conflict). Now the page shows a notice and stops saving until it is fixed.
- **Saves from an out-of-date tab no longer overwrite newer annotations** made in
  another tab or on another device; the save is refused with a prompt to reload.
  Saving also keeps sidecar fields it does not manage.
- README no longer claims favorites follow you across machines; they live in
  `~/.md-reviewer/` on each machine.

### Notes
- Backward compatible: old `.review.json` files load unchanged (`schema` stays
  `1`). Annotations created before 0.6.0 have no `context`; they are located by
  their quote as before and are labelled "original may have changed" when the
  quote is gone, so the old/new difference is available only for annotations
  created with 0.6.0 or later.
- Use 0.6.0 or later on every device that edits the same `.review.json`: 0.5.x
  rewrites the file from its own fields and drops the `review` record.

## [0.5.1] - 2026-10-01

### Fixed
- **Broken mermaid diagrams no longer leave a "Syntax error" bomb at the bottom of
  the page.** mermaid 10.x keeps its error diagram in a temporary `#d<id>` node
  appended to `<body>` when parsing fails; the reviewer already fell back to
  showing the source as a code block, but never removed that node, so one bomb
  per broken diagram piled up below the document. The failed-render path now
  removes it. (#1)

## [0.5.0] - 2026-06-27

### Added
- **Mermaid diagram lightbox**: large flowcharts are no longer cramped inside the
  document column. Hovering a rendered diagram reveals a `⛶` button (double-click
  the diagram works too) that opens it in a near-fullscreen modal. The modal
  **auto-fits** the whole diagram on open, then supports **zoom** (mouse wheel,
  centered on the cursor, plus `＋ / −` buttons), **pan** (click-and-drag), a
  **fit-to-screen reset** (`⟲`), and close via `✕`, backdrop `Esc`. The backdrop is
  opaque and theme-aware (light/dark). New i18n keys `mermaid.*` (English +
  Traditional Chinese); missing keys fall back to English.

### Notes
- Additive and backward-compatible: no change to the annotation `*.review.json`
  format, the Markdown renderer, or the local-only security model. The lightbox is
  pure client-side (no new endpoints, no network calls) and reuses the vendored
  offline mermaid build.

## [0.4.0] - 2026-06-21

### Added
- **AI integration guide + setup script**. The README now documents the two-layer
  workflow: (1) a trigger instruction for your `CLAUDE.md` / agent prompt — the
  main mechanism — and (2) an optional deterministic Claude Code `PostToolUse`
  hook.
- `md-reviewer --hook [settings.json]` installs that hook (merges into
  `./.claude/settings.json` by default, with a backup), pointing at the new
  `scripts/hook-open.mjs` handler. The handler **only enqueues a written `.md`
  when the reviewer is already running** — it never starts a server or opens a
  browser, so it stays silent during normal coding.

## [0.3.0] - 2026-06-21

### Added
- **Collapsible sidebar sections**: the favorites / history / pinned section
  headers now collapse and expand, with per-section state persisted. History and
  pinned start collapsed by default.
- **File browser**: a `…` button next to the path input opens an in-app file
  browser (modal) to navigate folders and pick a `.md` by absolute path (new
  token-protected `GET /api/browse`). Cross-platform; on Windows the top level
  lists drives.
- **Mermaid diagrams**: ` ```mermaid ` blocks render as diagrams via a **vendored**
  mermaid build (`mermaid@10.9.6`) served locally — no external/CDN calls, works
  offline. The library is loaded only when a document contains a mermaid block;
  invalid diagrams fall back to a code block.

### Changed
- Package now bundles `vendor/mermaid.min.js`, increasing the published size to
  ~2.8 MB (the accepted trade-off for offline, no-CDN mermaid rendering).

### Notes
- Additive and backward-compatible: no change to the annotation `*.review.json`
  format or the local-only security model.

## [0.2.0] - 2026-06-21

### Added
- **Favorites**: click the ⭐ star on any sidebar row to bookmark a document.
  Favorites persist server-side in `~/.md-reviewer/favorites.json` (new
  token-protected `POST /api/favorite`; `/api/sidebar` gains a `favorites` field)
  and are independent of the read-only pinned docs.
- **Internationalization**: the whole UI is localized through a JSON locale
  layer. Ships English + Traditional Chinese with a header language selector
  (browser auto-detect on first run, choice remembered). **Add a language by
  dropping one JSON file into `~/.md-reviewer/locales/`** — it appears in the
  selector automatically (new `GET /api/locales` and `GET /api/locale`); missing
  keys fall back to English.
- **Collapsible right panel**: the annotations panel now collapses via 💬,
  mirroring the left list, with the state persisted (`mdr-side-collapsed`).

### Notes
- Additive and backward-compatible: no change to the annotation `*.review.json`
  format, the Markdown renderer, or the local-only security model.

## [0.1.0] - 2026-06-21

First standalone release, extracted from an embedded internal tool into a
public, cross-platform, npm-installable package.

### Added
- **Cross-platform CLI** `md-reviewer <file.md>`: ensures the local server is
  running, enqueues the file, and opens the default browser on Windows / macOS /
  Linux. Falls back to printing the URL when no browser launcher is available
  (headless / WSL / SSH).
- **npm packaging**: installable via `npx claudecode-md-reviewer <file>` or
  `npm i -g claudecode-md-reviewer`. Zero runtime dependencies; requires Node >= 18.
- **User-writable configuration**: pinned documents are read from
  `~/.md-reviewer/pins.json` when present, otherwise from the bundled
  `pins.example.json` (which ships empty — no preconfigured personal pins).
- MIT license; bilingual README (English + 繁體中文).

### Notes
- The core review engine, the `*.review.json` annotation format, and the
  local-only security model (binds `127.0.0.1`, token-protected `/api/*`, Host
  check against DNS rebinding, 30-minute idle shutdown) are carried over
  unchanged from the original tool.
