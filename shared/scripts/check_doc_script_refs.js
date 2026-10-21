// check_dangling_refs.js — 技能库体检 §8-3：文档引用的 shared 脚本是否存在（转义安全版）
const fs = require('fs'), path = require('path');
function walk(d) {
  let o = [];
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === '.git') continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) o.push(...walk(p));
    else if (e.name.endsWith('.md')) o.push(p);
  }
  return o;
}
const BS = String.fromCharCode(92); // 反斜杠，避免源码里写转义
const re = new RegExp('shared(?:' + BS + BS + '|/)scripts(?:' + BS + BS + '|/)([A-Za-z0-9_]+\\.(?:js|java))', 'g');
const refs = new Set();
for (const f of walk('.')) {
  const t = fs.readFileSync(f, 'utf8');
  for (const m of t.matchAll(re)) refs.add(m[1]);
}
let missing = 0;
for (const r of [...refs].sort()) {
  if (!fs.existsSync(path.join('shared', 'scripts', r))) { console.log('MISSING:', r); missing++; }
}
console.log('refs:', refs.size, 'missing:', missing);
process.exit(missing ? 1 : 0);
