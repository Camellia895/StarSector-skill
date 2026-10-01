// enum_struct_fields.js — enumerate all string-valued keys in .ship/.skin/.variant files
// (per extract skill §1.5: list ALL string fields first, then decide which are translatable)
// 2026-10-02 Hyperion 实测：只 grep hullName 会漏掉 .skin 的 tech 等可见字段——先枚举全貌再判断
const fs = require('fs');
const path = require('path');
const { parseJsonLoose } = require('./pseudojson.js');

const ROOT = process.argv[2];
if (!ROOT) {
  console.error('usage: node enum_struct_fields.js <data目录>');
  console.error('  枚举 .ship/.skin/.variant 全部字符串键及出现次数/样例（决定哪些是可见文本前先看全貌）');
  process.exit(2);
}
const counts = {}; // key -> { n, sample, file }
function visit(obj, keyPath, file) {
  if (Array.isArray(obj)) { obj.forEach(v => visit(v, keyPath, file)); return; }
  if (obj && typeof obj === 'object') {
    for (const k of Object.keys(obj)) visit(obj[k], keyPath ? keyPath + '.' + k : k, file);
    return;
  }
  if (typeof obj === 'string') {
    if (!counts[keyPath]) counts[keyPath] = { n: 0, sample: '', files: new Set() };
    counts[keyPath].n++;
    if (!counts[keyPath].sample) counts[keyPath].sample = obj.slice(0, 60);
    counts[keyPath].files.add(file);
  }
}
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(ship|skin|variant)$/.test(e.name)) {
      const rel = path.relative(ROOT, p).replace(/\\/g, '/');
      try { visit(parseJsonLoose(fs.readFileSync(p, 'utf8')), '', rel); } catch (err) { console.error('PARSE FAIL ' + rel + ': ' + err.message); }
    }
  }
}
walk(ROOT);
const keys = Object.keys(counts).sort();
for (const k of keys) {
  const c = counts[k];
  console.log(`${k}  x${c.n}  files=${c.files.size}  sample=${JSON.stringify(c.sample)}`);
}
