// build_jar_worklist.js — 汇总 LLM/人工分类结果，产出 jar 翻译清单（通用版）。
// 输入契约（分类结果每项）：
//   { "c": <jar 常量原文，逐字符一致>, "decision": "translate"|"skip",
//     "category": "ui"|"log"|"id"|"path"|"sig"|"fmt"|"markup"|"other",
//     "cls": <主要类>, "note": "一句中文说明" }
// 用法：
//   node build_jar_worklist.js <candidates.json> <outTranslate.json> <outAudit.json> <classify1.json> [classify2.json ...]
//   - candidates.json = scan_jar_sources.js 输出（提供 classes/src 上下文）
//   - outTranslate.json：decision=translate 的条目，附加 classes/src/lineText，含空 zh 待填
//   - outAudit.json：skip 条目存档（便于复查有无漏判）
// 校验：分类键必须全部能在 candidates 找到、且不得重复，否则报错退出。
const fs = require('fs');
const path = require('path');

const CAND = process.argv[2];
const OUT_TR = process.argv[3];
const OUT_AU = process.argv[4];
const CLASSIFY = process.argv.slice(5);
if (!CAND || !OUT_TR || !OUT_AU || CLASSIFY.length === 0) {
  console.error('usage: node build_jar_worklist.js <candidates.json> <outTranslate.json> <outAudit.json> <classify1.json> [...]');
  process.exit(1);
}
fs.mkdirSync(path.dirname(OUT_TR), { recursive: true });

const cand = JSON.parse(fs.readFileSync(CAND, 'utf8'));
const candMap = new Map(cand.map(r => [r.c, r]));
const all = [];
for (const f of CLASSIFY) all.push(...JSON.parse(fs.readFileSync(f, 'utf8')));
console.log('classify total:', all.length);

const missing = [];
for (const e of all) if (!candMap.has(e.c)) missing.push(e.c);
if (missing.length) { console.error('classify keys missing from candidates:', missing.length, missing.slice(0, 10)); process.exit(2); }

const seen = new Set();
for (const e of all) {
  if (seen.has(e.c)) { console.error('duplicate classify key:', JSON.stringify(e.c)); process.exit(3); }
  seen.add(e.c);
}

const tr = all.filter(e => e.decision === 'translate');
const sk = all.filter(e => e.decision !== 'translate');
const outTr = tr.map(e => {
  const c = candMap.get(e.c) || { classes: [], src: [] };
  return { c: e.c, classes: c.classes || [], src: (c.src || []).map(s => s.ctx).join('; '), lineText: (c.src && c.src[0] ? c.src[0].lineText : '').slice(0, 180), cls: e.cls, note: e.note, zh: '' };
}).sort((a, b) => a.c.localeCompare(b.c));
const outSk = sk.map(e => ({ c: e.c, decision: e.decision, category: e.category, cls: e.cls, note: e.note })).sort((a, b) => a.c.localeCompare(b.c));
fs.writeFileSync(OUT_TR, JSON.stringify(outTr, null, 1), 'utf8');
fs.writeFileSync(OUT_AU, JSON.stringify(outSk, null, 1), 'utf8');
console.log('translate:', outTr.length, '->', OUT_TR);
console.log('skip     :', outSk.length, '->', OUT_AU);
