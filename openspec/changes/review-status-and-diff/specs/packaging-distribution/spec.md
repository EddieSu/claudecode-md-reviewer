## MODIFIED Requirements

### Requirement: Package ships only necessary files
The package SHALL declare an explicit `files` whitelist so that the published tarball contains the server, front-end assets, CLI, and `pins.example.json`, but excludes user data (`*.review.json` demos optional), local config, and history.

#### Scenario: Published tarball contents
- **WHEN** the package is packed (`npm pack`)
- **THEN** the tarball includes `server.cjs`, `reviewer.html`, `reviewer.css`, `reviewer.js`, `reviewer-diff.js`, `bin/`, `pins.example.json`, `README*`, and `LICENSE`
- **AND** it excludes `~/.md-reviewer/` data and any personal `pins.json`

---
🤖 claude-opus-5-5[1m] · effort: xhigh · 2026-10-08
