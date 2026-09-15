// 闸门 G-data-faction2：复刻 CoreLifecyclePluginImpl.verifyFactionData 的静态数据版校验。
// .faction 的 knownShips/knownHullMods/knownFighters/knownWeapons 逐条对照合并注册表
// （core + 全部已启用 mod + 被测 mod 自身），任一 id 不存在 = 读档/开局时 RuntimeException。
// 背景（2026-09-15 AI War 事故⑤）：knownHullMods 填了类名（AIW_Forcefield）而非 id
//（aiw_forcefield）→ "Hullmod with id [...] not found for faction [...]"。
// 用法：node check_faction_known_lists.js <modDir>
const fs = require('fs');
const path = require('path');
const { parseJsonLoose } = require('C:/game/StarSector.v0.9.8a-RC8/_work/skills/shared/scripts/pseudojson.js');
const GAME = 'C:/game/StarSector.v0.9.8a-RC8';
const modDir = process.argv[2];
if (!modDir) { console.error('用法: node check_faction_known_lists.js <modDir>'); process.exit(2); }
const MOD = path.resolve(modDir).split(path.sep).join('/');
function walk(d, out = []) {
  if (!fs.existsSync(d)) return out;
  for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p, out) : out.push(p); }
  return out;
}
function collectIds(p, col, set) {
  if (!fs.existsSync(p)) return;
  const lines = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
  const i = lines[0].split(',').indexOf(col);
  if (i < 0) return;
  for (const l of lines.slice(1)) {
    const c = l.split(',');
    if (c.length > i && c[i].trim() && !c[i].trim().startsWith('#')) set.add(c[i].trim());
  }
}
let enabled = [];
try { enabled = JSON.parse(fs.readFileSync(path.join(GAME, 'mods', 'enabled_mods.json'), 'utf8').replace(/^\uFEFF/, '')).enabledMods || []; } catch (e) {}
const roots = [path.join(GAME, 'starsector-core'), MOD].concat(enabled.map(m => path.join(GAME, 'mods', m)));
const hulls = new Set(), hullmods = new Set(), wings = new Set(), weapons = new Set();
for (const root of roots) {
  collectIds(path.join(root, 'data', 'hulls', 'ship_data.csv'), 'id', hulls);
  collectIds(path.join(root, 'data', 'hullmods', 'hull_mods.csv'), 'id', hullmods);
  collectIds(path.join(root, 'data', 'hulls', 'wing_data.csv'), 'id', wings);
  collectIds(path.join(root, 'data', 'weapons', 'weapon_data.csv'), 'id', weapons);
  for (const sk of walk(path.join(root, 'data', 'hulls')).filter(f => f.endsWith('.skin'))) {
    try { const j = parseJsonLoose(fs.readFileSync(sk, 'utf8')); if (j.skinHullId) hulls.add(j.skinHullId); } catch (e) {}
  }
}
const CHECKS = {
  knownShips: ['hulls', hulls, 'hull'],
  knownHullMods: ['hullMods', hullmods, 'hullmod'],
  knownFighters: ['fighters', wings, 'wing'],
  knownWeapons: ['weapons', weapons, 'weapon'],
};
let fail = 0;
for (const f of walk(path.join(MOD, 'data', 'world', 'factions')).filter(x => x.endsWith('.faction'))) {
  const t = fs.readFileSync(f, 'utf8');
  for (const [key, [innerKey, set, label]] of Object.entries(CHECKS)) {
    const m = t.match(new RegExp('"' + key + '"\\s*:\\s*\\{[\\s\\S]*?"' + innerKey + '"\\s*:\\s*\\[([^\\]]*)\\]'));
    if (!m) { console.log('PASS（无 ' + key + ' 或未用对象结构——schema 另由 check_faction_shiproles.js 管）:', path.basename(f)); continue; }
    const arr = [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]);
    const miss = arr.filter(id => !set.has(id));
    if (miss.length) { fail = 1; console.log('FAIL', path.basename(f), key, '缺失' + label + ':', miss.join(', ')); }
    else console.log('PASS', path.basename(f), key, '(' + arr.length + ')');
  }
}
process.exit(fail);
