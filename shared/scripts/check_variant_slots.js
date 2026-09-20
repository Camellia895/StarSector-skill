// 核对 mod 变体的武器槽位 id 是否存在于对应船体（mod + core 的 .ship / .skin）
// 用法: node check_variant_slots.js <modDir> <gameRoot>
const fs = require('fs');
const path = require('path');

const MOD = process.argv[2].replace(/\/$/, '');
const GAME = process.argv[3].replace(/\/$/, '');
const HULL_DIRS = [
  path.join(MOD, 'data', 'hulls'),
  path.join(GAME, 'starsector-core', 'data', 'hulls'),
  path.join(GAME, 'starsector-core', 'data', 'hulls', 'skins'),
];

function readJsonLoose(p) {
  let t = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
  t = t.replace(/#[^\n"]*(?=\n|$)/g, '');
  t = t.replace(/,(\s*[}\]])/g, '$1'); // 尾随逗号（org.json 合法，仅为本地解析）
  return JSON.parse(t);
}
function shipSlots(p) {
  const j = readJsonLoose(p);
  const out = new Set();
  for (const s of (j.weaponSlots || j.slots || [])) if (s.id) out.add(s.id);
  return out;
}

const hullSlots = new Map();
const skinBase = new Map(); // skinHullId -> baseHullId
for (const dir of HULL_DIRS) {
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (f.endsWith('.ship')) {
      try {
        const j = readJsonLoose(p);
        const hid = j.hullId || f.replace(/\.ship$/, '');
        const slots = shipSlots(p);
        hullSlots.set(hid, slots);
      } catch (e) { console.log('WARN parse ' + p + ': ' + e.message); }
    } else if (f.endsWith('.skin')) {
      // 皮肤是伪 JSON（裸键/裸值），正则抽取关键字段
      const t = fs.readFileSync(p, 'utf8');
      const sh = t.match(/"skinHullId"\s*:\s*"([^"]+)"/);
      const bh = t.match(/"baseHull"\s*:\s*"([^"]+)"/);
      if (sh && bh) skinBase.set(sh[1], bh[1]);
    }
  }
}

function slotsFor(hullId) {
  const seen = new Set();
  let cur = hullId;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    if (hullSlots.has(cur)) return hullSlots.get(cur);
    if (skinBase.has(cur)) { cur = skinBase.get(cur); continue; }
    return null;
  }
  return null;
}

const varDir = path.join(MOD, 'data', 'variants');
let checked = 0, bad = 0;
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!e.name.endsWith('.variant')) continue;
    checked++;
    let j;
    try { j = readJsonLoose(p); } catch (err) { console.log('BAD-JSON ' + p + ': ' + err.message); bad++; continue; }
    const slots = slotsFor(j.hullId);
    if (!slots) { console.log('NOHULL ' + e.name + ' (hullId=' + j.hullId + ')'); bad++; continue; }
    const used = new Set();
    for (const g of (j.weaponGroups || []))
      for (const slotId of Object.keys(g.weapons || {})) used.add(slotId);
    const missing = [...used].filter(s => !slots.has(s));
    if (missing.length) {
      bad++;
      console.log('SLOT-MISS ' + e.name + ' hull=' + j.hullId + ' 幽灵槽位: ' + missing.join(', '));
    }
  }
}
walk(varDir);
console.log('checked=' + checked + ' problems=' + bad);
