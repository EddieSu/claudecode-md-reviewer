## 1. 比對函式（共用模組）

- [x] 1.1 `reviewer-diff.js` 新增 `locateQuote(texts, quote, first)` 並匯出
- [x] 1.2 `test/diff.test.cjs` 加測試：跨片段、跨段、空白差異、只有空白的中間片段、起點不在區塊內回 null、找不到回 null、不回空範圍

## 2. 選取與螢光（reviewer.js / reviewer.css）

- [x] 2.1 `selInfo` 改取「選取範圍裡第一個選到非空白字的文字片段」所屬區塊
- [x] 2.2 `wrapQuote` 改成收集文字片段（跳過 `.mermaid`、收夠就停）→ `locateQuote` → 每片段各包一個 mark；每段第一片帶 `data-sym`；點擊 `stopPropagation`
- [x] 2.3 CSS：色章選擇器改 `mark.anno[data-sym]::before`；已解決只淡化、拿掉刪除線

## 3. 其它意見

- [x] 3.1 `server.cjs`：`/api/file` 回傳 `generalComment`；`/api/save` 有鍵才寫入／移除
- [x] 3.2 `reviewer.html` 加 `#general`（label＋textarea），位置在 `#docInner` 與 `#selBar` 之間；`reviewer.css` 樣式（分隔線、小標題、五行、可拉長、深色配色）
- [x] 3.3 `reviewer.js`：開檔載入、顯示／隱藏、舊伺服器停用、暫停存檔時唯讀、輸入即存（只在改過時送鍵）、從空白變有內容時清除完成紀錄、mouseup 排除 `#general`
- [x] 3.4 匯出帶 `generalComment`；複製給 Claude 加摘要註記與「其它意見」段、放寬空註解提示
- [x] 3.5 存檔計數修正：存檔途中又改過就不清掉未存狀態
- [x] 3.6 語系：新增 `general.*`、`copy.summaryGeneral`、`copy.generalSection`；改寫 `bar.copyTitle`、`msg.noAnnotations`（en 與 zh-Hant key 一致）

## 4. 讀回說明與文件

- [x] 4.1 `bin/md-reviewer.js` 的 `--hook` 建議文字補 `generalComment`
- [x] 4.2 `README.md`、`README.zh-Hant.md`：其它意見功能、註解檔格式、給 CLAUDE.md 的範例、git 衝突時一併合併、左側色條的意思
- [x] 4.3 `CHANGELOG.md` 0.8.0（含升級後要重啟伺服器）、`package.json` 版本 0.8.0

## 5. 驗證

- [x] 5.1 `npm test` 通過
- [x] 5.2 無頭瀏覽器腳本（隔離埠 8779）驗證：三擊帶格式段落文字上色、上下兩方向多段選取同一行號且三段上色、從空白處開始拖曳、流程圖色條、巢狀點擊、已解決樣式、其它意見存檔／清空／換檔／舊伺服器／唯讀／完成紀錄清除、複製文字
- [x] 5.3 `openspec validate --strict` 通過

---
🤖 claude-opus-5-5[1m] · effort: xhigh · 2026-10-14
