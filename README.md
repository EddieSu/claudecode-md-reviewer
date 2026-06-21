# claudecode-md-reviewer

A local, zero-dependency **Markdown review loop**: an AI (or anyone) produces a
`.md`, you select text and annotate it in your browser, and the annotations are
saved next to the file so the author can read them back and continue.

> 繁體中文版說明見 [README.zh-Hant.md](./README.zh-Hant.md).

Built for the **Claude Code** workflow — "Claude writes a doc → you mark it up →
Claude reads your notes and revises" — but it works for any human-in-the-loop
Markdown review.

## Why it's not just a viewer

It runs a tiny **on-demand local server** (`server.cjs`) that reads and writes
files directly, so opening a document **loads it instantly, with zero
permission clicks, from any path**. Annotations are saved as a sibling
`*.review.json` file that the author (or your AI) can read directly. The server
binds `127.0.0.1` only, protects its API with a per-run token, and exits after
30 minutes idle — it is not a always-on daemon.

## Requirements

- **Node.js >= 18** on your PATH.
- A modern browser (Edge / Chrome / Firefox / Safari — plain HTTP + fetch).

## Install & run

```bash
# one-off, no install
npx claudecode-md-reviewer path/to/file.md

# or install globally, then use the `md-reviewer` command
npm install -g claudecode-md-reviewer
md-reviewer path/to/file.md

# open the reviewer with no file (paste a path in the bar)
md-reviewer
```

From a clone:

```bash
git clone https://github.com/EddieSu/claudecode-md-reviewer.git
cd claudecode-md-reviewer
node bin/md-reviewer.js DEMO.md   # or: npm run demo
```

The CLI ensures the local server is running (starting it in the background if
needed), enqueues your file, and opens the default browser. On a headless / WSL
/ SSH environment where no browser launcher exists, it prints the URL for you to
open manually.

## How to use

1. Run `md-reviewer <file.md>` (or double-click `open-reviewer.cmd` on Windows
   and paste a path). You can also click the **…** button next to the path input
   to open an in-app file browser and pick a `.md` file.
2. **Select text** in the article → an annotation box pops up → pick a color,
   write your comment → **Add** (or `Ctrl+Enter`).
3. Annotations auto-save to `<file>.review.json` in the same folder; the header
   shows "已自動儲存" (saved).
4. The author reads `<file>.review.json` and acts on each open annotation. Or
   click **📋 Copy for Claude** to copy unresolved notes as plain text and paste
   them straight back into your AI chat.

## Sidebar: queue, favorites, history, pinned docs

Toggle the left panel with **☰** and the right annotations panel with **💬**
(both states persist). Each row shows the filename, its `folder · project` tag,
an unresolved-annotation badge, and a ⭐ star to favorite it. The favorites /
history / pinned section headers collapse (history and pinned start collapsed).
Sections:

- **📥 Review queue** — documents pushed to you this session via the CLI.
  Cleared when the server restarts (= one session).
- **⭐ Favorites** — click the star on any row to bookmark a document. Favorites
  persist server-side in `~/.md-reviewer/favorites.json` (so they survive browser
  and machine changes) and are independent of pins.
- **🕘 History** — documents you've opened, most-recent first, up to 50,
  persisted across sessions in `~/.md-reviewer/history.json`.
- **📌 Pinned docs** — a whitelist of documents you always want one click away.

### Configuring pinned docs

Pins are read from `~/.md-reviewer/pins.json` if it exists, otherwise from the
bundled `pins.example.json` (which ships empty). To set your own:

```bash
# copy the example to your user config and edit it
mkdir -p ~/.md-reviewer
cp "$(npm root -g)/claudecode-md-reviewer/pins.example.json" ~/.md-reviewer/pins.json
```

```json
{
  "pins": [
    "~/notes/README.md",
    "~/Documents/specs"
  ]
}
```

Each entry is a single `.md` file or a directory (only its immediate `.md`
children are listed, non-recursive). A leading `~` expands to your home
directory. Each file is auto-tagged with the name of the nearest ancestor
containing `.git`, and you can filter the sidebar by project tag.

## Language

The interface ships in **English** and **Traditional Chinese**, with a language
selector in the header bar. On first run it auto-detects your browser language;
your choice is then remembered (`localStorage`).

**Add your own language** by dropping a single JSON file into
`~/.md-reviewer/locales/` — it appears in the selector automatically, with no
edit to the installed files:

```bash
mkdir -p ~/.md-reviewer/locales
cp "$(npm root -g)/claudecode-md-reviewer/locales/en.json" ~/.md-reviewer/locales/fr.json
# translate the values in fr.json; set "_name" to the display name, e.g. "Français"
```

Missing keys fall back to English, so a partial translation works. A user file
whose code matches a bundled locale overrides it.

## Best workflow: wire it into your AI

The loop shines when your AI drives it. There are two layers — set up the first,
add the second only if you want it.

### 1. The trigger instruction (the main mechanism)

The chain "AI produces a doc → reviewer opens" is driven by an **instruction**,
not magic. Add this to your `CLAUDE.md` / agent system prompt — the model decides
when a document is substantial enough to push:

> After producing a substantial `.md`, run
> `npx claudecode-md-reviewer "<absolute path to the md>"` so the user can
> annotate it. When the user says "continue from my review", read the sibling
> `<base>.review.json`, process every annotation with `status: "open"` using its
> `line` + `quote` to locate the text, and revise per the `comment`. Do not edit
> the `.review.json` yourself — report which items you handled and let the user
> mark them resolved.

Because the reviewer **polls every 4 seconds**, you only need it open once; later
pushes appear in the **📥 To review** list automatically.

### 2. Optional: a deterministic Claude Code hook

If you'd rather guarantee that **every** Markdown file written in a project gets
queued (regardless of whether the model remembers), install a `PostToolUse` hook:

```bash
# from your project root — writes ./.claude/settings.json (backs up if present)
npx claudecode-md-reviewer --hook
# or target a specific settings file:
npx claudecode-md-reviewer --hook /path/to/.claude/settings.json
```

This adds a hook that runs `scripts/hook-open.mjs` after a `Write`. The handler
**only enqueues when the reviewer is already running** — it never starts a server
or opens a browser on its own, so it stays silent during normal coding. Equivalent
manual config:

```json
{
  "hooks": {
    "PostToolUse": [
      { "matcher": "Write",
        "hooks": [ { "type": "command", "command": "node \"<path>/scripts/hook-open.mjs\"" } ] }
    ]
  }
}
```

Use the instruction (layer 1) for "review when it's worth it" and the hook
(layer 2) for "always queue these"; they compose fine.

### Annotation file format (`*.review.json`)

```json
{
  "file": "design.md",
  "schema": 1,
  "updatedAt": "2026-06-21T03:40:00.000Z",
  "annotations": [
    {
      "line": 42,
      "quote": "this logic is wrong",
      "comment": "check for null first",
      "color": "yellow",
      "status": "open",
      "id": "a...",
      "createdAt": "..."
    }
  ]
}
```

- `line` — 1-based line in the source `.md` (start of the block the text is in).
- `quote` — the selected text, so the author can locate it.
- `comment` — your review note.
- `status` — `open` (todo) or `resolved`.

## Architecture & security

- `server.cjs` — Node HTTP server, `listen('127.0.0.1', 8771)` only. Endpoints:
  `GET /api/file`, `POST /api/save`, `GET /api/sidebar`, `POST /api/enqueue`,
  `POST /api/dequeue`, `POST /api/favorite`, `GET /api/locales`, `GET /api/locale`,
  `GET /api/browse`, `GET /api/ping`.
- Front end split into `reviewer.html` + `reviewer.css` + `reviewer.js`
  (the latter two served from `/reviewer.css` and `/reviewer.js`, no token).
- **Token** — a random token generated at startup, written only to a temp file
  (`md-reviewer-server.json`) for the launcher; the browser reads it from the
  URL, and `/api/*` requires it, blocking forged requests from other local tabs.
- **Host check** — only accepts `Host: 127.0.0.1:8771` / `localhost:8771`,
  blocking DNS rebinding.
- **Idle shutdown** — exits after 30 minutes with no requests.

## Known limitations

- Requires Node.js on PATH. Port defaults to `8771`; set `MDR_PORT` to run on
  another port (e.g. a second instance alongside a running one).
- Highlighting is precise for a selected fragment; selecting **across** bold /
  links / multiple paragraphs falls back to highlighting the whole block (the
  line number stays correct, so annotating and locating are unaffected).
- Lightweight custom Markdown renderer — does **not** support: GFM tables without
  a leading `|`, escaped pipes `\|` inside tables, setext headings (`===`/`---`),
  ordered-list custom start numbers, or inline HTML. These are display-only
  differences and don't affect annotation locating. Supported: headings,
  emphasis, inline / fenced code, lists (nested, task), quotes, tables, rules,
  links, images, HTML comments, and **mermaid** diagrams (` ```mermaid `,
  rendered from a bundled offline build).

## License

[MIT](./LICENSE) © Eddie Su
