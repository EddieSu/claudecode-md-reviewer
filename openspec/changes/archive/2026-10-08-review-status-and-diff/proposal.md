## Why

The reviewer is used in a loop: a person annotates a document, the AI revises it,
and the person checks the revision. Three parts of that loop are missing today,
plus one reading convenience:

1. **No record of whether a document's review is finished.** The only signal is
   the unresolved-annotation count. A document with zero open annotations looks
   the same whether it was reviewed and approved or never opened. If the document
   changes after approval, nothing tells you that it needs another look.
2. **The user asked whether this record can be persistent and work across
   devices.** It can, if it is kept in the place that already travels with the
   document. Annotations already live in the `<name>.review.json` file (called the
   *sidecar*) next to the `.md`. When that folder is in git or a synced drive
   (OneDrive, Dropbox), the sidecar goes wherever the document goes. Data in
   `~/.md-reviewer/` (history, favorites, pins) stays on one machine, because it
   is keyed by absolute paths that differ between machines.
3. **After the document is revised, an annotation cannot show what changed.** An
   annotation stores only the quoted words and a line number. When the AI rewrites
   that sentence, the highlight disappears, and if lines were added above, it
   lands on the wrong paragraph. The reviewer cannot see "it said X, now it says
   Y", which is exactly what they need to decide whether to resolve the
   annotation.
4. **Long documents have no quick way back to the top.**

Making the sidecar the cross-device store also exposes an existing weakness: a
sidecar that cannot be parsed (for example, one with git merge-conflict markers)
is silently treated as empty, and the next save overwrites it. Cross-device use
makes that case common, so this change closes it.

## What Changes

- **Review-completion record (per document, latest state only).** A toolbar
  button marks the open document as *review complete*. The sidecar gets a new
  `review` field: `{ status: "done", at, hash }`, where `hash` is a fingerprint
  of the document text the reviewer was looking at. Displayed state is derived:
  - no record → not reviewed;
  - fingerprint matches the document → **complete**;
  - fingerprint differs → **changed since review** (needs another look).

  Rules that keep the record honest:
  - marking complete while annotations are unresolved asks for confirmation;
  - adding a new annotation to a completed document removes the record;
  - removing the record asks for confirmation;
  - marking complete is refused if the file on disk is newer than the version on
    screen (reload first);
  - marking complete also takes the document out of "📥 To review".

  Rows in the left list show a small **Reviewed** / **Changed** label. There is no
  separate overview screen.
- **Persistent and cross-device, by storing it in the sidecar.** No new storage
  location and no sync service. The fingerprint ignores line-ending, BOM and
  trailing-space differences, so the same file checked out on Windows and macOS
  gives the same result. The README gets a "Cross-device" section: keep
  `*.review.json` in git or the synced folder (and how to check it is not
  ignored), move it together with the `.md`, what does and does not travel, how
  synced drives behave, privacy, and that every device must run ≥ 0.6.0.
- **Safe sidecar writes.**
  - A sidecar that exists but cannot be parsed is never overwritten; the page
    says so and disables saving until the file is fixed.
  - Saving keeps every sidecar field it does not manage (including `review`).
  - A save from a tab whose copy is out of date is refused, with a prompt to
    reload, instead of overwriting changes made on another device or tab.
- **Old/new difference in the annotation card.** Each new annotation also saves
  `context`: the Markdown source of its paragraph (block), plus the first line of
  the block before and after it. When a document is opened, each annotation is
  matched to the current text:
  - the same paragraph still exists → nothing changes (the line number follows
    the paragraph if it moved);
  - the paragraph was edited → the card shows **"✎ Original text changed"** with a
    line-then-word difference (removed text struck through, added text
    highlighted), and the highlight and "Go to" follow the new paragraph;
  - the paragraph is gone → the card shows the old text, says it was removed, and
    the annotation is no longer highlighted.

  The page also notices when the open file changes on disk and offers a reload,
  so the difference shows up without guessing when to press ↻.
- **Older annotations are handled conservatively.** Annotations made before this
  change have no `context`. They are located by their quote as today. If the
  quote cannot be found, they keep today's behaviour (block highlight, "Go to"
  works) and are labelled "original may have changed". A `context` is filled in
  for them only when the quote identifies one paragraph unambiguously.
- **Existing line-number bug fixed.** Text that follows an HTML comment on the
  same line (`<!-- x --> text`) currently shifts every later line number by one.
  Correct line numbers are now a prerequisite, so this is fixed here.
- **Back-to-top button** in the reading pane. It appears after the reader scrolls
  down one screen and scrolls the document back to the top.
- **AI-facing instructions** in the README explain the two new fields: `context`
  is a snapshot of the original text (not a target to restore), and `review` is
  set only by the human reviewer.

## Capabilities

### New Capabilities
- `review-status`: marking a document as review complete, the fingerprint and
  "changed since review" detection, the record's rules (confirmations,
  auto-removal, refusal when on-disk is newer), and showing status in the toolbar
  and the left list.
- `annotation-revision-diff`: saving each annotation's block context, matching
  annotations to the current document on open (same / changed / gone, plus the
  conservative path for older annotations), the old/new difference in cards, the
  "file changed on disk" notice, and accurate block line ranges.
- `sidecar-integrity`: never overwriting an unreadable sidecar, preserving
  unmanaged fields, and refusing out-of-date writes.
- `back-to-top`: a button in the reading pane that returns to the top.

### Modified Capabilities
- `packaging-distribution`: the published file list gains `reviewer-diff.js`.
- `favorites`: correct the persistence wording. Favorites survive browser
  restarts and switching browsers on the same machine; they are not shared
  across machines (they never were).

## Impact

- **Front end**: `reviewer.html`, `reviewer.css`, `reviewer.js` (status button,
  notice bar, list labels, card difference, back-to-top, block ranges, save
  path). New file `reviewer-diff.js` with the pure functions (text
  normalization, block matching, difference), shared by the browser and the
  server and testable with plain Node.
- **Server**: `server.cjs`:
  - `/api/file` also returns the fingerprint, the `review` record, the sidecar's
    `updatedAt`, and an "unreadable sidecar" flag.
  - `/api/save` keeps unmanaged fields and refuses unreadable or out-of-date
    writes.
  - New `POST /api/review` marks or unmarks complete.
  - `/api/sidebar` rows carry the review status, and it reports whether the open
    file changed.
  - The new static file is served.
- **i18n**: new keys in `locales/en.json` and `locales/zh-Hant.json` (same key
  set in both).
- **Sidecar format**: new optional fields, top-level `review` and per-annotation
  `context`. `schema` stays `1`.
- **Package / docs**:
  - `package.json`: `files`, version `0.6.0`, `test` script.
  - README (EN + zh-Hant): sidecar format, review status, changed-text cards, the
    Cross-device section, AI instructions; fix the claim that favorites travel
    across machines.
  - CHANGELOG.
- **Tests**: `test/diff.test.cjs`, run with `npm test`.
- **Follow-up outside this repo**: the global `md-reviewer` skill in the
  `claude-config` repo gets the same two-sentence AI note, in a separate PR after
  this change ships.
- **Non-goals**:
  - syncing `~/.md-reviewer/` across machines;
  - a log of every past review round (only the latest record is kept);
  - an overview screen of unreviewed documents;
  - live re-rendering of the open document (a notice plus ↻ reload is enough).

---
🤖 claude-opus-5-5[1m] · effort: xhigh · 2026-10-08
