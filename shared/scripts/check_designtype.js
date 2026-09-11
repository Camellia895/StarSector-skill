// check_designtype.js — designType 一致性闸门（red 级，G3）。
//
// 为什么单列（事故）：
//   引擎按 `tech/manufacturer` 的值去 `settings.json` 的 `designTypeColors` 里**查注册**。
//   查不到时它**不会报错**，而是**把该值原样当分类名显示出来** ——
//   于是船体图鉴里会出现一个"英文/原始值"的分类（本项目实测：`ship_data.csv` 写 "夜十字"，
//   而 designTypeColors 注册的是 "夜十字军械" → 图鉴分类显示 `夜十字`，用户报障）。
//
//   铁律 R10 只说了"势力显示名 = tech = designTypeColors 键要一致"，
//   但**没强调 tech 值必须落在 designTypeColors 的键集合内**。本脚本补这一条。
//
// 判据：把 mod + （可选）core 的 designTypeColors 键并起来当"有效集合"；以下两处的每个取值
//       都必须落在该集合内：
//         ① 所有含 `tech/manufacturer` 列的 CSV（`ship_data.csv` 等）
//         ② `data/hulls/**` 的 `.skin` / `.ship` 文件级 `tech` 字段
//       两处**互相独立**：只改 ① 而漏 ② 时界面照旧显示英文（实测事故），故本脚本同时查。
//
// 用法:
//   node check_designtype.js <modRoot> [游戏core目录]     # 建议给 core，否则 core 的设计类型会被误报
//   node check_designtype.js --help
// 退出码: 0 = 全部已注册；1 = 存在未注册值（会以原始值显示）；2 = 调用错误
const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./csvlib.js');

const argv = process.argv.slice(2);
if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
  console.log('usage: node check_designtype.js <modRoot> [游戏core目录]');
  console.log('校验 tech/manufacturer 的每个取值都在 designTypeColors 里注册（否则引擎原样显示该值作为分类名）');
  process.exit(argv.length ? 0 : 2);
}
const pos = argv.filter(a => !a.startsWith('--'));
const [MOD, CORE] = pos;
if (!MOD) { console.error('需要 <modRoot>（可选 [游戏core目录]）'); process.exit(2); }
if (!fs.existsSync(MOD)) { console.error('modRoot 不存在: ' + MOD); process.exit(2); }

const read = p => fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
const registered = new Map();
const collect = (p, tag) => {
  if (!fs.existsSync(p)) return;
  const m = read(p).match(/"designTypeColors"\s*:\s*\{([\s\S]*?)\n\s*\}/);
  if (!m) return;
  for (const x of m[1].matchAll(/"([^"]+)"\s*:\s*\[/g)) registered.set(x[1], tag);
};
collect(path.join(MOD, 'data/config/settings.json'), 'mod');
if (CORE) collect(path.join(CORE, 'data/config/settings.json'), 'core');

const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
  const p = path.join(d, e.name);
  return e.isDirectory() ? walk(p) : (/\.csv$/i.test(e.name) ? [p] : []);
});

// core 里少数非设计类型的特殊值（如电容/耗散标记），忽略
const IGNORE = new Set(['capacitor', 'vent']);
const bad = new Map();   // value -> [{file,id}]
let cells = 0;
for (const abs of walk(path.join(MOD, 'data'))) {
  const rel = path.relative(MOD, abs).replace(/\\/g, '/');
  let parsed;
  try { parsed = parseCsv(read(abs)); } catch (e) { continue; }
  const { header, rows } = parsed;
  const ci = header.indexOf('tech/manufacturer');
  if (ci < 0) continue;
  const iId = header.indexOf('id');
  for (const r of rows) {
    const v = (r.cells[ci] || '').trim();
    if (!v || IGNORE.has(v.toLowerCase())) continue;
    const id = iId >= 0 ? (r.cells[iId] || '').trim() : '';
    if (id.startsWith('#')) continue;
    cells++;
    if (registered.has(v)) continue;
    if (!bad.has(v)) bad.set(v, []);
    bad.get(v).push({ file: rel, id });
  }
}

// ---- 第二处来源：.skin / .ship 的 `tech`（**CSV 检查看不见**）----
// 事故：只把 ship_data.csv 的 tech 改成注册键，`na_kasei_x.skin` 自己的 `tech` 仍是英文
//   `"Nightcross"` → 图鉴该舰的分类名照旧显示英文。两处都要查。
//   注意：`"tech"` 只出现在文件级字段；悬点槽位用的是 `"type"`，不会误命中。
const badSpec = new Map();
let specHits = 0;
const walkSpec = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
  const p = path.join(d, e.name);
  return e.isDirectory() ? walkSpec(p) : (/\.(skin|ship)$/i.test(e.name) ? [p] : []);
});
const SPEC_RE = /(^|[\s,{])"tech"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
const specRoot = path.join(MOD, 'data', 'hulls');
if (fs.existsSync(specRoot)) {
  for (const abs of walkSpec(specRoot)) {
    const rel = path.relative(MOD, abs).replace(/\\/g, '/');
    const id = path.basename(abs).replace(/\.(skin|ship)$/i, '');
    for (const m of read(abs).matchAll(SPEC_RE)) {
      const v = m[2].trim();
      if (!v) continue;
      specHits++;
      if (registered.has(v)) continue;
      if (!badSpec.has(v)) badSpec.set(v, []);
      badSpec.get(v).push({ file: rel, id });
    }
  }
}

console.log('=== designType 一致性 ===');
console.log(`designTypeColors 已注册键 ${registered.size} 个（mod${CORE ? ' + core' : ''}）| 受检 tech/manufacturer 单元格 ${cells} 个 | .skin/.ship 的 tech 字段 ${specHits} 处\n`);
if (!bad.size && !badSpec.size) {
  console.log('✓ 所有 tech/manufacturer 与 .skin/.ship 的 tech 取值都已在 designTypeColors 注册');
  process.exit(0);
}
if (bad.size) {
  console.log(`✗ CSV 中未注册却被使用的值 ${bad.size} 个（引擎会把它们**原样当分类名显示**）：\n`);
  for (const [v, list] of [...bad.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const byFile = new Map();
    for (const r of list) byFile.set(r.file, (byFile.get(r.file) || 0) + 1);
    console.log(`  ${JSON.stringify(v)}  （${list.length} 处）`);
    for (const [f, n] of byFile) console.log(`      ${String(n).padStart(4)}  ${f}`);
    console.log(`      例: ${list.slice(0, 4).map(r => r.id).join(', ')}`);
  }
  console.log('');
}
if (badSpec.size) {
  console.log(`✗ .skin/.ship 的 tech 中未注册的值 ${badSpec.size} 个（**CSV 检查看不见**，界面照样显示原值）：\n`);
  for (const [v, list] of [...badSpec.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${JSON.stringify(v)}  （${list.length} 处）`);
    for (const r of list) console.log(`      ${r.file}   (id=${r.id})`);
  }
  console.log('');
}
console.log('处置二选一：');
console.log('  ① 把这些 tech/manufacturer 值改成**已注册的键**（推荐：避免同一含义出现两种写法）；');
console.log('  ② 或在 settings.json 的 designTypeColors 里为这些值注册颜色。');
console.log('注意 R10：键必须**唯一**且与 CSV 值**逐字一致**（重复键 = 启动 fatal）。');
console.log('若某值本身**就是**已注册键（如 TWINDRILL）、决定保留原文：该条 zh 写死等于 en，不要留空。');
process.exit(1);
