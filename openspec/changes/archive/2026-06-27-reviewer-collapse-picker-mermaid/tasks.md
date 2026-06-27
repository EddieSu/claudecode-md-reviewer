## 1. 可摺疊側欄分區（collapsible-sidebar-sections）

- [x] 1.1 `reviewer.html`：favorites/history/pinned 的 `.navsec-h` 改為可點 toggle（加 caret 元素）
- [x] 1.2 `reviewer.css`：`.navsec.collapsed .navsec-list{display:none}` + caret(▾/▸) 樣式 + header 可點游標
- [x] 1.3 `reviewer.js`：點 header toggle `.collapsed`、持久化 `mdr-sec-fav`/`mdr-sec-hist`/`mdr-sec-pin`；init 還原（未設定時 hist+pin 預設摺疊、fav 展開）

## 2. 內建檔案瀏覽器（native-file-open）

> 原先做原生 OS 對話框,但在背景 server 上 Windows 不可靠（windowsHide 藏窗→ShowDialog 卡死；前景鎖；P/Invoke 前景化被 AMSI 擋）→ 改成 App 內建檔案瀏覽器。
- [x] 2.1 `server.cjs`：`GET /api/browse`（token 保護）列一層目錄（子資料夾 + `.md`、略過隱藏）；`dir` 預設家目錄、`::drives` 列 Windows 磁碟、回 `{ok,dir,parent,entries}`
- [x] 2.2 `reviewer.html`：path 輸入框右邊加 `…` 按鈕（`#btnPick`）+ 選檔 modal（`#browse`）
- [x] 2.3 `reviewer.js`：`#btnPick` 開 modal、`browseTo` 導覽（folder/..）、點檔 → 設 pathInput + `loadFile` + 關閉；✕/backdrop/Esc 關閉
- [x] 2.4 `reviewer.css` modal 樣式；locale 加 `bar.pick`/`browse.drives`/`browse.empty`

## 3. Mermaid 渲染（mermaid-rendering）

- [x] 3.1 取得 vendored `vendor/mermaid.min.js`（mermaid@10.9.6 UMD，曝露全域 `mermaid`）
- [x] 3.2 `server.cjs`：新增靜態路由 `/vendor/mermaid.min.js`（免 token，比照 reviewer.js）
- [x] 3.3 `reviewer.js`：`renderMarkdown` 對 ` ```mermaid ` fence 改 emit `<div class="mermaid" data-line>…原始碼…</div>`
- [x] 3.4 `reviewer.js`：`renderDoc` 後若有 `.mermaid` → 懶載 vendored script、`mermaid.initialize({startOnLoad:false,securityLevel:"strict",theme:<dark?>})`、`mermaid.render`；單塊 parse 失敗 → 退回該塊 `<pre><code>`
- [x] 3.5 `reviewer.css`：`.mermaid` 容器樣式（置中、深淺色相容）

## 4. 套件與文件

- [x] 4.1 `package.json`：`files` 加 `vendor/`、版本 → `0.3.0`；`npm pack --dry-run` 確認含 `vendor/mermaid.min.js`（整包 1.0MB、14 檔）
- [x] 4.2 README（EN + zh-Hant）：新增 collapsible sections、`…` 選檔、mermaid、`MDR_PORT`、端點清單更新
- [x] 4.3 CHANGELOG：新增 `0.3.0` 條目（含 mermaid@10.9.6）

## 5. 本機驗證

- [x] 5.1 摺疊：HTML/CSS/JS 接線 + init 預設（hist+pin 摺疊）靜態驗證（瀏覽器點測由使用者進行）
- [x] 5.2 選檔：`/api/browse` 列目錄正確（4 資料夾+4 md+parent）、bad token → 403、`/api/pick` 已移除（404）；modal 導覽/選檔由使用者點測
- [x] 5.3 mermaid：fence emit + renderDoc 接線、`/vendor/mermaid.min.js` 200(3.34MB)、無 mermaid 不載 lib、壞圖退回程式碼塊（邏輯）；實際渲染由使用者瀏覽器點測
- [x] 5.4 隔離埠(8779)+暫存 HISTORY_DIR 測試,不碰 live 8771;locale key 對齊(56)、靜態 key 覆蓋無漏
