// MD Reviewer 共用純函式（瀏覽器、server、Node 測試三方共用）：文字正規化、註解重新定位、新舊差異、註解分類（kind）。
// 瀏覽器只掛一個全域 window.MDRDiff；Node 走 module.exports。不碰 DOM。
(function(root){
"use strict";
const SLOT_MIN = 0.2;          // 只對到一側鄰居時，相似度至少要這麼高才算「改寫」
const GLOBAL_MIN = 0.5;        // 鄰居都對不到時，全文找相似段的門檻（較嚴）
const SHORT_TOKENS = 8;        // 少於這麼多詞的短區塊（標題、短清單項）不做全文相似比對，避免「## 結論 → ## 背景」
const BACKFILL_TOKENS = 4;     // 舊註解回填 context 時，quote 至少要這麼長才算有把握
const DIFF_CELLS = 250000;     // LCS 表上限；超過就該段退化成「全刪＋全加」

// 去 BOM、CRLF/CR→LF、去行尾空白。hash、context、區塊原文一律先過這裡，Windows/macOS 才會一致。
function normText(s){ return String(s).replace(/^﻿/,"").replace(/\r\n?/g,"\n").replace(/[ \t]+$/gm,""); }
function ws(s){ return String(s).replace(/\s+/g," ").trim(); }
// 比對用的鍵：空白壓平（重新折行不算改）＋開頭有序清單編號正規化（重新編號不算改）
function key(s){ return ws(s).replace(/^\d+([.)])(?= )/,"#$1"); }
function firstLine(s){ return String(s).split("\n")[0]; }

const TOKEN_RE = /[A-Za-z0-9_]+|\s+|[^]/gu;   // Latin 一串、空白一串、其他單一 code point（每個中文字一個 token、emoji 不拆半）
function tokens(s){ return String(s).match(TOKEN_RE) || []; }
function words(s){ return tokens(s).filter(t=>!/^[\s\p{P}\p{S}]+$/u.test(t)); }   // 丟空白/標點/符號 → Markdown 記號不計分

function bigrams(s){
  const w=words(s), m=new Map();
  for(let i=0;i<w.length-1;i++){ const k=w[i]+"\u0000"+w[i+1]; m.set(k,(m.get(k)||0)+1); }
  return { m, n:Math.max(w.length-1,0), k:key(s) };
}
function simBG(A,B){
  if(!A.n || !B.n) return A.k===B.k ? 1 : 0;                  // 不足 2 個詞：只看是否相同（不會出 NaN）
  let x=0; for(const [k,c] of A.m){ const d=B.m.get(k); if(d) x+=Math.min(c,d); }
  return 2*x/(A.n+B.n);
}
function sim(a,b){ return simBG(bigrams(a),bigrams(b)); }      // token bigram Dice，0..1

function typeOf(src){                                          // 與 renderer 同一組判斷
  const l=firstLine(src);
  if(/^\s*#{1,6}\s/.test(l)) return "h";
  if(/^\s*(```|~~~)/.test(l)) return "code";
  if(/^\s*>/.test(l)) return "quote";
  if(/^\s*\|/.test(l)) return "table";
  if(/^\s*([-*_])\1\1+\s*$/.test(l)) return "hr";
  if(/^\s*([-*+]|\d+[.)])\s+/.test(l)) return "li";
  return "p";
}

// 第 i 個區塊的 context：本塊原文 + 前後區塊第一行（鄰居錨點）。空區塊回 null（不存空 context）。
function contextAt(blocks,i){
  if(i<0 || i>=blocks.length || !blocks[i].src.trim()) return null;
  return { block:blocks[i].src, prev:i>0?firstLine(blocks[i-1].src):null, next:i<blocks.length-1?firstLine(blocks[i+1].src):null };
}

// 把註解對回目前文件。blocks=[{line,src,text?}]（依行號排序）。
// 回 Map(id → {state:"same"|"changed"|"gone"|"unverified", line, src, quoteKept, backfill?})。純函式，不改輸入。
function reanchor(anns, blocks){
  const n=blocks.length, last=n?blocks[n-1]:null, total=Math.max(last?(last.end||last.line):1,1);
  const K=blocks.map(b=>key(b.src)), F=blocks.map(b=>key(firstLine(b.src))), T=blocks.map(b=>typeOf(b.src));
  const W=blocks.map(b=>words(b.src).length), TX=blocks.map(b=>ws(b.text!=null?b.text:b.src));
  const BG=[]; const bg=i=>BG[i]||(BG[i]=bigrams(blocks[i].src));   // 每塊 bigram 只算一次
  const pen=(i,line)=>Math.min(0.1, 0.1*Math.abs(blocks[i].line-line)/total);   // 只用來破平手
  const out=new Map();
  for(const a of anns||[]) out.set(a.id, a.context && a.context.block ? withContext(a) : legacy(a));
  return out;

  function hit(state,i,a){
    if(i==null) return { state, line:a.line, src:null, quoteKept:false };
    return { state, line:blocks[i].line, src:blocks[i].src, quoteKept:!!a.quote && TX[i].includes(ws(a.quote)) };
  }
  function side(c,i){                                          // [前鄰居吻合, 後鄰居吻合]；null 錨點 = 文件開頭/結尾
    const p = c.prev==null ? i===0 : i>0 && F[i-1]===key(c.prev);
    const q = c.next==null ? i===n-1 : i<n-1 && F[i+1]===key(c.next);
    return [p,q];
  }
  function nb(c,i){ const [p,q]=side(c,i); return (p?1:0)+(q?1:0); }
  function withContext(a){
    const c=a.context, k=key(c.block), ty=typeOf(c.block), A=bigrams(c.block);
    let slot=-1;                                               // 剛好夾在兩個原鄰居之間的區塊
    for(let i=0;i<n;i++) if(nb(c,i)===2 && (slot<0 || pen(i,a.line)<pen(slot,a.line))) slot=i;
    let best=-1, bs=-Infinity;                                 // 1) 完全相同：鄰居吻合數優先，再看距離
    for(let i=0;i<n;i++) if(K[i]===k){ const s=nb(c,i)-pen(i,a.line); if(s>bs){ bs=s; best=i; } }
    if(best>=0){
      if(nb(c,best)>0 || slot<0) return hit("same",best,a);
      return hit("changed",slot,a);                            // 別處有一模一樣的副本，但被註解的那份（在鄰居之間）被改了
    }
    if(slot>=0) return hit("changed",slot,a);                  // 2) 原位置被改寫
    for(let j=-1;j<n;j++){                                     // 3) 原本的前後鄰居現在緊鄰 → 這段被刪了
      const p = c.prev==null ? j===-1 : j>=0 && F[j]===key(c.prev);
      const q = c.next==null ? j+1===n : j+1<n && F[j+1]===key(c.next);
      if(p && q) return hit("gone",null,a);
    }
    let bi=-1, bsc=-Infinity;                                  // 4) 只對到一側鄰居的同類型區塊
    for(let i=0;i<n;i++){
      if(nb(c,i)!==1 || T[i]!==ty) continue;
      const s=simBG(A,bg(i)); if(s<SLOT_MIN) continue;
      if(s-pen(i,a.line)>bsc){ bsc=s-pen(i,a.line); bi=i; }
    }
    if(bi>=0) return hit("changed",bi,a);
    if(words(c.block).length>=SHORT_TOKENS){                   // 5) 全文找同類型、夠長、夠像的區塊
      for(let i=0;i<n;i++){
        if(T[i]!==ty || W[i]<SHORT_TOKENS) continue;
        const s=simBG(A,bg(i)); if(s<GLOBAL_MIN) continue;
        if(s-pen(i,a.line)>bsc){ bsc=s-pen(i,a.line); bi=i; }
      }
      if(bi>=0) return hit("changed",bi,a);
    }
    const q=ws(a.quote||"");                                   // 6) quote 只出現在一個區塊
    if(q){ const hs=[]; for(let i=0;i<n;i++) if(TX[i].includes(q)) hs.push(i); if(hs.length===1) return hit("changed",hs[0],a); }
    return hit("gone",null,a);
  }
  function legacy(a){                                          // 沒有 context 的舊註解：保守處理
    const q=ws(a.quote||"");
    const hs=[]; if(q) for(let i=0;i<n;i++) if(TX[i].includes(q)) hs.push(i);
    if(!hs.length) return { state:"unverified", line:a.line, src:null, quoteKept:false };   // 維持舊行為（原行號整塊標示）
    let i=hs.find(h=>blocks[h].line===a.line);
    if(i==null) i=hs.reduce((x,h)=>Math.abs(blocks[h].line-a.line)<Math.abs(blocks[x].line-a.line)?h:x);
    const r=hit("same",i,a);
    if(hs.length===1 && words(q).length>=BACKFILL_TOKENS) r.backfill=contextAt(blocks,i);   // 唯一且夠長才回填
    return r;
  }
}

// LCS 共用小幫手：回 [[op,item]]，op ∈ "=" "-" "+"；"=" 取新版那份。先去頭去尾，中段用一維 Uint16Array。
function lcsOps(A,B,eq){
  let p=0; while(p<A.length && p<B.length && eq(A[p],B[p])) p++;
  let s=0; while(s<A.length-p && s<B.length-p && eq(A[A.length-1-s],B[B.length-1-s])) s++;
  const a=A.slice(p,A.length-s), b=B.slice(p,B.length-s), n=a.length, m=b.length, ops=[];
  for(let i=0;i<p;i++) ops.push(["=",B[i]]);
  if((n+1)*(m+1)>DIFF_CELLS){ a.forEach(x=>ops.push(["-",x])); b.forEach(x=>ops.push(["+",x])); }
  else {
    const W=m+1, L=new Uint16Array((n+1)*W);
    for(let i=n-1;i>=0;i--) for(let j=m-1;j>=0;j--)
      L[i*W+j] = eq(a[i],b[j]) ? L[(i+1)*W+j+1]+1 : Math.max(L[(i+1)*W+j], L[i*W+j+1]);
    let i=0, j=0;
    while(i<n && j<m){
      if(eq(a[i],b[j])){ ops.push(["=",b[j]]); i++; j++; }
      else if(L[(i+1)*W+j]>=L[i*W+j+1]) ops.push(["-",a[i++]]);
      else ops.push(["+",b[j++]]);
    }
    while(i<n) ops.push(["-",a[i++]]);
    while(j<m) ops.push(["+",b[j++]]);
  }
  for(let i=B.length-s;i<B.length;i++) ops.push(["=",B[i]]);
  return ops;
}
// 新舊差異：先逐行，再對變動的行逐 token；空白差異視為相同；每段變動先刪後加。回 [[op,text]]（相鄰同類已合併）。
function textDiff(oldS,newS){
  const lines=s=>normText(s).split(/(?<=\n)/);
  const out=[];
  const push=(op,t)=>{ if(!t) return; const l=out[out.length-1]; if(l && l[0]===op) l[1]+=t; else out.push([op,t]); };
  const sp=t=>/^\s+$/.test(t);
  let del=[], add=[];
  const flush=()=>{
    if(!del.length && !add.length) return;
    let d="", a="";
    const ops=lcsOps(tokens(del.join("")), tokens(add.join("")), (x,y)=>x===y || (sp(x)&&sp(y)));
    for(let k=0;k<ops.length;k++){
      const [op,t]=ops[k];
      if(op==="=" && sp(t) && (d||a) && ops[k+1] && ops[k+1][0]!=="="){ d+=t; a+=t; }   // 夾在兩段變動間的空白併進變動，不切碎
      else if(op==="="){ push("-",d); push("+",a); d=a=""; push("=",t); }
      else if(op==="-") d+=t; else a+=t;
    }
    push("-",d); push("+",a); del=[]; add=[];
  };
  for(const [op,l] of lcsOps(lines(oldS), lines(newS), (x,y)=>ws(x)===ws(y))){
    if(op==="="){ flush(); push("=",l); } else (op==="-"?del:add).push(l);
  }
  flush();
  return out;
}

// 註解分類：kind 值與符號（順序＝加註框的排列）。名稱、提示、處理方式在語系檔 kind.<值>.*，顏色在 CSS。
const KINDS = [
  { kind:"see-comment", sym:"※" }, { kind:"agree", sym:"✓" },
  { kind:"explain-more", sym:"?" }, { kind:"offer-alternatives", sym:"⇄" },
  { kind:"delete-text", sym:"−" }, { kind:"rethink-first-principles", sym:"↺" },
  { kind:"state-positively", sym:"+" }, { kind:"drop-feature", sym:"⊘" },
];
// 檔案裡的 kind 不可信：不是字串、不認得（含 0.7.0 前沒有 kind 的舊註解）一律當 see-comment。畫面與計數只看這個值。
function kindOf(a){ const k=a && a.kind; return typeof k==="string" && KINDS.some(x=>x.kind===k) ? k : "see-comment"; }
// 待辦＝沒解決、而且不是「同意」。左側徽章、標記完成前的確認、複製給 Claude 的摘要都用它。
function isTodo(a){ return a.status!=="resolved" && kindOf(a)!=="agree"; }
// 新註解：一律帶 kind、comment 一律字串、不帶 color；context 有值才帶。
function newAnnotation(f){
  return Object.assign({ line:f.line, quote:f.quote, comment:f.comment==null?"":String(f.comment), kind:kindOf(f),
    status:"open", id:f.id, createdAt:f.createdAt||new Date().toISOString() }, f.context?{context:f.context}:{});
}
// 存檔：以記憶體裡的註解物件為底（陌生欄位、kind／color／context 的原值照帶，沒有的不補），再正規化已知欄位。
function annToSave(a){ return Object.assign({}, a, { comment:a.comment==null?"":String(a.comment) }); }

const api = { normText, key, sim, typeOf, contextAt, reanchor, textDiff, KINDS, kindOf, isTodo, newAnnotation, annToSave };
if(typeof module!=="undefined" && module.exports) module.exports=api; else root.MDRDiff=api;
})(typeof window!=="undefined" ? window : this);
