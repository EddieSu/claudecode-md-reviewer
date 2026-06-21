# Changelog

All notable changes to this project are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

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
