// check_worldgen_ids.js — Java 世界生成代码的 id 语义校验闸门（2026-10-05，CELESTIAL MOUNT CIRCLE 制作流程沉淀）
//
// 背景：为旧 mod 制作派系/星系/星球（Java 世界生成路线）时，编译探测只能抓 API 签名断裂；
//       **字符串/常量形式的 id**（行星/恒星类型、市场条件、产业、子市场、商品、特殊物品、派系 id）
//       编译器不查、加载期不崩或运行期才崩，只有深烟测能暴露。本脚本在进游戏前拦下这层。
//       实战参照 = mods\Celestial Mount Circle（CMC_PeachGarden.java 的 addPlanet/initStar/
//       addMarketplace/Conditions/Industries/Submarkets/Items 用法全绿）。
//
// 用法: node check_worldgen_ids.js <modDir> [--java=<dir>]...
//   <modDir>      mod 根目录（注册表 = core + 全部已启用 mod + 被测 mod 自身）
//   --java=<dir>  额外的 Java 源码目录（可重复）；缺省 = <modDir>\src 与 <modDir>\data 下全部 .java
//                 （janino 运行时脚本同覆盖；只有 jar 的 mod 可传反编译输出目录）
//
// 检查项：
//   A. id 常量类引用 → 从 <game>\_work\_api_src 的 impl/campaign/ids/*.java 解析常量值，
//      再对照注册表：Conditions→market_conditions.csv / Industries→industries.csv /
//      Submarkets→submarkets.csv / Commodities→commodities.csv / Items→special_items.csv /
//      Factions→*.faction 的 id / Planets→planets.json ∪ planet_gen_data / StarTypes→star_gen_data
//   B. 调用点字面量：initStar(第2参=恒星类型)、addPlanet(第4参=行星类型)、addCondition /
//      addIndustry / addSubmarket(第1参)、getFaction / setRelationship / addParticipatingFaction /
//      addMarketplace(第1参=派系id)
// 退出码：全部通过 = 0；任何未知 id = 1。**只读+打印**。
'use strict';
const fs = require('fs');
const path = require('path');

const GAME = 'C:/game/StarSector.v0.9.8a-RC8';
const CORE = GAME + '/starsector-core';
const API_IDS = GAME + '/_work/_api_src/com/fs/starfarer/api/impl/campaign/ids';

const args = process.argv.slice(2);
const modDir = args[0] && !args[0].startsWith('--') ? args[0] : null;
if (!modDir || !fs.existsSync(modDir)) { console.error('用法: node check_worldgen_ids.js <modDir> [--java=<dir>]...'); process.exit(2); }
const javaDirs = [];
for (const a of args.slice(1)) {
  if (a.startsWith('--java=')) javaDirs.push(a.slice(7));
}

// ---------- 通用工具 ----------
function stripJavaComments(text) {
  // 状态机：保留字符串/字符字面量，剥 // 与 /* */（字符串内的引号转义感知）
  let out = '', i = 0, n = text.length, state = 'code';
  while (i < n) {
    const c = text[i], c2 = text[i + 1];
    if (state === 'code') {
      if (c === '"' ) { state = 'str'; out += c; }
      else if (c === "'") { state = 'chr'; out += c; }
      else if (c === '/' && c2 === '/') { state = 'line'; i += 2; continue; }
      else if (c === '/' && c2 === '*') { state = 'block'; i += 2; continue; }
      else out += c;
    } else if (state === 'str') {
      out += c;
      if (c === '\\') { out += c2 || ''; i += 2; continue; }
      if (c === '"') state = 'code';
    } else if (state === 'chr') {
      out += c;
      if (c === '\\') { out += c2 || ''; i += 2; continue; }
      if (c === "'") state = 'code';
    } else if (state === 'line') {
      if (c === '\n') { state = 'code'; out += c; }
    } else if (state === 'block') {
      if (c === '*' && c2 === '/') { state = 'code'; i += 2; continue; }
      if (c === '\n') out += c; // 保行号
    }
    i++;
  }
  return out;
}

function stripHashComments(text) {
  // .faction/planets.json 的 # 注释（整行/行内），字符串感知
  let out = [], inStr = false;
  for (const line of text.split(/\r?\n/)) {
    let res = '';
    inStr = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inStr) {
        res += c;
        if (c === '\\') { res += line[i + 1] || ''; i++; continue; }
        if (c === '"') inStr = false;
      } else if (c === '"') { inStr = true; res += c; }
      else if (c === '#') break;
      else res += c;
    }
    out.push(res);
  }
  return out.join('\n');
}

function lineOf(text, offset) { let n = 1; for (let i = 0; i < offset && i < text.length; i++) if (text[i] === '\n') n++; return n; }

// 提取 methodName( ... ) 的实参列表（嵌套括号 + 字符串感知），返回 [{file,line,args:[raw...]}]
function extractCalls(text, methodName, relFile) {
  const calls = [];
  const re = new RegExp('\\b' + methodName + '\\s*\\(', 'g');
  let m;
  while ((m = re.exec(text))) {
    let i = m.index + m[0].length, depth = 1, inStr = false;
    const start = i;
    while (i < text.length && depth > 0) {
      const c = text[i];
      if (inStr) {
        if (c === '\\') { i += 2; continue; }
        if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === '(') depth++;
      else if (c === ')') { depth--; if (depth === 0) break; }
      i++;
    }
    const inner = text.slice(start, i);
    // 顶层逗号切分（字符串 + 嵌套括号感知）
    const args = []; let cur = '', d = 0; inStr = false;
    for (let j = 0; j < inner.length; j++) {
      const c = inner[j];
      if (inStr) {
        cur += c;
        if (c === '\\') { cur += inner[j + 1] || ''; j++; continue; }
        if (c === '"') inStr = false;
      } else if (c === '"') { inStr = true; cur += c; }
      else if (c === '(') { d++; cur += c; }
      else if (c === ')') { d--; cur += c; }
      else if (c === ',' && d === 0) { args.push(cur.trim()); cur = ''; }
      else cur += c;
    }
    if (cur.trim()) args.push(cur.trim());
    calls.push({ file: relFile, line: lineOf(text, m.index), args });
  }
  return calls;
}

function literalOf(raw) {
  const m = /^"((?:[^"\\]|\\.)*)"$/.exec(raw);
  return m ? m[1] : null;
}

function walkFiles(dir, ext, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walkFiles(p, ext, out);
    else if (!ext || f.toLowerCase().endsWith(ext)) out.push(p);
  }
  return out;
}

function readText(p) { return fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''); }

// CSV 指定列 → Set（跳过 # 注释行；够用于核心注册表，它们没有引号内逗号）
function csvIds(p, col = 'id') {
  const set = new Set();
  if (!fs.existsSync(p)) return set;
  const lines = readText(p).split(/\r?\n/);
  if (!lines.length) return set;
  const idx = lines[0].split(',').indexOf(col);
  if (idx < 0) return set;
  for (const l of lines.slice(1)) {
    if (!l.trim() || l.startsWith('#')) continue;
    const v = l.split(',')[idx];
    if (v && v.trim()) set.add(v.trim());
  }
  return set;
}

function union(...sets) { const s = new Set(); for (const t of sets) for (const v of t) s.add(v); return s; }

// ---------- 注册表收集（core + 已启用 mod + 被测 mod） ----------
function enabledMods() {
  try {
    const j = JSON.parse(readText(path.join(GAME, 'mods', 'enabled_mods.json')));
    return (j.enabledMods || []).map((m) => path.join(GAME, 'mods', m));
  } catch (e) { return []; }
}

function collectCsv(name, col = 'id') {
  const sets = [csvIds(path.join(CORE, 'data', 'campaign', name), col)];
  for (const root of [...enabledMods(), modDir]) {
    // mod 可能放在 data/campaign/（与 core 同构）——就这一处，别处不是该注册表
    sets.push(csvIds(path.join(root, 'data', 'campaign', name), col));
  }
  return union(...sets);
}

function collectPlanetTypes() {
  const set = new Set();
  const jsons = [path.join(CORE, 'data', 'config', 'planets.json')];
  for (const root of [...enabledMods(), modDir]) {
    const p = path.join(root, 'data', 'config', 'planets.json');
    if (fs.existsSync(p)) jsons.push(p);
  }
  const { parseJsonLoose } = require(path.join(__dirname, '..', '..', '..', 'shared', 'scripts', 'pseudojson.js'));
  for (const p of jsons) {
    try { for (const k of Object.keys(parseJsonLoose(readText(p)))) set.add(k); }
    catch (e) { console.error(`! 无法解析 ${p}: ${e.message}`); }
  }
  return union(set, collectProcgenIds('planet_gen_data.csv'));
}

function collectProcgenIds(file) {
  const out = new Set();
  for (const root of [CORE, ...enabledMods(), modDir]) {
    for (const v of csvIds(path.join(root, 'data', 'campaign', 'procgen', file))) out.add(v);
  }
  return out;
}

function collectFactionIds() {
  const set = new Set();
  for (const root of [CORE, ...enabledMods(), modDir]) {
    const d = path.join(root, 'data', 'world', 'factions');
    for (const f of walkFiles(d, '.faction')) {
      // 裸键合法（persean_league.faction 实测 id:"persean" 无引号），键名引号必须可选
      const m = /["']?id["']?\s*:\s*"([^"]+)"/.exec(stripHashComments(readText(f)));
      if (m) set.add(m[1]);
    }
  }
  return set;
}

function collectStarTypes() { return collectProcgenIds('star_gen_data.csv'); }

// ---------- API 常量解析 ----------
function parseApiConsts(cls) {
  const map = {};
  const p = path.join(API_IDS, cls + '.java');
  if (!fs.existsSync(p)) return null;
  const text = readText(p);
  const re = /static\s+final\s+String\s+(\w+)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(text))) map[m[1]] = m[2];
  return map;
}

// ---------- 主流程 ----------
const registries = {
  Conditions: { name: '市场条件', set: collectCsv('market_conditions.csv') },
  Industries: { name: '产业', set: collectCsv('industries.csv') },
  Submarkets: { name: '子市场', set: collectCsv('submarkets.csv') },
  Commodities: { name: '商品', set: collectCsv('commodities.csv') },
  Items: { name: '特殊物品', set: collectCsv('special_items.csv') },
  Factions: { name: '派系', set: collectFactionIds() },
  Planets: { name: '行星类型', set: collectPlanetTypes() },
  StarTypes: { name: '恒星类型', set: collectStarTypes() },
};

const files = [];
for (const d of javaDirs) files.push(...walkFiles(d, '.java'));
if (!javaDirs.length) {
  files.push(...walkFiles(path.join(modDir, 'src'), '.java'));
  files.push(...walkFiles(path.join(modDir, 'data'), '.java'));
}
if (!files.length) { console.log('（未找到 .java 源码——纯数据 mod，无世界生成代码可校验）'); process.exit(0); }

const findings = []; // {sev, file, line, msg}
const add = (sev, file, line, msg) => findings.push({ sev, file, line, msg });

// 调用名 → {argIndex, registry}
const CALL_CHECKS = [
  ['initStar', 1, 'StarTypes', '恒星类型'],
  ['addPlanet', 3, 'Planets', '行星类型'],
  ['addCondition', 0, 'Conditions', '市场条件'],
  ['addIndustry', 0, 'Industries', '产业'],
  ['addSubmarket', 0, 'Submarkets', '子市场'],
  ['getFaction', 0, 'Factions', '派系'],
  ['setRelationship', 0, 'Factions', '派系'],
  ['addParticipatingFaction', 0, 'Factions', '派系'],
  ['addMarketplace', 0, 'Factions', '派系'],
];

// setInteractionImage(类别, 键)：类别必须是 mod/core settings.json "graphics" 里定义的类别，
// 且键必须在该类别下——"长得像拼写错误的自定义类别"（Citadel 的 illustrationz，2026-10-05 实证）
// 与真拼写错误（键不存在）只能靠注册表区分，引擎对两者都只静默失败或晚崩。
function collectIllustrationCats() {
  const { parseJsonLoose } = require(path.join(__dirname, '..', '..', '..', 'shared', 'scripts', 'pseudojson.js'));
  const cats = new Map(); // cat -> Set(keys)
  const addCat = (cat, obj) => {
    if (!cats.has(cat)) cats.set(cat, new Set());
    if (obj && typeof obj === 'object') for (const k of Object.keys(obj)) cats.get(cat).add(k);
  };
  for (const root of [CORE, ...enabledMods(), modDir]) {
    const p = path.join(root, 'data', 'config', 'settings.json');
    if (!fs.existsSync(p)) continue;
    const raw = readText(p);
    try {
      const g = parseJsonLoose(raw).graphics || {};
      for (const cat of Object.keys(g)) addCat(cat, g[cat]);
    } catch (e) {
      // 核心大 settings.json 常含 parseJsonLoose 不支持的裸写法（如 ":.5"，R8 合法）。
      // 降级：定位 "graphics" 块（括号配平），类别均为扁平键→字符串映射，用正则提取。
      const gi = raw.search(/"graphics"\s*:\s*\{/);
      if (gi < 0) { console.error(`! ${p}：解析失败且无 graphics 块（${e.message}）`); continue; }
      let depth = 0, i = raw.indexOf('{', gi);
      const start = i;
      for (; i < raw.length; i++) {
        if (raw[i] === '{') depth++;
        else if (raw[i] === '}') { depth--; if (depth === 0) break; }
      }
      const gblock = raw.slice(start, i + 1);
      const catRe = /"([A-Za-z0-9_]+)"\s*:\s*\{([^{}]*)\}/g;
      let m;
      while ((m = catRe.exec(gblock))) {
        const keys = new Set();
        const kRe = /"([^"]+)"\s*:/g;
        let km;
        while ((km = kRe.exec(m[2]))) keys.add(km[1]);
        if (!cats.has(m[1])) cats.set(m[1], keys);
        else for (const k of keys) cats.get(m[1]).add(k);
      }
    }
  }
  return cats;
}

for (const f of files) {
  const rel = path.relative(modDir, f) || path.basename(f);
  const raw = readText(f);
  const text = stripJavaComments(raw);
  // A. 常量类引用
  const re = /\b(Conditions|Industries|Submarkets|Commodities|Items|Factions|Planets|StarTypes)\.([A-Za-z0-9_]+)/g;
  let m;
  while ((m = re.exec(text))) {
    const cls = m[1], konst = m[2], reg = registries[cls];
    if (!reg) continue;
    const apiMap = parseApiConsts(cls);
    if (!apiMap) { add('WARN', rel, lineOf(text, m.index), `${cls}.${konst}：API ids 源码缺失（${API_IDS}），无法解析`); continue; }
    if (!(konst in apiMap)) { add('FAIL', rel, lineOf(text, m.index), `${cls}.${konst}：0.98a API 无此常量（拼写错误或已删）`); continue; }
    const v = apiMap[konst];
    if (!reg.set.has(v)) add('FAIL', rel, lineOf(text, m.index), `${cls}.${konst} = "${v}"：注册表中不存在（${reg.name}，core+已启用mod+本mod）`);
  }
  // B. 调用点字面量
  for (const [callee, idx, regKey, label] of CALL_CHECKS) {
    for (const call of extractCalls(text, callee, rel)) {
      const lit = literalOf(call.args[idx] || '');
      if (lit == null) continue; // 非字面量（变量/i18n 间接）跳过
      if (!registries[regKey].set.has(lit)) {
        add('FAIL', call.file, call.line, `${callee}(…) 第${idx + 1}参 "${lit}"：${label}不存在于注册表`);
      }
    }
  }
  // B2. setInteractionImage(类别, 键) → settings.json graphics 类别注册表
  const illuCats = collectIllustrationCats();
  for (const call of extractCalls(text, 'setInteractionImage', rel)) {
    const cat = literalOf(call.args[0] || '');
    const key = literalOf(call.args[1] || '');
    if (cat == null) continue;
    if (!illuCats.has(cat)) { add('FAIL', call.file, call.line, `setInteractionImage 类别 "${cat}"：mod/core settings.json 的 graphics 未定义该类别`); continue; }
    if (key != null && !illuCats.get(cat).has(key)) {
      add('FAIL', call.file, call.line, `setInteractionImage 键 "${key}"：类别 "${cat}" 下不存在（mod+core 合并）`);
    }
  }
}

const fail = findings.filter((x) => x.sev === 'FAIL');
const warn = findings.filter((x) => x.sev === 'WARN');
for (const x of findings) console.log(`${x.sev} ${x.file}:${x.line} ${x.msg}`);
console.log(`扫描 ${files.length} 个 .java；FAIL ${fail.length}，WARN ${warn.length}`);
if (fail.length) { console.log('✗ 未通过：存在进游戏才会暴露的未知 id'); process.exit(1); }
console.log('✓ 全部通过');
