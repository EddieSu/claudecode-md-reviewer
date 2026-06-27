## 1. i18n 框架（先做，後續新字串才走 t()）

- [x] 1.1 建 `locales/en.json`、`locales/zh-Hant.json`：把現有 HTML/JS ~40–50 條字串抽成 dot-namespaced key（兩檔 key 集合一致）
- [x] 1.2 `server.cjs`：新增 `GET /api/locales`（合併 bundled `locales/` + `~/.md-reviewer/locales/`，user 優先，回 `[{code,name}]`）與 `GET /api/locale?code=`（code 以 `^[A-Za-z][A-Za-z0-9-]*$` 驗證、擋路徑穿越；user dir 優先）
- [x] 1.3 `reviewer.js`：實作 `t(key)`（active locale → `en` → raw key fallback）、locale 載入、`applyLocale()`（走訪 `[data-i18n]`/`[data-i18n-ph]`/`[data-i18n-title]`/`[data-i18n-html]` + 重跑動態 render）
- [x] 1.4 `reviewer.html`：靜態字串改掛 `data-i18n*` 屬性；`reviewer.js` 動態字串改 `t()`
- [x] 1.5 `#bar` 加 `<select id="lang">`：由 `/api/locales` 帶出；初值 = `mdr-lang` → `navigator.language` 最佳匹配 → `en`；change 時持久化並 `applyLocale()`

## 2. 收藏夾（favorites）

- [x] 2.1 `server.cjs`：`~/.md-reviewer/favorites.json` 讀寫（`{favorites:[{path,addedAt}]}`）；`POST /api/favorite {path,token,on}`（token 保護、切換、寫檔）
- [x] 2.2 `server.cjs`：`/api/sidebar` 回傳新增 `favorites` 陣列（每筆 `metaOf`+`annCounts`、最新在前）
- [x] 2.3 `reviewer.js`：`navItem` 加 ⭐ 控制（`data-act="fav"`，依 `e.path ∈ favPaths` 決定實心/空心），點擊 POST 後 reload sidebar
- [x] 2.4 `reviewer.html`/`reviewer.js`：新增「⭐ 收藏」區，從 `state.sb.favorites` render；`renderSidebar()` 建 favPaths Set 傳下去
- [x] 2.5 確認與 pins 並存互不影響（favorites 獨立於唯讀 pins）

## 3. 右側欄收合（collapsible-right-sidebar）

- [x] 3.1 `reviewer.html`：`#bar` 加 `#sideToggle` 鈕（💬，收合時仍可達）
- [x] 3.2 `reviewer.css`：`#side.collapsed{display:none}`（鏡射 `#nav`）
- [x] 3.3 `reviewer.js`：toggle `.collapsed`、持久化 `mdr-side-collapsed`、init 時還原（與 nav 並行）

## 4. 套件與文件

- [x] 4.1 `package.json`：`files` 加入 `locales/`、版本 → `0.2.0`；`npm pack --dry-run` 確認含 `locales/*.json`
- [x] 4.2 README（EN + zh-Hant）：新增 Favorites、Language、「如何新增一個語言」三段
- [x] 4.3 CHANGELOG：新增 `0.2.0` 條目

## 5. 本機驗證（Phase 收尾）

- [x] 5.1 i18n：locale 兩語言 key 對齊(54)、`/api/locales` 列 en+zh-Hant、drop-in `xx.json` 出現於清單、缺 key 回退 en（伺服器端 + 靜態交叉驗證；瀏覽器視覺切換未點測）
- [x] 5.2 收藏：`/api/favorite` toggle 新增/移除、跨重啟讀 `favorites.json`、bad token 403、與 pins 並存
- [x] 5.3 右側欄：`#side.collapsed` + `mdr-side-collapsed` 邏輯（靜態驗證；瀏覽器收合動作未點測）
- [x] 5.4 逐條對照 specs scenario 自檢通過；隔離埠(8779)+暫存 HISTORY_DIR 測試,不碰 live 8771 與真實 `~/.md-reviewer/`
