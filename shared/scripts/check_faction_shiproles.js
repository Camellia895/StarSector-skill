// 闸门 G-data-faction：mod .faction 的 shipRoles 里每个 "变体id":权重 必须能解析为真实变体。
// 背景（2026-09-15 AI War 事故×2）：
//   ① shipRoles 引用不存在的变体 id → SpecStore 加载 faction 时
//      Misc.getHullIdForVariantId → getVariant(id).getHullSpec() NPE 启动崩溃；
//   ② 变体 id 必须用「文件内 variantId 字段」（注册 id），不是文件名——
//      如 core 的 kite/kite_Interceptor.variant 注册 id 是 kite_hegemony_Interceptor；
//      dead 角色键（interceptor/fighter/bomber 等）也会被逐条解析，不会被忽略。
// 用法：node check_faction_shiproles.js <modDir> [游戏根=当前环境默认]
const fs = require('fs');
const path = require('path');
const { parseJsonLoose } = require('C:/game/StarSector.v0.9.8a-RC8/_work/skills/shared/scripts/pseudojson.js');
const GAME = process.argv[3] || 'C:/game/StarSector.v0.9.8a-RC8';
const modDir = process.argv[2];
if (!modDir) { console.error('用法: node check_faction_shiproles.js <modDir> [游戏根]'); process.exit(2); }
function walk(d, out = []) {
  if (!fs.existsSync(d)) return out;
  for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p, out) : out.push(p); }
  return out;
}
// 变体注册 id 池 = 每个 .variant 的内部 variantId 字段 ?? 文件名（core + 全部已启用 mod）
const regIds = new Set();
let enabled = [];
try { enabled = JSON.parse(fs.readFileSync(path.join(GAME, 'mods', 'enabled_mods.json'), 'utf8').replace(/^\uFEFF/, '')).enabledMods || []; } catch (e) {}
const roots = [path.join(GAME, 'starsector-core', 'data', 'variants')]
  .concat(walk(path.join(GAME, 'mods')).length ? enabled.map(m => path.join(GAME, 'mods', m, 'data', 'variants')) : []);
for (const root of roots) {
  for (const v of walk(root)) {
    if (!v.endsWith('.variant')) continue;
    let reg = path.basename(v, '.variant');
    try { const j = parseJsonLoose(fs.readFileSync(v, 'utf8')); if (j.variantId) reg = j.variantId; } catch (e) {}
    regIds.add(reg);
  }
}
// 被测 mod 自身的变体（无论是否启用清单里）
for (const v of walk(path.join(modDir, 'data', 'variants'))) {
  if (!v.endsWith('.variant')) continue;
  let reg = path.basename(v, '.variant');
  try { const j = parseJsonLoose(fs.readFileSync(v, 'utf8')); if (j.variantId) reg = j.variantId; } catch (e) {}
  regIds.add(reg);
}
let fail = 0;
const KNOWN_KEYS = { knownShips: 'hulls', knownFighters: 'fighters', knownWeapons: 'weapons', knownHullMods: 'hullMods' };
for (const f of walk(path.join(modDir, 'data', 'world', 'factions')).filter(x => x.endsWith('.faction'))) {
  const t = fs.readFileSync(f, 'utf8');
  // known* 必须是对象 { tags:[...], hulls/fighters/weapons/hullMods:[...] }，裸数组 = 启动崩溃
  //（SpecStore getJSONObject("knownShips") → JSONException "is not a JSONObject"）
  for (const [key, inner] of Object.entries(KNOWN_KEYS)) {
    const re = new RegExp('"' + key + '"\\s*:\\s*(\\[|\\{)');
    const m = t.match(re);
    if (m && m[1] === '[') {
      fail = 1;
      console.log('FAIL:', f, '→ "' + key + '" 是裸数组，0.98 要求对象 {"tags":[...],"' + inner + '":[...]}');
    }
    if (m && m[1] === '{' && !t.includes('"' + inner + '"')) {
      fail = 1;
      console.log('FAIL:', f, '→ "' + key + '" 缺少内部数组键 "' + inner + '"');
    }
  }
  const s = t.indexOf('"shipRoles"');
  if (s < 0) { console.log('PASS（无 shipRoles）:', f); continue; }
  const ends = ['"doctrine"', '"factionDoctrine"', '"traits"', '"knownShips"'].map(k => t.indexOf(k, s)).filter(i => i > s);
  let block = t.slice(s, ends.length ? Math.min(...ends) : t.length);
  block = block.replace(/"fallback"\s*:\s*\{[^{}]*\}/g, '"fallback":{}'); // fallback 里是角色名不是变体
  const variants = new Set();
  const re = /"([a-zA-Z0-9_]+)"\s*:\s*([{\d])/g;
  let m;
  while ((m = re.exec(block))) {
    if (m[2] === '{') continue; // 角色声明
    variants.add(m[1]);
  }
  const miss = [...variants].filter(id => !regIds.has(id));
  if (miss.length) {
    fail = 1;
    console.log('FAIL:', f);
    console.log('  无法解析的变体 id（按注册 id）:', miss.join(', '));
  } else {
    console.log('PASS:', f, '（shipRoles 变体', variants.size, '个全部可解析）');
  }
}
process.exit(fail);
