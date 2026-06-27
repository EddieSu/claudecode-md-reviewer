## Context

The reviewer front-end is `reviewer.html` + `reviewer.css` + `reviewer.js`,
served by `server.cjs`. Current relevant facts (from the code):
- Layout: `#bar` (header) + `#main` → `#nav` (left, 264px, collapsible) ·
  `#doc` (article, flex:1) · `#side` (right, 340px, annotations, **not**
  collapsible).
- Left collapse: `#navToggle` toggles `.collapsed` (`#nav.collapsed{display:none}`),
  persisted as `localStorage["mdr-nav-collapsed"]`.
- Sidebar data comes from `GET /api/sidebar` → `{queue, history, pinned}`; rows
  render via `navItem(e, kind)` returning a `.navrow`. Pins read-only from
  `pins.json`.
- ~40–50 user-facing strings hardcoded in Chinese across HTML + JS; no i18n.
- Only `localStorage` key in use today: `mdr-nav-collapsed`.

This change adds three front-end capabilities. It is additive — no change to the
annotation model, Markdown renderer, or the local-only security model.

## Goals / Non-Goals

**Goals:**
- One-click, server-persisted favorites that survive browser/machine changes and
  coexist with read-only pins.
- A localization layer where **adding a language is dropping in one file** — no
  source edits.
- Right annotations panel collapses like the left nav, persisted.

**Non-Goals:**
- No change to `*.review.json`, the renderer, endpoints' security model.
- Not translating the README artifacts or OpenSpec docs (UI strings only).
- No server-side rendering / build step (stay plain static assets + Node).

## Decisions

**D1. Favorites = server file + toggle endpoint, parallel to pins**
- Storage `~/.md-reviewer/favorites.json`: `{ "favorites": [ { "path": "<abs>", "addedAt": "<iso>" } ] }`.
- `POST /api/favorite` `{ path, token, on }` → add/remove, write file, return ok.
- `GET /api/sidebar` gains a `favorites` array, each entry enriched like queue/
  history/pinned (`metaOf` + `annCounts`), newest first.
- Rationale: mirrors the existing `pins.json` / `history.json` user-config
  pattern (D3 of the previous change); the author/AI can read favorites too.
- Alternative: client `localStorage` favorites → rejected (per-browser, invisible
  to the author). Alternative: make pins UI-editable → rejected (clobbers a
  hand-curated config file; keep curated pins and one-click favorites separate).

**D2. i18n = JSON locale files, bundled + user dir, served by the API**
- Bundled locales ship in `locales/` as JSON: `locales/en.json`,
  `locales/zh-Hant.json` (identical key sets).
- **User locales** live in `~/.md-reviewer/locales/*.json` — drop a file there to
  add or override a language, no install edit.
- Server: `GET /api/locales` → merged list `[{code, name}]` (user dir wins on
  code clash); `GET /api/locale?code=<code>` → that locale's JSON (user dir
  precedence). `code` sanitized to `^[A-Za-z][A-Za-z0-9-]*$` to block path
  traversal. Locale JSON is **data, not code** (no `eval`/script injection).
- Client: `t(key)` looks up the active locale, falling back to `en`, then to the
  raw key. Static HTML uses `data-i18n` / `data-i18n-ph` / `data-i18n-title`
  attributes; `applyLocale()` walks them and re-runs the dynamic renderers.
- Selector: `<select id="lang">` in `#bar`, populated from `/api/locales`.
  Initial pick: `localStorage["mdr-lang"]` → else best match of
  `navigator.language` → else `en`. Changing it persists and calls
  `applyLocale()`.
- "Add a language" path (documented in README): copy `en.json` →
  `~/.md-reviewer/locales/<code>.json`, translate values, reload — it appears in
  the selector automatically.
- Alternative: hardcoded locale objects in `reviewer.js`, or `<script>` tags per
  locale in HTML → rejected (not user-extensible without editing source).

**D3. Right sidebar collapse mirrors the left**
- Add `#sideToggle` button in `#bar` (so it is reachable while `#side` is
  collapsed, exactly like `#navToggle`). Toggle `.collapsed` on `#side`
  (`#side.collapsed{display:none}`); `#doc` (flex:1) reflows to fill.
- Persist `localStorage["mdr-side-collapsed"]`; restore on init alongside the nav
  state. No new endpoint.

**D4. Star control hooks into `navItem`**
- `navItem(e, kind)` gains a ⭐ span (`data-act="fav"`, filled vs outline by
  whether `e.path` ∈ favorites set). Toggling POSTs `/api/favorite` then reloads
  the sidebar. A new `⭐ Favorites` section renders from `state.sb.favorites`.
- Render needs to know favorited paths → `renderSidebar()` builds a `Set` of
  favorite paths once and passes it down.

**D5. Packaging**
- Add `locales/` to `package.json` `files`. No new runtime dependency (JSON +
  built-in `fs`). Keeps zero-dependency invariant.

## Risks / Trade-offs

- Language switch must re-translate already-rendered DOM → `applyLocale()` updates
  tagged static nodes and re-invokes `renderSidebar()` / `renderSide()`; any
  string missed simply shows English (fallback), never a crash.
- Missing keys in a user-supplied locale → `t()` falls back to `en` then the key;
  partial translations are safe.
- `favorites.json` written from multiple tabs → last-write-wins (same model as
  pins/history). Acceptable for a single-user local tool.
- `/api/locale?code=` path traversal → mitigated by strict code sanitization +
  reading only from known dirs.
- Slight async startup cost (fetch locales before first paint) → render with a
  built-in default immediately, apply fetched locale when ready.

## Migration Plan

Additive, no breaking changes. New files (`locales/*.json`), new optional user
files (`~/.md-reviewer/favorites.json`, `~/.md-reviewer/locales/`), new
`localStorage` keys. Existing installs keep working with zh-Hant default until a
language is chosen. Rollback = revert the front-end + the `server.cjs` additions;
user files are inert if unused.

## Open Questions

- Default language when neither `mdr-lang` nor a `navigator.language` match
  exists → propose `en` (most portable). Confirm during review if zh-Hant should
  remain the hard default instead.
