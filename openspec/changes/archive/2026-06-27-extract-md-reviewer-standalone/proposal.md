## Why

`md-reviewer`(Markdown 審閱迴路工具)目前內嵌在 `ClaudeCodeManager/tools/md-reviewer`,並靠私有的 `claude-config` 跨機器同步。它的**啟動器是 Windows-only**（`.cmd` + PowerShell）、設定檔寫死作者的私人路徑、README 綁定作者的 `~/.claude` 生態——外人無法下載安裝。

我們要把它抽成一個**獨立的公開 repo `claudecode-md-reviewer`**，當作**單一真相**，改造成**跨平台 Node CLI + npm 可安裝（MIT 授權）**，讓任何人 `npx` 或 `npm i -g` 就能用；作者本機的 `~/.claude/tools/md-reviewer` 反過來改成「消費這個套件」。

## What Changes

- **抽出獨立 repo**：把 `tools/md-reviewer/` 的引擎與前端搬進新 repo `claudecode-md-reviewer`，成為唯一開發來源。
- **npm 套件化**：新增 `package.json`（`bin`、`engines.node`、`repository`、`license`、`files`），使 `npx claudecode-md-reviewer <file>` 與 `npm i -g` 可用。
- **跨平台 CLI**：新增 `bin/md-reviewer.js`，把 `review.ps1` 的「確保 server → enqueue → 開瀏覽器」邏輯改寫成跨平台 Node，開瀏覽器走 `start`/`open`/`xdg-open` 分支。Windows 的 `.cmd`/`.ps1` 保留為方便入口。
- **設定去個人化**：移除寫死的私人路徑；改 ship `pins.example.json`，真實 pins 改讀使用者可寫的 `~/.md-reviewer/pins.json`（全域安裝時 install 目錄唯讀，不能放那）。**BREAKING**：`pins.json` 不再從 install 目錄讀取。
- **授權與專案文件**：新增 `LICENSE`（MIT）、`.gitignore`、對外版 `README`、`CHANGELOG`。
- **核心審閱行為維持不變**：`server.cjs` 的端點、註解 `*.review.json` 格式、sidebar/安全設計（127.0.0.1 + token + Host 檢查 + 閒置自關）原樣沿用。
- **接回作者環境**：發布後，`claude-config` / `~/.claude/tools/md-reviewer` 改為消費已發布套件（非開發來源）。

## Capabilities

### New Capabilities
- `packaging-distribution`: npm 套件結構、`bin` 進入點、`files` 白名單、`engines` 版本下限、`npx`/全域安裝/從原始碼三種安裝路徑、語意化版本與 CHANGELOG。
- `cross-platform-cli`: 跨平台命令列進入點的行為契約——確保本機 server（沒跑就背景起一個）、把目標 `.md` 推進待審佇列、依平台開預設瀏覽器並帶 token；保留「server 已開著就只入佇列、不炸新分頁」的推送語意。
- `user-configuration`: 設定解析規則——pins 來源優先序（使用者 `~/.md-reviewer/pins.json` → 內建 `pins.example.json` fallback）、`~` 家目錄展開、history 與 pins 的使用者可寫位置。

### Modified Capabilities
<!-- 無。核心審閱引擎為原樣沿用，本 repo 為全新初始化、無既有 specs 需改動。 -->

## Impact

- **新 repo**：`claudecode-md-reviewer`（本資料夾），公開、MIT。
- **新增程式**：`bin/md-reviewer.js`（CLI）；`server.cjs` 小改（`PINS_FILE` 改為使用者設定來源 + fallback）。
- **新增檔案**：`package.json`、`LICENSE`、`.gitignore`、`pins.example.json`、改寫的 `README.md`、`CHANGELOG.md`。
- **依賴**：維持零執行期 npm 依賴（純 Node 內建模組）；npm 發布需作者 npm 帳號授權（人工步驟）。
- **外部系統**：GitHub repo 建立與推送一律走 GitHub MCP；發布後 `claude-config` 同步流程需調整為消費套件。
- **待確認**：對外 README 語言（英文 / 中英並陳）於 design 階段定案。
