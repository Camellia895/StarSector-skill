// verify_all_data.js — 综合数据层复查：扫描已知易漏区，输出英文残留/键唯一性/匹配性报告。
// 用法: node verify_all_data.js [data根目录]   (默认: RAT mod 的 data)
const fs = require('fs');
const path = require('path');

const DATA = process.argv[2] || 'C:/game/StarSector.v0.9.8a-RC8/mods/Random-Assortment-of-Things/data';
const isEn = s => /[A-Za-z]{3,}/.test(s) && !/[\u4e00-\u9fff]/.test(s);
let issues = 0;
const report = (tag, msg) => { issues++; console.log('  [' + tag + '] ' + msg); };

function parseCsv(src) {
  const rows = []; let r = [], f = '', q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '"') { if (src[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else { if (c === '"') q = true; else if (c === ',') { r.push(f); f = ''; } else if (c === '\n') { r.push(f); rows.push(r); r = []; f = ''; } else if (c === '\r') { } else f += c; }
  }
  if (f.length || r.length) { r.push(f); rows.push(r); }
  return rows;
}
function walk(d, ext, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, ext, out);
    else if (e.name.endsWith(ext)) out.push(p);
  }
  return out;
}

// ---- 1. LunaSettings.csv ----
console.log('=== 1. LunaSettings.csv ===');
const lsPath = path.join(DATA, 'config/LunaSettings.csv');
if (fs.existsSync(lsPath)) {
  const ls = parseCsv(fs.readFileSync(lsPath, 'utf8'));
  const h = ls[0]; const ix = {}; h.forEach((c, i) => ix[c] = i);
  for (const r of ls.slice(1)) {
    const id = (r[ix['fieldID']] || '').trim();
    if (!id || id.startsWith('#')) continue;
    const ft = (r[ix['fieldType']] || '').trim();
    for (const col of ['fieldName', 'fieldDescription']) {
      const v = (r[ix[col]] || '').trim();
      if (isEn(v)) report('LunaSettings', id + ' ' + col + ' => ' + v.slice(0, 60));
    }
    if (ft === 'Text' || ft === 'Header') {
      const dv = (r[ix['defaultValue']] || '').trim();
      if (isEn(dv)) report('LunaSettings-Text/Header default', id + ' => ' + dv.slice(0, 60));
    }
    if (ft === 'Radio') {
      const dv = (r[ix['defaultValue']] || '').trim();
      const sv = (r[ix['secondaryValue']] || '').trim();
      if (isEn(dv) || isEn(sv)) console.log('  (提示) Radio 选项值是代码逻辑键，勿译: ' + id + ' = ' + dv + ' | ' + sv);
    }
  }
}

// ---- 2. variants displayName ----
console.log('=== 2. variants displayName ===');
const vdir = path.join(DATA, 'variants');
if (fs.existsSync(vdir)) {
  const seen = new Set();
  for (const f of walk(vdir, '.variant')) {
    const m = fs.readFileSync(f, 'utf8').match(/"displayName"\s*:\s*"([^"]*)"/);
    if (m && isEn(m[1])) seen.add(m[1]);
  }
  if (seen.size) report('variants', '英文 displayName: ' + [...seen].join(', '));
  else console.log('  OK: 无英文 displayName');
}

// ---- 3. faction 舰队名/官职名 ----
console.log('=== 3. faction fleet/rank names ===');
const fdir = path.join(DATA, 'world/factions');
if (fs.existsSync(fdir)) {
  const keysRe = /"(patrolSmall|patrolMedium|patrolLarge|battlestation|trade|tradeLiner|tradeSmuggler|smallTrader|inspectionFleet|taskForce|foodReliefFleet|mercScout|mercBountyHunter|mercPrivateer|mercPatrol|mercArmada|name|spaceAdmiral|spaceCommander|factionLeader|patrolCommander|fleetCommander|baseCommander)"\s*:\s*"([^"]*)"/g;
  for (const fn of fs.readdirSync(fdir).filter(x => x.endsWith('.faction'))) {
    const lines = fs.readFileSync(path.join(fdir, fn), 'utf8').split('\n');
    lines.forEach((line) => {
      if (line.trim().startsWith('#')) return; // 注释行不加载
      const m = keysRe.exec(line);
      keysRe.lastIndex = 0;
      if (m && isEn(m[2])) report('faction', fn + ' ' + m[1] + '=' + m[2].slice(0, 50));
    });
  }
}

// ---- 4. settings.json designTypeColors ----
console.log('=== 4. settings.json designTypeColors ===');
const setPath = path.join(DATA, 'config/settings.json');
if (fs.existsSync(setPath)) {
  const s = fs.readFileSync(setPath, 'utf8');
  if (s.includes('$3') || /""[^\[]/.test(s)) report('settings.json', '存在替换残留 ($3 / 连续引号)');
  const i = s.indexOf('designTypeColors');
  if (i >= 0) {
    const seg = s.slice(i, s.indexOf('}', i));
    const keys = [...seg.matchAll(/^\s*"([^"]+)"\s*:/gm)].map(m => m[1]);
    const dup = keys.filter((k, idx) => keys.indexOf(k) !== idx);
    if (dup.length) report('designTypeColors', '重复键: ' + dup.join(', ') + ' (游戏 fatal: Duplicate key)');
    // 与 CSV 实际值匹配
    const used = new Set();
    for (const rel of ['hullmods/hull_mods.csv', 'hulls/ship_data.csv', 'weapons/weapon_data.csv', 'hulls/wing_data.csv', 'campaign/special_items.csv', 'campaign/rat_artifacts.csv']) {
      const p2 = path.join(DATA, rel);
      if (!fs.existsSync(p2)) continue;
      const rows = parseCsv(fs.readFileSync(p2, 'utf8'));
      const hd = rows[0]; const ixd = {}; hd.forEach((c, k2) => ixd[c] = k2);
      const col = ixd['tech/manufacturer'] !== undefined ? ixd['tech/manufacturer'] : ixd['designType'];
      if (col === undefined) continue;
      for (const rr of rows.slice(1)) {
        if (!rr[0] || rr[0].startsWith('#')) continue;
        const v = (rr[col] || '').trim();
        if (v) used.add(v);
      }
    }
    for (const v of used) {
      if (!keys.includes(v) && !/^[A-Za-z]/.test(v)) console.log('  (提示) 原版 designTypeColors 即无此设计类型的颜色键(保持原样): ' + v);
    }
  }
}

// ---- 5. custom_entities.json defaultName/nameInText ----
console.log('=== 5. custom_entities.json ===');
const cePath = path.join(DATA, 'config/custom_entities.json');
if (fs.existsSync(cePath)) {
  const s = fs.readFileSync(cePath, 'utf8');
  for (const [field, re] of [['defaultName', /"defaultName":"([^"]*)"/g], ['nameInText', /"nameInText":"([^"]*)"/g]]) {
    let m; const en = [];
    while ((m = re.exec(s))) if (isEn(m[1])) en.push(m[1]);
    if (en.length) report('custom_entities', field + ' 英文: ' + en.slice(0, 8).join(', '));
  }
}

// ---- 6. customStarts.json ----
console.log('=== 6. exerelin customStarts.json ===');
const csPath = path.join(DATA, 'config/exerelin/customStarts.json');
if (fs.existsSync(csPath)) {
  const s = fs.readFileSync(csPath, 'utf8');
  const re = /"(name|desc|difficulty)":\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(s))) if (isEn(m[2])) report('customStarts', m[1] + ' => ' + m[2].slice(0, 50));
}

console.log('\n===== 结果: ' + (issues === 0 ? '全部通过 ✔' : issues + ' 处问题需要处理 ✘') + ' =====');
process.exit(issues === 0 ? 0 : 1);
