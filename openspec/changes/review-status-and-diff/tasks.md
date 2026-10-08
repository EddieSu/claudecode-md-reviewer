## 1. 共用純函式 `reviewer-diff.js` ＋ 測試（先做，後面都依賴它）

- [x] 1.1 建 `reviewer-diff.js`：IIFE 包住、只掛 `window.MDRDiff`、Node 下 `module.exports`；實作 `normText`（去 BOM、CRLF/CR→LF、去行尾空白）、`key`（壓空白＋有序清單編號正規化）
- [x] 1.2 實作 `sim`（token bigram Dice；Latin 一串、其他單一 code point、`u` 旗標；丟空白/標點/符號 token；不足 2 token 回 `key` 相等 1 否則 0）
- [x] 1.3 實作 `textDiff`（先逐行、再對變動行逐 token；同一 LCS helper、一維 `Uint16Array`、250,000 格上限退化；變動區先刪後加；相鄰同類合併）
- [x] 1.4 實作 `reanchor`（design D7 流程：exact＋鄰居、鄰居相鄰→GONE、夾在兩鄰居之間、單側鄰居＋同類型 sim≥0.2、同類型≥8 token sim≥0.5、唯一 quote；舊註解 SAME/UNVERIFIED 與回填條件；距離懲罰只破平手；block bigram 預算一次）
- [x] 1.5 建 `test/diff.test.cjs`（純 `assert`）涵蓋 design「Test cases for reanchor」整張表＋`normText`、`sim` 邊界、`textDiff` 只標出改動字；`package.json` 加 `"test": "node test/diff.test.cjs"`，跑過

## 2. Renderer：正確的區塊範圍

- [x] 2.1 `renderMarkdown` 修 HTML 註解後接文字的行號漂移（`lines[j]=after; i=j`）
- [x] 2.2 `renderMarkdown`／`renderList` 每個區塊輸出 `data-end`（li 只含本項＋續行）；mermaid 失敗退回 `<pre>` 時一併複製 `data-end`
- [x] 2.3 `reviewer.js` 新增 `buildBlocks()`（distinct line、同 line 取最內層、`src` 取自 `normText(content)`、`text` 排除巢狀 `[data-line]`、表格格間補空白、壓空白）

## 3. Server

- [x] 3.1 `require("./reviewer-diff.js")`；`hashOf`（SHA-256 of `normText`）＋ `mtimeMs/size` 快取；靜態路由加 `/reviewer-diff.js`
- [x] 3.2 `readSidecar`（missing / ok / unreadable）與共用的受保護寫入 `writeSidecar(fp, base, patch)`（壞檔 409 corrupt、`base`≠`updatedAt` 409 conflict、保留其他欄位、回新 `updatedAt`）
- [x] 3.3 `/api/file` 多回 `hash`、`review`、`updatedAt`、`sidecarError`
- [x] 3.4 `/api/save` 改走 `writeSidecar`，只換 `annotations`，不碰 `review`
- [x] 3.5 新增 `POST /api/review`（`done:true` 驗 64 hex 且等於磁碟現值，否則 409 stale；`done:false` 刪 `review`）
- [x] 3.6 `annCounts` 多回 `review: {state:"done"|"stale", at}`；`/api/sidebar` 接 `current=` 回 `current:{hash, updatedAt}`

## 4. 前端：存檔路徑與審閱完成

- [x] 4.1 `buildSidecar` 欄位白名單（含 `context`、頂層 `review`），`saveToServer` 改送白名單＋`base`；所有寫入走單一 promise chain；處理 409（顯示提示、停止自動存檔）
- [x] 4.2 `reviewer.html` 加 `#btnDone`、`#notice`、`reviewer-diff.js` script；`applyLocale` 支援 `[data-i18n-aria]`
- [x] 4.3 審閱按鈕三態（標籤寫明點下會怎樣、tooltip 本地時間）、未解決數確認、取消需確認、標記成功後移出本次待審
- [x] 4.4 對已完成文件新增註解 → 呼叫 `/api/review done:false` 並提示一次
- [x] 4.5 左欄每列「已審／需重審」小標籤（與 ✓ 移出待審區隔）
- [x] 4.6 輪詢帶 `current=`：磁碟文件或註解檔變更時顯示提示＋重新載入鈕；寫入中／待存時略過比對；sidecar 損壞時顯示常駐提示並停用存檔

## 5. 前端：差異顯示

- [x] 5.1 選字（mouseup）與 `saveAnnotation` 由 `buildBlocks()` 取 `context {block, prev, next}`（空 block 不存）
- [x] 5.2 `renderDoc` 順序：innerHTML → `buildBlocks` → `reanchor` → `applyHighlights`（略過 GONE）→ `renderMermaid`；結果與 diff 依 id 快取，不掛在註解物件上
- [x] 5.3 `renderSide`：CHANGED 差異框（`<del>`/`<ins>`、長的未變段省略、限高捲動、已解決收進 `<details>`、quote 仍在的提示）；GONE「原 L{n}」＋舊文＋隱藏定位；UNVERIFIED 標示
- [x] 5.4 `gotoAnno` 略過 GONE；「📋 複製給 Claude」用目前行號並加狀態註記

## 6. 回到頂端

- [x] 6.1 `#toTop` 放 `#doc` 最後、sticky 右下、`z-index` 高於 `.mm-zoom-btn`、用 `visibility/opacity` 切換、捲超過一個窗高顯示、平滑捲回頂端；mouseup 忽略點擊

## 7. i18n、套件、文件

- [x] 7.1 `locales/en.json`、`locales/zh-Hant.json` 加齊新 key（兩檔 key 集合一致，用腳本比對）
- [x] 7.2 `package.json`：`files` 加 `reviewer-diff.js`、版本 `0.6.0`；`npm pack --dry-run` 確認含新檔
- [x] 7.3 README（EN＋zh-Hant）：sidecar 格式（`review`、`context`）、審閱完成、差異卡片、「跨設備」段（`git check-ignore -v`、改名一起搬、哪些跟著走哪些不會、同步盤行為、隱私、所有設備 ≥0.6.0、衝突怎麼手動合併）、AI 觸發指示補兩句；更正收藏「跨機器」說法
- [x] 7.4 CHANGELOG `0.6.0`（含：降版會丟 `review`、差異只對 0.6.0 後的註解或可回填者有效）

## 8. 本機驗證（隔離埠＋暫存 HOME，不碰 live 8771 與真實 `~/.md-reviewer/`）

- [x] 8.1 `npm test` 全過
- [x] 8.2 Server：壞 sidecar → 409 且檔案不變；兩分頁衝突 → 409；`/api/save` 保留 `review` 與未知欄位；`/api/review` stale 擋下；CRLF/LF 同 hash
- [x] 8.3 瀏覽器（Playwright）：標記完成→改檔→左欄「需重審」＋提示列→重新載入→卡片顯示差異；刪段→GONE；舊註解 UNVERIFIED；回到頂端位置與行為；中英切換字串齊全
- [x] 8.4 逐條對照 specs scenario 自檢；開檔不寫 sidecar（hash 前後一致）

---
🤖 claude-opus-5-5[1m] · effort: xhigh · 2026-10-08
