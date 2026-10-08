// reviewer-diff.js 的自我檢查：node test/diff.test.cjs（npm test）。純 assert，不需框架。
"use strict";
const assert = require("assert");
const D = require("../reviewer-diff.js");

// 測試用：依序排區塊（每塊之間空一行），行號自動算
function B(...srcs){ let line=1; return srcs.map(src=>{ const b={ line, end:line+src.split("\n").length-1, src }; line=b.end+2; return b; }); }
function ann(blocks,i,quote){ return { id:"x", line:blocks[i].line, quote, context:D.contextAt(blocks,i) }; }
function at(a,blocks){ return D.reanchor([a],blocks).get("x"); }
const changes = ops => ops.filter(o=>o[0]!=="=");
let n=0; function t(name,fn){ fn(); n++; console.log("ok -", name); }

const P = "Para one has some words here for testing.";

t("normText 去 BOM、統一換行、去行尾空白", ()=>{
  assert.strictEqual(D.normText("﻿a\r\nb  \rc\t"), "a\nb\nc");
});

t("段落沒變、上方插入 30 段 → SAME，行號跟著走", ()=>{
  const old=B("# T", P, "## H2"), a=ann(old,1,"some words");
  const ins=Array.from({length:30},(_,i)=>"Inserted "+i+".");
  const now=B(...ins, "# T", P, "## H2");
  const r=at(a,now);
  assert.strictEqual(r.state,"same"); assert.strictEqual(r.line, now[31].line);
});

t("改一個字 → CHANGED，差異只標那個字", ()=>{
  const old=B("# T", P, "## H2"), a=ann(old,1,"some");
  const now=B("# T", P.replace("some","many"), "## H2");
  const r=at(a,now);
  assert.strictEqual(r.state,"changed");
  assert.deepStrictEqual(changes(D.textDiff(a.context.block, r.src)), [["-","some"],["+","many"]]);
});

t("重新折行、字沒變 → SAME", ()=>{
  const old=B("# T", "Para one has\nsome words here.", "## H2"), a=ann(old,1,"some");
  const now=B("# T", "Para one has some\nwords here.", "## H2");
  assert.strictEqual(at(a,now).state,"same");
});

t("有序清單重新編號 → SAME", ()=>{
  const old=B("1. First item", "3. Third item text", "4. Fourth"), a=ann(old,1,"Third");
  const now=B("1. First item", "4. Third item text", "5. Fourth");
  assert.strictEqual(at(a,now).state,"same");
});

t("刪掉清單項 macOS → GONE，不會變成「macOS → Linux」", ()=>{
  const old=B("- Support Windows", "- Support macOS", "- Support Linux"), a=ann(old,1,"macOS");
  const now=B("- Support Windows", "- Support Linux");
  assert.strictEqual(at(a,now).state,"gone");
});

t("標題改名、鄰居沒變 → CHANGED", ()=>{
  const old=B("Intro para text.", "## Summary", "Body para text here."), a=ann(old,1,"Summary");
  const now=B("Intro para text.", "## Overview", "Body para text here.");
  const r=at(a,now);
  assert.strictEqual(r.state,"changed"); assert.strictEqual(r.src,"## Overview");
});

t("標題被刪、還有別的標題 → GONE", ()=>{
  const old=B("## Background", "Text A is here.", "## Summary", "Text B is here.", "## Risks", "Text C."), a=ann(old,2,"Summary");
  const now=B("## Background", "Text A is here.", "Text B is here.", "## Risks", "Text C.");
  assert.strictEqual(at(a,now).state,"gone");
});

t("同一段出現兩次、被註解的那份被改 → 在被改的那份 CHANGED", ()=>{
  const S="Same paragraph text repeated twice here.";
  const old=B("## A", S, "## B", S, "## C"), a=ann(old,3,"repeated");
  const now=B("## A", S, "## B", S+" Edited.", "## C");
  const r=at(a,now);
  assert.strictEqual(r.state,"changed"); assert.strictEqual(r.line, now[3].line);
});

t("同一標題出現兩次、中間插入 90 段 → 留在被註解的那份", ()=>{
  const old=B("### Example", "First body.", "### Other", "### Example", "Second body."), a=ann(old,3,"Example");
  const ins=Array.from({length:90},(_,i)=>"Filler "+i+".");
  const now=B("### Example", "First body.", ...ins, "### Other", "### Example", "Second body.");
  const r=at(a,now);
  assert.strictEqual(r.state,"same"); assert.strictEqual(r.line, now[now.length-2].line);
});

t("舊註解（無 context）：quote 唯一且夠長 → SAME＋回填；出現多處 → 不回填", ()=>{
  const now=B("# T", P, "## H2");
  const r1=at({ id:"x", line:99, quote:"Para one has some words" }, now);
  assert.strictEqual(r1.state,"same"); assert.strictEqual(r1.line, now[1].line);
  assert.deepStrictEqual(r1.backfill, { block:P, prev:"# T", next:"## H2" });
  const dup=B("Shared words in this sentence.", "Shared words in this sentence too.");
  const r2=at({ id:"x", line:1, quote:"Shared words in this sentence" }, dup);
  assert.strictEqual(r2.state,"same"); assert.strictEqual(r2.backfill, undefined);
});

t("舊註解：quote 到處都找不到 → UNVERIFIED，行號不動", ()=>{
  const r=at({ id:"x", line:7, quote:"nowhere to be found" }, B("# T", P));
  assert.strictEqual(r.state,"unverified"); assert.strictEqual(r.line,7);
});

t("CRLF 的 context 對 LF 的文件 → SAME", ()=>{
  const now=B("# T", "Line a\nLine b", "## H2");
  const a={ id:"x", line:3, quote:"Line", context:{ block:"Line a\r\nLine b", prev:"# T\r", next:"## H2" } };
  assert.strictEqual(at(a,now).state,"same");
});

t("sim 邊界不出 NaN", ()=>{
  for(const [x,y] of [["",""],["a",""],["a","b"],["一","一"]]) assert.ok(!Number.isNaN(D.sim(x,y)), x+"|"+y);
  assert.strictEqual(D.sim("a","a"),1); assert.strictEqual(D.sim("a","b"),0);
});

t("差異逐字（中文一字一 token、emoji 不拆半、先刪後加）", ()=>{
  assert.deepStrictEqual(changes(D.textDiff("約一億筆資料", "約一點二億筆資料")), [["+","點二"]]);
  assert.deepStrictEqual(changes(D.textDiff("簽名 🤖", "簽名 🤗")), [["-","🤖"],["+","🤗"]]);
  assert.deepStrictEqual(changes(D.textDiff("a b", "c d")).map(o=>o[0]), ["-","+"]);
});

t("多行表格只改一格 → 差異只在那一格", ()=>{
  const rows=Array.from({length:60},(_,i)=>"| r"+i+" | v"+i+" |");
  const after=rows.slice(); after[30]="| r30 | CHANGED |";
  assert.deepStrictEqual(changes(D.textDiff(rows.join("\n"), after.join("\n"))), [["-","v30"],["+","CHANGED"]]);
});

console.log(`\n${n} checks passed`);
