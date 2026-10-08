## 1. 共用模組 `reviewer-diff.js` 與單元測試（先做，前端與伺服器都依賴它）

- [x] 1.1 在 `reviewer-diff.js` 新增 `KINDS`，依 design D9 的順序列出八類的 `kind` 值與符號（see-comment ※、agree ✓、explain-more ?、offer-alternatives ⇄、delete-text −、rethink-first-principles ↺、state-positively +、drop-feature ⊘），並把模組開頭的說明改成也涵蓋「註解分類」。
- [x] 1.2 新增 `kindOf(a)`：`a.kind` 是字串而且是八類之一就回傳它，其他情況一律回傳 `"see-comment"`。
- [x] 1.3 新增 `isTodo(a)`：只有狀態不是 `resolved`、而且 `kindOf(a)` 不是 `agree` 時才回傳 true。
- [x] 1.4 新增 `newAnnotation(fields)`：組出新註解，一律帶 `kind`，`comment` 轉成字串（空的存 `""`），不帶 `color`，`context` 有值才帶。
- [x] 1.5 新增 `annToSave(a)`：先複製記憶體裡的註解物件，再蓋上已知欄位的正規化值（`line`、`quote`、轉成字串的 `comment`、`status`、`id`、`createdAt`；`kind`、`color`、`context` 有值才寫），物件上沒有的欄位不補。
- [x] 1.6 確認這五項同時從 `module.exports`（Node）與 `window.MDRDiff`（瀏覽器）匯出。
- [x] 1.7 在 `test/diff.test.cjs` 加入 `KINDS` 與 `kindOf` 的檢查：八類的值與順序正確並原樣回傳；沒有 `kind`、不認得的值、數字、物件、`null`、只有 `color` 的舊註解都回傳 `"see-comment"`。
- [x] 1.8 加入 `isTodo` 的檢查：未解決的「同意」不算；未解決的「見說明」與沒有 `kind` 的舊註解算；已解決的任何分類都不算。
- [x] 1.9 加入 `annToSave` 的檢查：舊註解（有 `color`、沒有 `kind`）前後內容完全相同；帶陌生欄位的註解存檔後陌生欄位仍在；沒有 `comment` 的註解存成 `""`。
- [x] 1.10 加入 `newAnnotation` 的檢查：結果沒有 `color`、一定有 `kind`、`comment` 是字串。
- [x] 1.11 跑 `npm test`，新舊檢查全部通過。

## 2. 伺服器與命令列

- [x] 2.1 `server.cjs` 從 `reviewer-diff.js` 多取 `isTodo`，`annCounts` 回傳的 `open` 改成以 `isTodo` 計數（`/api/save` 與 `writeSidecar` 不改）。
- [x] 2.2 `bin/md-reviewer.js --hook` 印出的建議指示改成：依 `kind` 處理 `status` 為 `open` 的註解，沒有 `kind` 當 `see-comment`，`agree` 不必處理，分類說明見 README 的「註解分類」一節。

## 3. 語系檔（`locales/en.json`、`locales/zh-Hant.json`）

- [x] 3.1 新增工具列字串：[複製]、[加註] 兩顆按鈕，「✓ 已複製」，「請按 Ctrl+C」與 macOS 版「請按 ⌘C」，工具列的無障礙名稱「選取文字的動作」，朗讀區的成功訊息與失敗訊息（失敗訊息也要有 macOS 版）。
- [x] 3.2 新增八類的 `kind.<值>.name`、`kind.<值>.hint`、`kind.<值>.how`，中文照 design D10，英文照 `annotation-kinds` 規格。
- [x] 3.3 新增加註框字串：「預設」標籤、分類群組的 legend「分類」、可留空時的輸入框提示「可留空；想補充就寫在這裡…（Ctrl+Enter 儲存）」。
- [x] 3.4 新增卡片與複製文字用的字串：整塊標示時「只刪除上面引用的文字…」的說明、「分類說明（每則若另有意見，以意見補充的條件為準）：」標題、「（同意，不必處理）」段標題。
- [x] 3.5 改既有字串：`pop.save` 改成「儲存」／Save，`card.delete` 改成「刪除註解」／Delete annotation，`doc.empty` 的操作說明改成「選取 → [複製]／[加註]」。
- [x] 3.6 用腳本比對兩份語系檔，確認 key 集合完全一致。

## 4. 前端：選取工具列與朗讀區

- [x] 4.1 `reviewer.html`：在 `#doc` 裡、`#docInner` 之後、`#toTop` 之前加入工具列元素（`role="toolbar"`、`aria-label` 走語系、兩顆 `<button>`、預設帶 `hidden`）；在工具列外面加入常駐、畫面上看不到的朗讀區（`aria-live="polite"`）；`#doc` 加上 `tabindex="-1"`。
- [x] 4.2 `reviewer.css`：`#doc` 加 `position: relative`，聚焦時不畫外框；加入工具列樣式（`user-select: none`、絕對定位、淺色深色都清楚）與朗讀區的視覺隱藏樣式。
- [x] 4.3 `reviewer.js`：把 `#doc` 的 mouseup 改成顯示工具列；加註框或流程圖放大檢視開著時不顯示；放開位置在工具列、加註框、`#toTop` 或流程圖放大按鈕上時不顯示；記下行號、壓過空白的引文與原始選取文字（`Selection.toString()`）。
- [x] 4.4 實作工具列定位：換算成 `#doc` 的內容座標，水平對齊放開滑鼠的位置並夾在閱讀區內，垂直放在該行選取範圍的上方，上方放不下時改放下方。
- [x] 4.5 工具列按鈕在 mousedown 時呼叫 `preventDefault`，確保按下去不會取消選取。
- [x] 4.6 實作 [複製]：先用 `navigator.clipboard.writeText`；被拒時掛一次性的 `copy` 事件只放 `text/plain`，再呼叫 `document.execCommand("copy")`；兩者都失敗時按鈕改成「請按 Ctrl+C」（macOS 顯示 ⌘C）並保留選取；成功時顯示「✓ 已複製」約 0.8 秒、工具列不收起；結果寫進朗讀區。
- [x] 4.7 實作 [加註]：把記下的行號與引文交給 `state.pending`，記下工具列收起前在視窗上的位置，收起工具列，再以「選取仍在且沒有改變就用選取的位置，否則用工具列的位置」為參考打開加註框。
- [x] 4.8 實作收起規則：在工具列外按下滑鼠、按 Esc（焦點在工具列內時放回 `#doc`）、`selectionchange` 發現選取變空或文字不同、打開加註框、`loadFile`、打開流程圖放大檢視、視窗 `resize`。
- [x] 4.9 實作鍵盤操作：出現時不搶焦點；工具列顯示中且焦點不在其中時，攔下 Tab（不含 Shift）跳到第一顆按鈕；工具列內只讓一顆按鈕在 Tab 順序裡，左右方向鍵切換、Home／End 到頭尾、Enter 或空白鍵執行、Tab 離開、Esc 收起。
- [x] 4.10 實作放開 Shift 重新顯示：工具列因 `selectionchange` 收起、而且新的選取不是空的時記下這個狀態；放開 Shift 時，若選取仍不是空的、起點在文章段落內，而且加註框與流程圖放大檢視都沒開，就在新的選取旁重新顯示工具列（水平對齊被移動的那一端）、記下新的行號、引文與原始文字，不移動焦點；在別處按下滑鼠、按 Esc 或其他收起情況都會清掉這個狀態。

## 5. 前端：加註框

- [x] 5.1 `openPopover` 改成先顯示、再用 `offsetWidth` 與 `offsetHeight` 計算位置：預設放在參考位置下方，下方放不下改放上方，最後上下左右都夾在視窗內、離邊緣至少 12px；CSS 設寬度約 340px（不超過視窗寬度減 24px），最大高度為視窗高度減 24px、內容可捲動。
- [x] 5.2 `closePopover` 關閉後把焦點放回 `#doc`；加註框內任何地方按 Esc 都會關閉，包含焦點在分類選項上的時候。
- [x] 5.3 移除「選字就直接打開加註框」的舊路徑，確認加註框開著時再選字不會出現工具列，也不會改動引文、分類與草稿。
- [x] 5.4 `loadFile` 一開始先呼叫 `closePopover()` 並收起工具列，加註框裡的草稿直接捨棄。
- [x] 5.5 `reviewer.html` 的 `#popSwatch` 換成分類群組：`<fieldset>` 加上視覺隱藏的 `<legend>`，八個 `<label><input type="radio" name="kind">色章 名稱</label>` 由 `KINDS` 產生，兩欄四列、網頁結構一列一列由左到右；「見說明」在第一格並標示「預設」；名稱與短提示用 `data-i18n` 系列屬性標記，讓 `applyLocale` 一起更新。
- [x] 5.6 `state.popColor` 換成 `state.popKind`，每次打開加註框都重設為 `see-comment`；選到其他七類時輸入框提示換成「可留空…」，選回「見說明」時換回原本的提示。
- [x] 5.7 `saveAnnotation` 改用 `newAnnotation`：只有「見說明」必須寫意見（空白時把焦點放回輸入框、不存檔）；其他七類可以存空白意見；在已標記完成的文件上新增「同意」時不呼叫 `setReview(false)`、不提示，新增其他分類照舊清除紀錄並提示一次。
- [x] 5.8 存檔按鈕改用新的「儲存」字串。

## 6. 前端：螢光、符號色章與卡片

- [x] 6.1 `reviewer.css`：新增八類的螢光色與圓點色 CSS 變數（淺色、深色兩組，數值照 `annotation-kinds` 規格）；`mark.anno` 以「見說明」的螢光當基本底色；加入各 `mark.anno.k-<值>` 的底色；用 `::before` 與 `attr(data-sym)` 畫圓形色章（淺色模式白色符號、深色模式 `#0d1117` 符號）；「已解決」的樣式不變。
- [x] 6.2 `reviewer.css`：移除 `mark.anno.yellow` 等四色規則與用不到的 `--hl-yellow`、`--hl-green`、`--hl-pink`，保留 `--hl-blue`（`.flash` 動畫與左側清單的選取列仍在使用）。
- [x] 6.3 `wrapQuote`：class 改成 `anno k-<kindOf(a)>`，`data-sym` 取自 `KINDS`，滑鼠提示改成「【分類名稱】意見」，意見空白時只顯示「【分類名稱】」。
- [x] 6.4 `applyHighlights`：把退回整塊標示的註解 id 記進 `state.blockHl`（每次重畫前清空），不掛在註解物件上。
- [x] 6.5 `applyLocale` 之後重跑 `applyHighlights`，讓螢光提示跟著換語言。
- [x] 6.6 `renderSide`：卡片第一行改成「色章＋分類 `<select>`＋行號」，`<select>` 的值是 `kindOf(a)`、滑鼠提示是目前分類的短提示；意見空白時不顯示意見那一行；分類是「刪除這些字」而且 id 在 `state.blockHl` 裡時，在引文下方加整塊標示的說明；刪除按鈕改用「刪除註解」字串。
- [x] 6.7 實作分類 `<select>` 的 change 處理：只改該則註解的 `kind`，其他欄位都不動，接著重畫螢光與卡片並呼叫 `markDirty()`，不碰審閱完成紀錄。
- [x] 6.8 移除 `COLORS`、`COLORHEX`、`renderSwatch` 與 `#popSwatch` 的點擊處理，並搜尋確認沒有殘留引用，畫面相關的程式也沒有任何地方直接讀 `a.kind` 或 `a.color`（一律經過 `kindOf`）。

## 7. 前端：複製給 Claude、標記完成與存檔

- [x] 7.1 改寫 `#btnCopy` 的點擊處理：摘要的未解決數用 `isTodo` 計算；有編號的項目是待辦註解，每則寫成 `[n] L行號【分類名稱】「引文」原文狀態註記`，意見空白時省略「→」那一行；分類說明段依編號項目中第一次出現的順序列出用到的分類，文字取自 `kind.<值>.how`，全部是「見說明」時省略；未解決的「同意」另列一段且不編號；已解決清單每行帶分類名稱；清單形式的行在意見空白時省略「→ 意見」那一截。
- [x] 7.2 `#btnDone` 的未解決數改用 `isTodo` 計算，只剩「同意」時不跳確認。
- [x] 7.3 `buildSidecar` 改用 `annToSave`，匯出與自動存檔共用；在存檔函式旁加註解，寫明「暫存值一律不得掛在註解物件上」。
- [x] 7.4 搜尋 `reviewer.js` 裡所有對註解物件的賦值，確認除了 `renderDoc` 刻意寫回的 `line`、`context` 與使用者操作改動的已知欄位（`kind`、`status`）之外，沒有任何算出來的值掛在註解物件上。

## 8. 文件與版本

- [ ] 8.1 `README.md`、`README.zh-Hant.md` 的「怎麼用」改成「選取文字 → [複製] 或 [加註]」的操作步驟。
- [ ] 8.2 兩份 README 新增「註解分類」一節（英文版標題 Annotation kinds）：列出八類的名稱、符號與處理方式，處理文字照抄對應語系檔的 `kind.<值>.how`，並寫明「同意」不算待辦。
- [ ] 8.3 兩份 README 的註解檔格式說明補上：新註解有 `kind`，`color` 只出現在 0.7.0 以前的舊註解，`comment` 可能是空字串。
- [ ] 8.4 兩份 README 給 AI 的觸發指示改成「依 `kind` 處理 status 為 open 的註解」，與 `--hook` 印出的文字一致。
- [ ] 8.5 兩份 README 的跨設備一節補上「每台設備都要用 0.7.0 以上」，並寫明「意見空白的註解在舊版存檔後，分類會被丟掉，變成沒有內容的註解」。
- [ ] 8.6 `CHANGELOG.md` 新增 0.7.0 條目：選取工具列、八種註解分類、陌生欄位保留、「同意」不算待辦、「儲存」與「刪除註解」兩個改名，並寫入上面的相容性提醒與回退說明（裝回 0.6.0 會怎樣）。
- [ ] 8.7 `package.json` 的版本升到 `0.7.0`。

## 9. 驗證

- [ ] 9.1 跑 `npm test`，全部通過。
- [ ] 9.2 跑 `openspec validate add-selection-actions-and-review-kinds --strict`，結果是 valid。
- [ ] 9.3 在 `.gitignore` 補上 `.local/`（目前沒有），把 `DEMO.md` 與 `DEMO.review.json` 複製到 `.local/`，之後的手動實測只開這份複本，並記下複本 sidecar 的雜湊值。
- [ ] 9.4 用隔離的連接埠與暫存 HOME 啟動伺服器做實測，不碰正在使用的 8771 埠與真實的 `~/.md-reviewer/`。
- [ ] 9.5 手動實測舊註解：開啟複本後，舊註解都顯示成「見說明」的顏色與 ※ 符號；什麼都不改時，複本 sidecar 的雜湊值不變。
- [ ] 9.6 手動實測工具列何時出現：一般拖曳、雙擊、三擊選取會出現；歡迎畫面與左右側欄不出現；流程圖內拖曳選取會出現；流程圖雙擊只打開放大檢視；選取後按 `#toTop` 不出現；加註框開著時再選字不出現、草稿不變。
- [ ] 9.7 手動實測 [複製]：跨兩段複製後貼到純文字編輯器，段落間換行保留；貼到 Word 之類的編輯器沒有格式；在開發者工具讓剪貼簿 API 拒絕，確認第二段退路只放純文字；再讓第二段也失敗，確認按鈕顯示「請按 Ctrl+C」且選取保留；成功時「✓ 已複製」約 0.8 秒後恢復、工具列不收起。在 Edge、Chrome、Firefox 各跑一次。
- [ ] 9.8 手動實測鍵盤與朗讀：工具列出現後按空白鍵會捲動頁面；按 Tab 進入 [複製]、右方向鍵到 [加註]、Enter 打開加註框；在工具列內按 Tab 會離開工具列，按 Esc 會收起並把焦點放回閱讀區；朗讀區在成功與失敗時的內容正確。
- [ ] 9.9 手動實測收起與加註框：點別處、Esc、視窗改變大小、換檔、重新載入、打開流程圖放大檢視都會收起工具列；捲動後按 [加註]，加註框出現在選取當下的位置；把視窗縮小，加註框仍在視窗內並可捲動；加註框開著時換檔，加註框關閉、新文件的 sidecar 沒有多出註解。
- [ ] 9.10 手動實測分類：每次打開加註框都預設「見說明」；「見說明」意見空白不能存；其他七類意見空白可以存，sidecar 寫 `"comment": ""`、有 `kind`、沒有 `color`；卡片上改分類只改 `kind`；舊註解改分類後仍保留 `color`；切換語言後分類選項、卡片選單與螢光提示都換成新語言；深色模式下八類都看得清楚。
- [ ] 9.11 手動實測「同意」與審閱完成：左側徽章不計「同意」；只剩「同意」時標記完成不跳確認；在已完成的文件新增「同意」不清除紀錄也不提示；新增其他分類照舊清除並提示一次；改分類不影響完成紀錄。
- [ ] 9.12 手動實測不可信輸入與陌生欄位：在複本 sidecar 手動放入不認得的 `kind`、數字 `kind`、含引號與 HTML 的 `kind`，以及一個陌生的註解欄位；開檔後這些註解都當「見說明」顯示，頁面沒有插入任何來自檔案的標記；改動另一則註解存檔後，這些原值與陌生欄位都原樣保留。
- [ ] 9.13 手動實測「📋 複製給 Claude」：照 design D15 的範例建一組註解，確認輸出結構一致（分類說明段的順序、「同意」另列不編號、意見空白省略「→」、原文狀態註記在第一行結尾）；全部是「見說明」時沒有分類說明段；切到英文介面時分類名稱與處理文字是英文。
- [ ] 9.14 色覺模擬驗證：在 Chrome 開發者工具的「模擬視覺缺陷」分別切換紅色盲、綠色盲、藍色盲、全色盲，各把八類並列的螢光、加註框分類選項、卡片截圖一次存進 `.local/`，確認任兩類都能靠顏色或符號分辨。
- [ ] 9.15 截一組「八個分類符號」的預覽圖（淺色與深色模式各一張，包含螢光色章、加註框選項與卡片選單）交給使用者確認符號是否好認；不好認就依使用者意見換符號，並同步更新 `KINDS`、規格與 README。
- [ ] 9.16 比對兩份 README「註解分類」一節的處理文字與語系檔的 `kind.<值>.how`，確認一字不差。
- [ ] 9.17 逐條對照五份 delta spec 的情境自我檢查，全部符合。

## 10. 外部 repo：claude-config 的 md-reviewer skill（另一個 repo，不在本 repo 內）

- [ ] 10.1 在 claude-config repo（github.com/EddieSu/claude-config）開分支，修改 `skills/md-reviewer/SKILL.md` 第 2 節「讀回審閱」：依 `kind` 處理註解，處理文字照抄 `locales/en.json` 的英文 `kind.<值>.how`，沒有 `kind` 的舊註解當「見說明」，「同意」不必處理；開好 PR，在 0.7.0 發布前不合併。
- [ ] 10.2 0.7.0 發布後，經使用者同意立即合併這個 PR，並提醒各台機器在 claude-config 執行 `apply`。

## 11. 合併、發布與歸檔

- [ ] 11.1 commit 並推送 `feature/selection-actions-and-review-kinds`，用 GitHub MCP 開 PR 到 `main`，經使用者同意後合併。
- [ ] 11.2 **需使用者明確同意才執行**：依 `RELEASING.md` 在 `main` 打 `v0.7.0` tag 並推送，由 GitHub Actions 發布到 npm，發布後確認 npm 上的版本是 0.7.0。
- [ ] 11.3 發布完成後執行 10.2，並在本機執行 `npm i -g claudecode-md-reviewer`，確認裝到 0.7.0。
- [ ] 11.4 執行 `openspec archive add-selection-actions-and-review-kinds`，把 delta 併入主規格。
- [ ] 11.5 整理歸檔後的主規格：`openspec/specs/review-status/spec.md` 與 `openspec/specs/sidecar-integrity/spec.md` 的中段會多出一行簽名（delta 檔尾的簽名被當成最後一條修改需求的一部分併進去），刪掉中段那行、檔尾只留一行；新建的 `annotation-kinds` 與 `selection-actions` 主規格把 Purpose 的「TBD」改成一句說明；再跑 `openspec validate --specs --strict` 確認通過。
- [ ] 11.6 歸檔結果另開分支與 PR，經使用者同意後合併（照上一個變更的做法）。

---
🤖 claude-opus-5-5[1m] · effort: ? · 2026-10-08
