// check_jar_registry_keys.js — ★jar 映射 × 引擎注册表交集闸门（2026-10-01 crabshack 事故沉淀）。
//
// 事故形态：patch_map 把引擎注册表 id 当 UI 文本翻译——
//   "barren-bombarded" → "荒芜-轰击"（原版星球类型 id，planets.json 键本就是**连字符**形态，
//     id 形态正则只认蛇形/全大写 ⇒ 漏网；addPlanet 查表 null → 新建游戏 NPE 崩溃）
//   "barren-desert"   → "荒芜-荒漠"（getTypeId() 比较值，误译后排除逻辑静默失效）
//   "food"            → "料理"（原版商品 id，料理配方 stuff.put("food",…) 映射键失效）
// 教训：**id 形态正则不可靠（连字符/单词型 id 都会漏），注册表交集是唯一可靠判据**。
//   调用点行级语境（KEYUSE/SHOWUSE）无法区分同调用不同参数位（addPlanet 的名称参 vs 类型参）。
//
// 做法：把 patch_map 的**键**（= jar 常量原文）与 core + mod 的引擎注册表求交集：
//   planets.json 顶层键（星球类型）、conditions/industries/commodities/special_items/hull_mods/
//   wing_data/ship_systems/ship_data/weapon_data/skill_data/factions/personalities 的 id 列、
//   descriptions.csv 的 id 列、settings.json 顶层键 + designTypeColors 键。
// 命中 = 疑似引擎 id 被翻译 ⇒ **必错或须人工定性**（同串可能既是 id 又是 UI 高亮词，
//   如 "water"/"intercept" 纯高亮用法可经 --allow 白名单保留；保留决策必须附反编译证据）。
//
// 用法:
//   node check_jar_registry_keys.js <patch_map.json> <coreDir> [modDir] [--allow=<allowlist.json>] [--json=<out|-]
//     <patch_map.json>  jar 映射（扁平 {en:zh} 或条目数组；键 = jar 常量原文）
//     <coreDir>         starsector-core 目录
//     [modDir]          mod 根目录（其 planets.json/settings.json 也并入注册表；建议总是给）
//     --allow           白名单 JSON：{ "<键>": "人工定性理由" }；命中白名单的键不计失败
//   node check_jar_registry_keys.js --help
// 退出码: 0 = 无未解释命中；1 = 有命中（回退或写白名单后再交付）；2 = 用法/文件错误
// 时机: patch_map 建好后、patchdir 之前（注入前拦截）；补丁后复跑一次防映射回改。
'use strict';
const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./csvlib.js');
const { parseJsonLoose } = require('./pseudojson.js');

const argv = process.argv.slice(2);
if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
  console.log('usage: node check_jar_registry_keys.js <patch_map.json> <coreDir> [modDir] [--allow=<allowlist.json>] [--json=<out|-]');
  console.log('  patch_map 键（jar 常量原文）× core+mod 引擎注册表求交集；命中 = 疑似引擎 id 被翻译');
  console.log('  退出码: 0 = 干净；1 = 有未解释命中（回退或 --allow 定性）；2 = 用法错误');
  console.log('  --allow=<json>  已定性保留白名单 { "<键>": "理由" }（如纯高亮用法，附反编译证据）');
  process.exit(argv.length ? 0 : 2);
}
const pos = argv.filter(a => !a.startsWith('--'));
const [MAPF, CORE, MOD] = pos;
const allowArg = argv.find(a => a.startsWith('--allow='));
const jsonArg = argv.find(a => a.startsWith('--json='));
if (!MAPF || !CORE) { console.error('需要 <patch_map.json> <coreDir> [modDir]'); process.exit(2); }
if (!fs.existsSync(MAPF)) { console.error('patch_map 不存在: ' + MAPF); process.exit(2); }
if (!fs.existsSync(CORE)) { console.error('coreDir 不存在: ' + CORE); process.exit(2); }
if (MOD && !fs.existsSync(MOD)) { console.error('modDir 不存在: ' + MOD); process.exit(2); }

// ---- 载入 patch_map（扁平或条目数组）----
function loadMap(f) {
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (Array.isArray(j)) {
    const m = {};
    for (const e of j) {
      const k = e.c !== undefined ? e.c : e.en;
      if (k === undefined) continue;
      if (e.zh === undefined || e.zh === '' || e.zh === k) continue;   // 未译/保留原文不算
      m[k] = e.zh;
    }
    return m;
  }
  return j;   // 扁平 {en:zh}（build_jar_worklist/apply_jar 产物）
}
const map = loadMap(MAPF);

// ---- 构建注册表 ----
const reg = new Map();   // id -> [来源]
const add = (id, src) => { if (!id) return; if (!reg.has(id)) reg.set(id, []); reg.get(id).push(src); };
const tryJson = (p, src) => { try { const o = parseJsonLoose(fs.readFileSync(p, 'utf8')); Object.keys(o).forEach(k => add(k, src)); return true; } catch (e) { return false; } };
const tryCsv = (p, idCol, src) => {
  if (!fs.existsSync(p)) return false;
  try {
    const { header, rows } = parseCsv(fs.readFileSync(p, 'utf8'));
    const i = header.indexOf(idCol);
    if (i < 0) return false;
    for (const r of rows) {
      const id = (r.cells[i] || '').trim();
      if (id && !id.startsWith('#') && !/^#+$/.test(id)) add(id, src);
    }
    return true;
  } catch (e) { return false; }
};

const CORE_DATA = path.join(CORE, 'data');
tryJson(path.join(CORE_DATA, 'config/planets.json'), 'core planets.json（星球类型）');
tryJson(path.join(CORE_DATA, 'config/settings.json'), 'core settings.json');
tryCsv(path.join(CORE_DATA, 'campaign/conditions.csv'), 'id', 'core conditions.csv');
tryCsv(path.join(CORE_DATA, 'campaign/industries.csv'), 'id', 'core industries.csv');
tryCsv(path.join(CORE_DATA, 'campaign/commodities.csv'), 'id', 'core commodities.csv');
tryCsv(path.join(CORE_DATA, 'campaign/special_items.csv'), 'id', 'core special_items.csv');
tryCsv(path.join(CORE_DATA, 'hullmods/hull_mods.csv'), 'id', 'core hull_mods.csv');
tryCsv(path.join(CORE_DATA, 'hulls/wing_data.csv'), 'id', 'core wing_data.csv');
tryCsv(path.join(CORE_DATA, 'hulls/ship_data.csv'), 'id', 'core ship_data.csv');
tryCsv(path.join(CORE_DATA, 'weapons/weapon_data.csv'), 'id', 'core weapon_data.csv');
tryCsv(path.join(CORE_DATA, 'shipsystems/ship_systems.csv'), 'id', 'core ship_systems.csv');
tryCsv(path.join(CORE_DATA, 'characters/skills/skill_data.csv'), 'id', 'core skill_data.csv');
tryCsv(path.join(CORE_DATA, 'world/factions/factions.csv'), 'faction', 'core factions.csv');
tryCsv(path.join(CORE_DATA, 'strings/descriptions.csv'), 'id', 'core descriptions.csv');

// mod 的 planets.json / settings.json / designTypeColors / conditions（mod 自定义类型）
if (MOD) {
  const M = p => path.join(MOD, p);
  tryJson(M('data/config/planets.json'), 'mod planets.json（星球类型）');
  tryJson(M('data/config/settings.json'), 'mod settings.json');
  tryJson(M('data/config/custom_entities.json'), 'mod custom_entities.json');
  tryCsv(M('data/campaign/conditions.csv'), 'id', 'mod conditions.csv');
  tryCsv(M('data/hullmods/hull_mods.csv'), 'id', 'mod hull_mods.csv');
}
// designTypeColors 键（core + mod 的 settings.json 内嵌注册表）
for (const [p, src] of [[path.join(CORE_DATA, 'config/settings.json'), 'core designTypeColors'], MOD ? [path.join(MOD, 'data/config/settings.json'), 'mod designTypeColors'] : null].filter(Boolean)) {
  try {
    const o = parseJsonLoose(fs.readFileSync(p, 'utf8'));
    if (o.designTypeColors && typeof o.designTypeColors === 'object') Object.keys(o.designTypeColors).forEach(k => add(k, src));
  } catch (e) { /* 宽松解析失败忽略 */ }
}

// ---- 白名单 ----
let allow = {};
if (allowArg) {
  const af = allowArg.split('=').slice(1).join('=');
  if (!fs.existsSync(af)) { console.error('--allow 文件不存在: ' + af); process.exit(2); }
  allow = JSON.parse(fs.readFileSync(af, 'utf8'));
}

// ---- 求交集 ----
const hits = [];
for (const [k, zh] of Object.entries(map)) {
  if (reg.has(k)) hits.push({ key: k, zh, sources: reg.get(k).join(', '), allow: !!allow[k], allowNote: allow[k] || '' });
}
const unexplained = hits.filter(h => !h.allow);

console.log(`patch_map 键数: ${Object.keys(map).length} | 注册表条目: ${reg.size}`);
for (const h of hits) {
  const tag = h.allow ? '（白名单: ' + h.allowNote + '）' : '';
  console.log(`  ${h.allow ? '[allow]' : '[HIT]'} ${JSON.stringify(h.key)} -> ${JSON.stringify(h.zh)}  @ ${h.sources} ${tag}`.trimEnd());
}
if (unexplained.length) {
  console.log(`\n✗ 未解释命中 ${unexplained.length} 条 —— 引擎 id 被翻译会导致查表失败（崩溃）或查找逻辑静默失效。`);
  console.log('  处置：回退为英文原值（zh=en / 从映射删除）；确属纯 UI 用法（如高亮词）的，反编译核实全部引用点后写 --allow 白名单。');
} else {
  console.log('✓ 无未解释命中');
}
if (jsonArg) {
  const out = jsonArg.split('=').slice(1).join('=');
  if (out !== '-') fs.writeFileSync(out, JSON.stringify(hits, null, 1), 'utf8');
}
process.exit(unexplained.length ? 1 : 0);
