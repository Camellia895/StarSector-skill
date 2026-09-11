// scan_logic_keys.js — **逻辑键误译探测**（red 级；本次启动 Fatal 的根因补救工具）。
//
// 问题本质（务必理解，否则会重犯）：
//   在 class 常量池里，"玩家可见文本"与"查找键"的字面**完全一样**，无法按字面区分：
//     LunaSettings.getBoolean("Nightcross", "na_pascal_system")   ← "Nightcross" 是 LunaLib 的 modID 键
//     getMergedSpreadsheetDataForMod("id", CSV, "Nightcross")     ← 同样是 modID 键
//     system.addPlanet("nightcross", pascal, "Nightcross", ...)   ← 这个是"显示名"
//   把前者当显示文本翻译 → LunaSettings.getBoolean 返回 null → mod 代码 booleanValue() →
//   ExceptionInInitializerError → **启动 Fatal**（本项目实测："Could not find mod 夜十字"）。
//   同类还有：createStarSystem("Pascal") 的星系名（与 exerelin 的 corvus_capitals.csv 必须一致）。
//
// 本工具的判据（两层，互不依赖 recipe）：
//   A. **保留键**（调用方显式给出，如 mod id / 引擎常量 / spec id）：补丁映射里出现即报错（必错）。
//   B. **键查找上下文**：某常量所在的 class 里存在 `getBoolean/getString/getModSpec/isModEnabled/
//      addSettingsListener/loadCSV/getMergedSpreadsheetDataForMod/…` 调用，且该常量"像 id"
//      （无空格、短、标识符形态）却被译成中文 → 报"待人工确认"（可能是键，也可能是正常显示文本）。
//
// 用法:
//   node scan_logic_keys.js <patch_map.json> <原classDir> [reservedKey1 reservedKey2 ...]
//     <patch_map.json>  patchdir.js 用的映射（{ 常量原文: 译文 }）；也接受 jar 清单数组（取 c/zh）
//     <原classDir>      英文原版解包目录（判断"该常量在哪个 class、是否有键查找调用"）
//     reservedKey...    可选：必须原样保留的键（mod id、引擎常量…）。也可用 --reserved=KEY 重复传。
//   node scan_logic_keys.js --help
// 退出码: 0 = 无问题；1 = 发现"保留键被译"或"键上下文里的 id 被译"；2 = 调用错误
const fs = require('fs');
const path = require('path');
const { parseClass } = require('./classparser.js');

const argv = process.argv.slice(2);
if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
  console.log('usage: node scan_logic_keys.js <patch_map.json> <原classDir> [reservedKey...] [--reserved=KEY]');
  console.log('  reservedKey：必须原样保留的常量（mod id / 引擎常量 / spec id），如 Nightcross Pascal');
  process.exit(argv.length ? 0 : 2);
}
const pos = argv.filter(a => !a.startsWith('--'));
const reservedInline = argv.filter(a => a.startsWith('--reserved=')).map(a => a.split('=').slice(1).join('='));
const [MAP_PATH, DIR] = pos;
const RESERVED = new Set([...pos.slice(2), ...reservedInline].filter(Boolean));
if (!MAP_PATH || !DIR) { console.error('用法见 --help：需要 <patch_map.json> <原classDir>'); process.exit(2); }
for (const [n, p] of [['patch_map.json', MAP_PATH], ['原classDir', DIR]]) {
  if (!fs.existsSync(p)) { console.error(`${n} 不存在: ${p}`); process.exit(2); }
}

// 读映射（兼容两种形态）
let map = {};
{
  const j = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));
  if (Array.isArray(j)) {
    for (const e of j) {
      const k = e.c !== undefined ? e.c : e.en;
      const v = e.zh;
      if (k !== undefined && v && String(v).trim() && String(v) !== String(k)) map[k] = String(v);
    }
  } else map = j;
}

const CALLS = /getBoolean|getInt|getDouble|getFloat|getString|getModSpec|isModEnabled|getSettings|addSettingsListener|reportSettingsChanged|hasSettingsListenerOfClass|loadCSV|getMergedSpreadsheetDataForMod|getSpec|createStarSystem|getStarSystem|addCustomEntity|getEntityById|getIndustry|getHullSpec|getWeaponSpec|getFighterWingSpec|getSound|getSprite|notifyUsed|hasTag|addTag/;

const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
  const p = path.join(d, e.name);
  return e.isDirectory() ? walk(p) : (e.name.endsWith('.class') ? [p] : []);
});

const files = walk(DIR);
const hardHits = [];    // A：保留键被译（必错）
const softHits = [];    // B：键查找上下文里"像 id"的常量被译（待确认）
const reservedSeen = new Map();

for (const f of files) {
  let cp;
  try { cp = parseClass(fs.readFileSync(f)).cp; } catch (e) { continue; }
  const strs = cp.filter(e => e && e.tag === 1).map(e => e.str);
  const set = new Set(strs);
  const rel = path.relative(DIR, f).replace(/\\/g, '/');
  const keyCtx = strs.some(s => CALLS.test(s));

  for (const [en, zh] of Object.entries(map)) {
    if (!set.has(en)) continue;
    if (RESERVED.has(en)) { hardHits.push({ cls: rel, en, zh }); reservedSeen.set(en, (reservedSeen.get(en) || 0) + 1); continue; }
    if (!keyCtx) continue;
    // "像 id"：无空格、标识符形态、短、且译文含中文
    const looksId = !/\s/.test(en) && /^[A-Za-z_][A-Za-z0-9_]*$/.test(en) && en.length <= 40;
    if (looksId && /[\u4e00-\u9fff]/.test(zh)) softHits.push({ cls: rel, en, zh });
  }
}

console.log('=== 逻辑键误译探测 ===');
console.log(`映射键 ${Object.keys(map).length} 个 | 扫描 class ${files.length} 个 | 保留键 ${RESERVED.size} 个${RESERVED.size ? '（' + [...RESERVED].join(', ') + '）' : ''}\n`);

console.log(`--- A) 保留键被翻译（必错：会导致查找失败/启动崩溃）: ${hardHits.length} ---`);
for (const h of hardHits) console.log(`  ✗ ${h.cls}\n      ${JSON.stringify(h.en)} → ${JSON.stringify(h.zh)}`);
if (!hardHits.length) console.log('  （无）');
if (RESERVED.size) {
  const never = [...RESERVED].filter(k => !reservedSeen.has(k));
  if (never.length) console.log(`  （提示）以下保留键未出现在该补丁映射中：${never.join(', ')} —— 若它们本应被译，请确认是否漏译；若本就不该译，无需处理`);
}

console.log(`\n--- B) 键查找上下文里"像 id"的常量被译（待人工确认）: ${softHits.length} ---`);
for (const h of softHits.slice(0, 80)) console.log(`  ? ${h.cls}\n      ${JSON.stringify(h.en)} → ${JSON.stringify(h.zh)}`);
if (softHits.length > 80) console.log(`  …还有 ${softHits.length - 80} 条`);
if (!softHits.length) console.log('  （无）');
console.log('\n判读：A 类必须修（在清单里把 zh 改回等于原文，或加入保留键名单）。');
console.log('      B 类需逐个看源码调用点：若该常量是 getBoolean/getModSpec/isModEnabled/addSettingsListener');
console.log('      之类的查找实参 → 必须保留原文；若只是 addPara/setName 的显示文本 → 翻译正确。');

process.exit(hardHits.length ? 1 : 0);
