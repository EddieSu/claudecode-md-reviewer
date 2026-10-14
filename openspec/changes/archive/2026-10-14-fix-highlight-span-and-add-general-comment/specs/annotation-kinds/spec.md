## MODIFIED Requirements

### Requirement: Kind is recognizable without color
Every place that shows an annotation's kind SHALL show the kind's symbol together with its color, and SHALL show the kind's name wherever there is room for text, so any two kinds can be told apart without relying on color.

- **Highlights**: each `<mark>` SHALL have the class `anno k-<kindOf(a)>`. The first
  `<mark>` of a highlight in each block SHALL also have a `data-sym` attribute holding
  the symbol from `KINDS` (never from the sidecar), as defined by
  `quote-highlighting`. A CSS `::before` on marks with `data-sym` SHALL draw a small
  round badge there, filled with the kind's dot color and showing the symbol. Because
  the badge is generated content, it SHALL NOT be selectable, SHALL NOT be copied and
  SHALL NOT affect quote matching. A resolved highlight SHALL be faded and SHALL NOT
  have a line-through, so a long resolved highlight does not strike out whole
  paragraphs and does not strike out unresolved highlights nested inside it.
- **Kind picker and the card's kind menu**: the same badge followed by the kind name.
- **Highlight tooltip**: "【<kind name>】<comment>", or "【<kind name>】" when the
  comment is empty. After a language switch the highlights SHALL be re-applied so the
  tooltips show the new language.
- **Cards**: the card's comment line SHALL be omitted when the comment is empty.
- **Whole-block marks**: when a quote cannot be found (for example the quoted text was
  later removed from the document, or the annotation is on a diagram, see
  `quote-highlighting`) and the block is marked with a line on its left instead, the
  page SHALL record that annotation's id in an id-keyed set in page
  state (`state.blockHl`), not on the annotation. A card whose kind is `delete-text`
  and whose id is in that set SHALL show, under its quote, "Only the quoted text above
  is to be deleted. It can't be marked exactly in the article, so the whole block is
  marked with a line on the left." / 「只刪除上面引用的文字；文章裡無法精確標出，所以整段以左側線條標示」.
  The quote itself SHALL still be shown in full.

Under Chrome DevTools' vision-deficiency emulation (protanopia, deuteranopia,
tritanopia and achromatopsia), any two of the eight kinds SHALL be distinguishable —
by color or by symbol — in the highlights, the kind picker and the cards.

#### Scenario: Badge is not copied
- **WHEN** the user selects and copies text that starts inside a highlight
- **THEN** the copied text does not contain the badge symbol

#### Scenario: Quote matching unaffected
- **WHEN** a document with highlights is reloaded
- **THEN** every highlight wraps exactly its quote, as without badges

#### Scenario: Tooltip with an empty comment
- **WHEN** the user hovers over a "Delete this text" highlight whose comment is empty
- **THEN** the tooltip reads "【Delete this text】" / 「【刪除這些字】」

#### Scenario: Tooltip follows the language
- **WHEN** the user switches the interface language while a document with annotations is open
- **THEN** hovering a highlight shows the kind name in the new language

#### Scenario: Resolved highlight is not struck out
- **WHEN** an annotation spanning two paragraphs is resolved
- **THEN** the text of both paragraphs is shown faded and without a line-through

#### Scenario: Delete this text on a whole-block mark
- **WHEN** a "Delete this text" annotation's quote is no longer found in its block, so the block is marked with a left line
- **THEN** its card shows the note that only the quoted text is to be deleted, and the annotation object has no new field

#### Scenario: Achromatopsia emulation
- **WHEN** the eight kinds are shown side by side under achromatopsia emulation
- **THEN** each kind can still be identified by its badge symbol and, on cards and in the picker, its name

### Requirement: Copy for Claude carries kinds
The "📋 Copy for Claude" text SHALL label every annotation with its kind name, placed after the line number and before the quote, and SHALL explain the kinds it uses.
The text SHALL be built as follows:

1. The existing header and summary line; the summary's open count SHALL be the number
   of to-do annotations (see "Agree annotations are not to-dos"). When the "Other
   comments" text (see `general-comment`) is not blank, the summary line SHALL end
   with 「，另有其它意見」 / ", plus other comments".
2. When the "Other comments" text is not blank, a section headed 「其它意見：」 /
   "Other comments:" followed by the text with leading and trailing whitespace
   removed, and an empty line. Otherwise this section SHALL be omitted.
3. A kind explanation section, headed 「分類說明（每則若另有意見，以意見補充的條件為準）：」 /
   "How to handle each kind (where an annotation also has a comment, the conditions in
   the comment take precedence):", with one line `- <kind name>：<handling text>` for
   each kind used by the numbered items, in the order each kind first appears among
   them. The text SHALL come from the locale's `kind.<value>.how` in the interface
   language. The section SHALL be omitted when every numbered item is "See comment" or
   there are no numbered items.
4. The numbered items: every to-do annotation, sorted by line, each as
   `[<n>] L<line>【<kind name>】「<quote>」<match-state marker>` followed by a line
   `→ <comment>`; the `→` line SHALL be omitted when the comment is empty. The first
   line of each item SHALL still end with the match-state marker required by
   `annotation-revision-diff`.
5. When there are unresolved "Agree" annotations, an unnumbered section titled
   「（同意，不必處理）」 / "(agree — no action needed)", with one line
   `- L<line>「<quote>」<match-state marker>→ <comment>` each.
6. The resolved section as before, with each line
   `- L<line>【<kind name>】「<quote>」<match-state marker>→ <comment>`.

In list lines (steps 5 and 6), the `→ <comment>` part SHALL be omitted when the
comment is empty. When there are no annotations and the "Other comments" text is
blank, pressing the button SHALL show 「還沒有任何註解或其它意見」 / "No annotations or
other comments yet" and copy nothing; when there are no annotations but the "Other
comments" text is not blank, the text SHALL be copied. The button's tooltip SHALL say
that it copies the unresolved annotations and the other comments.

Example (Traditional Chinese interface, handling texts shortened here):

```text
# 審閱回饋：design.md
共 6 則（未解決 4）

分類說明（每則若另有意見，以意見補充的條件為準）：
- 請展開解釋：這段寫得太簡略，讀者看不懂。在文件裡把這段補寫清楚……
- 刪除這些字：刪掉引用的文字（只刪引文，不是整段），再調整前後語句……
- 第一性原理重新評估：這個做法的前提可能錯了。回到它要解決的問題重新推導……
- 見說明：照意見文字處理。意見可能是修改要求、提問或補充資訊……

[1] L12【請展開解釋】「API 逾時設 30 秒」
→ 為什麼是 30 秒？

[2] L40【刪除這些字】「沿用舊版快取」（原文已修改）

[3] L57【第一性原理重新評估】「先把所有檔案載入記憶體再比對」

[4] L70【見說明】「術語表」
→ 加上英文對照

（同意，不必處理）
- L63「三段式流程圖」→ 這張圖很清楚

（已解決）
- L5【見說明】「標題」→ 改短一點
```

#### Scenario: Mixed kinds
- **WHEN** the user copies annotations matching the example above
- **THEN** the copied text has the structure of the example: the summary counts 4 open, the explanation section lists the four kinds used in first-appearance order, and the Agree annotation is in its own unnumbered section

#### Scenario: Other comments come first
- **WHEN** the "Other comments" box holds "整體結構太鬆" and there are two to-do annotations
- **THEN** the summary line ends with 「，另有其它意見」, and the 「其它意見：」 section with "整體結構太鬆" comes right after it, before the kind explanation and the numbered items

#### Scenario: Only other comments
- **WHEN** a document has no annotations and its "Other comments" box is not blank
- **THEN** pressing "📋 Copy for Claude" copies the header, a summary of 0 annotations ending with 「，另有其它意見」 and the 「其它意見：」 section

#### Scenario: Nothing to copy
- **WHEN** a document has no annotations and its "Other comments" box is blank
- **THEN** pressing "📋 Copy for Claude" shows that there are no annotations or other comments yet and copies nothing

#### Scenario: Only See comment items
- **WHEN** every numbered item is "See comment"
- **THEN** the copied text has no kind explanation section, and each item is still labelled 【見說明】 / 【See comment】

#### Scenario: Empty comment
- **WHEN** a numbered "Delete this text" annotation has an empty comment
- **THEN** its item is only the first line, with no `→` line

#### Scenario: Match-state marker stays at the end
- **WHEN** a numbered item's original text has changed since it was annotated
- **THEN** the item's first line ends with the "original text changed" marker after the quote

#### Scenario: Explanation follows the interface language
- **WHEN** the interface language is English and the user copies annotations with several kinds
- **THEN** the explanation section uses the English names and the English handling text

---
🤖 claude-opus-5-5[1m] · effort: xhigh · 2026-10-14
