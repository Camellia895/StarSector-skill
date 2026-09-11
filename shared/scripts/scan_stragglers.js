// scan_stragglers.js — 补丁后英文 UI 残留扫描（质量网）。
// 用法:
//   node scan_stragglers.js <classDir> [outJson] [--quiet]
//     [outJson] 省略时不写文件，只打印（推荐：别在 mod 目录里落中间产物，见 conventions §1）
//   node scan_stragglers.js --help
// 退出码: 0 = 无残留；1 = 有残留（便于 run_check.js 记账）
const fs = require('fs');
const path = require('path');
const { walkCp, decodeModifiedUtf8 } = require('./patcher.js');

const argv = process.argv.slice(2);
if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
  console.log('usage: node scan_stragglers.js <classDir> [outJson] [--quiet]');
  process.exit(argv.length ? 0 : 2);
}
const QUIET = argv.includes('--quiet');
const pos = argv.filter(a => !a.startsWith('--'));
const dir = pos[0];
const outFile = pos[1] || null;
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

const seen = new Map(); // str -> classes[]
for (const f of walk(dir)) {
  let buf;
  try { buf = fs.readFileSync(f); } catch (e) { continue; }
  let utf8s;
  try { utf8s = walkCp(buf).utf8s; } catch (e) { continue; }
  const rel = path.relative(dir, f).replace(/\\/g, '/');
  for (const u of utf8s) {
    const s = decodeModifiedUtf8(u.bytes);
    // looks like English UI text: has letters, has spaces or is a sentence-like phrase
    if (/[a-zA-Z]{3,}/.test(s) && /[\s]/.test(s) && s.length >= 8 && !/[\u4e00-\u9fff]/.test(s)) {
      if (!seen.has(s)) seen.set(s, []);
      seen.get(s).push(rel);
    }
  }
}
const arr = [];
for (const [s, cls] of seen) arr.push({ s, classes: cls.slice(0, 5), n: cls.length });
arr.sort((a, b) => b.n - a.n);
if (outFile) {
  fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(arr, null, 1), 'utf8');
}
console.log('dir:', dir);
console.log('remaining English-looking constants:', arr.length);
if (!QUIET) arr.slice(0, 40).forEach(x => console.log(`${x.n} | ${x.s.slice(0, 90)}`));
if (outFile) console.log('->', outFile);
process.exit(arr.length ? 1 : 0);

