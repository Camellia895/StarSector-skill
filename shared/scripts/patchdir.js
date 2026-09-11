// patchdir.js — 对目录树内全部 .class 按映射**原位补丁**（写操作！先备份）+ 键命中报告。
// 用法: node patchdir.js <mapping.json> <classDir> [outDir]
//   [outDir] 键未命中报告（missing_keys.json）的落盘目录；默认 <classDir>/..（别落在 mod 目录里）
// 退出码: 0 = 完成（未命中键只是提示，用报告复核）；2 = 参数/文件错误
const fs = require('fs');
const path = require('path');
const { patchClass, encodeModifiedUtf8 } = require('./patcher.js');

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.class')) out.push(p);
  }
  return out;
}

const argv = process.argv.slice(2);
if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
  console.log('usage: node patchdir.js <mapping.json> <classDir> [outDir]');
  console.log('  [outDir] missing_keys.json 的落盘目录；默认 <classDir>/..');
  console.log('  ⚠ 原位改写 .class，运行前请先备份（*.orig 或整个 jar 副本）');
  process.exit(argv.length ? 0 : 2);
}
const pos = argv.filter(a => !a.startsWith('--'));
const mappingFile = pos[0];
const classDir = pos[1];
const outDir = pos[2] || (classDir ? path.join(classDir, '..') : '.');
if (!mappingFile || !classDir) {
  console.error('usage: node patchdir.js <mapping.json> <classDir> [outDir]');
  process.exit(2);
}
if (!fs.existsSync(mappingFile)) { console.error('mapping.json 不存在: ' + mappingFile); process.exit(2); }
if (!fs.existsSync(classDir)) { console.error('classDir 不存在: ' + classDir); process.exit(2); }
const raw = JSON.parse(fs.readFileSync(mappingFile, 'utf8'));
const mapping = new Map();
for (const k of Object.keys(raw)) mapping.set(k, encodeModifiedUtf8(raw[k]));

const files = walk(classDir);
let replacedTotal = 0, changedClasses = 0, unchanged = 0;
const foundKeys = new Set();

// pass 1: read originals, count key presence, compute patches
const patches = []; // {file, buf} for changed classes
for (const f of files) {
  let buf;
  try { buf = fs.readFileSync(f); } catch (e) { continue; }
  const { walkCp } = require('./patcher.js');
  const { decodeModifiedUtf8 } = require('./patcher.js');
  try {
    const { utf8s } = walkCp(buf);
    for (const u of utf8s) {
      const s = decodeModifiedUtf8(u.bytes);
      if (mapping.has(s)) foundKeys.add(s);
    }
  } catch (e) { }
  let r;
  try { r = patchClass(buf, mapping); } catch (e) { console.log('PATCH FAIL:', f, e.message); continue; }
  if (r.buf) {
    patches.push({ file: f, buf: r.buf });
    replacedTotal += r.count;
    changedClasses++;
  } else {
    unchanged++;
  }
}
// pass 2: write patches
for (const p of patches) fs.writeFileSync(p.file, p.buf);
console.log('classes:', files.length, 'changed:', changedClasses, 'unchanged:', unchanged, 'total replacements:', replacedTotal);
const allKeys = new Set(mapping.keys());
const misses = [...allKeys].filter(k => !foundKeys.has(k));
console.log('mapping keys:', allKeys.size, 'found in jar:', foundKeys.size, 'MISSING:', misses.length);
if (misses.length) {
  const p = path.join(outDir, 'missing_keys.json');
  fs.mkdirSync(path.dirname(path.resolve(p)), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(misses, null, 1), 'utf8');
  console.log('missing keys saved to ' + p);
  console.log('（未命中键必须逐条解释：改错键 / 该条已不存在 / 故意保留 —— 见 -apply §3 G4）');
}
