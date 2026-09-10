// check_sprites.js —— 校验源码里 getSprite("分类","键") / getSpriteName 的引用是否存在（只读）
// 用法: node check_sprites.js <modDir> <游戏根>
//
// 要点：
//   * 分类可以来自 **mod 的 settings.json，也可以来自 core 的 settings.json**
//     （intel / planets / portraits 等大类本来就在 core）——只查 mod 会全是假阳性
//   * 键可以是**动态拼接**的（如 "SRD_generic_fighter_phantom_" + i）→ 脚本会把
//     以该前缀开头的键视为命中
const fs = require('fs');
const path = require('path');

const modDir = process.argv[2];
const gameRoot = process.argv[3] || path.resolve(modDir, '..', '..');
if (!modDir) { console.error('用法: node check_sprites.js <modDir> <游戏根>'); process.exit(2); }
const coreDir = path.join(gameRoot, 'starsector-core');

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

// 收集 core + mod 的 graphics 分类
const cats = new Map(); // 分类 -> Set(键)
// 注意：**不要**去 JSON.parse 这些文件！原版 settings.json 含 `[STATIONS]` 这类枚举字面量、
// 注释、尾随逗号、`1e` 之类非严格数值，任何"先预处理再 parse"的做法都可能失败。
// 这里改用**文本级**提取：定位 "graphics" 段 -> 找 "分类" : { ... } -> 抓该块内的 "键"。
function extractGraphics(file, tag) {
  if (!fs.existsSync(file)) return;
  const txt = fs.readFileSync(file, 'utf8');
  const gi = txt.indexOf('"graphics"');
  if (gi < 0) { console.log(`  跳过 ${tag} settings.json（未找到 graphics 段）`); return; }
  let i = txt.indexOf('{', gi);
  if (i < 0) return;
  // 括号配对找 graphics 段结束
  let depth = 0, end = txt.length;
  for (let j = i; j < txt.length; j++) {
    if (txt[j] === '{') depth++;
    else if (txt[j] === '}') { depth--; if (depth === 0) { end = j; break; } }
  }
  const block = txt.slice(i + 1, end);
  // 顶层分类：行首缩进的一级 "分类" : {  —— 用括号深度切分
  let d = 0, segStart = 0, cat = null, n = 0;
  for (let j = 0; j < block.length; j++) {
    const c = block[j];
    if (c === '{') {
      if (d === 0) {
        const head = block.slice(segStart, j);
        const m = head.match(/"([A-Za-z0-9_\- ]+)"\s*:\s*$/);
        cat = m ? m[1] : null;
        if (cat) { if (!cats.has(cat)) cats.set(cat, new Set()); n++; }
        segStart = j;
      }
      d++;
    } else if (c === '}') {
      if (d === 1 && cat) {
        // 该分类内的 "键" : 值
        const inner = block.slice(segStart, j + 1);
        for (const m of inner.matchAll(/"([^"]+)"\s*:/g)) cats.get(cat).add(m[1]);
        cat = null;
      }
      d--;
      if (d === 0) segStart = j + 1;
    }
  }
  console.log(`  读取 ${tag} settings.json 的 graphics 分类 ${n} 个`);
}
extractGraphics(path.join(coreDir, 'data/config/settings.json'), 'core');
extractGraphics(path.join(modDir, 'data/config/settings.json'), 'mod');

const calls = [];
for (const f of walk(path.join(modDir, 'jars', 'src')).filter(x => x.endsWith('.java'))) {
  const txt = fs.readFileSync(f, 'utf8');
  const rel = path.relative(modDir, f);
  for (const m of txt.matchAll(/getSprite\s*\(\s*"([^"]+)"\s*,\s*"([^"]+)"/g)) calls.push({ file: rel, cat: m[1], key: m[2] });
  for (const m of txt.matchAll(/getSpriteName\s*\(\s*"([^"]+)"\s*,\s*"([^"]+)"/g)) calls.push({ file: rel, cat: m[1], key: m[2] });
}

console.log(`源码中 getSprite/getSpriteName 调用 ${calls.length} 处`);
const bad = [];
for (const c of calls) {
  const set = cats.get(c.cat);
  if (!set) { bad.push(`[分类缺失] ${c.file}: getSprite("${c.cat}","${c.key}")`); continue; }
  if (set.has(c.key)) continue;
  // 动态拼接：存在以该键为前缀的键即算命中
  let dyn = false;
  for (const k of set) if (k.startsWith(c.key)) { dyn = true; break; }
  if (!dyn) bad.push(`[键缺失]   ${c.file}: getSprite("${c.cat}","${c.key}")`);
}
console.log(`问题 ${bad.length} 条`);
bad.forEach(b => console.log('  ' + b));
