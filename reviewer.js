"use strict";
/* ───────────────────────── state ───────────────────────── */
const state = {
  file:"", fileName:"", token:"", mdText:"",
  annotations:[], dirty:false, pending:null, popColor:"yellow",
  sb:null, tagFilter:null,                 // sb=最近一次 sidebar 資料;tagFilter=目前選的專案標籤(null=全部)
};
const COLORS = ["yellow","green","pink","blue"];
const COLORHEX = {yellow:"#fff3a3",green:"#b8f0c4",pink:"#ffc9d8",blue:"#bcd9ff"};
const $ = s => document.querySelector(s);

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
    if(fence){ const fc=fence[1][0], flen=fence[1].length; i++; let code="";
      const isClose=l=>{ const t=l.trim(); if(t.length<flen) return false; for(const ch of t){ if(ch!==fc) return false; } return true; };
      while(i<lines.length && !isClose(lines[i])){ code+=lines[i]+"\n"; i++; }
      i++; html+=`<pre data-line="${ln}"><code>${escapeHtml(code.replace(/\n$/,""))}</code></pre>`; continue; }
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
function renderDoc(){ $("#docInner").innerHTML = renderMarkdown(state.mdText); applyHighlights(); }
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
  if(!state.fileName){ list.innerHTML='<div class="empty">尚未開啟檔案</div>'; return; }
  if(!items.length){ list.innerHTML='<div class="empty">還沒有註解。<br>在左邊選取文字即可加註。</div>'; return; }
  list.innerHTML=items.map(a=>`
    <div class="card${a.status==="resolved"?" resolved":""}" data-id="${escapeHtml(a.id)}">
      <div class="meta">
        <span class="dot" style="background:${COLORHEX[a.color]||"#ccc"}"></span>
        <span>L${a.line}</span><span class="spacer" style="flex:1"></span>
        <span>${a.status==="resolved"?"✓ 已解決":""}</span>
      </div>
      <div class="q" title="原文">${escapeHtml(a.quote||"")}</div>
      <div class="c">${escapeHtml(a.comment)}</div>
      <div class="acts">
        <a data-act="goto">↦ 定位</a>
        <a data-act="toggle">${a.status==="resolved"?"重開":"標記解決"}</a>
        <a data-act="del">刪除</a>
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
  if(state.dirty){ b.textContent="儲存中…"; b.className="badge dirty"; }
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
    if(d.ok){ state.dirty=false; updateBadge("已自動儲存 "+new Date().toLocaleTimeString()); loadSidebar(); }
    else updateBadge("⚠ 存檔失敗:"+d.error);
  }catch(e){ updateBadge("⚠ 存檔失敗:"+e.message); }
}
async function loadFile(absPath){
  try{
    const r=await fetch("/api/file?path="+encodeURIComponent(absPath)+"&token="+encodeURIComponent(state.token));
    const d=await r.json();
    if(!d.ok){ $("#docInner").innerHTML='<div class="empty">無法開啟 <b>'+escapeHtml(absPath)+'</b>:<br>'+escapeHtml(d.error)+'</div>'; return; }
    state.file=d.path; state.fileName=d.name; state.mdText=d.content; state.annotations=d.annotations||[]; state.dirty=false;
    $("#fileName").textContent="📄 "+d.name;
    $("#pathInput").value=d.path;
    renderDoc(); renderSide(); updateBadge(); loadSidebar();   // 開檔後刷新清單(更新紀錄/未讀/反白)
  }catch(e){ $("#docInner").innerHTML='<div class="empty">連不到 server:'+escapeHtml(e.message)+'</div>'; }
}

/* ───────────────────────── toolbar ───────────────────────── */
$("#btnOpen").addEventListener("click",()=>{ const v=$("#pathInput").value.trim(); if(v) loadFile(v); });
$("#pathInput").addEventListener("keydown",e=>{ if(e.key==="Enter"){ const v=e.target.value.trim(); if(v) loadFile(v); } });
$("#btnReload").addEventListener("click",()=>{ if(state.file) loadFile(state.file); });

$("#btnExport").addEventListener("click",()=>{
  if(!state.fileName){ return; }
  const blob=new Blob([JSON.stringify(buildSidecar(),null,2)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=state.fileName.replace(/\.md$/i,"")+".review.json"; a.click();
});
$("#btnCopy").addEventListener("click",async()=>{
  if(!state.annotations.length){ alert("還沒有任何註解"); return; }
  const open=state.annotations.filter(a=>a.status!=="resolved").sort((a,b)=>a.line-b.line);
  const done=state.annotations.filter(a=>a.status==="resolved");
  let out="# 審閱回饋:"+state.fileName+"\n共 "+state.annotations.length+" 則(未解決 "+open.length+")\n\n";
  open.forEach((a,i)=>{ out+="["+(i+1)+"] L"+a.line+"「"+a.quote+"」\n→ "+a.comment+"\n\n"; });
  if(done.length){ out+="(已解決)\n"+done.map(a=>"- L"+a.line+"「"+a.quote+"」→ "+a.comment).join("\n")+"\n"; }
  try{ await navigator.clipboard.writeText(out); $("#btnCopy").textContent="✓ 已複製"; setTimeout(()=>$("#btnCopy").textContent="📋 複製給 Claude",1500); }
  catch(e){ prompt("複製失敗,請手動複製:",out); }
});

/* ───────────────────────── left list (待審佇列 + 過往紀錄) ───────────────────────── */
async function loadSidebar(){
  try{
    const r=await fetch("/api/sidebar?token="+encodeURIComponent(state.token));
    const d=await r.json(); if(!d.ok) return;
    state.sb={ queue:d.queue||[], history:d.history||[], pinned:d.pinned||[] };
    renderSidebar();
  }catch(e){/* server 還沒起來,稍後輪詢會補上 */}
}
const tagOf = e => e.tag || "(未分類)";
function dedupUnion(){                            // 三區依路徑去重(待審>紀錄>全域 取首見)
  const {queue,history,pinned}=state.sb||{queue:[],history:[],pinned:[]};
  const seen=new Set(), out=[];
  for(const e of [...queue,...history,...pinned]){ if(seen.has(e.path)) continue; seen.add(e.path); out.push(e); }
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
  const badge   = e.open>0 ? '<span class="navbadge" title="未解決註解">'+e.open+'</span>' : '';
  const unread  = (kind==="q" && e.unread) ? '<span class="udot" title="推送後尚未開啟"></span>' : '';
  const dismiss = kind==="q" ? '<span class="navx" data-act="dismiss" title="移出待審(不影響紀錄)">✓</span>' : '';
  const subtxt  = e.tag ? (e.dir && e.dir!==e.tag ? e.dir+" · "+e.tag : e.tag) : (e.dir||"");
  const sub     = subtxt ? '<div class="sub">'+escapeHtml(subtxt)+'</div>' : '';
  row.title=e.path;
  row.innerHTML='<div class="row1"><span class="nm">📄 '+escapeHtml(e.name)+'</span>'+badge+unread+dismiss+'</div>'+sub;
  row.addEventListener("click",ev=>{
    if(ev.target.dataset.act==="dismiss"){ ev.stopPropagation(); dequeue(e.path); return; }
    loadFile(e.path);
  });
  return row;
}
function renderSidebar(){
  const {queue,history,pinned}=state.sb||{queue:[],history:[],pinned:[]};
  const union=dedupUnion();
  if(state.tagFilter!==null && !union.some(e=>tagOf(e)===state.tagFilter)) state.tagFilter=null;  // 標籤沒了就回全部
  renderTagBar(union);

  const fSec=$("#fSec");                          // 🔍 篩選結果區:選了標籤才出現,跨三區去重
  if(state.tagFilter===null){ fSec.style.display="none"; }
  else {
    fSec.style.display="";
    $("#fLabel").textContent=state.tagFilter;
    const items=union.filter(e=>tagOf(e)===state.tagFilter).sort((a,b)=>a.name.localeCompare(b.name));
    $("#fCount").textContent=items.length;
    const fl=$("#fList"); fl.innerHTML="";
    if(!items.length) fl.innerHTML='<div class="navempty">沒有符合的文件。</div>';
    else items.forEach(e=>fl.appendChild(navItem(e,"f")));
  }

  const ql=$("#qList"), hl=$("#hList"), pl=$("#pList");   // 三區永遠完整
  $("#qCount").textContent=queue.length;
  ql.innerHTML=""; hl.innerHTML=""; pl.innerHTML="";
  if(!queue.length) ql.innerHTML='<div class="navempty">這次還沒有 Agent 推來待審的文件。</div>';
  else queue.forEach(e=>ql.appendChild(navItem(e,"q")));
  if(!history.length) hl.innerHTML='<div class="navempty">尚無閱讀紀錄。<br>開過的文件會留在這裡。</div>';
  else history.forEach(e=>hl.appendChild(navItem(e,"h")));
  if(!pinned.length) pl.innerHTML='<div class="navempty">在 <kbd>pins.json</kbd> 設定要釘選的全域文件。</div>';
  else pinned.forEach(e=>pl.appendChild(navItem(e,"p")));
}
async function dequeue(p){
  try{ await fetch("/api/dequeue",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({path:p, token:state.token})}); }catch(e){}
  loadSidebar();
}
$("#navRefresh").addEventListener("click",loadSidebar);
$("#navToggle").addEventListener("click",()=>{ $("#nav").classList.toggle("collapsed"); try{ localStorage.setItem("mdr-nav-collapsed",$("#nav").classList.contains("collapsed")?"1":"0"); }catch(e){} });

/* ───────────────────────── init ───────────────────────── */
(function init(){
  const p=new URLSearchParams(location.search);
  state.token=p.get("token")||"";
  try{ if(localStorage.getItem("mdr-nav-collapsed")==="1") $("#nav").classList.add("collapsed"); }catch(e){}
  loadSidebar();
  setInterval(loadSidebar, 4000);          // 輪詢:Agent 新推送會自動冒進「本次待審」
  const file=p.get("file");
  if(file) loadFile(file);
})();
window.addEventListener("beforeunload",e=>{ if(state.dirty){ e.preventDefault(); e.returnValue="x"; } });
