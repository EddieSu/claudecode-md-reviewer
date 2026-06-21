## Context

`md-reviewer` 現為 `ClaudeCodeManager/tools/md-reviewer` 內嵌工具：一支 on-demand 的本機 Node HTTP server（`server.cjs`，零 npm 依賴，只綁 `127.0.0.1:8771`、token 保護、閒置 30 分鐘自關）+ 前端三檔（`reviewer.html/css/js`）。啟動靠 Windows-only 的 `review.cmd`/`review.ps1`/`open-reviewer.cmd`；`pins.json` 寫死作者私人路徑；README 綁作者 `~/.claude` 生態。已決定抽成獨立公開 repo `claudecode-md-reviewer`（單一真相）、跨平台 npm 套件、MIT、README 中英並陳。

約束：維持**零執行期依賴**與既有**安全模型**；不重寫審閱 UI 與 Markdown 渲染器；目標使用者需有 Node。

## Goals / Non-Goals

**Goals:**
- 任何人 `npx claudecode-md-reviewer <file>` 或 `npm i -g` 即可使用，Win/Mac/Linux 行為一致。
- 核心審閱行為、`*.review.json` 格式、安全設計**原樣保留**（行為零迴歸）。
- 設定與紀錄落在**使用者可寫**位置，install 目錄保持唯讀友善。
- 此 repo 成為唯一開發來源；作者環境反過來消費發布套件。

**Non-Goals:**
- 不重寫 Markdown 渲染器、審閱 UI、註解模型。
- 不改 server 端點與 token/Host 安全機制（除 pins 來源外）。
- 不導入打包/轉譯步驟（維持純 Node、無 build）。
- 不支援非 Node 執行環境（Deno/Bun/獨立 exe）。

## Decisions

**D1. 散布＝npm 套件 + `bin`，維持零執行期依賴**
保留 `server.cjs` 為 CommonJS（`.cjs`），不遷 ESM。`package.json` 用 `files` 白名單只發布必要檔；`bin` 指向 CLI。
- 替代：`pkg`/`nexe` 打包單檔 exe → 否決（每平台各一份二進位、體積大、與「需 Node」前提矛盾）。
- 替代：Deno/Bun → 否決（Node 安裝基數大、現有碼即 Node）。

**D2. 單一跨平台 CLI `bin/md-reviewer.js` 取代 `review.ps1` 為主要進入點**
職責（沿用 `review.ps1` 語意）：確保 server 在跑（沒跑就 `child_process.spawn` 背景起 `server.cjs`、輪詢 `/api/ping`）→ 從暫存檔讀 token → `POST /api/enqueue` 推入待審 → 依平台開瀏覽器。
- **開瀏覽器**：`win32`→`start`、`darwin`→`open`、其餘→`xdg-open`；失敗則印出 URL 當 fallback。
- **保留推送語意**：server 本就在跑＝已有分頁 → 只入佇列不開新分頁；這次才拉起 server 或手動 `--open` 才開分頁。
- **HTTP 用內建 `fetch`**（Node 18+ 全域），免依賴。
- `.cmd`/`.ps1` 降級為 Windows 雙擊方便入口，內容改成呼叫 `node "%~dp0bin/md-reviewer.js" %*`，邏輯只留一份。
- 替代：續用平台各自 shell script → 否決（邏輯分散、難維護）。

**D3. 設定/紀錄落在使用者目錄 `~/.md-reviewer/`**
`history.json` 已在此。`pins` 來源優先序：`~/.md-reviewer/pins.json`（存在就用）→ 否則退回套件內建 `pins.example.json`。不自動建立使用者 pins（避免在唯讀 install 情境寫檔）；`pins.example.json` 預設**只含註解範例、active 清單為空**，確保開箱無任何個人 pins。`~` 展開沿用既有 `expandHome`。
- 替代：pins 留 install 目錄 → 否決（全域安裝唯讀；且會再次個人化）。

**D4. `server.cjs` 最小改動**
僅改 `PINS_FILE` 解析為「使用者設定 + example fallback」。端點、token、Host 檢查、閒置自關、history 全不動 → 行為零迴歸、diff 最小、易 review。

**D5. 版本與文件**
新套件身分從 `0.1.0` 起算（語意化版本、tag 驅動，依作者 git 規範）。`README.md`（英文，GitHub 預設）+ `README.zh-Hant.md`（繁中），互相連結；`CHANGELOG.md` 記 `0.1.0` 首發。

**D6. Node 版本下限 `>=18`**
CLI 用全域 `fetch`；`server.cjs` 用 `URL`、`readdirSync({withFileTypes})`（皆 Node 18 滿足）。`engines.node` 標 `>=18`，npm 安裝時對過舊環境告警。

## Risks / Trade-offs

- 瀏覽器自動開啟在 headless/WSL/SSH 不一定成功 → CLI 偵測開啟指令失敗時**改印 URL** 供手動貼上。
- 作者只有 Windows，Mac/Linux 路徑為推理未實測 → 標為已知風險；CLI 平台分支邏輯保持簡單、README 註明歡迎回報。
- Node 18 下限排除極舊環境 → 可接受，`engines` 明示。
- **BREAKING**：作者既有 `pins.json`（含私人路徑）位置改變 → 遷移步驟把內容搬到 `~/.md-reviewer/pins.json`。
- Port 8771 衝突 → 維持現狀行為（未處理）；列為已知限制，env 覆寫留待後續。
- Windows `.cmd` 非 ASCII 註解在某些 codepage 誤判 → 沿用「註解保持 ASCII」慣例。

## Migration Plan

1. **Phase 1（本 repo、本機）**：搬入引擎/前端、加 `package.json`/CLI/設定重構/文件；本機（Windows）驗證 `npx .`、`node bin/...` 流程跑通。
2. **Phase 2**：用 GitHub MCP 建 repo 並推送；`npm publish`（作者 npm 帳號授權，人工）。
3. **Phase 3**：經 `claude-config` 把 `~/.claude/tools/md-reviewer` 改成消費發布套件；把作者現有 pins 搬到 `~/.md-reviewer/pins.json`。
4. **Rollback**：Phase 3 確認前，`ClaudeCodeManager/tools/md-reviewer` 原封不動；若發布或消費失敗，退回內嵌版。

## Open Questions

- 作者是否已有 npm 帳號可發布 `claudecode-md-reviewer`（unscoped，無需 scope）。→ Phase 2 前確認。
- Mac/Linux 是否有環境可實測 CLI；無則以「社群回報」補。
