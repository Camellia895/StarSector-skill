// verify_patched.js — 补丁目录综合复查（G4，迁移场景）：① 报告仍含 \u0001 的字符串常量；
// ② 报告仍像英文句子的字面量。偏保守（会把标识符也算进来），作为人肉复核的候选清单用。
// 用法:
//   node verify_patched.js <classDir>
//   node verify_patched.js --help
// 退出码: 0 = 无 u0001、无句子级残留；1 = 有残留（便于 run_check.js 记账）
const fs = require('fs');
const path = require('path');
const { walkCp, decodeModifiedUtf8 } = require('./patcher.js');

const argv = process.argv.slice(2);
if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
  console.log('usage: node verify_patched.js <classDir>');
  process.exit(argv.length ? 0 : 2);
}
const dir = argv.filter(a => !a.startsWith('--'))[0];
if (!dir || !fs.existsSync(dir)) { console.error('classDir 不存在: ' + dir); process.exit(2); }

function walk(d) {
  const out = [];
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.class')) out.push(p);
  }
  return out;
}

let u0001 = 0;
const stragglers = new Map(); // s -> classes
for (const f of walk(dir)) {
  let buf;
  try { buf = fs.readFileSync(f); } catch (e) { continue; }
  let c;
  try { c = walkCp(buf); } catch (e) { continue; }
  const rel = path.relative(dir, f).replace(/\\/g, '/');
  for (const u of c.utf8s) {
    if (!c.stringRefs.has(u.index) || c.identRefs.has(u.index)) continue;
    const s = decodeModifiedUtf8(u.bytes);
    if (s.includes('\u0001')) { u0001++; console.log('u0001 in', rel, JSON.stringify(s.slice(0, 80))); }
    // sentence-like English remaining
    if (/[a-zA-Z]{4,}/.test(s) && /\s/.test(s) && s.length >= 10 && !/[\u4e00-\u9fff]/.test(s)) {
      if (/^(graphics|data|sounds)\//.test(s)) continue;
      if (/^tem_/.test(s)) continue;
      if (/\.(png|jpg|json|csv|fnt|ttf|ogg|class|java|wav)$/.test(s)) continue;
      if (!stragglers.has(s)) stragglers.set(s, []);
      stragglers.get(s).push(rel);
    }
  }
}
console.log('dir:', dir);
console.log('u0001 constants:', u0001);
console.log('remaining sentence-like English literals:', stragglers.size);
const arr = [...stragglers.entries()].sort((a, b) => a[0].localeCompare(b[0]));
for (const [s, cls] of arr) console.log(JSON.stringify(s.slice(0, 100)), '<-', cls.slice(0, 2).join(';'));
process.exit((u0001 || stragglers.size) ? 1 : 0);

