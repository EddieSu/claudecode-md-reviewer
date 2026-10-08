"use strict";
/* ───────────────────────── state ───────────────────────── */
const state = {
  file:"", fileName:"", token:"", mdText:"",
  annotations:[], dirty:false, pending:null, popKind:"see-comment",
  sb:null, tagFilter:null,                 // sb=最近一次 sidebar 資料;tagFilter=目前選的專案標籤(null=全部)
  favPaths:new Set(),                      // 目前收藏的路徑集合（決定星號實心/空心）
  hash:"", base:null, review:null,         // hash=畫面上這版文件的指紋;base=載入時 sidecar 的 updatedAt(寫入時帶回);review=完成紀錄
  blocked:null, disk:"", flash:"",         // blocked="corrupt"|"conflict" 時停止存檔;disk="doc"|"sidecar"=磁碟上已被改;flash=短暫提示
  blocks:[], anchors:new Map(), diffs:new Map(),   // 目前文件的區塊、各註解的對位結果、差異快取（都不寫進 sidecar）
  blockHl:new Set(),                               // 螢光包不住、退回整塊標示的註解 id（不寫進 sidecar）
};
const SYM = Object.fromEntries(MDRDiff.KINDS.map(k=>[k.kind,k.sym]));   // kind → 符號；畫面一律用 kindOf 的結果查，不用檔案原值
const cmt = a => a.comment==null ? "" : String(a.comment);              // 意見一律當字串（舊檔可能沒有 comment）
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
  document.querySelectorAll("[data-i18n-aria]").forEach(el=>{ el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
  applyHighlights(); renderSide(); if(state.sb) renderSidebar(); updateBadge(); renderDoneBtn(); renderNotice();   // 螢光的滑鼠提示也跟著換語言
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
    if(m){ cur={indent:m[1].replace(/\t/g,"    ").length, ordered:/\d/.test(m[2]), content:m[3], line:startNo+k, end:startNo+k, sub:[]}; items.push(cur); }
    else if(cur && block[k].trim()!==""){ cur.content += " "+block[k].trim(); cur.end=startNo+k; }   // 續行算本項（子項不算）
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
        h += `<li data-line="${it.line}" data-end="${it.end}">${inner}${emit(it.sub)}</li>`;
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
  let h=`<table data-line="${startNo}" data-end="${startNo+lines.length-1}"><thead><tr>`+head.map(c=>`<th>${inline(c)}</th>`).join("")+"</tr></thead><tbody>";
  for(let r=2;r<lines.length;r++){ h+="<tr>"+split(lines[r]).map(c=>`<td>${inline(c)}</td>`).join("")+"</tr>"; }
  return h+"</tbody></table>";
}
function renderMarkdown(src, baseLine){
  baseLine = baseLine || 0;
  const lines = src.replace(/\r\n?/g,"\n").split("\n");
  let html="", i=0;
  const at=s=>` data-line="${s}" data-end="${Math.min(i,lines.length)+baseLine}"`;   // 區塊吃完後呼叫：i 已指到下一行
  while(i<lines.length){
    const line=lines[i], ln=i+1+baseLine;
    if(/^\s*<!--/.test(line)){
      let j=i; while(j<lines.length && !/-->/.test(lines[j])) j++;
      if(j<lines.length){ const after=lines[j].slice(lines[j].indexOf("-->")+3);
        if(after.trim()){ lines[j]=after; i=j; } else i=j+1; }   // 註解後的同行文字就地留在第 j 行（不插行，後面行號才不會漂）
      else { i=j; }
      continue;
    }
    if(/^\s*$/.test(line)){ i++; continue; }
    const fence=line.match(/^\s*(```+|~~~+)(.*)$/);
    if(fence){ const fc=fence[1][0], flen=fence[1].length, info=(fence[2]||"").trim().toLowerCase(); i++; let code="";
      const isClose=l=>{ const t=l.trim(); if(t.length<flen) return false; for(const ch of t){ if(ch!==fc) return false; } return true; };
      while(i<lines.length && !isClose(lines[i])){ code+=lines[i]+"\n"; i++; }
      i++; const body=code.replace(/\n$/,"");
      if(info==="mermaid") html+=`<div class="mermaid"${at(ln)}>${escapeHtml(body)}</div>`;
      else html+=`<pre${at(ln)}><code>${escapeHtml(body)}</code></pre>`;
      continue; }
    const h=line.match(/^\s*(#{1,6})\s+(.*)$/);
    if(h){ i++; html+=`<h${h[1].length}${at(ln)}>${inline(h[2])}</h${h[1].length}>`; continue; }
    if(/^\s*([-*_])\1\1+\s*$/.test(line)){ i++; html+=`<hr${at(ln)}>`; continue; }
    if(/^\s*>/.test(line)){ let buf=[]; const s=ln;
      while(i<lines.length && /^\s*>/.test(lines[i])){ buf.push(lines[i].replace(/^\s*>\s?/,"")); i++; }
      html+=`<blockquote${at(s)}>${renderMarkdown(buf.join("\n"), s-1)}</blockquote>`; continue; }
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
    html+=`<p${at(pLn)}>${inline(para.join(" "))}</p>`;
  }
  return html;
}

/* ───────────────────────── doc render + highlight ───────────────────────── */
function renderDoc(){                              // 順序固定：渲染 → 建區塊 → 對位 → 上螢光 → mermaid（mermaid 在 await 後才換成 SVG）
  $("#docInner").innerHTML = renderMarkdown(state.mdText);
  state.blocks = buildBlocks();
  state.anchors = MDRDiff.reanchor(state.annotations, state.blocks); state.diffs = new Map();
  for(const a of state.annotations){             // 行號跟著段落走、舊註解有把握才回填 context；只改記憶體，下次改註解才落地
    const r=state.anchors.get(a.id); if(!r) continue;
    if(r.state==="same" || r.state==="changed") a.line=r.line;
    if(r.backfill && !a.context) a.context=r.backfill;
  }
  applyHighlights(); renderMermaid();
}
function ownText(el){                              // 元素自己的文字（不含巢狀區塊）、表格格間補空白、壓空白
  const c=el.cloneNode(true);
  c.querySelectorAll("[data-line]").forEach(x=>x.remove());
  c.querySelectorAll("td,th").forEach(x=>x.append(" "));
  return c.textContent.replace(/\s+/g," ").trim();
}
function buildBlocks(){                            // DOM → [{line,end,src,text}]；同一行有多個元素（blockquote 與首段）取最內層。加註與開檔共用
  const lines=MDRDiff.normText(state.mdText).split("\n"), by=new Map();
  for(const el of document.querySelectorAll("#docInner [data-line]")){
    const line=+el.dataset.line, end=+el.dataset.end||line, prev=by.get(line);
    if(!line || (prev && prev.end<end)) continue;
    by.set(line, {line, end, el});
  }
  return [...by.values()].sort((a,b)=>a.line-b.line).map(b=>({ line:b.line, end:b.end,
    src:lines.slice(b.line-1, b.end).join("\n").replace(/\n+$/,""), text:ownText(b.el) }));
}
const anchorOf = a => state.anchors.get(a.id) || {state:"same"};   // 開檔後才新增的註解查不到 → 當 SAME
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
    const src=el.textContent, id="mmd"+(n++)+"_"+Math.floor(Math.random()*1e6);
    try{ const {svg}=await mermaid.render(id, src); el.innerHTML=svg;
      const btn=document.createElement("button"); btn.type="button"; btn.className="mm-zoom-btn"; btn.textContent="⛶";
      btn.title=t("mermaid.zoom");
      btn.addEventListener("click", ev=>{ ev.stopPropagation(); openMermaidModal(el.querySelector("svg")); });
      el.appendChild(btn);
      el.addEventListener("dblclick", ()=> openMermaidModal(el.querySelector("svg"))); }
    catch(e){ document.getElementById("d"+id)?.remove(); document.getElementById(id)?.remove();   // mermaid 10 失敗時把錯誤圖（炸彈）留在 body 底部，自己清
      const pre=document.createElement("pre"); pre.setAttribute("data-line", el.getAttribute("data-line")||""); pre.setAttribute("data-end", el.getAttribute("data-end")||"");
      const c=document.createElement("code"); c.textContent=src; pre.appendChild(c); el.replaceWith(pre); }   // 壞圖 → 退回程式碼塊
  }
}

/* ───────────────────────── mermaid zoom modal (lightbox) ───────────────────────── */
const mm={scale:1,tx:0,ty:0};                       // 縮放比例 + 平移位移(px)
function applyMM(){
  const c=$("#mmCanvas"); if(c) c.style.transform="translate("+mm.tx+"px,"+mm.ty+"px) scale("+mm.scale+")";
  const z=$("#mmZoom"); if(z) z.textContent=Math.round(mm.scale*100)+"%";
}
function mmZoomAt(factor,cx,cy){                     // 以 (cx,cy) 為定點縮放
  const s=Math.max(0.05,Math.min(16,mm.scale*factor)); factor=s/mm.scale;
  mm.tx=cx-(cx-mm.tx)*factor; mm.ty=cy-(cy-mm.ty)*factor; mm.scale=s; applyMM();
}
function fitMM(){                                    // 置中並縮到剛好放得下(留 5% 邊)
  const svg=$("#mmCanvas").firstChild; if(!svg) return;
  const w=parseFloat(svg.getAttribute("width"))||svg.getBoundingClientRect().width;
  const h=parseFloat(svg.getAttribute("height"))||svg.getBoundingClientRect().height;
  const sr=$("#mmStage").getBoundingClientRect();
  const fit=Math.min(sr.width/w, sr.height/h, 1)*0.95;
  mm.scale=fit>0?fit:1; mm.tx=(sr.width-w*mm.scale)/2; mm.ty=(sr.height-h*mm.scale)/2; applyMM();
}
function openMermaidModal(svg){
  if(!svg) return;
  const clone=svg.cloneNode(true); clone.removeAttribute("style");   // 去掉 mermaid 內聯 max-width
  const vb=svg.viewBox && svg.viewBox.baseVal; let w=0,h=0;
  if(vb && vb.width){ w=vb.width; h=vb.height; } else { const r=svg.getBoundingClientRect(); w=r.width; h=r.height; }
  clone.setAttribute("width",w); clone.setAttribute("height",h);
  hideToolbar();
  const canvas=$("#mmCanvas"); canvas.innerHTML=""; canvas.appendChild(clone);
  $("#mmModal").style.display="flex"; fitMM();
}
function closeMermaidModal(){ $("#mmModal").style.display="none"; $("#mmCanvas").innerHTML=""; }
(function bindMM(){
  const stage=$("#mmStage"); if(!stage) return;
  $("#mmClose").addEventListener("click",closeMermaidModal);
  $("#mmReset").addEventListener("click",fitMM);
  $("#mmZoomIn").addEventListener("click",()=>{ const r=stage.getBoundingClientRect(); mmZoomAt(1.25,r.width/2,r.height/2); });
  $("#mmZoomOut").addEventListener("click",()=>{ const r=stage.getBoundingClientRect(); mmZoomAt(0.8,r.width/2,r.height/2); });
  stage.addEventListener("wheel",e=>{ e.preventDefault(); const r=stage.getBoundingClientRect();
    mmZoomAt(e.deltaY<0?1.12:1/1.12, e.clientX-r.left, e.clientY-r.top); }, {passive:false});
  let drag=null;
  stage.addEventListener("pointerdown",e=>{ drag={x:e.clientX,y:e.clientY,tx:mm.tx,ty:mm.ty};
    stage.setPointerCapture(e.pointerId); stage.classList.add("grabbing"); });
  stage.addEventListener("pointermove",e=>{ if(!drag) return;
    mm.tx=drag.tx+(e.clientX-drag.x); mm.ty=drag.ty+(e.clientY-drag.y); applyMM(); });
  const end=()=>{ if(drag){ drag=null; stage.classList.remove("grabbing"); } };
  stage.addEventListener("pointerup",end); stage.addEventListener("pointercancel",end);
  document.addEventListener("keydown",e=>{ if(e.key==="Escape" && $("#mmModal").style.display==="flex") closeMermaidModal(); });
})();

function clearHighlights(){
  document.querySelectorAll("mark.anno").forEach(m=>{ const p=m.parentNode; while(m.firstChild) p.insertBefore(m.firstChild,m); p.removeChild(m); if(p.normalize) p.normalize(); });
  document.querySelectorAll(".hl-block").forEach(b=>b.classList.remove("hl-block"));
}
function applyHighlights(){
  clearHighlights(); state.blockHl=new Set();
  for(const a of state.annotations){
    if(anchorOf(a).state==="gone") continue;        // 原段落已刪：舊行號可能是別段，不標
    const block = $('#docInner [data-line="'+a.line+'"]');
    if(!block) continue;
    if(!wrapQuote(block,a)){ block.classList.add("hl-block"); state.blockHl.add(a.id); }
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
    const mark=document.createElement("mark"), k=MDRDiff.kindOf(a);   // class、符號、名稱都取自 kindOf，檔案原值不進畫面
    mark.className="anno k-"+k+(a.status==="resolved"?" resolved":"");
    mark.dataset.sym=SYM[k];
    mark.dataset.id=a.id; mark.title="【"+t("kind."+k+".name")+"】"+cmt(a);
    mark.addEventListener("click",()=>focusCard(a.id));
    try{ range.surroundContents(mark); return true; }catch(e){ return false; }
  }
  return false;
}

/* ───────────────────────── selection → toolbar ───────────────────────── */
// 工具列出現當下記下：行號、引文（壓空白，給加註）、原始選取（保留換行，給複製）。
// rekey＝滑鼠選的字被 Shift＋方向鍵微調而收起，放開 Shift 時重新出現；entered＝焦點進過工具列（Tab 只攔第一下）
const tb={line:0, quote:"", raw:"", rekey:false, entered:false};
const isMac=/Mac|iPhone|iPad/.test(navigator.platform||"");
const popOpen=()=>$("#pop").style.display==="block";
const zoomOpen=()=>$("#mmModal").style.display==="flex";
function selInfo(){                                // 目前選取：不是空白、起點在文章區塊內才算
  const s=window.getSelection(); if(!s.rangeCount) return null;
  const raw=s.toString(), quote=raw.replace(/\s+/g," ").trim(); if(!quote) return null;
  const n=s.anchorNode, el=n && (n.nodeType===3?n.parentElement:n), block=el && el.closest("[data-line]");
  if(!block || !$("#docInner").contains(block)) return null;
  return {s, range:s.getRangeAt(0), line:+block.dataset.line, quote, raw};
}
function showToolbar(info, x, y){                  // (x,y)＝視窗座標：水平對齊 x，垂直放在 y 那一行選取的上方，放不下改下方
  Object.assign(tb, {line:info.line, quote:info.quote, raw:info.raw, rekey:false, entered:false});
  const bar=$("#selBar"), doc=$("#doc"), dr=doc.getBoundingClientRect(), [copy,anno]=bar.children;
  copy.textContent=t("sel.copy"); copy.tabIndex=0; anno.tabIndex=-1;
  bar.hidden=false;
  const rs=[...info.range.getClientRects()].filter(r=>r.width||r.height);
  const r=rs.find(r=>y>=r.top && y<=r.bottom) || rs.reduce((a,b)=>Math.abs(b.top+b.bottom-2*y)<Math.abs(a.top+a.bottom-2*y)?b:a, rs[0]) || info.range.getBoundingClientRect();
  const w=bar.offsetWidth, h=bar.offsetHeight;
  let top=r.top-h-6; if(top<dr.top+4) top=r.bottom+6;
  const left=Math.max(dr.left+4, Math.min(x-w/2, dr.left+doc.clientWidth-w-4));
  bar.style.left=(left-dr.left+doc.scrollLeft)+"px"; bar.style.top=(top-dr.top+doc.scrollTop)+"px";   // 換成 #doc 內容座標 → 捲動時跟著文字走
}
function hideToolbar(){
  tb.rekey=false;
  const bar=$("#selBar"); if(bar.hidden) return;
  if(bar.contains(document.activeElement)) $("#doc").focus({preventScroll:true});   // 焦點在工具列裡 → 放回閱讀區
  bar.hidden=true;
}
$("#doc").addEventListener("mouseup",e=>{
  if(e.target.closest("#selBar,#toTop,.mm-zoom-btn")) return;
  const x=e.clientX, y=e.clientY;
  setTimeout(()=>{                                 // 等瀏覽器定好選取（雙擊、三擊也一樣）
    if(popOpen() || zoomOpen()) return;            // 加註框開著：只是一般選取，不動草稿；流程圖雙擊：只開放大檢視
    const info=selInfo(); if(info) showToolbar(info,x,y);
  },10);
});
document.addEventListener("mousedown",e=>{ if(!e.target.closest("#selBar")) hideToolbar(); },true);
$("#selBar").addEventListener("mousedown",e=>e.preventDefault());   // 按工具列不取消選取、也不搶焦點
document.addEventListener("selectionchange",()=>{
  if($("#selBar").hidden) return;
  const raw=window.getSelection().toString(); if(raw===tb.raw) return;
  hideToolbar(); tb.rekey=!!raw.trim();            // 選取變了就收起；還有字（例如 Shift＋方向鍵微調）→ 放開 Shift 時再出現
});
document.addEventListener("keyup",e=>{             // 放開 Shift：在微調後的選取旁重新出現，焦點不動
  if(e.key!=="Shift" || !tb.rekey) return;
  tb.rekey=false;
  const info=!popOpen() && !zoomOpen() && selInfo(); if(!info) return;
  const s=info.s, rs=[...info.range.getClientRects()].filter(r=>r.width||r.height); if(!rs.length) return;
  const back=s.anchorNode===s.focusNode ? s.focusOffset<s.anchorOffset
           : !!(s.anchorNode.compareDocumentPosition(s.focusNode) & Node.DOCUMENT_POSITION_PRECEDING);   // 往回選：被移動的是開頭那端
  const r=back?rs[0]:rs[rs.length-1];
  showToolbar(info, back?r.left:r.right, (r.top+r.bottom)/2);
});
window.addEventListener("resize",()=>hideToolbar());
function focusTbBtn(j){ const btns=[...$("#selBar").children]; btns.forEach((b,k)=>b.tabIndex=k===j?0:-1); btns[j].focus(); }
$("#selBar").addEventListener("focusin",()=>{ tb.entered=true; });
document.addEventListener("keydown",e=>{           // WAI-ARIA toolbar：只有一顆按鈕在 Tab 順序裡，左右／Home／End 移動，Tab 離開
  const bar=$("#selBar"); if(bar.hidden) return;
  if(e.key==="Escape"){ hideToolbar(); return; }
  const btns=[...bar.children], i=btns.indexOf(document.activeElement);
  if(i<0){                                         // 焦點在外：只攔第一下 Tab（不含 Shift），直接進工具列，不必先走過文章裡的連結
    if(e.key==="Tab" && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && !tb.entered){ e.preventDefault(); focusTbBtn(0); }
    return;
  }
  const j={ArrowRight:(i+1)%btns.length, ArrowLeft:(i+btns.length-1)%btns.length, Home:0, End:btns.length-1}[e.key];
  if(j!=null){ e.preventDefault(); focusTbBtn(j); }
});
function say(msg){ const el=$("#selSay"); el.textContent=""; setTimeout(()=>{ el.textContent=msg; },30); }   // 朗讀區：先清空，同一句也會再唸
async function copySelection(){                    // 只放純文字：剪貼簿 API → 內建複製指令 → 請使用者自己按 Ctrl+C
  const btn=$("#selCopy"), text=tb.raw; let ok=false;
  try{ await navigator.clipboard.writeText(text); ok=true; }
  catch(_){
    const onCopy=ev=>{ ev.clipboardData.setData("text/plain",text); ev.preventDefault(); };   // 擋掉預設內容，不帶格式
    document.addEventListener("copy",onCopy);
    try{ ok=document.execCommand("copy"); }catch(_){ ok=false; }
    document.removeEventListener("copy",onCopy);
  }
  clearTimeout(copySelection.t);
  if(ok){ btn.textContent=t("sel.copied"); say(t("sel.saidCopied")); copySelection.t=setTimeout(()=>{ btn.textContent=t("sel.copy"); },800); }
  else { btn.textContent=t(isMac?"sel.pressCmdC":"sel.pressCtrlC"); say(t(isMac?"sel.saidFailMac":"sel.saidFail")); }   // 工具列與選取都留著
}
$("#selCopy").addEventListener("click",copySelection);
$("#selAnno").addEventListener("click",()=>{       // 加註框位置當下重算：選取還在就對齊選取，否則對齊工具列
  const s=window.getSelection(), same=s.rangeCount && s.toString()===tb.raw;
  const ref=same ? s.getRangeAt(0).getBoundingClientRect() : $("#selBar").getBoundingClientRect();
  state.pending={line:tb.line, quote:tb.quote};
  openPopover(ref);
});

/* ───────────────────────── popover ───────────────────────── */
$("#popKinds").insertAdjacentHTML("beforeend", MDRDiff.KINDS.map(({kind,sym})=>   // 八個分類選項（兩欄，一列一列由左到右）
  '<label class="kopt" data-i18n-title="kind.'+kind+'.hint"><input type="radio" name="kind" value="'+kind+'">'+
  '<span class="kb k-'+kind+'" aria-hidden="true">'+sym+'</span><span><span data-i18n="kind.'+kind+'.name"></span>'+
  (kind==="see-comment" ? ' · <span class="kdef" data-i18n="pop.default"></span>' : '')+'</span></label>').join(""));
function openPopover(rect){                        // 先顯示，再用實際大小定位：預設放下方、放不下放上方，最後夾在視窗內（離邊 12px）
  hideToolbar();
  const pop=$("#pop"), m=12;
  $("#popQuote").textContent="「"+state.pending.quote+"」";
  $("#popText").value=""; setPopKind("see-comment");   // 每次都預設「見說明」
  pop.style.display="block"; pop.scrollTop=0;
  const w=pop.offsetWidth, h=pop.offsetHeight;
  let top=rect.bottom+8; if(top+h>innerHeight-m) top=rect.top-h-8;
  pop.style.left=Math.max(m, Math.min(rect.left, innerWidth-w-m))+"px";
  pop.style.top=Math.max(m, Math.min(top, innerHeight-h-m))+"px";
  $("#popText").focus();
}
function closePopover(){
  const was=popOpen(); $("#pop").style.display="none"; state.pending=null;
  if(was) $("#doc").focus({preventScroll:true});   // 關閉後焦點回閱讀區
}
function setPopKind(k){                            // 只有「見說明」必須寫意見；其他七類可留空，提示文字跟著換
  state.popKind=k; $('#popKinds input[value="'+k+'"]').checked=true;
  const ta=$("#popText"); ta.dataset.i18nPh = k==="see-comment" ? "pop.placeholder" : "pop.placeholderOptional"; ta.placeholder=t(ta.dataset.i18nPh);
}
$("#popKinds").addEventListener("change",e=>setPopKind(e.target.value));
$("#pop").addEventListener("keydown",e=>{ if(e.key==="Escape") closePopover(); });   // 加註框裡任何地方按 Esc 都關閉
$("#popCancel").addEventListener("click",closePopover);
$("#popSave").addEventListener("click",saveAnnotation);
$("#popText").addEventListener("keydown",e=>{ if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)) saveAnnotation(); });
function saveAnnotation(){
  const comment=$("#popText").value.trim(), kind=state.popKind;
  if(!comment && kind==="see-comment"){ $("#popText").focus(); return; }
  const context=MDRDiff.contextAt(state.blocks, state.blocks.findIndex(b=>b.line===state.pending.line));   // 加註當下的段落原文＋前後鄰居
  state.annotations.push(MDRDiff.newAnnotation({
    id:"a"+Date.now().toString(36)+Math.floor(performance.now()).toString(36),
    line:state.pending.line, quote:state.pending.quote, comment, kind, context }));
  closePopover(); window.getSelection().removeAllRanges();
  applyHighlights(); renderSide(); markDirty();
  if(state.review && kind!=="agree") setReview(false).then(ok=>{ if(ok) flash(t("done.autoCleared")); });   // 新增待辦 → 不算完成；「同意」不影響
}

/* ───────────────────────── sidebar ───────────────────────── */
function renderSide(){
  const showR=$("#showResolved").checked;
  const list=$("#sideList");
  const items=state.annotations.filter(a=>showR||a.status!=="resolved").sort((a,b)=>a.line-b.line);
  if(!state.fileName){ list.innerHTML='<div class="empty">'+t("side.noFile")+'</div>'; return; }
  if(!items.length){ list.innerHTML='<div class="empty">'+t("side.noAnno")+'</div>'; return; }
  list.innerHTML=items.map(a=>{ const st=anchorOf(a).state, k=MDRDiff.kindOf(a), c=cmt(a); return `
    <div class="card${a.status==="resolved"?" resolved":""}${st==="gone"?" gone":""}" data-id="${escapeHtml(a.id)}">
      <div class="meta">
        <span class="kb k-${k}" aria-hidden="true">${SYM[k]}</span>
        <select class="kindSel" title="${escapeHtml(t("kind."+k+".hint"))}" aria-label="${escapeHtml(t("pop.kindLegend"))}">${MDRDiff.KINDS.map(x=>
          `<option value="${x.kind}"${x.kind===k?" selected":""}>${escapeHtml(t("kind."+x.kind+".name"))}</option>`).join("")}</select>
        <span>${st==="gone"?escapeHtml(t("card.oldLine",{line:a.line})):"L"+a.line}</span><span class="spacer" style="flex:1"></span>
        <span>${a.status==="resolved"?t("card.resolvedTag"):""}</span>
      </div>
      <div class="q" title="${escapeHtml(t("card.quoteTitle"))}">${escapeHtml(a.quote||"")}</div>
      ${k==="delete-text" && state.blockHl.has(a.id) ? '<div class="bnote">'+escapeHtml(t("card.blockNote"))+'</div>' : ""}
      ${changeHtml(a)}
      ${c ? `<div class="c">${escapeHtml(c)}</div>` : ""}
      <div class="acts">
        ${st==="gone"?"":`<a data-act="goto">${t("card.goto")}</a>`}
        <a data-act="toggle">${a.status==="resolved"?t("card.reopen"):t("card.markResolve")}</a>
        <a data-act="del">${t("card.delete")}</a>
      </div>
    </div>`; }).join("");
}
function diffOf(a){                                // 差異每次開檔只算一次
  if(!state.diffs.has(a.id)){ const r=anchorOf(a); state.diffs.set(a.id, r.state==="changed" ? MDRDiff.textDiff(a.context.block, r.src) : null); }
  return state.diffs.get(a.id);
}
function diffHtml(ops){                            // <del>/<ins>；很長的沒變段只留頭尾各 20 字
  return ops.map(([op,s])=>{
    if(op==="="){ const c=[...s]; return escapeHtml(c.length>60 ? c.slice(0,20).join("")+" … "+c.slice(-20).join("") : s); }
    return op==="-" ? "<del>"+escapeHtml(s)+"</del>" : "<ins>"+escapeHtml(s)+"</ins>";
  }).join("");
}
function changeHtml(a){                            // 卡片裡的「原文狀態」：改了 → 差異框；刪了 → 舊文；舊註解無法比對 → 提示
  const r=anchorOf(a);
  if(r.state==="changed"){
    const head='<div class="dhead">'+escapeHtml(t("card.changed"))+(r.quoteKept?' <span class="dnote">'+escapeHtml(t("card.quoteKept"))+'</span>':'')+'</div>';
    const body=head+'<div class="diff">'+diffHtml(diffOf(a))+'</div>';
    return a.status==="resolved" ? '<details class="dwrap"><summary>'+escapeHtml(t("card.showDiff"))+'</summary>'+body+'</details>' : body;
  }
  if(r.state==="gone") return '<div class="dhead">'+escapeHtml(t("card.gone"))+'</div><div class="diff"><del>'+escapeHtml(a.context.block)+'</del></div>';
  if(r.state==="unverified") return '<div class="dhead warn">'+escapeHtml(t("card.unverified"))+'</div>';
  return "";
}
$("#sideList").addEventListener("click",e=>{
  const card=e.target.closest(".card"); if(!card || e.target.closest("select")) return;   // 分類選單由 change 處理
  const id=card.dataset.id, act=e.target.dataset.act;
  if(act==="toggle"){ const a=state.annotations.find(x=>x.id===id); a.status=a.status==="resolved"?"open":"resolved"; applyHighlights(); renderSide(); markDirty(); }
  else if(act==="del"){ state.annotations=state.annotations.filter(x=>x.id!==id); applyHighlights(); renderSide(); markDirty(); }
  else gotoAnno(id);
});
$("#sideList").addEventListener("change",e=>{       // 卡片改分類：只改 kind，意見、狀態、color、完成紀錄都不動
  if(!e.target.matches("select.kindSel")) return;
  const a=state.annotations.find(x=>x.id===e.target.closest(".card").dataset.id); if(!a) return;
  a.kind=e.target.value; applyHighlights(); renderSide(); markDirty();
});
$("#showResolved").addEventListener("change",renderSide);
function gotoAnno(id){
  const a=state.annotations.find(x=>x.id===id); if(!a || anchorOf(a).state==="gone") return;
  const block=$('#docInner [data-line="'+a.line+'"]'); if(!block) return;
  block.scrollIntoView({behavior:"smooth",block:"center"});
  block.classList.remove("flash"); void block.offsetWidth; block.classList.add("flash");
}
function focusCard(id){
  const card=$('#sideList .card[data-id="'+id+'"]');
  if(card){ card.scrollIntoView({behavior:"smooth",block:"center"}); card.classList.remove("flash"); void card.offsetWidth; card.classList.add("flash"); }
}

/* ───────────────────────── data layer (server) ───────────────────────── */
// 匯出與自動存檔共用：每則註解＝記憶體裡的物件（較新版本加的陌生欄位照帶）蓋上已知欄位的正規化值（annToSave）。
// 規則：開檔後算出來的暫存值（對位結果、差異、是否退回整塊標示…）一律放在 state 裡以 id 查詢的表或集合，
// 不得掛在註解物件上，否則會被寫進檔案。renderDoc 寫回的 line、context 是刻意要落地的已知欄位，不算暫存值。
function buildSidecar(){
  return Object.assign({ file:state.fileName, schema:1, updatedAt:new Date().toISOString() }, state.review?{review:state.review}:{}, {
    annotations:state.annotations.map(a=>MDRDiff.annToSave(a)) });
}
function updateBadge(msg){
  const b=$("#saveBadge");
  if(msg){ b.textContent=msg; b.className="badge"; return; }
  if(state.dirty){ b.textContent=t("save.saving"); b.className="badge dirty"; }
  else b.textContent="";
}
let saveTimer=null;
function markDirty(){
  state.dirty=true; clearTimeout(saveTimer);
  if(state.blocked){ updateBadge(t("save.paused")); return; }   // 壞檔/衝突：不存，badge 明講沒存
  updateBadge(); saveTimer=setTimeout(saveToServer,500);
}
let writeChain=Promise.resolve(), writing=0, writeSeq=0;
function serverWrite(url, payload){                // 所有寫入排隊一筆一筆送，base 由上一筆回應接力 → 不會自己跟自己衝突
  const fp=state.file; writing++;
  const run=async()=>{
    try{
      if(state.file!==fp) return {ok:false, error:"switched"};
      const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify(Object.assign(payload(), {path:fp, token:state.token, base:state.base}))});
      const d=await r.json(); if(d.ok) state.base=d.updatedAt; return d;
    }catch(e){ return {ok:false, error:e.message}; }
    finally{ writing--; writeSeq++; }
  };
  return (writeChain=writeChain.then(run,run));
}
function failWrite(d){                             // 409：壞檔 / 別處已更新 → 停止自動存檔，請使用者重新載入
  if(d.error==="corrupt" || d.error==="conflict"){ state.blocked=d.error; renderNotice(); updateBadge(t("save.paused")); }
  else updateBadge(t("save.failPrefix")+d.error);
}
async function saveToServer(){
  if(!state.file || state.blocked) return;
  const d=await serverWrite("/api/save", ()=>({annotations:buildSidecar().annotations}));
  if(d.ok){ state.dirty=false; updateBadge(t("save.saved",{time:new Date().toLocaleTimeString()})); loadSidebar(); }
  else if(d.error!=="switched") failWrite(d);
}
async function loadFile(absPath){
  closePopover(); hideToolbar();                   // 先關加註框與工具列：草稿直接捨棄（等同取消），不會寫進新文件
  clearTimeout(saveTimer); if(state.dirty && !state.blocked) saveToServer(); await writeChain;   // 先把手上的存完，才不會存到別的檔
  try{
    const r=await fetch("/api/file?path="+encodeURIComponent(absPath)+"&token="+encodeURIComponent(state.token));
    const d=await r.json();
    if(!d.ok){ $("#docInner").innerHTML='<div class="empty">'+escapeHtml(t("msg.openFailPrefix"))+'<b>'+escapeHtml(absPath)+'</b>'+escapeHtml(t("msg.openFailSuffix"))+'<br>'+escapeHtml(d.error)+'</div>'; return; }
    state.file=d.path; state.fileName=d.name; state.mdText=d.content; state.annotations=d.annotations||[]; state.dirty=false;
    state.hash=d.hash; state.base=d.updatedAt; state.review=d.review; state.blocked=d.sidecarError?"corrupt":null; state.disk=""; state.flash="";
    $("#fileName").textContent="📄 "+d.name;
    $("#pathInput").value=d.path;
    renderDoc(); renderSide(); updateBadge(); renderDoneBtn(); renderNotice(); loadSidebar();   // 開檔後刷新清單(更新紀錄/未讀/反白)
  }catch(e){ $("#docInner").innerHTML='<div class="empty">'+escapeHtml(t("msg.noServer"))+escapeHtml(e.message)+'</div>'; }
}

/* ───────────────────────── review-complete record ───────────────────────── */
function reviewState(){ return !state.review ? "none" : state.review.hash===state.hash ? "done" : "stale"; }
function renderDoneBtn(){                          // 標籤寫明「點下去會怎樣」
  const b=$("#btnDone"); b.style.display=state.file?"":"none"; if(!state.file) return;
  const s=reviewState(), time=state.review?new Date(state.review.at).toLocaleString():"";
  b.textContent=t({none:"done.mark",done:"done.done",stale:"done.stale"}[s]);
  b.title=t({none:"done.markTitle",done:"done.doneTitle",stale:"done.staleTitle"}[s],{time});
  b.classList.toggle("on",s==="done"); b.classList.toggle("warn",s==="stale");
}
async function setReview(done){
  const d=await serverWrite("/api/review", ()=>({done, hash:state.hash}));
  if(d.ok){ state.review=d.review; renderDoneBtn(); loadSidebar(); return true; }
  if(d.error==="stale"){ state.disk="doc"; renderNotice(); }   // 磁碟上的比畫面新 → 提示重新載入
  else if(d.error!=="switched") failWrite(d);
  return false;
}
$("#btnDone").addEventListener("click", async()=>{
  if(!state.file || state.blocked) return;
  if(reviewState()==="done"){ if(confirm(t("done.confirmUndo"))) setReview(false); return; }
  const open=state.annotations.filter(a=>MDRDiff.isTodo(a)).length;   // 只算待辦，「同意」不算
  if(open && !confirm(t("done.confirmOpen",{n:open}))) return;
  if(await setReview(true)) dequeue(state.file);  // 完成了就不再是「本次待審」
});

/* ───────────────────────── notice bar ───────────────────────── */
function renderNotice(){                           // 常駐（壞檔/衝突/磁碟已改）優先於短暫提示
  const n=$("#notice");
  const key = state.blocked==="corrupt" ? "notice.sidecarCorrupt" : state.blocked==="conflict" ? "notice.conflict"
            : state.disk==="doc" ? "notice.diskChanged" : state.disk==="sidecar" ? "notice.sidecarChanged" : "";
  const msg = key ? t(key) : state.flash;
  n.style.display = msg ? "" : "none";
  n.innerHTML = !msg ? "" : escapeHtml(msg)+(key?' <button data-act="reload">'+escapeHtml(t(state.blocked?"notice.reloadPlain":"notice.reload"))+'</button>':"");
}
function flash(msg){ state.flash=msg; renderNotice(); clearTimeout(flash.t); flash.t=setTimeout(()=>{ state.flash=""; renderNotice(); },6000); }
$("#notice").addEventListener("click",e=>{ if(e.target.dataset.act==="reload" && state.file) loadFile(state.file); });

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
  const byLine=(a,b)=>a.line-b.line, K=MDRDiff.kindOf, nm=a=>"【"+t("kind."+K(a)+".name")+"】";
  const open=state.annotations.filter(a=>MDRDiff.isTodo(a)).sort(byLine);                     // 有編號的待辦
  const agree=state.annotations.filter(a=>a.status!=="resolved" && K(a)==="agree").sort(byLine);   // 「同意」另列、不編號
  const done=state.annotations.filter(a=>a.status==="resolved");
  const mk=a=>{ const s=anchorOf(a).state; return s==="changed"||s==="gone"||s==="unverified" ? t("copy."+s) : ""; };   // 原文狀態註記
  const arrow=a=>cmt(a) ? "→ "+cmt(a) : "";        // 意見空白就省略箭頭
  let out=t("copy.header",{file:state.fileName})+t("copy.summary",{total:state.annotations.length,open:open.length});
  const used=[...new Set(open.map(K))];            // 分類說明：依第一次出現的順序；全是「見說明」就省略
  if(used.some(k=>k!=="see-comment")) out+=t("copy.kindsHead")+used.map(k=>t("copy.kindLine",{name:t("kind."+k+".name"),how:t("kind."+k+".how")})).join("")+"\n";
  open.forEach((a,i)=>{ out+="["+(i+1)+"] L"+a.line+nm(a)+"「"+a.quote+"」"+mk(a)+"\n"+(cmt(a)?arrow(a)+"\n":"")+"\n"; });
  if(agree.length){ out+=t("copy.agreeSection")+agree.map(a=>"- L"+a.line+"「"+a.quote+"」"+mk(a)+arrow(a)).join("\n")+"\n"+(done.length?"\n":""); }
  if(done.length){ out+=t("copy.resolvedSection")+done.map(a=>"- L"+a.line+nm(a)+"「"+a.quote+"」"+mk(a)+arrow(a)).join("\n")+"\n"; }
  try{ await navigator.clipboard.writeText(out); $("#btnCopy").textContent=t("bar.copied"); setTimeout(()=>$("#btnCopy").textContent=t("bar.copy"),1500); }
  catch(e){ prompt(t("msg.copyFail"),out); }
});

/* ───────────────────────── left list (待審佇列 + 過往紀錄) ───────────────────────── */
async function loadSidebar(){
  try{
    const f=state.file, seq=writeSeq;
    const r=await fetch("/api/sidebar?token="+encodeURIComponent(state.token)+(f?"&current="+encodeURIComponent(f):""));
    const d=await r.json(); if(!d.ok) return;
    state.sb={ queue:d.queue||[], history:d.history||[], pinned:d.pinned||[], favorites:d.favorites||[] };
    renderSidebar();
    // 磁碟上的文件或註解檔被別處改了 → 提示重新載入（自己有寫入在途/待存時不比，免得誤報）
    if(f && f===state.file && d.current && d.current.hash && !writing && !state.dirty && seq===writeSeq){
      const disk = d.current.hash!==state.hash ? "doc" : (d.current.updatedAt||null)!==state.base ? "sidecar" : "";
      if(disk!==state.disk){ state.disk=disk; renderNotice(); }
    }
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
  const rvk     = e.review ? (e.review.state==="done" ? "nav.reviewDone" : "nav.reviewStale") : "";   // 已審 / 需重審 小標籤
  const rv      = rvk ? '<span class="navrev '+e.review.state+'" title="'+escapeHtml(t(rvk+"Title",{time:new Date(e.review.at).toLocaleString()}))+'">'+escapeHtml(t(rvk))+'</span>' : '';
  const badge   = rv + (e.open>0 ? '<span class="navbadge" title="'+escapeHtml(t("nav.badgeTitle"))+'">'+e.open+'</span>' : '');
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

/* 回到頂端：捲過一個窗高才出現（用 visibility 切換，捲動高度不會跳） */
$("#doc").addEventListener("scroll",()=>{ const d=$("#doc"); $("#toTop").classList.toggle("show", d.scrollTop>d.clientHeight); },{passive:true});
$("#toTop").addEventListener("click",()=>$("#doc").scrollTo({top:0, behavior:"smooth"}));

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
