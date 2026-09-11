// scan_data_stragglers.js — **data 层"字段级"残留扫描**（质量网；本次事故的核心补救工具）。
//
// 为什么不只用 recipe / cmp_csv_cells：
//   recipe 是"按已知列写死的抽取规则"，只能覆盖**你想到的列**；
//   cmp_csv_cells 是"证明改动都登记过"，无法发现**压根没提取**的字段。
//   真实事故：一个 mod 的 .skin 有 descriptionPrefix（图鉴描述前缀）、weapon_data.csv 有
//   customPrimary/customAncillary/primaryRoleStr/…（武器 tooltip 覆写列）、
//   industries.csv 的 data 列内嵌 fleetName、Nexerelin 的 mercConfig.json——
//   这些全都没进清单，直到用户在游戏里发现"这艘船的描述没翻、分类也没翻"。
//
// 本工具反过来做：**先把文件里所有"人可读英文"枚举出来**，再看它是否被清单覆盖；
// 未被覆盖的即"提取遗漏候选"。它不依赖 recipe，因此能发现 recipe 的盲区。
//
// 用法:
//   node scan_data_stragglers.js <modRoot> <enBackupRoot> <worklistDir> [outJson]
//     <modRoot>      注入后的 mod 目录（或英文原版目录，用于"提取阶段"预检）
//     <enBackupRoot> 英文原版备份目录（用于判断"该值本来就是英文"）
//     <worklistDir>  待译清单目录（含 *.json 分片）
//     [outJson]      省略只打印；'-' 亦为只打印
//   node scan_data_stragglers.js --help
// 退出码: 0 = 无未覆盖的英文残留；1 = 有候选（便于 run_check.js 记账）；2 = 调用错误
//
// 口径（可复核）：
//   · 只看"自然语言"：长度 ≥ 12、无 CJK、含 ≥2 个英文词、不含路径分隔符、非 id 形态、非注释行
//   · 跳过"逻辑列"（脚本/键/枚举/路径/颜色等），清单见 SKIP_COLS / SKIP_FIELDS
//   · 覆盖判定三选一：清单里有 (file,id,列) 条目；或清单里出现过同一 file+en；或该文件被清单完全忽略（单列报告）
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
  console.log('usage: node scan_data_stragglers.js <modRoot> <enBackupRoot> <worklistDir> [outJson|-]');
  process.exit(argv.length ? 0 : 2);
}
const pos = argv.filter(a => !a.startsWith('--'));
const [MOD, BAK, WL] = pos;
const OUT = (pos[3] && pos[3] !== '-') ? pos[3] : null;
if (!MOD || !BAK || !WL) { console.error('用法见 --help：需要 <modRoot> <enBackupRoot> <worklistDir>'); process.exit(2); }
for (const [n, p] of [['modRoot', MOD], ['enBackupRoot', BAK], ['worklistDir', WL]]) {
  if (!fs.existsSync(p)) { console.error(`${n} 不存在: ${p}`); process.exit(2); }
}

const { parseCsv } = require('./csvlib.js');

// ---- 非玩家可见的"逻辑列"（值即使有英文也不算文本）----
const SKIP_COLS = new Set([
  // rules 类
  'id', 'trigger', 'conditions', 'script', 'notes', 'freq', 'prob', 'plugin', 'plugin params',
  'min dur', 'max dur', 'min timeout', 'max timeout', 'min accepted timeout', 'max accepted timeout',
  'person id', 'tagsAll', 'tagsAny', 'tagsNotAny', 'tags', 'reqMissionAny', 'reqMissionAll', 'reqMissionNone',
  'importance', 'min rep', 'max rep', 'mission id', 'person id', 'bar event id',
  // 资源 / 键
  'icon', 'sprite', 'sound id', 'sound id drop', 'iconPath', 'iconWidthMult', 'logo', 'crest',
  'fieldID', 'fieldType', 'secondaryValue', 'minValue', 'maxValue', 'tab',
  'categories', 'spawnWeight', 'npcSpawnWeight', 'color', 'order', 'faction', 'variant', 'hullId',
  'baseHullId', 'skinHullId', 'descriptionId', 'customDescriptionId', 'systemId', 'system id',
  'tech', 'tech/manufacturer', 'style', 'engineStyle', 'hullStyle', 'shieldId', 'defenseId',
  'collisionClass', 'shieldType', 'mount', 'size', 'type', 'weaponSlotChanges', 'engineSlotChanges',
  'builtInMods', 'removeWeaponSlots', 'removeEngineSlots', 'variantId', 'goalVariant', 'scriptName',
  'data', 'spriteName', 'hints', 'groupTag', 'number', 'notes', 'Column', 'Column 07',
]);
// 值形态类跳过
const LOOKS_LIKE_KEY = v =>
  /^[\x20-\x7E]*$/.test(v) && (
    /^[a-z][a-zA-Z0-9_]*$/.test(v) ||                      // camelCase / snake_case id
    /^[A-Z][A-Z0-9_]{2,}$/.test(v) ||                      // 全大写常量
    /^[A-Za-z0-9_./\\-]+$/.test(v) ||                      // 路径或单 token
    /^\$/.test(v) ||                                       // 内存键
    /^-?\d/.test(v)                                        // 数字开头
  );

const isNaturalEnglish = v => {
  if (typeof v !== 'string') return false;
  const s = v.trim();
  if (s.length < 12) return false;
  if (/[\u4e00-\u9fff\u3040-\u30ff]/.test(s)) return false;        // 已含中日文
  if (!/[A-Za-z]{3,}\s+[A-Za-z]{2,}/.test(s)) return false;        // 至少两个英文词
  if (/[\\/]/.test(s)) return false;                                // 路径
  if (LOOKS_LIKE_KEY(s)) return false;
  if (s.startsWith('#')) return false;                              // 注释
  return true;
};

// ---- 读清单：建"覆盖索引" ----
const covered = new Set();          // file#id&field
const coveredEn = new Set();        // file\0en
const fieldsByFile = new Map();     // file -> Set(field)
const filesInWl = new Set();
for (const f of fs.readdirSync(WL).filter(x => x.endsWith('.json') && !/_zh\.json$/.test(x))) {
  let arr;
  try { arr = JSON.parse(fs.readFileSync(path.join(WL, f), 'utf8')); } catch (e) { continue; }
  if (!Array.isArray(arr)) continue;
  for (const e of arr) {
    if (!e || !e.file) continue;
    filesInWl.add(e.file);
    covered.add(`${e.file}#${e.id}&${e.field}`);
    if (e.en !== undefined) coveredEn.add(e.file + '\u0000' + String(e.en));
    if (!fieldsByFile.has(e.file)) fieldsByFile.set(e.file, new Set());
    fieldsByFile.get(e.file).add(String(e.field).replace(/\(.*\)$/, '').replace(/#.*$/, ''));
  }
}

const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
  const p = path.join(d, e.name);
  return e.isDirectory() ? walk(p) : [p];
});

const hits = [];
const seen = new Set();
const push = (rel, id, field, val, why) => {
  const k = `${rel}#${id}&${field}&${val}`;
  if (seen.has(k)) return;
  seen.add(k);
  hits.push({ file: rel, id, field, en: val, why });
};

// ---- CSV ----
for (const abs of walk(path.join(MOD, 'data'))) {
  const rel = path.relative(MOD, abs).replace(/\\/g, '/');
  if (/\.csv$/i.test(abs)) {
    let parsed;
    try { parsed = parseCsv(fs.readFileSync(abs, 'utf8').replace(/^\uFEFF/, '')); } catch (e) { continue; }
    const { header, rows } = parsed;
    if (!header.length) continue;
    const iId = header.indexOf('id') >= 0 ? header.indexOf('id')
      : header.indexOf('fieldID') >= 0 ? header.indexOf('fieldID') : -1;
    const covFields = fieldsByFile.get(rel);
    for (const r of rows) {
      const id = iId >= 0 ? (r.cells[iId] || '').trim() : '';
      if (iId >= 0 && (!id || id.startsWith('#'))) continue;
      for (let c = 0; c < header.length; c++) {
        const col = header[c];
        if (SKIP_COLS.has(col)) continue;
        const v = (r.cells[c] || '').trim();
        if (!isNaturalEnglish(v)) continue;
        // 已覆盖？① (file,id,列) ② (file,en) 出现过
        const byCell = covered.has(`${rel}#${id}&${col}`);
        const byEn = coveredEn.has(rel + '\u0000' + v);
        if (byCell || byEn) continue;
        const why = covFields
          ? `列「${col}」未被清单覆盖（该文件清单只覆盖: ${[...covFields].join(', ') || '无'}）`
          : `整个文件未被清单覆盖（清单未含 ${rel}）`;
        push(rel, id, col, v, why);
      }
    }
  } else if (/\.(ship|skin|variant|faction|json|system|wpn|proj)$/i.test(abs)) {
    const covFields = fieldsByFile.get(rel);
    let txt;
    try { txt = fs.readFileSync(abs, 'utf8'); } catch (e) { continue; }
    const re = /"([A-Za-z0-9_]+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
    let m;
    while ((m = re.exec(txt))) {
      const [, k, vRaw] = m;
      if (SKIP_COLS.has(k)) continue;
      const v = vRaw.replace(/\\"/g, '"');
      if (!isNaturalEnglish(v)) continue;
      const id = path.basename(abs).replace(/\.(ship|skin|variant|faction|json|system|wpn|proj)$/i, '');
      const byCell = covered.has(`${rel}#${id}&${k}`);
      const byEn = coveredEn.has(rel + '\u0000' + v);
      if (byCell || byEn) continue;
      const why = covFields
        ? `字段「${k}」未被清单覆盖（该文件清单只覆盖: ${[...covFields].join(', ') || '无'}）`
        : `整个文件未被清单覆盖（清单未含 ${rel}）`;
      push(rel, id, k, v, why);
    }
  }
}

// ---- 列内嵌配置块（真实事故：industries.csv 的 data 列里有 `fleetName:Aria Station`）----
// 这类"单元格里塞了一段配置"的写法（`key:value` 行），其 value 常是玩家可见文本，
// 而列名（data/config/script 之类）看似逻辑列、容易被整列跳过 → 单列一条检查。
const EMBEDDED_KEYS = /(fleetName|nameInText|defaultName|displayName|fleetNameOverride|stationName)\s*[:=]\s*([^,\n}]+)/g;
for (const abs of walk(path.join(MOD, 'data'))) {
  if (!/\.csv$/i.test(abs)) continue;
  const rel = path.relative(MOD, abs).replace(/\\/g, '/');
  let parsed;
  try { parsed = parseCsv(fs.readFileSync(abs, 'utf8').replace(/^\uFEFF/, '')); } catch (e) { continue; }
  const { header, rows } = parsed;
  const iId = header.indexOf('id') >= 0 ? header.indexOf('id') : header.indexOf('fieldID');
  if (iId < 0) continue;
  for (const r of rows) {
    const id = (r.cells[iId] || '').trim();
    if (!id || id.startsWith('#')) continue;
    for (let c = 0; c < header.length; c++) {
      const col = header[c];
      const v = r.cells[c] || '';
      if (!v || v.length < 8) continue;
      EMBEDDED_KEYS.lastIndex = 0;
      let m;
      while ((m = EMBEDDED_KEYS.exec(v))) {
        const key = m[1], val = m[2].trim();
        if (!isNaturalEnglish(val) && !(val.length >= 6 && /^[A-Za-z][A-Za-z0-9 '’\-]+$/.test(val))) continue;
        const field = `${col}#${key}`;
        if (covered.has(`${rel}#${id}&${field}`) || coveredEn.has(rel + '\u0000' + val)) continue;
        push(rel, id, field, val, `列「${col}」内嵌配置块中的 ${key}（列名看似逻辑列，极易被整列跳过）`);
      }
    }
  }
}

// ---- 报告 ----
const byFile = new Map();
for (const h of hits) byFile.set(h.file, (byFile.get(h.file) || 0) + 1);
console.log('=== data 层残留扫描（未被待译清单覆盖的英文自然语言）===');
console.log(`mod=${MOD}\n英文基线=${BAK}\n清单=${WL}\n`);
console.log(`候选 ${hits.length} 条，分布在 ${byFile.size} 个文件：`);
for (const [f, n] of [...byFile.entries()].sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(5)}  ${f}`);
if (hits.length) {
  console.log('\n--- 明细（前 60 条）---');
  for (const h of hits.slice(0, 60)) {
    console.log(`  ${h.file}  id=${h.id}  字段=${h.field}`);
    console.log(`      ${h.why}`);
    console.log(`      值: ${JSON.stringify(String(h.en).slice(0, 130))}`);
  }
  if (hits.length > 60) console.log(`  …还有 ${hits.length - 60} 条`);
  console.log('\n提示：把上述字段补进 recipe（或用专用提取脚本），重跑提取与注入。');
} else {
  console.log('\n✓ 未发现未覆盖的英文残留');
}
if (OUT) { fs.writeFileSync(OUT, JSON.stringify(hits, null, 1), 'utf8'); console.log('\nwritten ' + OUT); }
process.exit(hits.length ? 1 : 0);
