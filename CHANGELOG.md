# Changelog

All notable changes to this project are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

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
