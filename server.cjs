// MD Reviewer 本機小 server（on-demand，閒置自動結束，非常駐輪詢）。
// 只綁 127.0.0.1；/api/* 需 token（token 只透過暫存檔給 launcher，不經 /api/ping 外洩），
// 擋掉同機其他瀏覽器分頁的偽造請求。
"use strict";
const http=require("http"), fs=require("fs"), path=require("path"), os=require("os"), crypto=require("crypto");
const { normText } = require("./reviewer-diff.js");   // 與前端共用同一份正規化（hash 才會跨平台一致）

const PORT = Number(process.env.MDR_PORT) || 8771;    // 預設 8771；MDR_PORT 可改埠（並存多實例）
const TOKEN = crypto.randomBytes(16).toString("hex");
const INFO = path.join(os.tmpdir(), "md-reviewer-server"+(PORT===8771?"":"-"+PORT)+".json");
const APP = path.join(__dirname, "reviewer.html");
const IDLE_MS = 30 * 60 * 1000;   // 閒置 30 分鐘自動結束
const HISTORY_DIR = path.join(os.homedir(), ".md-reviewer");
const HISTORY_FILE = path.join(HISTORY_DIR, "history.json");  // 過往閱讀紀錄(跨 session 持久化)
const HISTORY_MAX = 50;
const USER_PINS_FILE = path.join(HISTORY_DIR, "pins.json");          // 第三區白名單：使用者可寫的 pins（優先）
const EXAMPLE_PINS_FILE = path.join(__dirname, "pins.example.json"); // 套件內建範例（fallback，唯讀）
const FAV_FILE = path.join(HISTORY_DIR, "favorites.json");           // ⭐ 收藏（使用者可寫，UI 點星增減）
const LOCALES_DIR = path.join(__dirname, "locales");                 // 內建 locale（en / zh-Hant）
const USER_LOCALES_DIR = path.join(HISTORY_DIR, "locales");          // 使用者 locale（丟一個 JSON 即新增/覆蓋語言）
let queue = [];                   // 本次 session Agent 推送的待審佇列(server 重啟即清空)
let lastReq = Date.now();

function send(res, code, body, type){ res.writeHead(code, {"Content-Type": type || "application/json; charset=utf-8"}); res.end(body); }
function json(res, code, obj){ send(res, code, JSON.stringify(obj), "application/json; charset=utf-8"); }
function hostOk(req){ const h = req.headers.host || ""; return h === "127.0.0.1:"+PORT || h === "localhost:"+PORT; }
function sidecarOf(fp){ return fp.replace(/\.md$/i,"") + ".review.json"; }
function readBody(req, cb){ let b=""; req.on("data",c=>{ b+=c; if(b.length>5e6) req.destroy(); }); req.on("end",()=>{ try{ cb(JSON.parse(b)); }catch(_){ cb(null); } }); }
function hashOf(text){ return crypto.createHash("sha256").update(normText(text),"utf8").digest("hex"); }   // 文件指紋
const hashCache = new Map();                      // abs -> {mtimeMs,size,hash}：輪詢時檔案沒變就不重讀重算
function fileHash(fp){
  const abs=path.resolve(fp); let st;
  try{ st=fs.statSync(abs); }catch(_){ return null; }
  const c=hashCache.get(abs);
  if(c && c.mtimeMs===st.mtimeMs && c.size===st.size) return c.hash;
  let h; try{ h=hashOf(fs.readFileSync(abs,"utf8")); }catch(_){ return null; }
  hashCache.set(abs, {mtimeMs:st.mtimeMs, size:st.size, hash:h});
  return h;
}
function readSidecar(fp){                         // {data:null}=還沒有；{data}=正常；{error}=存在但讀不懂（例如 git 衝突標記）→ 絕不覆寫
  let raw;
  try{ raw=fs.readFileSync(sidecarOf(fp),"utf8"); }catch(e){ return e.code==="ENOENT" ? {data:null} : {error:e.message}; }
  try{ const d=JSON.parse(raw); if(!d || typeof d!=="object" || Array.isArray(d)) throw new Error("not a JSON object"); return {data:d}; }
  catch(e){ return {error:e.message}; }
}
// 受保護寫入（/api/save 與 /api/review 共用）：壞檔不寫、base 對不上不寫、沒管到的欄位原樣保留。
// 同步讀寫：單執行緒下「讀→比對→寫」中間不會插進別的請求。
function writeSidecar(fp, base, patch){
  const cur=readSidecar(fp);
  if(cur.error) return [409, {ok:false, error:"corrupt", detail:cur.error}];
  if((base||null)!==((cur.data && cur.data.updatedAt)||null)) return [409, {ok:false, error:"conflict"}];
  const out=Object.assign({}, cur.data, patch, { updatedAt:new Date().toISOString() });   // patch 裡 undefined 的欄位 → JSON 會略過 = 刪除
  try{ fs.writeFileSync(sidecarOf(fp), JSON.stringify(out,null,2)); }catch(e){ return [500, {ok:false, error:e.message}]; }
  return [200, {ok:true, sidecar:sidecarOf(fp), updatedAt:out.updatedAt, review:out.review||null}];
}
function annCounts(fp){
  const s=readSidecar(fp).data, a=(s && Array.isArray(s.annotations)) ? s.annotations : [];
  let review=null;                                // 有完成紀錄才讀檔算 hash
  if(s && s.review && s.review.status==="done") review={ state: s.review.hash===fileHash(fp) ? "done" : "stale", at:s.review.at };
  return { total:a.length, open:a.filter(x=>x.status!=="resolved").length, review };
}
const tagCache = new Map();                       // dir -> 專案標籤(git root 名),避免每次輪詢重走
function gitRoot(fp){                              // 往上找最近含 .git 的資料夾(.git 檔/資料夾皆算,含 worktree)
  const start = path.dirname(path.resolve(fp));
  if(tagCache.has(start)) return tagCache.get(start);
  let d=start, prev=null, tag=null;
  while(d && d!==prev){
    if(fs.existsSync(path.join(d,".git"))){ tag=path.basename(d); break; }
    prev=d; d=path.dirname(d);
  }
  tagCache.set(start, tag);
  return tag;
}
function metaOf(fp){ const abs=path.resolve(fp); return { path:abs, name:path.basename(abs), dir:path.basename(path.dirname(abs)), tag:gitRoot(abs) }; }
function readHistory(){
  try{ const a=JSON.parse(fs.readFileSync(HISTORY_FILE,"utf8")); return Array.isArray(a)?a:[]; }
  catch(_){ return []; }
}
function writeHistory(list){
  try{ fs.mkdirSync(HISTORY_DIR,{recursive:true}); fs.writeFileSync(HISTORY_FILE, JSON.stringify(list,null,2)); }catch(_){}
}
function touchHistory(fp){                       // 開檔即記一筆,移到最前,上限 HISTORY_MAX
  const m=metaOf(fp);
  let list=readHistory().filter(h=>path.resolve(h.path)!==m.path);
  list.unshift(Object.assign({}, m, { lastOpenedAt:new Date().toISOString() }));
  if(list.length>HISTORY_MAX) list=list.slice(0,HISTORY_MAX);
  writeHistory(list);
}
function expandHome(p){ return String(p).replace(/^~(?=[\\/]|$)/, os.homedir()); }
function pinsFile(){                              // 使用者 ~/.md-reviewer/pins.json 存在就用,否則退回套件內建範例
  return fs.existsSync(USER_PINS_FILE) ? USER_PINS_FILE : EXAMPLE_PINS_FILE;
}
function readPins(){                              // pins.json: { pins: [ "~/notes/README.md", "~/Documents/specs", ... ] }
  try{ const j=JSON.parse(fs.readFileSync(pinsFile(),"utf8")); return Array.isArray(j.pins)?j.pins:[]; }
  catch(_){ return []; }
}
function listPinned(){                            // 白名單 → 攤平成 .md 清單(資料夾只列正下方一層、不遞迴)
  const out=[], seen=new Set();
  const add=(fp)=>{ const abs=path.resolve(fp); if(seen.has(abs)||!fs.existsSync(abs)) return; seen.add(abs); out.push(Object.assign({}, metaOf(abs), annCounts(abs))); };
  for(const raw of readPins()){
    const fp=expandHome(raw);
    let st; try{ st=fs.statSync(fp); }catch(_){ continue; }   // 路徑不存在就略過
    if(st.isDirectory()){
      let ents=[]; try{ ents=fs.readdirSync(fp,{withFileTypes:true}); }catch(_){}
      ents.filter(e=>e.isFile() && /\.md$/i.test(e.name) && !e.name.startsWith("."))
          .sort((a,b)=>a.name.localeCompare(b.name))
          .forEach(e=>add(path.join(fp,e.name)));
    } else if(/\.md$/i.test(fp)){ add(fp); }
  }
  return out;
}
function readFavorites(){                          // favorites.json: { favorites:[ {path,addedAt}, ... ] }（最新在前）
  try{ const j=JSON.parse(fs.readFileSync(FAV_FILE,"utf8")); return Array.isArray(j.favorites)?j.favorites:[]; }
  catch(_){ return []; }
}
function writeFavorites(list){
  try{ fs.mkdirSync(HISTORY_DIR,{recursive:true}); fs.writeFileSync(FAV_FILE, JSON.stringify({favorites:list},null,2)); }catch(_){}
}
function listFavorites(){                          // 攤平成 .md 清單（存在者），沿用 readFavorites 的「最新在前」順序
  const out=[];
  for(const f of readFavorites()){
    const abs=path.resolve(expandHome(f.path||""));
    if(!fs.existsSync(abs)) continue;
    out.push(Object.assign({}, metaOf(abs), annCounts(abs), { addedAt:f.addedAt }));
  }
  return out;
}
const LOCALE_CODE_RE = /^[A-Za-z][A-Za-z0-9-]*$/; // 擋路徑穿越 + 合法語言碼
function listLocales(){                            // 合併內建 + 使用者（同 code 由 user 覆蓋 name），回 [{code,name}]
  const codes=new Map();
  const scan=dir=>{ let ents=[]; try{ ents=fs.readdirSync(dir); }catch(_){ return; }
    for(const fn of ents){ const m=/^([A-Za-z][A-Za-z0-9-]*)\.json$/.exec(fn); if(!m) continue;
      let name=m[1]; try{ const j=JSON.parse(fs.readFileSync(path.join(dir,fn),"utf8")); if(j&&j._name) name=j._name; }catch(_){}
      codes.set(m[1], name); } };
  scan(LOCALES_DIR); scan(USER_LOCALES_DIR);       // user 後掃 → 覆蓋同 code
  return [...codes.entries()].map(([code,name])=>({code,name})).sort((a,b)=>a.code.localeCompare(b.code));
}
function readLocale(code){                          // user 優先，回 JSON 物件或 null
  if(!LOCALE_CODE_RE.test(code)) return null;
  for(const dir of [USER_LOCALES_DIR, LOCALES_DIR]){
    try{ return JSON.parse(fs.readFileSync(path.join(dir, code+".json"),"utf8")); }catch(_){}
  }
  return null;
}
function listDrives(){                              // Windows：掃 A:-Z: 存在的磁碟根
  const out=[];
  for(let c=65;c<=90;c++){ const d=String.fromCharCode(c)+":\\"; try{ if(fs.existsSync(d)) out.push(d); }catch(_){} }
  return out;
}
function listDir(dir){                               // 列一層：子資料夾 + .md 檔（略過隱藏）
  let ents;
  try{ ents=fs.readdirSync(dir,{withFileTypes:true}); }catch(e){ return {error:e.message}; }
  const out=[];
  for(const ent of ents){
    if(ent.name.startsWith(".")) continue;
    let isDir=ent.isDirectory();
    if(ent.isSymbolicLink()){ try{ isDir=fs.statSync(path.join(dir,ent.name)).isDirectory(); }catch(_){ continue; } }
    if(isDir) out.push({name:ent.name, path:path.join(dir,ent.name), isDir:true});
    else if(/\.md$/i.test(ent.name)) out.push({name:ent.name, path:path.join(dir,ent.name), isDir:false});
  }
  out.sort((a,b)=> (a.isDir!==b.isDir)?(a.isDir?-1:1):a.name.localeCompare(b.name));
  return {entries:out};
}

const server = http.createServer((req, res)=>{
  lastReq = Date.now();
  if(!hostOk(req)){ json(res, 403, {ok:false, error:"bad host"}); return; }       // 擋 DNS rebinding
  const u = new URL(req.url, "http://127.0.0.1:"+PORT);
  const p = u.pathname;

  if(req.method==="GET" && (p==="/" || p==="/reviewer.html")){
    fs.readFile(APP, (e,d)=>{ if(e){ send(res,500,"reviewer.html missing","text/plain"); return; } send(res,200,d,"text/html; charset=utf-8"); });
    return;
  }
  if(req.method==="GET" && (p==="/reviewer.css" || p==="/reviewer.js" || p==="/reviewer-diff.js")){   // 靜態資產(純程式碼、無祕密,免 token,與 / 同層)
    const type = p.endsWith(".css") ? "text/css; charset=utf-8" : "text/javascript; charset=utf-8";
    fs.readFile(path.join(__dirname, p.slice(1)), (e,d)=>{ if(e){ send(res,404,"not found","text/plain"); return; } send(res,200,d,type); });
    return;
  }
  if(req.method==="GET" && p==="/vendor/mermaid.min.js"){   // vendored mermaid（純程式碼、免 token，與其他靜態資產同層）
    fs.readFile(path.join(__dirname,"vendor","mermaid.min.js"), (e,d)=>{ if(e){ send(res,404,"not found","text/plain"); return; } send(res,200,d,"text/javascript; charset=utf-8"); });
    return;
  }
  if(req.method==="GET" && p==="/api/ping"){ json(res,200,{ok:true}); return; }    // 不回 token

  if(req.method==="GET" && p==="/api/file"){
    if(u.searchParams.get("token")!==TOKEN){ json(res,403,{ok:false,error:"bad token"}); return; }
    const fp = u.searchParams.get("path") || "";
    if(!fp){ json(res,400,{ok:false,error:"no path"}); return; }
    fs.readFile(fp, "utf8", (e, content)=>{
      if(e){ json(res,404,{ok:false,error:"讀不到檔案: "+e.message}); return; }
      const sc=readSidecar(fp), s=sc.data||{};
      touchHistory(fp);                                     // 記入過往閱讀紀錄
      json(res,200,{ok:true, path:fp, dir:path.dirname(fp), name:path.basename(fp), content,
        annotations:Array.isArray(s.annotations)?s.annotations:[], review:s.review||null, updatedAt:s.updatedAt||null,
        hash:hashOf(content), sidecarError:sc.error||null});
    });
    return;
  }

  // 左側清單：本次待審佇列 + 過往閱讀紀錄（各帶未解決註解數），唯讀、token 保護。
  if(req.method==="GET" && p==="/api/sidebar"){
    if(u.searchParams.get("token")!==TOKEN){ json(res,403,{ok:false,error:"bad token"}); return; }
    const hist=readHistory();
    const histByPath=new Map(hist.map(h=>[path.resolve(h.path), h]));
    const qPaths=new Set();
    const queueOut=[];
    for(const q of queue){
      if(!fs.existsSync(q.path)) continue;                  // 檔案已不存在就略過
      qPaths.add(q.path);
      const h=histByPath.get(q.path);
      const unread = !h || new Date(h.lastOpenedAt) < new Date(q.pushedAt);   // 推送後尚未開過 = 未讀
      queueOut.push(Object.assign({}, metaOf(q.path), annCounts(q.path), { pushedAt:q.pushedAt, unread }));
    }
    const historyOut=[];
    for(const h of hist){
      const abs=path.resolve(h.path);
      if(qPaths.has(abs)) continue;                         // 已在待審區就不重複列
      if(!fs.existsSync(abs)) continue;                     // 檔案已不存在就略過
      historyOut.push(Object.assign({}, metaOf(abs), annCounts(abs), { lastOpenedAt:h.lastOpenedAt }));
    }
    let current=null;                                       // 目前開著的文件：讓前端發現「磁碟上已被改」
    const cur=u.searchParams.get("current");
    if(cur){ const sc=readSidecar(cur); current={ hash:fileHash(cur), updatedAt:(sc.data && sc.data.updatedAt)||null }; }
    json(res,200,{ok:true, queue:queueOut, history:historyOut, pinned:listPinned(), favorites:listFavorites(), current});
    return;
  }

  // i18n：可用語言清單（內建 + 使用者 ~/.md-reviewer/locales/）。
  if(req.method==="GET" && p==="/api/locales"){
    if(u.searchParams.get("token")!==TOKEN){ json(res,403,{ok:false,error:"bad token"}); return; }
    json(res,200,{ok:true, locales:listLocales()});
    return;
  }

  // i18n：單一語言字串包（user 優先；code 嚴格驗證擋路徑穿越）。
  if(req.method==="GET" && p==="/api/locale"){
    if(u.searchParams.get("token")!==TOKEN){ json(res,403,{ok:false,error:"bad token"}); return; }
    const code=u.searchParams.get("code")||"";
    const loc=readLocale(code);
    if(!loc){ json(res,404,{ok:false,error:"locale not found"}); return; }
    json(res,200,{ok:true, code, strings:loc});
    return;
  }

  // App 內建檔案瀏覽器（token 保護）：列一層目錄（子資料夾 + .md），給前端 modal 導覽。
  if(req.method==="GET" && p==="/api/browse"){
    if(u.searchParams.get("token")!==TOKEN){ json(res,403,{ok:false,error:"bad token"}); return; }
    const win = process.platform==="win32";
    let dir = u.searchParams.get("dir");
    if(dir==null || dir==="") dir = os.homedir();                       // 初始：家目錄
    if(dir==="::drives"){                                               // 磁碟清單（Windows）
      if(win){ json(res,200,{ok:true, dir:"::drives", parent:null, entries:listDrives().map(d=>({name:d,path:d,isDir:true}))}); return; }
      dir = "/";
    }
    const abs = path.resolve(dir);
    const r = listDir(abs);
    if(r.error){ json(res,200,{ok:false, error:r.error}); return; }
    const up = path.dirname(abs);
    const atRoot = up===abs;                                            // 磁碟根/檔系根
    const parent = atRoot ? (win ? "::drives" : null) : up;
    json(res,200,{ok:true, dir:abs, parent, entries:r.entries});
    return;
  }

  // ⭐ 收藏：切換某 .md 的收藏狀態，寫入 ~/.md-reviewer/favorites.json。
  if(req.method==="POST" && p==="/api/favorite"){
    readBody(req, d=>{
      if(!d || d.token!==TOKEN){ json(res,403,{ok:false,error:"bad token"}); return; }
      const fp=d.path || "";
      if(!/\.md$/i.test(fp)){ json(res,400,{ok:false,error:"path not .md"}); return; }
      const abs=path.resolve(fp);
      let list=readFavorites().filter(f=>path.resolve(expandHome(f.path||""))!==abs);
      if(d.on){ list.unshift({ path:abs, addedAt:new Date().toISOString() }); }  // 新增 → 置頂
      writeFavorites(list);
      json(res,200,{ok:true, on:!!d.on});
    });
    return;
  }

  // Agent 推送：把一份 .md 加進「本次待審」佇列（dedupe、移到最前）。
  if(req.method==="POST" && p==="/api/enqueue"){
    readBody(req, d=>{
      if(!d || d.token!==TOKEN){ json(res,403,{ok:false,error:"bad token"}); return; }
      const fp=d.path || "";
      if(!/\.md$/i.test(fp)){ json(res,400,{ok:false,error:"path not .md"}); return; }
      if(!fs.existsSync(fp)){ json(res,404,{ok:false,error:"file missing"}); return; }
      const abs=path.resolve(fp);
      queue=queue.filter(q=>q.path!==abs);
      queue.unshift({ path:abs, pushedAt:new Date().toISOString() });
      json(res,200,{ok:true});
    });
    return;
  }

  // 使用者把某筆移出「本次待審」（不影響過往紀錄）。
  if(req.method==="POST" && p==="/api/dequeue"){
    readBody(req, d=>{
      if(!d || d.token!==TOKEN){ json(res,403,{ok:false,error:"bad token"}); return; }
      const abs=path.resolve(d.path || "");
      queue=queue.filter(q=>q.path!==abs);
      json(res,200,{ok:true});
    });
    return;
  }

  if(req.method==="POST" && p==="/api/save"){
    readBody(req, d=>{
      if(!d){ json(res,400,{ok:false,error:"bad json"}); return; }
      if(d.token!==TOKEN){ json(res,403,{ok:false,error:"bad token"}); return; }
      const fp = d.path || "";
      if(!/\.md$/i.test(fp)){ json(res,400,{ok:false,error:"path not .md"}); return; }
      const [code, body] = writeSidecar(fp, d.base, { file:path.basename(fp), schema:1, annotations:Array.isArray(d.annotations)?d.annotations:[] });
      json(res, code, body);
    });
    return;
  }

  // 審閱完成紀錄：只動 review 欄位。done=true 時 hash 必須等於磁碟現值（畫面上的版本就是磁碟上的版本）。
  if(req.method==="POST" && p==="/api/review"){
    readBody(req, d=>{
      if(!d || d.token!==TOKEN){ json(res,403,{ok:false,error:"bad token"}); return; }
      const fp=d.path || "";
      if(!/\.md$/i.test(fp)){ json(res,400,{ok:false,error:"path not .md"}); return; }
      let disk; try{ disk=hashOf(fs.readFileSync(fp,"utf8")); }catch(e){ json(res,404,{ok:false,error:"file missing"}); return; }
      let review;                                           // undefined → 刪除紀錄
      if(d.done){
        if(!/^[0-9a-f]{64}$/.test(d.hash||"")){ json(res,400,{ok:false,error:"bad hash"}); return; }
        if(d.hash!==disk){ json(res,409,{ok:false,error:"stale"}); return; }
        review={ status:"done", at:new Date().toISOString(), hash:d.hash };
      }
      const [code, body] = writeSidecar(fp, d.base, { file:path.basename(fp), schema:1, review });
      json(res, code, body);
    });
    return;
  }

  json(res,404,{ok:false,error:"not found"});
});

server.on("error", e=>{ process.stderr.write("server error: "+e.message+"\n"); process.exit(1); });
server.listen(PORT, "127.0.0.1", ()=>{
  try{ fs.writeFileSync(INFO, JSON.stringify({port:PORT, token:TOKEN, pid:process.pid})); }catch(_){}
  process.stdout.write("READY "+PORT+"\n");
});

setInterval(()=>{ if(Date.now()-lastReq > IDLE_MS){ try{ fs.unlinkSync(INFO); }catch(_){}; process.exit(0); } }, 60*1000);
