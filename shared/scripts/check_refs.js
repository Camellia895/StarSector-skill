// check_refs.js —— 引用完整性校验（只读，不改任何文件）
// 用法: node check_refs.js <modDir> <游戏根>
//
// 检查：
//   data/variants/**/*.variant       -> hullId / 槽位武器 / hullMods / wings / permaMods
//   data/hulls/*.ship                -> builtInWeapons / builtInMods / builtInWings / style
//   data/hulls/skins/*.skin          -> baseHullId（skinHullId 是皮肤自建 id，跳过）
//   data/world/factions/default_ship_roles.json -> variant id
//   data/weapons/weapon_data.csv     <-> data/weapons/*.wpn <-> data/weapons/proj/*.proj
// 定义来源：core + 全部已装 mod（脚本自动枚举）
//
// 已知假阳性（脚本已规避）：.skin 的 skinHullId；default_ship_roles 的空对象；动态拼接的 sprite 名。
const fs = require('fs');
const path = require('path');

const modDir = process.argv[2];
const gameRoot = process.argv[3] || path.resolve(modDir, '..', '..');
if (!modDir) { console.error('用法: node check_refs.js <modDir> <游戏根>'); process.exit(2); }
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

// ---- 完整 CSV 解析（处理引号内换行；本机原版 hull_mods.csv 就有） ----
function parseCsvFull(text) {
  const rows = []; let row = []; let cur = ''; let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (c !== '\r') cur += c;
    }
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
function csvIds(file, idCol) {
  const ids = new Set();
  if (!fs.existsSync(file)) return ids;
  const rows = parseCsvFull(fs.readFileSync(file, 'utf8'));
  if (!rows.length) return ids;
  const hdr = rows[0].map(s => s.trim().replace(/"/g, ''));
  const idx = hdr.indexOf(idCol);
  if (idx < 0) return ids;
  for (let i = 1; i < rows.length; i++) if (rows[i][idx] && rows[i][idx].trim()) ids.add(rows[i][idx].trim());
  return ids;
}

// ---- JSON 风格文本（容忍 # 注释 / 尾逗号 / 裸键；与游戏 org.json 行为近似） ----
function parseLoose(txt) {
  let t = txt.replace(/#.*$/gm, '').replace(/,\s*([}\]])/g, '$1');
  t = t.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":');
  try { return JSON.parse(t); } catch (e) { return null; }
}

// ---- 收集定义 ----
const ships = new Set(), weapons = new Set(), hullmods = new Set(), wings = new Set(), variants = new Set(), styles = new Set();
const projIds = new Set();
const dirs = [coreDir];
for (const d of fs.readdirSync(modsDir)) {
  const p = path.join(modsDir, d);
  try { if (fs.statSync(p).isDirectory()) dirs.push(p); } catch (e) { /* skip */ }
}
for (const d of dirs) {
  for (const id of csvIds(path.join(d, 'data/hulls/ship_data.csv'), 'id')) ships.add(id);
  for (const id of csvIds(path.join(d, 'data/weapons/weapon_data.csv'), 'id')) weapons.add(id);
  for (const id of csvIds(path.join(d, 'data/hullmods/hull_mods.csv'), 'id')) hullmods.add(id);
  for (const id of csvIds(path.join(d, 'data/hulls/wing_data.csv'), 'id')) wings.add(id);
  for (const f of walk(path.join(d, 'data/variants'))) if (f.endsWith('.variant')) variants.add(path.basename(f, '.variant'));
  for (const f of walk(path.join(d, 'data/weapons'))) if (f.endsWith('.proj')) projIds.add(path.basename(f, '.proj'));
  const hs = path.join(d, 'data/config/hull_styles.json');
  if (fs.existsSync(hs)) {
    const t = fs.readFileSync(hs, 'utf8').replace(/#.*$/gm, '');
    for (const m of t.matchAll(/"([A-Za-z][A-Za-z0-9_]*)"\s*:\s*\{/g)) styles.add(m[1]);
  }
}

const problems = [];
const ok = [];
const modFiles = walk(modDir);

// ---- 1) variants ----
for (const f of modFiles.filter(x => x.endsWith('.variant'))) {
  const rel = path.relative(modDir, f);
  const o = parseLoose(fs.readFileSync(f, 'utf8'));
  if (!o) { problems.push(`${rel}: JSON 解析失败（若游戏能读则是假阳性，用 JsonProbe 复核）`); continue; }
  if (o.hullId && !ships.has(o.hullId) && !o.hullId.endsWith('_Hull')) problems.push(`${rel}: hullId '${o.hullId}' 无定义`);
  for (const [slot, w] of Object.entries(o.weapons || {})) {
    if (w && w !== 'NULL' && !weapons.has(w)) problems.push(`${rel}: 槽位 ${slot} 武器 '${w}' 无定义`);
  }
  for (const hm of (o.hullMods || [])) if (hm && !hullmods.has(hm)) problems.push(`${rel}: hullMod '${hm}' 无定义`);
  for (const w of (o.wings || [])) if (w && !wings.has(w)) problems.push(`${rel}: wing '${w}' 无定义`);
  for (const hm of (o.permaMods || [])) if (hm && !hullmods.has(hm)) problems.push(`${rel}: permaMod '${hm}' 无定义`);
}

// ---- 2) ship hulls ----
for (const f of modFiles.filter(x => x.endsWith('.ship'))) {
  const rel = path.relative(modDir, f);
  const o = parseLoose(fs.readFileSync(f, 'utf8'));
  if (!o) { problems.push(`${rel}: JSON 解析失败`); continue; }
  if (o.hullId && !ships.has(o.hullId)) {
    // 只报告"有 .ship 但 ship_data.csv 无行"——游戏不会加载它，属惰性文件（提示级）
    ok.push(`NOTE ${rel}: hullId '${o.hullId}' 无 ship_data.csv 行（游戏不会加载该 .ship；惰性文件）`);
  }
  if (o.style && !styles.has(o.style)) problems.push(`${rel}: hull style '${o.style}' 无定义`);
  for (const w of Object.values(o.builtInWeapons || {})) if (w && !weapons.has(w)) problems.push(`${rel}: builtInWeapon '${w}' 无定义`);
  for (const hm of (o.builtInMods || [])) if (hm && !hullmods.has(hm)) problems.push(`${rel}: builtInMod '${hm}' 无定义`);
  for (const w of (o.builtInWings || [])) if (w && !wings.has(w)) problems.push(`${rel}: builtInWing '${w}' 无定义`);
}

// ---- 3) skins（skinHullId 是自建 id，跳过） ----
for (const f of modFiles.filter(x => x.endsWith('.skin'))) {
  const rel = path.relative(modDir, f);
  const o = parseLoose(fs.readFileSync(f, 'utf8'));
  if (!o) { problems.push(`${rel}: JSON 解析失败`); continue; }
  if (o.baseHullId && !ships.has(o.baseHullId) && !o.baseHullId.endsWith('_Hull')) problems.push(`${rel}: baseHullId '${o.baseHullId}' 无定义`);
}

// ---- 4) default_ship_roles.json ----
const dsr = path.join(modDir, 'data/world/factions/default_ship_roles.json');
if (fs.existsSync(dsr)) {
  const o = parseLoose(fs.readFileSync(dsr, 'utf8'));
  if (!o) problems.push('data/world/factions/default_ship_roles.json: JSON 解析失败');
  else for (const [role, list] of Object.entries(o)) {
    if (role === 'fallback' || typeof list !== 'object' || list === null) continue;
    for (const v of Object.keys(list)) {
      if (v === 'fallback' || v === 'fallback2') continue;
      if (!variants.has(v)) problems.push(`data/world/factions/default_ship_roles.json: 角色 ${role} 引用 variant '${v}' 无定义`);
    }
  }
}

// ---- 5) 武器 <-> .wpn <-> .proj ----
const wcsv = path.join(modDir, 'data/weapons/weapon_data.csv');
if (fs.existsSync(wcsv)) {
  const rows = parseCsvFull(fs.readFileSync(wcsv, 'utf8'));
  const hdr = rows[0].map(s => s.trim().replace(/"/g, ''));
  const idi = hdr.indexOf('id');
  const csvW = new Set();
  if (idi >= 0) for (let r = 1; r < rows.length; r++) if (rows[r][idi] && rows[r][idi].trim()) csvW.add(rows[r][idi].trim());
  const modWpn = new Set(walk(path.join(modDir, 'data/weapons')).filter(f => f.endsWith('.wpn')).map(f => path.basename(f, '.wpn')));
  const modProj = new Set(walk(path.join(modDir, 'data/weapons')).filter(f => f.endsWith('.proj')).map(f => path.basename(f, '.proj')));
  for (const id of csvW) {
    if (!modWpn.has(id) && !fs.existsSync(path.join(coreDir, 'data/weapons', id + '.wpn')))
      problems.push(`weapon_data.csv: '${id}' 没有对应 .wpn（游戏日志会报 "Weapon [...] from weapon_data.csv not found in store"）`);
  }
  for (const id of modWpn) {
    if (!csvW.has(id)) problems.push(`.wpn '${id}' 在 weapon_data.csv 里没有行（游戏日志会报 "Weapon spec [...] not found in weapon_data.csv"）`);
  }
  for (const f of walk(path.join(modDir, 'data/weapons')).filter(f => f.endsWith('.wpn'))) {
    const t = fs.readFileSync(f, 'utf8');
    const m = t.match(/"projectileSpecId"\s*:\s*"([^"]+)"/);
    if (m && !modProj.has(m[1]) && !fs.existsSync(path.join(coreDir, 'data/weapons', m[1] + '.proj')))
      problems.push(`${path.basename(f)}: projectileSpecId '${m[1]}' 没有 .proj`);
  }
  console.log(`武器: csv ${csvW.size} / .wpn ${modWpn.size} / .proj ${modProj.size}`);
}

console.log(`定义集合: ships=${ships.size} weapons=${weapons.size} hullmods=${hullmods.size} wings=${wings.size} variants=${variants.size} styles=${styles.size}`);
ok.forEach(l => console.log('  ' + l));
console.log(`\n检查完成，问题 ${problems.length} 条：`);
for (const p of problems) console.log('  ' + p);
if (problems.length) console.log('\n注意：JSON 解析失败类问题请先用 JsonProbe.java 以游戏 org.json 复核，避免严格解析器造成的假阳性。');
