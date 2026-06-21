# OpenSpec workspace — claudecode-md-reviewer

This directory holds the **specifications** for this project. `claudecode-md-reviewer`
was built **spec-first**: the requirements were written, reviewed, and frozen
*before* the implementation — using [OpenSpec](https://github.com/Fission-AI/OpenSpec),
a lightweight spec-driven workflow.

If you want to understand *what the tool does and why it is shaped the way it is*,
this is the place to read. For installation and usage, see the
[project README](../README.md) ([繁體中文](../README.zh-Hant.md)).

## What the tool is (in one paragraph)

A local, zero-dependency **Markdown review loop**: an AI (or a person) produces a
`.md`, a reviewer selects text and annotates it in the browser, and the
annotations are saved next to the file (`*.review.json`) so the author can read
them back and revise. It runs an on-demand local server bound to `127.0.0.1`
(token-protected, idle-exits) and ships a cross-platform CLI so it installs and
runs the same on Windows, macOS, and Linux.

## How these specs came to be

The tool already existed as an embedded, Windows-only internal utility. Turning
it into a public, installable package was driven through a single OpenSpec
**change**, authored as four artifacts in dependency order:

| Artifact | Question it answers | Link |
| --- | --- | --- |
| **proposal** | *Why* the change, *what* changes, which capabilities | [proposal.md](./changes/extract-md-reviewer-standalone/proposal.md) |
| **design** | *How* — key technical decisions, trade-offs, migration plan | [design.md](./changes/extract-md-reviewer-standalone/design.md) |
| **specs** | *What the system must do* — testable requirements per capability | [specs/](./changes/extract-md-reviewer-standalone/specs/) |
| **tasks** | The implementation checklist derived from the specs | [tasks.md](./changes/extract-md-reviewer-standalone/tasks.md) |

Each artifact unlocks the next: the proposal fixes the *why* and the capability
list; design and specs build on it; tasks are derived from both. The whole change
is validated (`openspec validate --strict`) before any code is written — that is
the "spec-first gate".

> The artifacts are authored in Traditional Chinese (the author's working
> language); this overview is in English to match the public-facing README.

## Capabilities (the specs)

The change introduces three capability specs. Each requirement is written with
SHALL/MUST and at least one WHEN/THEN scenario, so every scenario reads as a
test case:

- [`packaging-distribution`](./changes/extract-md-reviewer-standalone/specs/packaging-distribution/spec.md)
  — installable via `npx` / `npm i -g`, `files` whitelist, `engines.node >= 18`,
  zero runtime dependencies, semantic versioning.
- [`cross-platform-cli`](./changes/extract-md-reviewer-standalone/specs/cross-platform-cli/spec.md)
  — the CLI ensures the local server, enqueues the target file, opens the browser
  per-OS (with a URL fallback), and preserves single-tab push semantics.
- [`user-configuration`](./changes/extract-md-reviewer-standalone/specs/user-configuration/spec.md)
  — pins resolve from `~/.md-reviewer/pins.json` with a bundled example fallback;
  history and pins live in the user's home directory, never the install dir.

## The change

- **[extract-md-reviewer-standalone](./changes/extract-md-reviewer-standalone/)**
  — extract the embedded tool into this standalone repo, make it a cross-platform
  npm package, and de-personalize its configuration.

Once a change is implemented and archived, its delta specs are merged into
`openspec/specs/` as the project's living specification, and the change folder
moves to `openspec/changes/archive/`.

## Working with OpenSpec

This repo was initialized with `openspec init`. If you use Claude Code, the
`/opsx:*` slash commands (new / continue / apply / verify / archive) drive the
workflow. Learn more at the [OpenSpec project](https://github.com/Fission-AI/OpenSpec).
