## ADDED Requirements

### Requirement: Installable as an npm package
The package SHALL be installable and runnable through npm without manual file copying, supporting both one-off (`npx`) and global (`npm i -g`) usage. The published package name SHALL be `claudecode-md-reviewer`.

#### Scenario: Run via npx without prior install
- **WHEN** a user runs `npx claudecode-md-reviewer <path-to.md>` in a Node 18+ environment
- **THEN** the reviewer server starts (if not already running) and the default browser opens loaded with that file

#### Scenario: Global install exposes a command
- **WHEN** a user runs `npm install -g claudecode-md-reviewer` and then `md-reviewer <path-to.md>`
- **THEN** the command resolves from PATH and behaves identically to the npx invocation

### Requirement: Package ships only necessary files
The package SHALL declare an explicit `files` whitelist so that the published tarball contains the server, front-end assets, CLI, and `pins.example.json`, but excludes user data (`*.review.json` demos optional), local config, and history.

#### Scenario: Published tarball contents
- **WHEN** the package is packed (`npm pack`)
- **THEN** the tarball includes `server.cjs`, `reviewer.html`, `reviewer.css`, `reviewer.js`, `bin/`, `pins.example.json`, `README*`, and `LICENSE`
- **AND** it excludes `~/.md-reviewer/` data and any personal `pins.json`

### Requirement: Declared runtime contract
The package SHALL declare `engines.node` of `>=18` and SHALL have zero runtime npm dependencies (Node built-in modules only).

#### Scenario: Engine floor is enforced by npm
- **WHEN** a user on Node < 18 installs the package
- **THEN** npm emits an engine warning citing the `>=18` requirement

#### Scenario: No third-party runtime dependencies
- **WHEN** the package manifest is inspected
- **THEN** its `dependencies` field is empty (built-in modules only)

### Requirement: Versioning and changelog
The package SHALL follow semantic versioning starting at `0.1.0`, and SHALL maintain a `CHANGELOG.md` whose top entry matches the manifest version.

#### Scenario: Changelog matches manifest
- **WHEN** the package version is `0.1.0`
- **THEN** `CHANGELOG.md` contains a `0.1.0` entry describing the first standalone release
