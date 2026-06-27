## 1. Repo 骨架（搬入既有引擎/前端）

- [x] 1.1 從 `ClaudeCodeManager/tools/md-reviewer/` 複製 `server.cjs`、`reviewer.html`、`reviewer.css`、`reviewer.js` 到本 repo 根
- [x] 1.2 複製 `DEMO.md` + `DEMO.review.json` 當示範樣本（可選保留）
- [x] 1.3 確認搬入後 `node server.cjs` 能起 server 且 `/api/ping` 回 200

## 2. 套件化（packaging-distribution）

- [x] 2.1 新增 `package.json`：`name=claudecode-md-reviewer`、`version=0.1.0`、`bin.md-reviewer=bin/md-reviewer.js`、`engines.node>=18`、`dependencies={}`、`repository`/`license=MIT`
- [x] 2.2 設定 `files` 白名單：`server.cjs`、`reviewer.html/css/js`、`bin/`、`pins.example.json`、`README*`、`LICENSE`
- [x] 2.3 新增 `LICENSE`（MIT，作者署名）
- [x] 2.4 新增 `.gitignore`：`node_modules/`、本機 `pins.json`、`*.review.json`（DEMO 例外視情況）、`.md-reviewer/`
- [x] 2.5 `npm pack --dry-run` 驗證 tarball 內容符合 `files` 白名單、無個人資料

## 3. 跨平台 CLI（cross-platform-cli）

- [x] 3.1 新增 `bin/md-reviewer.js`（shebang `#!/usr/bin/env node`）：參數解析（`<file.md>` 或無參數開啟）
- [x] 3.2 實作「確保 server」：`fetch` 探 `/api/ping`，沒跑就 `spawn` 背景起 `server.cjs`、輪詢至就緒（逾時明確報錯）
- [x] 3.3 從暫存檔讀 token；以 `POST /api/enqueue` 推入目標 `.md`（驗證存在且副檔名 `.md`，否則非零退出）
- [x] 3.4 跨平台開瀏覽器：win `start` / mac `open` / 其餘 `xdg-open`，帶 tokenized URL；失敗 fallback 印 URL
- [x] 3.5 推送語意：server 已在跑就只入佇列不開分頁；這次才起 server 或無檔開啟才開分頁
- [x] 3.6 把 `review.cmd`/`open-reviewer.cmd`/`review.ps1` 改為呼叫 `node bin/md-reviewer.js`（Windows 雙擊方便入口、邏輯只留一份）

## 4. 設定去個人化（user-configuration）

- [x] 4.1 `server.cjs` 改 `PINS_FILE` 解析：`~/.md-reviewer/pins.json` 存在就用，否則 fallback 套件內建 `pins.example.json`
- [x] 4.2 新增 `pins.example.json`：含註解說明 + 空的 `pins` 陣列（開箱無個人 pins）
- [x] 4.3 確認 `history.json` 仍寫 `~/.md-reviewer/`（不落 install 目錄）；其餘端點/token/Host/閒置邏輯不動

## 5. 對外文件（中英並陳）

- [x] 5.1 改寫 `README.md`（英文，GitHub 預設）：What/Install（npx/global/from-source）/Usage/Claude 整合/Security/Limitations
- [x] 5.2 新增 `README.zh-Hant.md`（繁中），與英文版互相連結
- [x] 5.3 新增 `CHANGELOG.md`，`0.1.0` 首發條目

## 6. 本機驗證（Phase 1 收尾）

- [x] 6.1 `npx .` / `node bin/md-reviewer.js DEMO.md` 跑通：server 起、瀏覽器開、檔載入、加註存出 `*.review.json`
- [x] 6.2 sidebar 三區（待審/紀錄/釘選）與專案標籤篩選正常；空 pins 下釘選區為空
- [x] 6.3 逐條對照 specs scenario 自檢通過

## 7. 上 GitHub + 發布（Phase 2，含人工授權步驟）

- [x] 7.1 用 GitHub MCP 建立 public repo `claudecode-md-reviewer` 並推送（依規範，GitHub 操作走 MCP）
- [x] 7.2 確認作者 npm 帳號；`npm publish`（人工授權執行）— 已發布（npm 上線至 v0.4.0）
- [~] 7.3 打 tag `v0.1.0`（tag 驅動版本）— 已跳過：版本直接演進，最早 tag 為 `v0.3.0`，不回溯補打 `v0.1.0`

## 8. 接回作者環境（Phase 3）

- [ ] 8.1 把作者現有 `pins.json` 內容遷移到 `~/.md-reviewer/pins.json` — 待作者本機核實（`~/.md-reviewer/`）
- [x] 8.2 經 `claude-config` 把 `~/.claude/tools/md-reviewer` 改為消費發布套件（npm 安裝或 vendored）— 全域 skill `md-reviewer` 已改用 npm 套件
- [x] 8.3 確認消費端運作後，`ClaudeCodeManager/tools/md-reviewer` 標記為已遷出（保留或移除由作者決定）— 舊 `~/.claude/tools/md-reviewer` + `review.cmd` 已退役
