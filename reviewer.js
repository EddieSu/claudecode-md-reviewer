"use strict";
/* ───────────────────────── state ───────────────────────── */
const state = {
  file:"", fileName:"", token:"", mdText:"",
  annotations:[], dirty:false, pending:null, popColor:"yellow",
  sb:null, tagFilter:null,                 // sb=最近一次 sidebar 資料;tagFilter=目前選的專案標籤(null=全部)
  favPaths:new Set(),                      // 目前收藏的路徑集合（決定星號實心/空心）
};
const COLORS = ["yellow","green","pink","blue"];
const COLORHEX = {yellow:"#fff3a3",green:"#b8f0c4",pink:"#ffc9d8",blue:"#bcd9ff"};
const $ = s => document.querySelector(s);

/* ───────────────────────── i18n ───────────────────────── */
let STRINGS = {}, EN = {};                       // STRINGS=目前語言;EN=英文 fallback
function t(key, vars){
  let s = (STRINGS[key] != null) ? STRINGS[key] : (EN[key] != null ? EN[key] : key);
  if(vars) for(const k in vars) s = s.split("{"+k+"}").join(vars[k]);
  return s;
}
async function fetchLocale(code){
  try{ const r=await fetch("/api/locale?code="+encodeURIComponent(code)+"&token="+encodeURIComponent(state.token));
       const d=await r.json(); return d.ok ? d.strings : null; }catch(_){ return null; }
}
function applyLocale(){                           // 套用到靜態 DOM + 重跑動態 render
  document.querySelectorAll("[data-i18n]").forEach(el=>{ el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-ph]").forEach(el=>{ el.placeholder = t(el.dataset.i18nPh); });
  document.querySelectorAll("[data-i18n-title]").forEach(el=>{ el.title = t(el.dataset.i18nTitle); });
  document.querySelectorAll("[data-i18n-html]").forEach(el=>{ el.innerHTML = t(el.dataset.i18nHtml); });
  renderSide(); if(state.sb) renderSidebar(); updateBadge();
}
function pickInitial(codes){                       // 記住的選擇 → 瀏覽器語言最佳匹配 → en → 第一個
  let saved=null; try{ saved=localStorage.getItem("mdr-lang"); }catch(_){}
  if(saved && codes.includes(saved)) return saved;
  const nav=(navigator.language||"").toLowerCase();
  let hit=codes.find(c=>c.toLowerCase()===nav);
  if(!hit) hit=codes.find(c=>c.toLowerCase().split("-")[0]===nav.split("-")[0]);
  return hit || (codes.includes("en")?"en":codes[0]);
}
async function initLocales(){
  let list=[];
  try{ const r=await fetch("/api/locales?token="+encodeURIComponent(state.token)); const d=await r.json(); if(d.ok) list=d.locales||[]; }catch(_){}
  if(!list.length) list=[{code:"en",name:"English"}];
  const codes=list.map(l=>l.code);
  EN = (await fetchLocale("en")) || {};
  const active = pickInitial(codes);
  STRINGS = (active==="en") ? EN : ((await fetchLocale(active)) || EN);
  const sel=$("#lang"); sel.innerHTML=list.map(l=>`<option value="${escapeHtml(l.code)}">${escapeHtml(l.name)}</option>`).join("");
  sel.value=active; document.documentElement.lang=active;
  applyLocale();
}
$("#lang").addEventListener("change", async e=>{
  const code=e.target.value;
  try{ localStorage.setItem("mdr-lang",code); }catch(_){}
  STRINGS = (code==="en") ? EN : ((await fetchLocale(code)) || EN);
  document.documentElement.lang=code; applyLocale();
});

/* ───────────────────────── markdown → html (source-line tagged) ───────────────────────── */
function escapeHtml(s){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function safeUrl(u){ return /^\s*(javascript|vbscript|data):/i.test(u)?"#":u; }
function safeImg(u){ return /^\s*(javascript|vbscript):/i.test(u)?"#":u; }
function inline(s){
  const codes=[], M=String.fromCharCode(1);
  s=s.replace(/`([^`]+)`/g,function(m,c){codes.push(c);return M+(codes.length-1)+M;});
  s=escapeHtml(s);
  s=s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g,(m,a,u)=>`<img alt="${a}" src="${safeImg(u)}" style="max-width:100%">`);
  s=s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,(m,t,u)=>`<a href="${safeUrl(u)}" target="_blank" rel="noopener">${t}</a>`);
  s=s.replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>");
  s=s.replace(/__([^_]+)__/g,"<strong>$1</strong>");
  s=s.replace(/(^|[^*])\*([^*\n]+)\*/g,"$1<em>$2</em>");
  s=s.replace(/~~([^~]+)~~/g,"<del>$1</del>");
  s=s.replace(new RegExp(M+"(\\d+)"+M,"g"),function(m,n){return "<code>"+escapeHtml(codes[+n])+"</code>";});
  return s;
}
const itemRe = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
function isBlockStart(l){
  return /^\s*#{1,6}\s/.test(l) || /^\s*(```|~~~)/.test(l) || /^\s*([-*_])\1\1+\s*$/.test(l)
      || /^\s*>/.test(l) || itemRe.test(l) || /^\s*<!--/.test(l) || /^\s*\|/.test(l);
}
function renderList(block, startNo){
  const items=[]; let cur=null;
  for(let k=0;k<block.length;k++){
    const m=block[k].match(itemRe);
    if(m){ cur={indent:m[1].replace(/\t/g,"    ").length, ordered:/\d/.test(m[2]), content:m[3], line:startNo+k, sub:[]}; items.push(cur); }
    else if(cur && block[k].trim()!=="") cur.content += " "+block[k].trim();
  }
  const root=[], stack=[{indent:-1,sub:root}];
  for(const it of items){
    while(stack.length>1 && it.indent<=stack[stack.length-1].indent) stack.pop();
    stack[stack.length-1].sub.push(it); stack.push(it);
  }
  return emit(root);
  function emit(arr){
    if(!arr.length) return "";
    let h="", i=0;
    while(i<arr.length){
      const ordered=arr[i].ordered;
      h += ordered?"<ol>":"<ul>";
      while(i<arr.length && arr[i].ordered===ordered){
        const it=arr[i];
        const t=it.content.match(/^\[([ xX])\]\s+(.*)$/);
        const inner = t ? `<input type="checkbox" disabled ${/[xX]/.test(t[1])?"checked":""}> `+inline(t[2]) : inline(it.content);
        h += `<li data-line="${it.line}">${inner}${emit(it.sub)}</li>`;
        i++;
      }
      h += ordered?"</ol>":"</ul>";
    }
    return h;
  }
}
function renderTable(lines, startNo){
  const split = r => r.replace(/^\s*\|?/,"").replace(/\|?\s*$/,"").split(/\s*\|\s*/).map(x=>x.trim());
  const head = split(lines[0]);
  let h=`<table data-line="${startNo}"><thead><tr>`+head.map(c=>`<th>${inline(c)}</th>`).join("")+"</tr></thead><tbody>";
  for(let r=2;r<lines.length;r++){ h+="<tr>"+split(lines[r]).map(c=>`<td>${inline(c)}</td>`).join("")+"</tr>"; }
  return h+"</tbody></table>";
}
function renderMarkdown(src, baseLine){
  baseLine = baseLine || 0;
  const lines = src.replace(/\r\n?/g,"\n").split("\n");
  let html="", i=0;
  while(i<lines.length){
    const line=lines[i], ln=i+1+baseLine;
    if(/^\s*<!--/.test(line)){
      let j=i; while(j<lines.length && !/-->/.test(lines[j])) j++;
      if(j<lines.length){ const after=lines[j].slice(lines[j].indexOf("-->")+3); i=j+1; if(after.trim()){ lines.splice(i,0,after); } }
      else { i=j; }
      continue;
    }
    if(/^\s*$/.test(line)){ i++; continue; }
    const fence=line.match(/^\s*(```+|~~~+)(.*)$/);
    if(fence){ const fc=fence[1][0], flen=fence[1].length, info=(fence[2]||"").trim().toLowerCase(); i++; let code="";
      const isClose=l=>{ const t=l.trim(); if(t.length<flen) return false; for(const ch of t){ if(ch!==fc) return false; } return true; };
      while(i<lines.length && !isClose(lines[i])){ code+=lines[i]+"\n"; i++; }
      i++; const body=code.replace(/\n$/,"");
      if(info==="mermaid") html+=`<div class="mermaid" data-line="${ln}">${escapeHtml(body)}</div>`;
      else html+=`<pre data-line="${ln}"><code>${escapeHtml(body)}</code></pre>`;
      continue; }
    const h=line.match(/^\s*(#{1,6})\s+(.*)$/);
    if(h){ html+=`<h${h[1].length} data-line="${ln}">${inline(h[2])}</h${h[1].length}>`; i++; continue; }
    if(/^\s*([-*_])\1\1+\s*$/.test(line)){ html+=`<hr data-line="${ln}">`; i++; continue; }
    if(/^\s*>/.test(line)){ let buf=[]; const s=ln;
      while(i<lines.length && /^\s*>/.test(lines[i])){ buf.push(lines[i].replace(/^\s*>\s?/,"")); i++; }
      html+=`<blockquote data-line="${s}">${renderMarkdown(buf.join("\n"), s-1)}</blockquote>`; continue; }
    if(/^\s*\|/.test(line) && i+1<lines.length && /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(lines[i+1]) && /-/.test(lines[i+1])){
      let tbl=[]; const s=ln;
      while(i<lines.length && /\|/.test(lines[i]) && lines[i].trim()!==""){ tbl.push(lines[i]); i++; }
      html+=renderTable(tbl,s); continue; }
    if(itemRe.test(line)){ const s=ln; let block=[];
      while(i<lines.length){
        if(itemRe.test(lines[i])){ block.push(lines[i]); i++; continue; }
        if(/^\s+\S/.test(lines[i])){ block.push(lines[i]); i++; continue; }
        if(/^\s*$/.test(lines[i]) && i+1<lines.length && (itemRe.test(lines[i+1])||/^\s+\S/.test(lines[i+1]))){ block.push(""); i++; continue; }
        break;
      }
      html+=renderList(block,s); continue; }
    let para=[line], pLn=ln; i++;
    while(i<lines.length && !/^\s*$/.test(lines[i]) && !isBlockStart(lines[i])){ para.push(lines[i]); i++; }
    html+=`<p data-line="${pLn}">${inline(para.join(" "))}</p>`;
  }
  return html;
}

/* ───────────────────────── doc render + highlight ───────────────────────── */
function renderDoc(){ $("#docInner").innerHTML = renderMarkdown(state.mdText); applyHighlights(); renderMermaid(); }
let mermaidLoading=null;
function loadMermaid(){                            // 懶載 vendored mermaid（只在文件含 mermaid 區塊時）
  if(window.mermaid) return Promise.resolve(window.mermaid);
  if(mermaidLoading) return mermaidLoading;
  mermaidLoading=new Promise((resolve,reject)=>{
    const s=document.createElement("script"); s.src="/vendor/mermaid.min.js";
    s.onload=()=>resolve(window.mermaid); s.onerror=()=>reject(new Error("mermaid load failed"));
    document.head.appendChild(s);
  });
  return mermaidLoading;
}
async function renderMermaid(){
  const nodes=[...document.querySelectorAll("#docInner .mermaid")];
  if(!nodes.length) return;                        // 無 mermaid 區塊 → 完全不載 lib
  let mermaid;
  try{ mermaid=await loadMermaid(); }catch(e){ return; }   // 載入失敗 → 維持顯示原始碼
  const dark=window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches;
  try{ mermaid.initialize({startOnLoad:false, securityLevel:"strict", theme:dark?"dark":"default"}); }catch(e){}
  let n=0;
  for(const el of nodes){
    const src=el.textContent;
    try{ const {svg}=await mermaid.render("mmd"+(n++)+"_"+Math.floor(Math.random()*1e6), src); el.innerHTML=svg; }
    catch(e){ const pre=document.createElement("pre"); pre.setAttribute("data-line", el.getAttribute("data-line")||"");
      const c=document.createElement("code"); c.textContent=src; pre.appendChild(c); el.replaceWith(pre); }   // 壞圖 → 退回程式碼塊
  }
}
function clearHighlights(){
  document.querySelectorAll("mark.anno").forEach(m=>{ const p=m.parentNode; while(m.firstChild) p.insertBefore(m.firstChild,m); p.removeChild(m); if(p.normalize) p.normalize(); });
  document.querySelectorAll(".hl-block").forEach(b=>b.classList.remove("hl-block"));
}
function applyHighlights(){
  clearHighlights();
  for(const a of state.annotations){
    const block = $('#docInner [data-line="'+a.line+'"]');
    if(!block) continue;
    if(!wrapQuote(block,a)) block.classList.add("hl-block");
  }
}
function wrapQuote(block,a){
  if(!a.quote) return false;
  const w=document.createTreeWalker(block,NodeFilter.SHOW_TEXT);
  let n;
  while(n=w.nextNode()){
    const idx=n.nodeValue.indexOf(a.quote);
    if(idx<0) continue;
    const range=document.createRange();
    range.setStart(n,idx); range.setEnd(n,idx+a.quote.length);
    const mark=document.createElement("mark");
    mark.className="anno "+a.color+(a.status==="resolved"?" resolved":"");
    mark.dataset.id=a.id; mark.title=a.comment;
    mark.addEventListener("click",()=>focusCard(a.id));
    try{ range.surroundContents(mark); return true; }catch(e){ return false; }
  }
  return false;
}

/* ───────────────────────── selection → popover ───────────────────────── */
$("#doc").addEventListener("mouseup",e=>{
  if($("#pop").contains(e.target)) return;
  setTimeout(()=>{
    const sel=window.getSelection();
    const text=sel.toString().replace(/\s+/g," ").trim();
    if(!text){ return; }
    const anchor=sel.anchorNode;
    const el=anchor.nodeType===3?anchor.parentElement:anchor;
    const block=el && el.closest("[data-line]");
    if(!block || !$("#docInner").contains(block)) return;
    const rect=sel.getRangeAt(0).getBoundingClientRect();
    state.pending={line:+block.dataset.line, quote:text};
    openPopover(rect);
  },10);
});
function openPopover(rect){
  const pop=$("#pop");
  $("#popQuote").textContent="「"+state.pending.quote+"」";
  $("#popText").value=""; state.popColor="yellow"; renderSwatch();
  pop.style.display="block";
  let top=rect.bottom+8, left=rect.left;
  const pw=300, ph=pop.offsetHeight||200;
  if(left+pw>innerWidth-12) left=innerWidth-pw-12;
  if(top+ph>innerHeight-12) top=Math.max(12,rect.top-ph-8);
  pop.style.left=left+"px"; pop.style.top=top+"px";
  $("#popText").focus();
}
function closePopover(){ $("#pop").style.display="none"; state.pending=null; }
function renderSwatch(){
  $("#popSwatch").innerHTML = COLORS.map(c=>`<div class="sw${c===state.popColor?" sel":""}" data-c="${c}" style="background:${COLORHEX[c]}"></div>`).join("");
}
$("#popSwatch").addEventListener("click",e=>{ const c=e.target.dataset.c; if(c){ state.popColor=c; renderSwatch(); }});
$("#popCancel").addEventListener("click",closePopover);
$("#popSave").addEventListener("click",saveAnnotation);
$("#popText").addEventListener("keydown",e=>{ if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)) saveAnnotation(); if(e.key==="Escape") closePopover(); });
function saveAnnotation(){
  const comment=$("#popText").value.trim();
  if(!comment){ $("#popText").focus(); return; }
  state.annotations.push({
    id:"a"+Date.now().toString(36)+Math.floor(performance.now()).toString(36),
    line:state.pending.line, quote:state.pending.quote, comment,
    color:state.popColor, status:"open", createdAt:new Date().toISOString()
  });
  closePopover(); window.getSelection().removeAllRanges();
  applyHighlights(); renderSide(); markDirty();
}

/* ───────────────────────── sidebar ───────────────────────── */
function renderSide(){
  const showR=$("#showResolved").checked;
  const list=$("#sideList");
  const items=state.annotations.filter(a=>showR||a.status!=="resolved").sort((a,b)=>a.line-b.line);
  if(!state.fileName){ list.innerHTML='<div class="empty">'+t("side.noFile")+'</div>'; return; }
  if(!items.length){ list.innerHTML='<div class="empty">'+t("side.noAnno")+'</div>'; return; }
  list.innerHTML=items.map(a=>`
    <div class="card${a.status==="resolved"?" resolved":""}" data-id="${escapeHtml(a.id)}">
      <div class="meta">
        <span class="dot" style="background:${COLORHEX[a.color]||"#ccc"}"></span>
        <span>L${a.line}</span><span class="spacer" style="flex:1"></span>
        <span>${a.status==="resolved"?t("card.resolvedTag"):""}</span>
      </div>
      <div class="q" title="${escapeHtml(t("card.quoteTitle"))}">${escapeHtml(a.quote||"")}</div>
      <div class="c">${escapeHtml(a.comment)}</div>
      <div class="acts">
        <a data-act="goto">${t("card.goto")}</a>
        <a data-act="toggle">${a.status==="resolved"?t("card.reopen"):t("card.markResolve")}</a>
        <a data-act="del">${t("card.delete")}</a>
      </div>
    </div>`).join("");
}
$("#sideList").addEventListener("click",e=>{
  const card=e.target.closest(".card"); if(!card) return;
  const id=card.dataset.id, act=e.target.dataset.act;
  if(act==="toggle"){ const a=state.annotations.find(x=>x.id===id); a.status=a.status==="resolved"?"open":"resolved"; applyHighlights(); renderSide(); markDirty(); }
  else if(act==="del"){ state.annotations=state.annotations.filter(x=>x.id!==id); applyHighlights(); renderSide(); markDirty(); }
  else gotoAnno(id);
});
$("#showResolved").addEventListener("change",renderSide);
function gotoAnno(id){
  const a=state.annotations.find(x=>x.id===id); if(!a) return;
  const block=$('#docInner [data-line="'+a.line+'"]'); if(!block) return;
  block.scrollIntoView({behavior:"smooth",block:"center"});
  block.classList.remove("flash"); void block.offsetWidth; block.classList.add("flash");
}
function focusCard(id){
  const card=$('#sideList .card[data-id="'+id+'"]');
  if(card){ card.scrollIntoView({behavior:"smooth",block:"center"}); card.classList.remove("flash"); void card.offsetWidth; card.classList.add("flash"); }
}

/* ───────────────────────── data layer (server) ───────────────────────── */
function buildSidecar(){
  return { file:state.fileName, schema:1, updatedAt:new Date().toISOString(),
    annotations:state.annotations.map(a=>({line:a.line,quote:a.quote,comment:a.comment,color:a.color,status:a.status,id:a.id,createdAt:a.createdAt})) };
}
function updateBadge(msg){
  const b=$("#saveBadge");
  if(msg){ b.textContent=msg; b.className="badge"; return; }
  if(state.dirty){ b.textContent=t("save.saving"); b.className="badge dirty"; }
  else b.textContent="";
}
let saveTimer=null;
function markDirty(){ state.dirty=true; updateBadge(); clearTimeout(saveTimer); saveTimer=setTimeout(saveToServer,500); }
async function saveToServer(){
  if(!state.file) return;
  try{
    const r=await fetch("/api/save",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({path:state.file, token:state.token, annotations:state.annotations})});
    const d=await r.json();
    if(d.ok){ state.dirty=false; updateBadge(t("save.saved",{time:new Date().toLocaleTimeString()})); loadSidebar(); }
    else updateBadge(t("save.failPrefix")+d.error);
  }catch(e){ updateBadge(t("save.failPrefix")+e.message); }
}
async function loadFile(absPath){
  try{
    const r=await fetch("/api/file?path="+encodeURIComponent(absPath)+"&token="+encodeURIComponent(state.token));
    const d=await r.json();
    if(!d.ok){ $("#docInner").innerHTML='<div class="empty">'+escapeHtml(t("msg.openFailPrefix"))+'<b>'+escapeHtml(absPath)+'</b>'+escapeHtml(t("msg.openFailSuffix"))+'<br>'+escapeHtml(d.error)+'</div>'; return; }
    state.file=d.path; state.fileName=d.name; state.mdText=d.content; state.annotations=d.annotations||[]; state.dirty=false;
    $("#fileName").textContent="📄 "+d.name;
    $("#pathInput").value=d.path;
    renderDoc(); renderSide(); updateBadge(); loadSidebar();   // 開檔後刷新清單(更新紀錄/未讀/反白)
  }catch(e){ $("#docInner").innerHTML='<div class="empty">'+escapeHtml(t("msg.noServer"))+escapeHtml(e.message)+'</div>'; }
}

/* ───────────────────────── toolbar ───────────────────────── */
$("#btnPick").addEventListener("click",()=>{               // 開內建檔案瀏覽器
  let start=null;
  if(state.file) start=state.file.replace(/[\\/][^\\/]*$/,"");   // 從目前檔案所在目錄起
  openBrowse(start);
});
async function browseTo(dir){
  const q = (dir==null) ? "" : "&dir="+encodeURIComponent(dir);
  try{
    const r=await fetch("/api/browse?token="+encodeURIComponent(state.token)+q);
    const d=await r.json();
    if(!d.ok){ $("#browseList").innerHTML='<div class="navempty">'+escapeHtml(d.error||"error")+'</div>'; return; }
    $("#browsePath").textContent = (d.dir==="::drives") ? t("browse.drives") : d.dir;
    let html="";
    if(d.parent!==null && d.parent!==undefined) html+='<div class="browse-row" data-go="'+escapeHtml(d.parent)+'">📁 ..</div>';
    for(const e of d.entries){
      if(e.isDir) html+='<div class="browse-row" data-go="'+escapeHtml(e.path)+'">📁 '+escapeHtml(e.name)+'</div>';
      else html+='<div class="browse-row" data-file="'+escapeHtml(e.path)+'">📄 '+escapeHtml(e.name)+'</div>';
    }
    $("#browseList").innerHTML = html || '<div class="navempty">'+t("browse.empty")+'</div>';
  }catch(e){ $("#browseList").innerHTML='<div class="navempty">'+escapeHtml(t("msg.noServer")+e.message)+'</div>'; }
}
function openBrowse(dir){ $("#browse").style.display="flex"; browseTo(dir); }
function closeBrowse(){ $("#browse").style.display="none"; }
$("#browseList").addEventListener("click",e=>{
  const row=e.target.closest(".browse-row"); if(!row) return;
  if(row.dataset.file){ closeBrowse(); $("#pathInput").value=row.dataset.file; loadFile(row.dataset.file); return; }
  if(row.dataset.go!==undefined) browseTo(row.dataset.go);
});
$("#browseClose").addEventListener("click",closeBrowse);
$("#browse").addEventListener("click",e=>{ if(e.target.id==="browse") closeBrowse(); });
document.addEventListener("keydown",e=>{ if(e.key==="Escape" && $("#browse").style.display!=="none") closeBrowse(); });
$("#pathInput").addEventListener("keydown",e=>{ if(e.key==="Enter"){ const v=e.target.value.trim(); if(v) loadFile(v); } });
$("#btnReload").addEventListener("click",()=>{ if(state.file) loadFile(state.file); });

$("#btnExport").addEventListener("click",()=>{
  if(!state.fileName){ return; }
  const blob=new Blob([JSON.stringify(buildSidecar(),null,2)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=state.fileName.replace(/\.md$/i,"")+".review.json"; a.click();
});
$("#btnCopy").addEventListener("click",async()=>{
  if(!state.annotations.length){ alert(t("msg.noAnnotations")); return; }
  const open=state.annotations.filter(a=>a.status!=="resolved").sort((a,b)=>a.line-b.line);
  const done=state.annotations.filter(a=>a.status==="resolved");
  let out=t("copy.header",{file:state.fileName})+t("copy.summary",{total:state.annotations.length,open:open.length});
  open.forEach((a,i)=>{ out+="["+(i+1)+"] L"+a.line+"「"+a.quote+"」\n→ "+a.comment+"\n\n"; });
  if(done.length){ out+=t("copy.resolvedSection")+done.map(a=>"- L"+a.line+"「"+a.quote+"」→ "+a.comment).join("\n")+"\n"; }
  try{ await navigator.clipboard.writeText(out); $("#btnCopy").textContent=t("bar.copied"); setTimeout(()=>$("#btnCopy").textContent=t("bar.copy"),1500); }
  catch(e){ prompt(t("msg.copyFail"),out); }
});

/* ───────────────────────── left list (待審佇列 + 過往紀錄) ───────────────────────── */
async function loadSidebar(){
  try{
    const r=await fetch("/api/sidebar?token="+encodeURIComponent(state.token));
    const d=await r.json(); if(!d.ok) return;
    state.sb={ queue:d.queue||[], history:d.history||[], pinned:d.pinned||[], favorites:d.favorites||[] };
    renderSidebar();
  }catch(e){/* server 還沒起來,稍後輪詢會補上 */}
}
const tagOf = e => e.tag || "(未分類)";
function dedupUnion(){                            // 各區依路徑去重(待審>收藏>紀錄>全域 取首見)
  const {queue,history,pinned,favorites}=state.sb||{queue:[],history:[],pinned:[],favorites:[]};
  const seen=new Set(), out=[];
  for(const e of [...queue,...favorites,...history,...pinned]){ if(seen.has(e.path)) continue; seen.add(e.path); out.push(e); }
  return out;
}
function chip(label,count,active,onClick){
  const c=document.createElement("div"); c.className="tagchip"+(active?" active":"");
  c.innerHTML=escapeHtml(label)+'<span class="n">'+count+'</span>';
  c.addEventListener("click",onClick); return c;
}
function renderTagBar(union){
  const counts=new Map();
  for(const e of union){ const t=tagOf(e); counts.set(t,(counts.get(t)||0)+1); }
  const tags=[...counts.entries()].sort((a,b)=> b[1]-a[1] || a[0].localeCompare(b[0]));
  const bar=$("#tagBar"); bar.innerHTML="";
  bar.appendChild(chip("全部", union.length, state.tagFilter===null, ()=>setTag(null)));
  tags.forEach(([t,c])=> bar.appendChild(chip(t, c, state.tagFilter===t, ()=>setTag(t))));
}
function setTag(t){ state.tagFilter=t; renderSidebar(); }
function navItem(e, kind){
  const row=document.createElement("div");
  row.className="navrow"+(e.path===state.file?" active":"");
  row.dataset.path=e.path;
  const badge   = e.open>0 ? '<span class="navbadge" title="'+escapeHtml(t("nav.badgeTitle"))+'">'+e.open+'</span>' : '';
  const unread  = (kind==="q" && e.unread) ? '<span class="udot" title="'+escapeHtml(t("nav.unreadTitle"))+'"></span>' : '';
  const dismiss = kind==="q" ? '<span class="navx" data-act="dismiss" title="'+escapeHtml(t("nav.dismissTitle"))+'">✓</span>' : '';
  const faved   = state.favPaths.has(e.path);
  const star    = '<span class="navstar'+(faved?' on':'')+'" data-act="fav" title="'+escapeHtml(faved?t("nav.unfavTitle"):t("nav.favTitle"))+'">'+(faved?'★':'☆')+'</span>';
  const subtxt  = e.tag ? (e.dir && e.dir!==e.tag ? e.dir+" · "+e.tag : e.tag) : (e.dir||"");
  const sub     = subtxt ? '<div class="sub">'+escapeHtml(subtxt)+'</div>' : '';
  row.title=e.path;
  row.innerHTML='<div class="row1"><span class="nm">📄 '+escapeHtml(e.name)+'</span>'+badge+unread+dismiss+star+'</div>'+sub;
  row.addEventListener("click",ev=>{
    if(ev.target.dataset.act==="dismiss"){ ev.stopPropagation(); dequeue(e.path); return; }
    if(ev.target.dataset.act==="fav"){ ev.stopPropagation(); toggleFavorite(e.path); return; }
    loadFile(e.path);
  });
  return row;
}
function renderSidebar(){
  const {queue,history,pinned,favorites}=state.sb||{queue:[],history:[],pinned:[],favorites:[]};
  state.favPaths=new Set((favorites||[]).map(e=>e.path));   // 星號實心/空心依此
  const union=dedupUnion();
  if(state.tagFilter!==null && !union.some(e=>tagOf(e)===state.tagFilter)) state.tagFilter=null;  // 標籤沒了就回全部
  renderTagBar(union);

  const fSec=$("#fSec");                          // 🔍 篩選結果區:選了標籤才出現,跨各區去重
  if(state.tagFilter===null){ fSec.style.display="none"; }
  else {
    fSec.style.display="";
    $("#fLabel").textContent=state.tagFilter;
    const items=union.filter(e=>tagOf(e)===state.tagFilter).sort((a,b)=>a.name.localeCompare(b.name));
    $("#fCount").textContent=items.length;
    const fl=$("#fList"); fl.innerHTML="";
    if(!items.length) fl.innerHTML='<div class="navempty">'+t("nav.filterEmpty")+'</div>';
    else items.forEach(e=>fl.appendChild(navItem(e,"f")));
  }

  const ql=$("#qList"), favl=$("#favList"), hl=$("#hList"), pl=$("#pList");   // 各區永遠完整
  $("#qCount").textContent=queue.length;
  ql.innerHTML=""; favl.innerHTML=""; hl.innerHTML=""; pl.innerHTML="";
  if(!queue.length) ql.innerHTML='<div class="navempty">'+t("nav.queueEmpty")+'</div>';
  else queue.forEach(e=>ql.appendChild(navItem(e,"q")));
  if(!favorites.length) favl.innerHTML='<div class="navempty">'+t("nav.favoritesEmpty")+'</div>';
  else favorites.forEach(e=>favl.appendChild(navItem(e,"v")));
  if(!history.length) hl.innerHTML='<div class="navempty">'+t("nav.historyEmpty")+'</div>';
  else history.forEach(e=>hl.appendChild(navItem(e,"h")));
  if(!pinned.length) pl.innerHTML='<div class="navempty">'+t("nav.pinnedEmpty")+'</div>';
  else pinned.forEach(e=>pl.appendChild(navItem(e,"p")));
}
async function toggleFavorite(p){                  // ⭐ 點星 → 切換收藏 → 重新整理清單
  const on=!state.favPaths.has(p);
  try{ await fetch("/api/favorite",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({path:p, token:state.token, on})}); }catch(e){}
  loadSidebar();
}
async function dequeue(p){
  try{ await fetch("/api/dequeue",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({path:p, token:state.token})}); }catch(e){}
  loadSidebar();
}
$("#navRefresh").addEventListener("click",loadSidebar);
$("#navToggle").addEventListener("click",()=>{ $("#nav").classList.toggle("collapsed"); try{ localStorage.setItem("mdr-nav-collapsed",$("#nav").classList.contains("collapsed")?"1":"0"); }catch(e){} });
$("#sideToggle").addEventListener("click",()=>{ $("#side").classList.toggle("collapsed"); try{ localStorage.setItem("mdr-side-collapsed",$("#side").classList.contains("collapsed")?"1":"0"); }catch(e){} });

/* 左欄分區摺疊（收藏/紀錄/全域;預設 紀錄+全域 摺疊） */
const NAV_SECTIONS=[["fav","mdr-sec-fav",false],["hist","mdr-sec-hist",true],["pin","mdr-sec-pin",true]];  // [data-sec, key, 預設摺疊]
function secCollapsed(key,def){ try{ const v=localStorage.getItem(key); return v===null?def:v==="1"; }catch(e){ return def; } }
function applySectionStates(){
  for(const [sec,key,def] of NAV_SECTIONS){
    const h=document.querySelector('.navsec-toggle[data-sec="'+sec+'"]'); if(!h) continue;
    const navsec=h.closest(".navsec"), collapsed=secCollapsed(key,def);
    navsec.classList.toggle("collapsed",collapsed);
    const caret=h.querySelector(".caret"); if(caret) caret.textContent=collapsed?"▸":"▾";
  }
}
document.addEventListener("click",e=>{
  const h=e.target.closest(".navsec-toggle"); if(!h) return;
  const navsec=h.closest(".navsec"), collapsed=!navsec.classList.contains("collapsed");
  navsec.classList.toggle("collapsed",collapsed);
  const caret=h.querySelector(".caret"); if(caret) caret.textContent=collapsed?"▸":"▾";
  try{ localStorage.setItem("mdr-sec-"+h.dataset.sec, collapsed?"1":"0"); }catch(_){}
});

/* ───────────────────────── init ───────────────────────── */
(async function init(){
  const p=new URLSearchParams(location.search);
  state.token=p.get("token")||"";
  try{ if(localStorage.getItem("mdr-nav-collapsed")==="1") $("#nav").classList.add("collapsed"); }catch(e){}
  try{ if(localStorage.getItem("mdr-side-collapsed")==="1") $("#side").classList.add("collapsed"); }catch(e){}
  applySectionStates();                    // 左欄分區摺疊狀態（紀錄/全域 預設摺疊）
  await initLocales();                     // 先載語言,後續 render 才有正確字串
  loadSidebar();
  setInterval(loadSidebar, 4000);          // 輪詢:Agent 新推送會自動冒進「本次待審」
  const file=p.get("file");
  if(file) loadFile(file);
})();
window.addEventListener("beforeunload",e=>{ if(state.dirty){ e.preventDefault(); e.returnValue="x"; } });
