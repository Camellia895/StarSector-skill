// check_assets.js —— 扫描 mod 内所有 graphics 资源引用，检查目标是否存在（只读）
// 用法: node check_assets.js <modDir> <游戏根>
//
// 要点（都是踩过的坑）：
//   * 存在性判定必须搜【mod 自身 + starsector-core + 其它已装 mod】——core 提供大量共用贴图
//     （graphics/hullmods/accelerated_shields.png 等），只查 mod 目录会造成大量假"缺失"
//   * 必须跳过注释行：.proj / .json 里被 # 注释掉的贴图引用不算数
//   * 只把带引号的 "graphics/..." 字面量当作引用（动态拼接的 sprite 名查不到，属正常）
const fs = require('fs');
const path = require('path');

const modDir = process.argv[2];
const gameRoot = process.argv[3] || path.resolve(modDir, '..', '..');
if (!modDir) { console.error('用法: node check_assets.js <modDir> <游戏根>'); process.exit(2); }
const coreDir = path.join(gameRoot, 'starsector-core');
const modsDir = path.join(gameRoot, 'mods');

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

// 去注释：整行/行内 # 与 // ，字符串外（与游戏 org.json 预处理一致）
function stripComments(s) {
  let out = ''; let inStr = false; let esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      out += c;
      if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; out += c; continue; }
    if (c === '#') { while (i < s.length && s[i] !== '\n') i++; out += '\n'; continue; }
    if (c === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') i++; out += '\n'; continue; }
    out += c;
  }
  return out;
}

const textExt = new Set(['.java', '.csv', '.json', '.faction', '.system', '.proj', '.variant', '.ship', '.skin', '.txt', '.version']);
const files = walk(modDir).filter(f => textExt.has(path.extname(f).toLowerCase()));

const refRe = /["'](graphics\/[^"'\s]+?\.(?:png|jpg|jpeg|webp|gif))["']/g;
const refs = new Map();
for (const f of files) {
  let txt;
  try { txt = stripComments(fs.readFileSync(f, 'utf8')); } catch (e) { continue; }
  let m;
  refRe.lastIndex = 0;
  while ((m = refRe.exec(txt)) !== null) {
    const p = m[1];
    if (!refs.has(p)) refs.set(p, new Set());
    refs.get(p).add(path.relative(modDir, f));
  }
}

const modAssets = new Set(walk(modDir).map(f => path.relative(modDir, f).replace(/\\/g, '/').toLowerCase()));
const coreAssets = new Set(walk(coreDir).map(f => path.relative(coreDir, f).replace(/\\/g, '/').toLowerCase()));
const otherAssets = new Set();
for (const d of fs.readdirSync(modsDir, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const g = path.join(modsDir, d.name, 'graphics');
  if (!fs.existsSync(g)) continue;
  for (const f of walk(g)) otherAssets.add(path.relative(path.join(modsDir, d.name), f).replace(/\\/g, '/').toLowerCase());
}

let missing = 0, ok = 0;
const missBySrc = new Map();
for (const [p, srcs] of [...refs.entries()].sort()) {
  const low = p.toLowerCase();
  if (modAssets.has(low) || coreAssets.has(low) || otherAssets.has(low)) { ok++; continue; }
  missing++;
  const where = [...srcs].join(', ');
  if (!missBySrc.has(where)) missBySrc.set(where, []);
  missBySrc.get(where).push(p);
}

console.log(`扫描 ${files.length} 个文本文件，发现 ${refs.size} 个 graphics 引用`);
console.log(`存在: ${ok}   缺失: ${missing}`);
if (missing) {
  console.log('\n=== 缺失引用（按来源文件）===');
  for (const [src, ps] of [...missBySrc.entries()].sort()) {
    console.log(`\n[${src}]`);
    for (const p of ps) console.log(`   ${p}`);
  }
  console.log('\n注意：贴图缺失一般只影响"玩家看到的图标/贴图"，不影响功能；');
  console.log('      但若引用来自 Java 源码的状态栏/UI 代码，请优先修（玩家能直接看到）。');
}
