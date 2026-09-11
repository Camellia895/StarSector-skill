// check_jar_stragglers.js — G4 闸门：**交付 jar** 里残留的英文 UI 文本必须为 0（可判定版）。
//
// 为什么需要它（两次踩坑）：
//   1. `scan_stragglers.js` 只吃 **.class 目录**。若对着"补丁前的解包副本"跑，
//      得到的是**原始 jar** 的英文——本项目实测 383 条，全是假警报。
//      本脚本直接吃 **jar 文件**（自己解包到内存），目标永远是"要交付的那个 jar"。
//   2. `scan_stragglers.js` 是纯启发式（含空格、无 CJK、长度≥8 就当英文 UI），
//      必然命中**故意不译**的常量。本脚本用两份账把它变成可判定：
//        · patch_map.json   —— 声明要译的（en ≠ zh）。这些在补丁后仍以英文出现 = **真残留（A 类，必错）**
//        · skip 审计        —— 声明跳过的（category 通常为 log/id/internal…）。命中 = **已记账（B 类）**
//      既不属 A 也不属 B 的 = **C 类（未记账，须人工判定）**。
//
// 判据：A === 0 且 C === 0 → 通过（B 类允许存在，它是"跳过决策"的证据，不是缺陷）。
//
// 用法:
//   node check_jar_stragglers.js <jar文件> <patch_map.json> <jar_skip_audit.json> [--show-b]
// 退出码: 0 = A 与 C 均为 0；1 = 存在 A 或 C；2 = 调用错误
//
// 注：patch_map 支持扁平 `{ "<en>": "<zh>" }`（apply_jar.js 产物）与条目数组两种形态。
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { walkCp, decodeModifiedUtf8 } = require('./patcher.js');

const argv = process.argv.slice(2);
const SHOW_B = argv.includes('--show-b');
const [JAR, MAPF, AUDITF] = argv.filter(a => !a.startsWith('--'));
if (!JAR || !MAPF) {
  console.error('usage: node check_jar_stragglers.js <jar文件> <patch_map.json> [jar_skip_audit.json] [--show-b]');
  process.exit(2);
}
if (!fs.existsSync(JAR)) { console.error('jar 不存在: ' + JAR); process.exit(2); }

// ---- 从 jar 里读出所有 .class 的常量（用 jar 自身的解包，不落中间产物）----
function readClassesFromJar(jar) {
  // 用 unzip -p 逐条目读（Node 无内置 zip；调用系统 unzip 会引入平台依赖，
  // 故改用 JDK 的 jar 工具；两者都可能缺失 → 退化到 PowerShell 的 ZipFile）
  const out = new Map();
  const listRaw = execFileSync('powershell', ['-NoProfile', '-Command',
    `Add-Type -AssemblyName System.IO.Compression.FileSystem;` +
    `$z=[System.IO.Compression.ZipFile]::OpenRead('${jar.replace(/'/g, "''")}');` +
    `$z.Entries | Where-Object { $_.FullName -like '*.class' } | ForEach-Object { $_.FullName };` +
    `$z.Dispose()`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const names = listRaw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (!names.length) throw new Error('jar 内没有 .class 条目');
  // 一次性把需要的条目解到临时目录会污染工作区；改为分批 -p 输出不可行（二进制），
  // 因此解到系统临时目录（不进 mod / 不进 _work）。
  const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jarstraggle-'));
  try {
    execFileSync('powershell', ['-NoProfile', '-Command',
      `Add-Type -AssemblyName System.IO.Compression.FileSystem;` +
      `[System.IO.Compression.ZipFile]::ExtractToDirectory('${jar.replace(/'/g, "''")}','${tmp.replace(/'/g, "''")}')`],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    for (const n of names) {
      const p = path.join(tmp, n.replace(/\//g, path.sep));
      if (fs.existsSync(p)) out.set(n, fs.readFileSync(p));
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  return out;
}

let classBufs;
try { classBufs = readClassesFromJar(JAR); }
catch (e) { console.error('读取 jar 失败: ' + e.message); process.exit(2); }

// ---- patch_map：声明要译的 ----
const raw = JSON.parse(fs.readFileSync(MAPF, 'utf8'));
let pairs = [];
if (Array.isArray(raw)) {
  for (const e of raw) if (typeof e.en === 'string' && typeof e.zh === 'string') pairs.push({ en: e.en, zh: e.zh });
} else if (Array.isArray(raw.entries)) {
  for (const e of raw.entries) if (typeof e.en === 'string' && typeof e.zh === 'string') pairs.push({ en: e.en, zh: e.zh });
} else if (raw.map && typeof raw.map === 'object') {
  for (const [k, v] of Object.entries(raw.map)) if (typeof v === 'string') pairs.push({ en: k, zh: v });
} else {
  const vals = Object.values(raw);
  if (vals.length && vals.every(v => typeof v === 'string')) pairs = Object.entries(raw).map(([k, v]) => ({ en: k, zh: v }));
}
if (!pairs.length) { console.error('patch_map 结构无法识别: ' + MAPF); process.exit(2); }
const translate = new Map();
for (const p of pairs) if (p.en !== p.zh) translate.set(p.en, p.zh);

// ---- skip 审计：声明跳过的 ----
const skipped = new Set();
let auditN = 0;
if (AUDITF && fs.existsSync(AUDITF)) {
  const A = JSON.parse(fs.readFileSync(AUDITF, 'utf8'));
  const arr = Array.isArray(A) ? A : (A.items || A.entries || []);
  auditN = arr.length;
  for (const x of arr) if (typeof x.c === 'string') skipped.add(x.c);
}

// ---- 扫（与 scan_stragglers 同一启发式，保证口径一致）----
const found = new Map();  // s -> [classRel]
for (const [rel, buf] of classBufs) {
  let utf8s;
  try { utf8s = walkCp(buf).utf8s; } catch (e) { continue; }
  for (const u of utf8s) {
    const s = decodeModifiedUtf8(u.bytes);
    if (!(/[a-zA-Z]{3,}/.test(s) && /\s/.test(s) && s.length >= 8 && !/[\u4e00-\u9fff]/.test(s))) continue;
    if (!found.has(s)) found.set(s, []);
    found.get(s).push(rel);
  }
}

const A = [], B = [], C = [];
for (const [s, cls] of found) {
  if (translate.has(s)) A.push({ s, cls, zh: translate.get(s) });
  else if (skipped.has(s)) B.push({ s, cls });
  else C.push({ s, cls });
}

console.log('=== jar 英文残留闸门（可判定）===');
console.log(`jar: ${JAR}`);
console.log(`  类文件 ${classBufs.size} 个 | 启发式命中 ${found.size} 条`);
console.log(`  账：声明要译 ${translate.size} 条 | 声明跳过 ${auditN} 条（去重 ${skipped.size}）\n`);

console.log(`A) 声明要译、jar 里仍是英文（**真残留，必错**）: ${A.length}`);
for (const x of A.slice(0, 30)) {
  console.log(`   ${JSON.stringify(x.s.slice(0, 90))}`);
  console.log(`       译: ${JSON.stringify(String(x.zh).slice(0, 70))}`);
  console.log(`       类: ${[...new Set(x.cls)].slice(0, 3).join(', ')}`);
}
console.log(`\nB) 已记账的跳过（category=log/id/internal 等，**允许**）: ${B.length}`);
if (SHOW_B) for (const x of B) console.log(`   ${JSON.stringify(x.s.slice(0, 80))}`);
console.log(`\nC) 未记账（既没声明要译、也不在跳过审计里 → 须人工判定）: ${C.length}`);
for (const x of C.slice(0, 30)) {
  console.log(`   ${JSON.stringify(x.s.slice(0, 90))}   ${[...new Set(x.cls)].length} 类`);
  console.log(`       类: ${[...new Set(x.cls)].slice(0, 3).join(', ')}`);
}
console.log('\n结论：A 与 C 必须都为 0；B 是"跳过决策"的证据，允许存在。');
console.log('C 类处置：确认玩家不可见 → 补进 jar_skip_audit.json（写清 category 与理由）；可见 → 补进清单并翻译。');
process.exit(A.length || C.length ? 1 : 0);
