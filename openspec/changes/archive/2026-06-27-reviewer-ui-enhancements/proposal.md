## Why

Three usability gaps in the reviewer front-end:

1. There is no quick way to bookmark a document you return to often. The 📌
   pinned section is **read-only** (curated by editing `pins.json` by hand) — you
   cannot star a document from the UI.
2. The interface is **hardcoded in Traditional Chinese** (~40–50 strings across
   HTML/JS) with no i18n mechanism, so non-Chinese users are locked out.
3. The right annotations panel (`#side`, 340px) **cannot be collapsed**, unlike
   the left nav (`#nav`) — on narrow screens it permanently eats reading width.

## What Changes

- **Star favorites (server-side)**: add a ⭐ toggle on every sidebar row to
  favorite/unfavorite a document. Favorites persist to a new user-writable
  `~/.md-reviewer/favorites.json` (consistent with `pins.json` / `history.json`)
  and surface in a new **⭐ 收藏 / Favorites** section. Coexists with 📌 pins
  (pins stay config-curated; favorites are one-click UI). New server endpoints
  `GET`/`POST /api/favorite` (token-protected); `/api/sidebar` gains a
  `favorites` field.
- **Internationalization framework**: extract all user-facing strings into a
  locale dictionary, add a language selector (auto-detect browser language on
  first load, manual override persisted in `localStorage` `mdr-lang`). Ship
  **Traditional Chinese + English**. **Designed so a user can add a new language
  by dropping in one locale file** — the selector lists whatever locales exist.
- **Collapsible right sidebar**: make `#side` collapsible mirroring the existing
  `#nav` pattern (toggle button + `.collapsed` class + `localStorage`
  `mdr-side-collapsed`); the article reflows to fill the freed width.

## Capabilities

### New Capabilities
- `favorites`: server-persisted, UI-driven document favorites — star toggle on
  rows, a dedicated favorites section, `favorites.json` storage, and the
  `/api/favorite` endpoints. Distinct from read-only pins.
- `ui-i18n`: an extensible localization framework — string externalization, a
  `t(key)` lookup, a language selector with persistence and browser auto-detect,
  shipping zh-Hant + en, and a documented one-file path to add a locale.
- `collapsible-right-sidebar`: the right annotations panel can be collapsed and
  expanded, with the state persisted across sessions.

### Modified Capabilities
<!-- 無既有 main specs（前一個 change 尚未 archive，openspec/specs/ 為空）。
     favorites 的儲存與 pins/history 同屬 ~/.md-reviewer/ user-config 慣例，但以新 capability 表述。 -->

## Impact

- **Front end**: `reviewer.html`, `reviewer.css`, `reviewer.js` — new ⭐ controls
  + favorites section, a locale layer wrapping all strings, a language selector,
  and a right-sidebar collapse toggle. New locale files (e.g. `locales/zh-Hant.js`,
  `locales/en.js`) added to the package `files` whitelist.
- **Server**: `server.cjs` — new `GET`/`POST /api/favorite` (token-protected),
  `favorites.json` read/write under `~/.md-reviewer/`, and a `favorites` field on
  `/api/sidebar`. Other endpoints / token / Host / idle logic unchanged.
- **Docs**: README (EN + zh-Hant) gains Favorites, Language, and "adding a
  locale" sections; CHANGELOG entry.
- **Persistence**: new `localStorage` keys `mdr-lang`, `mdr-side-collapsed`; new
  user file `~/.md-reviewer/favorites.json`.
- **Non-Goals**: no change to the annotation model / `*.review.json` format, the
  Markdown renderer, or the local-only security model.
