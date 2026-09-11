// check_jar_patch_integrity.js — **jar 补丁洁净性**验证（red 级，G4）。
//
// 与现有 G4 工具的分工：
//   verify_identifiers.js  只查"标识符有没有含 CJK"（防 R7 误改）
//   verify_u0001_jar.js    只查"含 \u0001 的常量数量是否一致"（防 R6）
//   scan_stragglers.js     只查"还有没有英文 UI 残留"
//   **本脚本补的是"除此之外有没有被动过"**——逐类做常量池**多重集差异**，要求：
//     · 类集合完全一致（不新增/不丢类）
//     · 每一处差异都必须落在**声明的映射键/译文**上
//   → 也就是"补丁只改了它该改的东西"这一句口号的可机械验证版本。
//   真实价值：本次实测它证明"映射外常量改动 = 0"，把"我只改了文本"从自述变成证据；
//   若哪天补丁脚本回归成全量替换，这里会立刻炸出来。
//
// 用法:
//   node check_jar_patch_integrity.js <原jar|原classDir> <补丁jar|补丁classDir> <patch_map.json|jar清单.json>
//     <原...>     英文原版 jar，或已解包的 class 目录
//     <补丁...>   补丁后 jar，或已解包的 class 目录
//     <映射>      patchdir.js 的映射（{常量:译文}），或 jar 层清单数组（取 c/zh）
//   node check_jar_patch_integrity.js --help
// 退出码: 0 = 洁净（类集合一致 + 映射外改动 0）；1 = 有问题；2 = 调用错误
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { parseClass } = require('./classparser.js');

const argv = process.argv.slice(2);
if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
  console.log('usage: node check_jar_patch_integrity.js <原jar|原classDir> <补丁jar|补丁classDir> <patch_map.json|jar清单.json>');
  process.exit(argv.length ? 0 : 2);
}
const pos = argv.filter(a => !a.startsWith('--'));
const [ORIG, PATCHED, MAP_PATH] = pos;
if (!ORIG || !PATCHED || !MAP_PATH) { console.error('用法见 --help：需要 3 个路径参数'); process.exit(2); }
for (const [n, p] of [['原', ORIG], ['补丁', PATCHED], ['映射', MAP_PATH]]) {
  if (!fs.existsSync(p)) { console.error(`${n} 不存在: ${p}`); process.exit(2); }
}

// ---- 映射：常量原文 -> 译文 ----
const translated = new Set();
{
  const j = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));
  if (Array.isArray(j)) {
    for (const e of j) {
      const k = e.c !== undefined ? e.c : e.en;
      const v = e.zh;
      if (k !== undefined && v && String(v).trim() && String(v) !== String(k)) translated.add(String(v));
      if (k !== undefined) translated.add(String(k));   // 常量原文本身也是"合法差异来源"
    }
  } else {
    for (const [k, v] of Object.entries(j)) { translated.add(k); translated.add(String(v)); }
  }
}

const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
  const p = path.join(d, e.name);
  return e.isDirectory() ? walk(p) : (e.name.endsWith('.class') ? [p] : []);
});
function extractJar(jar, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  execFileSync('powershell', ['-NoProfile', '-Command',
    `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${path.resolve(jar).replace(/'/g, "''")}','${dest.replace(/'/g, "''")}')`],
    { stdio: 'ignore' });
  return dest;
}
// jar 判定：接受 *.jar 与 *.jar.orig / *.jar.bak（备份件仍是 zip，不是目录）
const isJar = p => fs.statSync(p).isFile();
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ncjar-'));
const dirA = isJar(ORIG) ? extractJar(ORIG, path.join(tmpRoot, 'a')) : ORIG;
const dirB = isJar(PATCHED) ? extractJar(PATCHED, path.join(tmpRoot, 'b')) : PATCHED;

// ---- 逐类收集 Utf8 常量（多重集）----
function consts(dir) {
  const m = new Map();
  for (const f of walk(dir)) {
    let cp;
    try { cp = parseClass(fs.readFileSync(f)).cp; } catch (e) { continue; }
    const rel = path.relative(dir, f).replace(/\\/g, '/');
    const list = [];
    for (let i = 1; i < cp.length; i++) { const e = cp[i]; if (e && e.tag === 1) list.push(e.str); }
    m.set(rel, list);
  }
  return m;
}
const A = consts(dirA), B = consts(dirB);

const keys = new Set([...A.keys(), ...B.keys()]);
const missing = [...A.keys()].filter(k => !B.has(k));
const added = [...B.keys()].filter(k => !A.has(k));
let classesChanged = 0;
const unexpected = [];

for (const k of keys) {
  const a = A.get(k), b = B.get(k);
  if (!a || !b) continue;
  const cnt = arr => { const m = new Map(); for (const s of arr) m.set(s, (m.get(s) || 0) + 1); return m; };
  const ma = cnt(a), mb = cnt(b);
  const diff = new Set();
  for (const [s, n] of ma) if ((mb.get(s) || 0) !== n) diff.add(s);
  for (const [s, n] of mb) if ((ma.get(s) || 0) !== n) diff.add(s);
  if (!diff.size) continue;
  classesChanged++;
  for (const s of diff) if (!translated.has(s)) unexpected.push({ cls: k, constant: s });
}

console.log('=== jar 补丁洁净性 ===');
console.log(`类（class）数：原件 ${A.size} | 补丁 ${B.size}`);
console.log(`常量池有变化的类: ${classesChanged}`);
console.log(`丢失的类: ${missing.length}${missing.length ? ' → ' + missing.slice(0, 5).join(', ') : ' ✓'}`);
console.log(`新增的类: ${added.length}${added.length ? ' → ' + added.slice(0, 5).join(', ') : ' ✓'}`);
console.log(`映射外的意外常量改动: ${unexpected.length}${unexpected.length ? '' : ' ✓'}`);
for (const u of unexpected.slice(0, 40)) console.log(`  ✗ ${u.cls} :: ${JSON.stringify(String(u.constant).slice(0, 110))}`);

const bad = missing.length + added.length + unexpected.length;
if (bad) {
  console.log('\n✗ 补丁改动了声明之外的东西（或类集合不一致）—— 必须查明后再交付。');
  console.log('  提示：映射外的改动常见原因是"补丁脚本退化成全量替换"或"映射里混入了标识符"。');
} else {
  console.log('\n✓ 补丁洁净：类集合一致，且每一处常量差异都落在声明的映射键/译文上');
}
try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (e) {}
process.exit(bad ? 1 : 0);
