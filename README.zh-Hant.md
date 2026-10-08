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
2. 在左邊文章中**選取文字** → 選取旁出現小工具列：
   - **複製**：只把選取的文字以純文字放進剪貼簿（工具列留著，可以接著按 **加註**）；
   - **加註**：打開加註框 → 選分類（見[註解分類](#註解分類)，預設「見說明」）、寫意見
     → **儲存**（或 `Ctrl+Enter`）。

   工具列出現時焦點不會跳過去：按 `Tab` 進入工具列，用方向鍵切換按鈕、`Enter` 執行、
   `Esc` 收起。滑鼠選字後用 `Shift`＋方向鍵微調選取，放開 `Shift` 時工具列會重新出現。
3. 註解即時自動存成同目錄的 `<檔名>.review.json`，右上角顯示「已自動儲存」。
4. 作者讀 `<檔名>.review.json` 依每則的分類續做；或按 **📋 複製給 Claude** 把未解決
   註解連同分類與處理方式複製成純文字,直接貼回 AI 對話。
5. 審完滿意了，按工具列的 **☐ 標記審閱完成**（見[審閱完成紀錄](#審閱完成紀錄)）。

長文件往下捲之後，閱讀區右下角會出現 **↑** 鈕，按一下回到頂端。

## 註解分類

每則註解都帶一個分類，告訴作者這則要怎麼處理。分類同時用顏色、螢光開頭的符號與
卡片上的名稱標示，不必靠顏色也分得出來；建立後也可以在卡片上改分類。每則若另有意見，
以意見補充的條件為準。

- **※ 見說明** (`see-comment`) — 照意見文字處理。意見可能是修改要求、提問或補充資訊；是提問就先在回覆裡回答，不一定要改文件。
- **✓ 同意** (`agree`) — 審閱者認同這段。不要修改，也不必回報。
- **? 請展開解釋** (`explain-more`) — 這段寫得太簡略，讀者看不懂。在文件裡把這段補寫清楚，說明它是什麼、為什麼、怎麼做；只在回覆裡解釋不算完成。
- **⇄ 提出不同的方式供選擇** (`offer-alternatives`) — 審閱者不想直接定案。列出 2～3 個可行的做法與各自的取捨，請使用者選；使用者選定之前不要修改文件。
- **− 刪除這些字** (`delete-text`) — 刪掉引用的文字（只刪引文，不是整段），再調整前後語句，讓文意通順。
- **↺ 第一性原理重新評估** (`rethink-first-principles`) — 這個做法的前提可能錯了。回到它要解決的問題重新推導，回報結論；結論跟原做法不同時，才改寫設計並說明理由。
- **+ 不反向列舉** (`state-positively`) — 這段用「不做 X、不做 Y」列出反面。改寫成正面描述要做什麼。
- **⊘ 此功能取消** (`drop-feature`) — 這個功能不做了。把它從文件拿掉；同一個變更的其他文件（例如提案、設計、規格）也一併拿掉，只為它存在的段落一起刪。回報拿掉了哪些地方。

只有「見說明」必須寫意見，其他分類可以留空。「同意」不算待辦：不計入未解決數徽章、
標記審閱完成前的確認，以及「複製給 Claude」的未解決數；新增「同意」也不會取消審閱
完成紀錄。0.7.0 以前建立的註解沒有分類，不論原本是什麼顏色，一律當「見說明」。

## 審閱完成紀錄

每份文件都可以留一筆「審閱完成」紀錄，隨時看得出它審完了沒。

- 按工具列的 **☐ 標記審閱完成**。紀錄（時間＋你當時看的那一版文字的指紋）存進該
  文件的 `.review.json`，文件也會移出 **📥 本次待審**。
- 之後文件若被修改，按鈕會變成 **⚠ 完成後已修改 · 重新標記完成**，左側清單那一列
  也從 **已審** 變成 **需重審**。文字若改回當初核可的版本，就又算完成。
- 還有未解決註解（「同意」不算）時標記完成，會先跟你確認。對已完成的文件新增「同意」
  以外的註解，會自動取消完成紀錄（有新意見就不算審完）。手動取消也會先確認。
- 磁碟上的檔案比畫面上的新時，必須先重新載入才能標記，確保紀錄對應的是你真的看過
  的那一版。

## 文件被修改後：註解卡片顯示新舊差異

每則註解都會記住加註當下那一段的 Markdown 原文（以及前後兩段的第一行）。作者改了
文件之後，右側註解欄會告訴你每一則發生了什麼：

- **沒變**：不另外顯示；段落就算搬了位置，螢光也會跟著走。
- **✎ 原文已修改**：以字為單位顯示新舊差異（刪掉的劃線、新增的上底色）；已解決的
  註解收在 **顯示差異** 裡。
- **✎ 原段落已刪除或大幅改寫**：顯示舊文，不再標螢光，行號顯示成「原 L42」。

文件開著時，若磁碟上的檔案被改了，幾秒內頁面就會提示 **↻ 重新載入以查看差異**。
0.6.0 以前建立的註解沒有記住原段落，仍照舊用引用文字定位；引用文字找不到時會標示
「原文可能已修改」。

## 跨設備

註解和審閱完成紀錄存在**文件旁邊**的 `<檔名>.review.json`，不是存在某台機器的資料
庫裡。所以它們會持久保存，而且文件到哪裡、它們就跟到哪裡：

- **Git**：把 `.review.json` 跟 `.md` 一起 commit。先確認它沒有被忽略：
  `git check-ignore -v doc.review.json` 會印出忽略它的那條規則（含全域 gitignore），
  把那條刪掉即可。也要記得：審閱意見從此會留在版本歷史裡，公開 repo 人人看得到。
- **雲端同步資料夾**（OneDrive、Dropbox、iCloud）：不用做任何事。但這類工具不會合併
  檔案內容，兩台機器同時改同一份審閱，結果會是其中一版，或多出一份「衝突副本」。
- **改檔名或搬移**文件時，`.review.json` 要一起搬（兩個檔都用 `git mv`）。
- **每台設備都要用 0.7.0 以上**：0.5.x 存檔時會把完成紀錄丟掉，0.6.x 會把每則註解的
  分類丟掉。意見空白的註解（例如只標了「刪除這些字」）在舊版存檔後，分類會被丟掉，
  變成沒有內容的註解。
- 比對文字時會忽略換行符號、BOM 與行尾空白，所以同一份檔案在 Windows（CRLF）和
  macOS（LF）上判斷一致。

**不會**跟著走的：本次待審、收藏、過往紀錄、釘選文件（存在各台機器的
`~/.md-reviewer/`，以絕對路徑為鍵）以及介面語言。換到另一台機器時，「已審／需重審」
標籤只會出現在那台機器清單裡有的文件上。

`.review.json` 讀不懂時（例如有 git 合併衝突標記），審閱器會明白告訴你，並且在你修好
之前**不存檔**，絕不覆蓋它。解衝突的方法：把兩邊的 `annotations` 陣列合併，
`updatedAt` 任選一邊。同理，如果你開檔之後別的分頁或設備存過註解，你的存檔會被擋下並
請你重新載入，而不是蓋掉對方的修改。

## 左側清單：待審、收藏、過往紀錄、釘選文件

點工具列 **☰** 開關左欄、**💬** 開關右側註解欄（兩者狀態都會記住）。每筆顯示檔名
+ `所在資料夾 · 專案` + 未解決註解數徽章 + 一顆 ⭐ 收藏星號。收藏／過往紀錄／全域
文件三區的標題可點摺疊（過往紀錄、全域文件預設摺疊）。分四區：

- **📥 本次待審** — 這次 session 透過 CLI 推來要你審的文件。server 重啟即清空
  （＝一個 session）。
- **⭐ 收藏** — 在任何一列點星即可加入收藏。收藏存在伺服器端
  `~/.md-reviewer/favorites.json`（重開瀏覽器、在這台機器換瀏覽器都還在；不會跨機器
  同步），與 pins 各自獨立。
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

## 最佳工作流：接進你的 AI

這個迴路在 AI 主動驅動時最有威力。分兩層——先設好第一層,需要再加第二層。

### 1. 觸發指示（核心機制）

「AI 產出文件 → 審閱器開」這個連鎖,靠的是**一條指示**,不是魔法。把這段加進你的
`CLAUDE.md` / agent 系統 prompt——由模型判斷「夠不夠份量才推」:

> 產出有份量的 `.md` 後,執行
> `npx claudecode-md-reviewer "<該 md 的絕對路徑>"` 讓使用者加註。當使用者說
> 「依審閱續做」時,讀同目錄的 `<base>.review.json`,依 `kind` 逐條處理 `status` 為
> `"open"` 的註解(沒有 `kind` 當 `see-comment`;`agree` 不必處理;各分類的處理方式
> 見 md-reviewer README 的「註解分類」一節):用 `line` + `quote` 定位、`comment`
> 是補充的條件。quote 找不到時,
> 用 `context.block`(加註當下的段落原文快照,不是要還原成的目標)找最相近的段落;
> `line` 僅供參考。**不要**自行改動 `.review.json`(尤其不要寫入 `review` 欄位,
> 審閱完成只由使用者標記),回報哪幾條已處理即可,由使用者自行標記「已解決」。

因為審閱器**每 4 秒輪詢**,只要開著一次,之後的推送會自動冒進 **📥 本次待審**。

### 2. 進階（可選）：Claude Code deterministic hook

如果你要**保證**專案裡每個寫出的 Markdown 都進佇列(不靠模型記得),裝一個
`PostToolUse` hook:

```bash
# 在專案根目錄——會寫 ./.claude/settings.json（已存在則先備份）
npx claudecode-md-reviewer --hook
# 或指定某個 settings 檔：
npx claudecode-md-reviewer --hook /path/to/.claude/settings.json
```

它加的 hook 會在 `Write` 後跑 `scripts/hook-open.mjs`。這個 handler **只有在審閱器
已經跑著時才把檔案塞進待審**——不會自己起 server、也不會彈瀏覽器,所以平常寫程式時
完全安靜。等效的手動設定:

```json
{
  "hooks": {
    "PostToolUse": [
      { "matcher": "Write",
        "hooks": [ { "type": "command", "command": "node \"<path>/scripts/hook-open.mjs\"" } ] }
    ]
  }
}
```

「值得才審」用第一層(模型判斷),「這些一律進佇列」用第二層(hook);兩者可並存。

### 註解檔格式（`*.review.json`）

```json
{
  "file": "design.md",
  "schema": 1,
  "updatedAt": "2026-06-21T03:40:00.000Z",
  "review": { "status": "done", "at": "2026-06-21T05:00:00.000Z", "hash": "3f2a..." },
  "annotations": [
    {
      "line": 42,
      "quote": "這段邏輯有問題",
      "comment": "改成先檢查 null",
      "kind": "see-comment",
      "status": "open",
      "id": "a...",
      "createdAt": "...",
      "context": { "block": "如果 x 成立，這段邏輯有問題。", "prev": "## 規則", "next": "- 第二步" }
    }
  ]
}
```

- `line`：對應 `.md` 原始行號（1-based，該文字所在區塊的起始行）。文件修改後會跟著
  段落走，下次你改動註解時寫回檔案。
- `quote`：你選取的原文片段（給作者就近定位用）。
- `comment`：你的審閱意見；一律是字串，`see-comment` 以外的分類可能是空字串 `""`。
- `kind`（0.7.0 起）：八種[註解分類](#註解分類)之一。0.7.0 以前建立的註解沒有
  `kind`，一律當 `see-comment`。
- `color`：只出現在 0.7.0 以前建立的舊註解，已不再使用。
- `status`：`open`（待處理）/ `resolved`（已解決）。
- `context`（0.6.0 起）：加註當下那一段的 Markdown 原文，加上前後兩段的第一行。用來
  顯示新舊差異，之後不再更新。
- `review`（0.6.0 起，選填）：只有標記審閱完成時才有；`hash` 是當時核可那一版文字的
  SHA-256 指紋。只由審閱器介面寫入。

## 架構與安全

- `server.cjs`：Node HTTP server，只 `listen('127.0.0.1', 8771)`。端點
  `GET /api/file`、`POST /api/save`、`POST /api/review`、`GET /api/sidebar`、`POST /api/enqueue`、
  `POST /api/dequeue`、`POST /api/favorite`、`GET /api/locales`、`GET /api/locale`、
  `GET /api/browse`、`GET /api/ping`。
- 前端拆成 `reviewer.html` + `reviewer.css` + `reviewer.js`（後兩者由
  `/reviewer.css`、`/reviewer.js` 送出，純程式碼、免 token）。`reviewer-diff.js`
  放文字比對與差異的純函式，瀏覽器和 server 共用（`npm test` 會檢查它）。
- **安全寫入**：每次存檔都帶上它最後看到的 `updatedAt`；註解檔讀不懂、或分頁已過時，
  server 一律回 409 拒寫，沒管到的欄位原樣保留。
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
