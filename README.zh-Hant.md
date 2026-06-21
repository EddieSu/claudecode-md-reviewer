# claudecode-md-reviewer（繁體中文）

一個本機、零依賴的 **Markdown 審閱迴路**：AI（或任何人）產出一份 `.md`，你在
瀏覽器裡選字加註，註解就存在檔案旁邊，讓作者讀回去續做。

> English version: [README.md](./README.md).

為 **Claude Code** 工作流打造——「Claude 產文件 → 你加註 → Claude 讀回你的意見
續做」——但任何「人在迴路中」的 Markdown 審閱都適用。

## 它不只是 viewer

靠一個 **on-demand 的本機小 server**（`server.cjs`，只綁 `127.0.0.1`、token
保護、閒置 30 分鐘自動結束）直接讀寫檔案，所以**開啟即已載入檔案、零授權點擊、
任何路徑都行**。註解存成旁置的 `*.review.json`，作者或你的 AI 直接讀得到。

## 需求

- PATH 上有 **Node.js >= 18**。
- 現代瀏覽器（Edge / Chrome / Firefox / Safari，純 HTTP + fetch）。

## 安裝與執行

```bash
# 不安裝，跑一次
npx claudecode-md-reviewer 路徑/檔案.md

# 或全域安裝，之後用 md-reviewer 指令
npm install -g claudecode-md-reviewer
md-reviewer 路徑/檔案.md

# 不指定檔案開啟審閱器（在上方輸入框貼路徑）
md-reviewer
```

從原始碼：

```bash
git clone https://github.com/EddieSu/claudecode-md-reviewer.git
cd claudecode-md-reviewer
node bin/md-reviewer.js DEMO.md   # 或：npm run demo
```

CLI 會確認本機 server 在跑（沒跑就背景起一個）、把檔案推進待審佇列、開預設
瀏覽器。在 headless / WSL / SSH 等沒有瀏覽器啟動器的環境，會改印出網址讓你手動開。

## 怎麼用

1. 跑 `md-reviewer <檔案.md>`（Windows 也可雙擊 `open-reviewer.cmd` 後貼路徑）;
   也可按路徑框旁的 **…** 鈕,用內建檔案瀏覽器選 `.md`。
2. 在左邊文章中**選取文字** → 跳出加註框 → 選顏色、寫意見 → **加註**（或
   `Ctrl+Enter`）。
3. 註解即時自動存成同目錄的 `<檔名>.review.json`，右上角顯示「已自動儲存」。
4. 作者讀 `<檔名>.review.json` 依意見續做；或按 **📋 複製給 Claude** 把未解決
   註解複製成純文字,直接貼回 AI 對話。

## 左側清單：待審、收藏、過往紀錄、釘選文件

點工具列 **☰** 開關左欄、**💬** 開關右側註解欄（兩者狀態都會記住）。每筆顯示檔名
+ `所在資料夾 · 專案` + 未解決註解數徽章 + 一顆 ⭐ 收藏星號。收藏／過往紀錄／全域
文件三區的標題可點摺疊（過往紀錄、全域文件預設摺疊）。分四區：

- **📥 本次待審** — 這次 session 透過 CLI 推來要你審的文件。server 重啟即清空
  （＝一個 session）。
- **⭐ 收藏** — 在任何一列點星即可加入收藏。收藏存在伺服器端
  `~/.md-reviewer/favorites.json`（跨瀏覽器/機器都在），與 pins 各自獨立。
- **🕘 過往紀錄** — 你開過的文件，依最近開啟排序、上限 50 筆，跨 session 持久化在
  `~/.md-reviewer/history.json`。
- **📌 釘選文件** — 你想隨時一鍵叫出的文件白名單。

### 設定釘選文件

pins 先讀 `~/.md-reviewer/pins.json`（存在就用），否則退回套件內建的
`pins.example.json`（預設為空）。要設定自己的：

```bash
mkdir -p ~/.md-reviewer
cp "$(npm root -g)/claudecode-md-reviewer/pins.example.json" ~/.md-reviewer/pins.json
```

```json
{
  "pins": [
    "~/notes/README.md",
    "~/Documents/specs"
  ]
}
```

每筆可是單一 `.md` 檔，或一個資料夾（只列正下方一層的 `.md`、不遞迴）。開頭 `~`
＝使用者家目錄。每個檔自動帶一個**專案標籤** = 往上找最近含 `.git` 的資料夾名，
左欄可依專案標籤篩選。

## 語言

介面內建 **English** 與 **繁體中文**，工具列有語言選單。首次開啟會依瀏覽器語言
自動選；之後記住你的選擇（`localStorage`）。

**自行新增語言**：把一個 JSON 檔丟進 `~/.md-reviewer/locales/` 即可，選單會自動
列出，完全不用改安裝目錄：

```bash
mkdir -p ~/.md-reviewer/locales
cp "$(npm root -g)/claudecode-md-reviewer/locales/en.json" ~/.md-reviewer/locales/fr.json
# 翻譯 fr.json 的值;把 "_name" 設成顯示名稱,例如 "Français"
```

缺少的 key 會自動退回英文,所以翻一半也能用。使用者檔若與內建語言同 code,會覆蓋內建。

## 搭配 Claude Code（或任何 AI）

這個迴路在 AI 主動驅動時最有威力。把類似這段指示加進你的 agent 系統／專案 prompt：

> 產出有份量的 `.md` 後，執行
> `npx claudecode-md-reviewer "<該 md 的絕對路徑>"` 讓使用者加註。當使用者說
> 「依審閱續做」時，讀同目錄的 `<base>.review.json`，逐條處理 `status` 為
> `"open"` 的註解：用 `line` + `quote` 定位、依 `comment` 修改。**不要**自行改動
> `.review.json`，回報哪幾條已處理即可，由使用者自行標記「已解決」。

### 註解檔格式（`*.review.json`）

```json
{
  "file": "design.md",
  "schema": 1,
  "updatedAt": "2026-06-21T03:40:00.000Z",
  "annotations": [
    {
      "line": 42,
      "quote": "這段邏輯有問題",
      "comment": "改成先檢查 null",
      "color": "yellow",
      "status": "open",
      "id": "a...",
      "createdAt": "..."
    }
  ]
}
```

- `line`：對應 `.md` 原始行號（1-based，該文字所在區塊的起始行）。
- `quote`：你選取的原文片段（給作者就近定位用）。
- `comment`：你的審閱意見。
- `status`：`open`（待處理）/ `resolved`（已解決）。

## 架構與安全

- `server.cjs`：Node HTTP server，只 `listen('127.0.0.1', 8771)`。端點
  `GET /api/file`、`POST /api/save`、`GET /api/sidebar`、`POST /api/enqueue`、
  `POST /api/dequeue`、`POST /api/favorite`、`GET /api/locales`、`GET /api/locale`、
  `GET /api/browse`、`GET /api/ping`。
- 前端拆成 `reviewer.html` + `reviewer.css` + `reviewer.js`（後兩者由
  `/reviewer.css`、`/reviewer.js` 送出，純程式碼、免 token）。
- **token**：server 啟動時產生隨機 token，只寫進暫存檔給 launcher；頁面從 URL
  取得，`/api/*` 需附 token → 擋掉同機其他瀏覽器分頁的偽造請求。
- **Host 檢查**：只接受 `Host: 127.0.0.1:8771` / `localhost:8771` → 擋 DNS rebinding。
- **閒置自動結束**：30 分鐘沒請求就自己退出。

## 已知限制

- 需要 Node.js 在 PATH。Port 預設 `8771`;設 `MDR_PORT` 可改埠（例如與正在跑的另
  一個實例並存）。
- 高亮以「選取片段」精準標示；若選取**跨越粗體／連結／多段落**，會退回整塊標示
  （行號仍正確，加註與定位不受影響）。
- 輕量自製 Markdown 渲染器，**不支援**：無前導 `|` 的 GFM 表格、表格內跳脫管線
  `\|`、setext 底線標題（`===`/`---`）、有序清單自訂起始號碼、HTML 內嵌。皆為
  呈現細節差異，不影響加註定位。涵蓋：標題／強調／行內碼／圍欄碼／清單（含巢狀、
  待辦）／引用／表格／分隔線／連結圖片／HTML 註解,以及 **mermaid** 圖表
  （` ```mermaid `,由內建離線 build 渲染）。

## 授權

[MIT](./LICENSE) © Eddie Su
