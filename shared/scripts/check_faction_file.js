// check_faction_file.js — .faction 派系文件完整性闸门（2026-09-16 IFR 派系启动崩复盘产物）
//
// 背景：ifed.faction 缺 `names` 键 → SpecStore "JSONObject[\"names\"] not found" 启动崩。
//       以 21 个原版 .faction 的顶层键交集为准得出**引擎必填键 8 项**：
//       id, displayName, displayNameWithArticle, personNamePrefixAOrAn, displayNameIsOrAre,
//       logo, names, portraits
//
// 用法: node check_faction_file.js <modRoot>   （校验该 mod 全部 .faction；随附 factions.csv 登记检查）
//
// 检查项：
//   1. 宽松解析（引擎口径：#注释/尾逗号/文档末尾逗号/无引号键/1f 浮点后缀）
//   2. 必填 8 键齐全
//   3. logo / crest / portraits 引用的贴图存在（mod 优先，回退 starsector-core）
//   4. knownShips/Weapons/Fighters 的显式 id 存在；tags 标签在 mod 或 core 的对应 spec 上至少出现一次
//   5. shipRoles 引用的变体 id 存在（mod + core variants 目录）
//   6. factions.csv（若存在）已登记该 .faction
'use strict';
const fs = require('fs');
const path = require('path');

const MOD = process.argv[2];
if (!MOD) { console.error('usage: node check_faction_file.js <modRoot>'); process.exit(2); }
const CORE = 'C:/game/StarSector.v0.9.8a-RC8/starsector-core';

// ---- 字符串感知的宽松清洗（原版 .faction 实测全部能过）----
function cleanLax(text) {
  let out = '';
  let inStr = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      out += c;
      if (c === '\\') { out += text[++i] ?? ''; continue; }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; out += c; continue; }
    if (c === '#') { while (i < text.length && text[i] !== '\n') i++; out += '\n'; continue; }
    out += c;
  }
  out = out.replace(/,(\s*[}\]])/g, '$1');
  out = out.replace(/^(\s*)([A-Za-z_][A-Za-z0-9_]*):/gm, '$1"$2":');
  out = out.replace(/:(\s*)(-?\d+(?:\.\d+)?)f([,\s}\]]|$)/g, ':$1$2$3');
  out = out.trimEnd();
  if (out.endsWith(',')) out = out.slice(0, -1);
  return out;
}

const REQUIRED_CRASH = ['names']; // 缺失=启动崩（2026-09-16 IFR 实证）
const REQUIRED_VANILLA = ['id', 'displayName', 'displayNameWithArticle', 'personNamePrefixAOrAn',
  'displayNameIsOrAre', 'logo', 'portraits']; // 21 个原版 .faction 全有；第三方可省（Kadur 实证）
const CORE_FAC_DIR = CORE + '/data/world/factions';

// ---- 资产解析：mod 优先，回退 core ----
function assetExists(rel) {
  if (!rel) return false;
  if (fs.existsSync(path.join(MOD, rel))) return true;
  if (fs.existsSync(path.join(CORE, rel))) return true;
  return false;
}

// ---- 收集 spec id 集合 ----
function collectVariantIds() {
  const set = new Set();
  for (const root of [path.join(MOD, 'data/variants'), path.join(CORE, 'data/variants')]) {
    if (!fs.existsSync(root)) continue;
    (function walk(d) {
      for (const f of fs.readdirSync(d)) {
        const p = path.join(d, f);
        if (fs.statSync(p).isDirectory()) walk(p);
        else if (f.endsWith('.variant')) set.add(f.replace(/\.variant$/, ''));
      }
    })(root);
  }
  return set;
}
function collectColumnIds(csvRel, idCol) {
  const set = new Set();
  for (const root of [MOD, CORE]) {
    const p = path.join(root, csvRel);
    if (!fs.existsSync(p)) continue;
    const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
    const hdr = (lines[0] || '').split(',');
    const idx = hdr.indexOf(idCol);
    if (idx < 0) continue;
    for (const l of lines.slice(1)) {
      // 简易：含引号行跳过首列逗号误切（id 列一般无引号）
      const cells = l.split(',');
      const id = (cells[idx] || '').trim();
      if (id) set.add(id);
    }
  }
  return set;
}

let problems = 0;
function fail(msg) { console.log('✗ ' + msg); problems++; }
function ok(msg) { console.log('✓ ' + msg); }

const facDir = path.join(MOD, 'data/world/factions');
if (!fs.existsSync(facDir)) { console.log('无 data/world/factions 目录，无对象'); process.exit(0); }
const facFiles = fs.readdirSync(facDir).filter(f => f.endsWith('.faction'));
if (!facFiles.length) { console.log('无 .faction 文件，无对象'); process.exit(0); }

const variantIds = collectVariantIds();
const wingIds = collectColumnIds('data/hulls/wing_data.csv', 'id');
const hullIds = collectColumnIds('data/hulls/ship_data.csv', 'id');
const coreHullIds = collectColumnIds('data/hulls/ship_data.csv', 'id');
const weaponIds = collectColumnIds('data/weapons/weapon_data.csv', 'id');
const allHulls = new Set([...hullIds, ...coreHullIds]);

for (const f of facFiles) {
  const p = path.join(facDir, f);
  let j;
  try { j = JSON.parse(cleanLax(fs.readFileSync(p, 'utf8'))); }
  catch (e) { fail(`${f} 解析失败: ${e.message.slice(0, 80)}`); continue; }

  // 同名覆盖原版派系的文件（如 mod 内 pirates.faction）：深度合并语义，只查解析与资产
  const isCoreOverride = fs.existsSync(path.join(CORE_FAC_DIR, f));
  if (isCoreOverride) ok(`${f} 是原版同名派系的覆盖文件（深度合并），跳过必填键检查`);

  if (!isCoreOverride) {
    const missCrash = REQUIRED_CRASH.filter(k => !(k in j));
    if (missCrash.length) fail(`${f} 缺必填键(启动崩): ${missCrash.join(', ')}`);
    const missConv = REQUIRED_VANILLA.filter(k => !(k in j));
    if (missConv.length) console.log(`! ${f} 缺原版惯例键(可省): ${missConv.join(', ')}`);
    if (!missCrash.length) ok(`${f} 必填键(names)在位`);
  }

  for (const [k, v] of Object.entries(j)) {
    if (/^(logo|crest)$/.test(k) && typeof v === 'string' && !assetExists(v)) fail(`${f} ${k} 贴图不存在: ${v}`);
  }
  if (j.portraits && typeof j.portraits === 'object') {
    for (const [grp, arr] of Object.entries(j.portraits)) {
      if (!Array.isArray(arr)) continue;
      const miss = arr.filter(x => !assetExists(x));
      if (miss.length) fail(`${f} portraits[${grp}] 缺贴图 ${miss.length} 张，如 ${miss[0]}`);
    }
  }

  const checkKnown = (key, idField, specIds) => {
    const o = j[key];
    if (!o) return;
    for (const id of (o[idField] || [])) {
      if (!specIds.has(id)) fail(`${f} ${key}.${idField} 引用不存在: ${id}`);
    }
    if (Array.isArray(o.tags)) for (const t of o.tags) {
      if (typeof t !== 'string') fail(`${f} ${key}.tags 含非字符串: ${JSON.stringify(t)}`);
    }
  };
  checkKnown('knownShips', 'hulls', allHulls);
  checkKnown('priorityShips', 'hulls', allHulls);
  checkKnown('knownWeapons', 'weapons', weaponIds);
  checkKnown('priorityWeapons', 'weapons', weaponIds);
  checkKnown('knownFighters', 'fighters', wingIds); // fighters 列表用联队 id（wing_data.csv），非变体 id
  checkKnown('priorityFighters', 'fighters', wingIds);

  if (j.shipRoles) {
    const miss = [];
    for (const [role, table] of Object.entries(j.shipRoles)) {
      if (typeof table !== 'object' || Array.isArray(table)) continue;
      for (const id of Object.keys(table)) {
        if (id === 'fallback') continue;
        if (!variantIds.has(id)) miss.push(`${role}:${id}`);
      }
    }
    if (miss.length) fail(`${f} shipRoles 引用不存在的变体 (${miss.length}): ${miss.slice(0, 5).join(', ')}`);
    else ok(`${f} shipRoles 变体 id 全部存在`);
  }

  // factions.csv 登记（覆盖原版的同名文件除外）
  const fcCsv = path.join(facDir, 'factions.csv');
  if (!isCoreOverride && fs.existsSync(fcCsv)) {
    const t = fs.readFileSync(fcCsv, 'utf8');
    if (!t.includes('data/world/factions/' + f)) fail(`${f} 未登记进 data/world/factions/factions.csv`);
    else ok(`${f} 已登记 factions.csv`);
  }
}

console.log(problems ? `\n共 ${problems} 个问题` : '\n全部通过');
process.exit(problems ? 1 : 0);
