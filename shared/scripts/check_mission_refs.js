// check_mission_refs.js — 任务(mission)层引用闭包校验（check_refs.js 的任务层扩展）
//
// 背景（2026-09-23 YRXP 3.1.0 沉淀）：主菜单独立任务在**点击/加载时**解析
// MissionDefinition 里 addToFleet 的 variant 引用，引用不存在的 variant = 点击即崩。
// check_refs.js 只扫 data 层互引，扫不到任务源码/jar 任务类里的引用。
//
// 本脚本扫两个载体：
//   ① data/missions/*/MissionDefinition.java 的字符串字面量；
//   ② jar 内 data/missions/*/MissionDefinition*.class 的常量池字节（含流式条目，
//      走中央目录，unzip 报 bad CRC 的 jar 也能读）。
// 关键判定——**惰性源码**：mod 同时带 jars/ 和 data 源码时，jar 里已有编译类的任务
// 以 jar 为准（Janino 只编 jar 缺的类）；这类任务的"仅源码引用"降级为 warn（不进退出码），
// jar 类与无 jar 类任务（真 Janino）的引用为 red。
//
// 覆盖闭包（对每个解析为 variant 的 id）：hullId / hullMods / permaMods / 武器 /
// wings→fighter variant / modules→模块 variant 与其 hull。
// 槽位闭包（WS.... 是否在船体 weaponSlots 上）请另跑 check_variant_slots.js；
// data 层互引请另跑 check_refs.js。
//
// 用法: node check_mission_refs.js <modDir> [gameRoot] [--prefix=a,b]
//   --prefix  显式指定 id 前缀白名单（首段）；缺省自动推导 = 全部 variant/hull/weapon
//             id 的首段并集。注意：子势力前缀若当前无任何 id 使用则推不出来，需显式给。
// 退出码: 0 = 无 red 发现（warn 不计）；1 = 有 red 发现；2 = 用法错误。
// 只读，不写任何文件。

'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { parseJsonLoose } = require('./pseudojson.js');

// 行内 # 注释剥离（字符串感知；.skin 的 "removeWeaponSlots":[], # ids 形态，pseudojson 只吃整行注释）
function stripHashComments(txt) {
  const out = []; let inStr = false;
  for (const line of txt.split('\n')) {
    let res = '';
    for (const ch of line) {
      if (ch === '"') inStr = !inStr;
      if (ch === '#' && !inStr) break;
      res += ch;
    }
    out.push(res);
  }
  return out.join('\n');
}
function parseLooseFile(p) {
  let t = stripHashComments(fs.readFileSync(p, 'utf8'));
  // 裸前导点数字（org.json 容忍的 "baseValueMult":.7 形态）
  let out = '', inStr = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (ch === '"') inStr = !inStr;
    if (ch === '.' && !inStr && i > 0 && /[:,\[\s]/.test(t[i - 1]) && /[0-9]/.test(t[i + 1] || '')) out += '0';
    out += ch;
  }
  return parseJsonLoose(out);
}

function usage(code) {
  console.log('用法: node check_mission_refs.js <modDir> [gameRoot] [--prefix=a,b]');
  console.log('  任务层引用闭包：mission 源码 + jar 任务类 → variant/hull/weapon/wing/hullmod/faction');
  console.log('  惰性源码判定：jar 已有编译类的任务，仅源码引用降级 warn。red 才进退出码。');
  process.exit(code);
}
const args = process.argv.slice(2);
if (args.includes('--help')) usage(0);
if (args.length < 1) usage(2);
const MOD = path.resolve(args[0]);
const GAME = path.resolve(args[1] && !args[1].startsWith('--') ? args[1] : path.join(MOD, '..', '..'));
const prefixArg = (args.find(a => a.startsWith('--prefix=')) || '').split('=')[1];
if (!fs.existsSync(path.join(MOD, 'mod_info.json'))) {
  console.error('不是 mod 目录（缺 mod_info.json）: ' + MOD); process.exit(2);
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
function readCsvIds(file, idCol, extra, target) {
  if (!fs.existsSync(file)) return;
  const rows = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  if (!rows.length) return;
  const split = (line) => { // 简易 CSV（id 列不含引号内逗号即可；check_refs.js 同款假设）
    const cells = []; let cur = '', q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if (ch === ',' && !q) { cells.push(cur); cur = ''; }
      else cur += ch;
    }
    cells.push(cur); return cells;
  };
  const head = split(rows[0]).map(s => s.trim());
  const iId = head.indexOf(idCol), iExtra = extra ? head.indexOf(extra) : -1;
  if (iId < 0) return;
  for (let i = 1; i < rows.length; i++) {
    const c = split(rows[i]);
    if (c[iId] && c[iId].trim()) {
      if (target) target.add(c[iId].trim());
      if (iExtra >= 0 && c[iExtra] && c[iExtra].trim()) wingVariant.set(c[iId].trim(), c[iExtra].trim());
    }
  }
}

const idHulls = new Set(), idWeapons = new Set(), idWings = new Set(),
      idHullmods = new Set(), idVariants = new Set(), idFactions = new Set();
const wingVariant = new Map();      // wing id -> fighter variant id
const variantFile = new Map();      // variant id -> file path
const shipFile = new Map();         // hull id -> .ship path
const knownTokens = new Set();      // 包路径段/类简单名等"非内容"豁免

const roots = [path.join(GAME, 'starsector-core')];
const modsDir = path.join(GAME, 'mods');
if (fs.existsSync(modsDir)) for (const n of fs.readdirSync(modsDir)) {
  const p = path.join(modsDir, n);
  if (fs.statSync(p).isDirectory()) roots.push(p);
}
for (const root of roots) {
  readCsvIds(path.join(root, 'data/hulls/ship_data.csv'), 'id', null, idHulls);
  readCsvIds(path.join(root, 'data/weapons/weapon_data.csv'), 'id', null, idWeapons);
  if (fs.existsSync(path.join(root, 'data/hulls/wing_data.csv')))
    readCsvIds(path.join(root, 'data/hulls/wing_data.csv'), 'id', 'variant', idWings);
  else readCsvIds(path.join(root, 'data/hulls/wings.csv'), 'id', 'variant', idWings);
  readCsvIds(path.join(root, 'data/hullmods/hull_mods.csv'), 'id', null, idHullmods);
  for (const f of walk(path.join(root, 'data/variants'))) {
    if (f.endsWith('.variant')) {
      // 注册 id = 文件内 variantId 字段（事故库 28）；无该字段才退回文件名
      let id = path.basename(f, '.variant');
      try {
        const m = fs.readFileSync(f, 'utf8').match(/"variantId"\s*:\s*"([^"]+)"/);
        if (m) id = m[1];
      } catch (e) { /* 读不了就退回文件名 */ }
      idVariants.add(id); variantFile.set(id, f);
    }
  }
  for (const f of walk(path.join(root, 'data/hulls'))) {
    if (f.endsWith('.ship')) shipFile.set(path.basename(f, '.ship'), f);
    if (f.endsWith('.skin')) { // 皮肤船体（如 mule_d_pirates）不在 ship_data.csv，靠 .skin 注册
      try { const sj = parseLooseFile(f);
        const sid = (sj.skinHullId || sj.hullId || path.basename(f, '.skin') + '').trim();
        if (sid) { idHulls.add(sid); shipFile.set(sid, f); } } catch (_) {}
    }
  }
  const facDir = path.join(root, 'data/world/factions');
  if (fs.existsSync(facDir)) for (const f of fs.readdirSync(facDir)) {
    if (!f.endsWith('.faction')) continue;
    const m = fs.readFileSync(path.join(facDir, f), 'utf8').match(/["']?id["']?\s*:\s*"([^"]+)"/);
    if (m) idFactions.add(m[1]);
  }
}
const idUniverse = new Set([...idHulls, ...idWeapons, ...idWings, ...idHullmods, ...idVariants, ...idFactions]);

// 前缀白名单：variant/hull/weapon id 首段并集
let prefixSet;
if (prefixArg) prefixSet = new Set(prefixArg.split(',').map(s => s.trim()).filter(Boolean));
else {
  prefixSet = new Set();
  for (const id of [...idVariants, ...idHulls, ...idWeapons]) {
    const i = id.indexOf('_');
    if (i > 0) prefixSet.add(id.slice(0, i));
  }
}

// ---- jar：中央目录解析（流式条目可用），只取 data/missions/* 的 class 字节 ----
function jarMissionClasses(jarPath, jarKnown) {
  const buf = fs.readFileSync(jarPath);
  const out = new Map(); // missionName -> [Buffer]
  // 找 EOCD → 中央目录偏移
  let eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) return out;
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break;
    const method = buf.readUInt16LE(off + 10);
    const csize = buf.readUInt32LE(off + 20);
    const nlen = buf.readUInt16LE(off + 28);
    const elen = buf.readUInt16LE(off + 30);
    const clen = buf.readUInt16LE(off + 32);
    const lho = buf.readUInt32LE(off + 42);
    const name = buf.slice(off + 46, off + 46 + nlen).toString('latin1');
    for (const seg of name.split(/[\/\\]/)) if (seg.includes('_')) knownTokens.add(seg);
    if (name.endsWith('.class')) {
      const base = name.split(/[\/\\]/).pop().split('$')[0].replace(/\.class$/, '');
      jarKnown.add(base);
    }
    const m = name.match(/^data[\/\\]missions[\/\\]([A-Za-z0-9_]+)[\/\\]MissionDefinition[^\/\\]*\.class$/);
    if (m) {
      const nl = buf.readUInt16LE(lho + 26), el = buf.readUInt16LE(lho + 28);
      const start = lho + 30 + nl + el;
      const raw = buf.slice(start, start + csize);
      const data = method === 8 ? zlib.inflateRawSync(raw) : raw;
      if (!out.has(m[1])) out.set(m[1], []);
      out.get(m[1]).push(data);
    }
    off += 46 + nlen + elen + clen;
  }
  return out;
}

const jarKnownClasses = new Set();
const jarClasses = new Map(); // mission -> [bytes]
const jarsDir = path.join(MOD, 'jars');
if (fs.existsSync(jarsDir)) for (const f of fs.readdirSync(jarsDir)) {
  if (f.endsWith('.jar')) {
    try {
      for (const [m, bufs] of jarMissionClasses(path.join(jarsDir, f), jarKnownClasses)) {
        if (!jarClasses.has(m)) jarClasses.set(m, []);
        jarClasses.get(m).push(...bufs);
      }
    } catch (e) { console.error(`[warn] 解析 ${f} 失败: ${e.message}`); }
  }
}

// ---- 采集每个任务的引用 ----
const TOKEN = /[A-Za-z][A-Za-z0-9_]{5,}/g;
const QUOTED = /"([^"\n]+)"/g;
function tokensFromText(text) {
  const out = new Set(); let m;
  while ((m = QUOTED.exec(text))) {
    let mm;
    while ((mm = TOKEN.exec(m[1]))) out.add(mm[0]);
  }
  return out;
}
function tokensFromBytes(bufs) {
  const out = new Set();
  for (const b of bufs) { let m; const t = b.toString('latin1'); TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(t))) out.add(m[0]); }
  return out;
}

// 原版目标点类型等非内容 id 豁免
for (const t of ['nav_buoy', 'sensor_array', 'comm_relay', 'stable_location', 'relay_buoy']) knownTokens.add(t);
const misDir = path.join(MOD, 'data/missions');
const missions = fs.existsSync(misDir) ? fs.readdirSync(misDir).filter(n =>
  fs.existsSync(path.join(misDir, n, 'MissionDefinition.java'))) : [];
for (const n of missions) knownTokens.add(n);

const findings = []; // {mission, tok, level: red|warn, why}
const parsedVariants = new Map();

function checkVariant(id, mission, level) {
  const p = variantFile.get(id);
  if (!p) return; // 调用方已处理 missing
  let d = parsedVariants.get(id);
  if (!d) { try { d = parseLooseFile(p); parsedVariants.set(id, d); } catch (e) {
    findings.push({ mission, tok: id, level, why: `variant 解析失败: ${e.message}` }); return; } }
  const hull = (d.hullId || '').trim();
  if (hull && !idHulls.has(hull)) findings.push({ mission, tok: id, level, why: `hull 缺失: ${hull}` });
  for (const mod of [...(d.hullMods || []), ...(d.permaMods || [])])
    if (typeof mod === 'string' && mod && !idHullmods.has(mod))
      findings.push({ mission, tok: id, level, why: `hullmod 缺失: ${mod}` });
  for (const g of d.weaponGroups || []) for (const [slot, w] of Object.entries(g.weapons || {}))
    if (typeof w === 'string' && w && !idWeapons.has(w))
      findings.push({ mission, tok: id, level, why: `武器缺失: ${slot}→${w}` });
  for (const w of d.wings || []) if (typeof w === 'string' && w) {
    if (!idWings.has(w)) findings.push({ mission, tok: id, level, why: `wing 缺失: ${w}` });
    else { const fv = wingVariant.get(w);
      if (fv && !idVariants.has(fv)) findings.push({ mission, tok: id, level, why: `wing ${w} 的 fighter variant 缺失: ${fv}` }); }
  }
  const mods = d.modules;
  const entries = Array.isArray(mods) ? mods.flatMap(x => Object.entries(x || {}))
    : mods && typeof mods === 'object' ? Object.entries(mods) : [];
  for (const [slot, mv] of entries) {
    if (!idVariants.has(mv)) findings.push({ mission, tok: id, level, why: `模块 variant 缺失: ${slot}→${mv}` });
    else { try { const mh = (parseLooseFile(variantFile.get(mv)).hullId || '').trim();
      if (mh && !idHulls.has(mh)) findings.push({ mission, tok: id, level, why: `模块 hull 缺失: ${slot}→${mv}→${mh}` }); } catch (_) {} }
  }
}

let inertCount = 0, liveCount = 0;
for (const m of missions) {
  const srcTok = tokensFromText(fs.readFileSync(path.join(misDir, m, 'MissionDefinition.java'), 'utf8'));
  const jarBufs = jarClasses.get(m) || [];
  const jarTok = jarBufs.length ? tokensFromBytes(jarBufs) : new Set();
  const inert = jarBufs.length > 0; // jar 有编译类 ⇒ 源码惰性
  if (inert) inertCount++; else liveCount++;
  const seen = new Map(); // tok -> {inSrc, inJar}
  for (const t of srcTok) if (!seen.has(t)) seen.set(t, { inSrc: true, inJar: false });
  for (const t of jarTok) { const e = seen.get(t); if (e) e.inJar = true; else seen.set(t, { inSrc: false, inJar: true }); }
  for (const [tok, s] of seen) {
    if (!tok.includes('_')) continue;
    const first = tok.slice(0, tok.indexOf('_'));
    if (!prefixSet.has(first)) continue;
    if (idUniverse.has(tok) || knownTokens.has(tok) || jarKnownClasses.has(tok)) {
      if (idVariants.has(tok)) checkVariant(tok, m, 'red');
      continue;
    }
    if (s.inJar || !inert) findings.push({ mission: m, tok, level: 'red',
      why: s.inJar ? 'jar 任务类引用不存在' : 'Janino 活源码引用不存在' });
    else findings.push({ mission: m, tok, level: 'warn', why: '仅惰性源码引用（jar 未用，不崩但建议清理）' });
  }
}

console.log(`id 宇宙: hull=${idHulls.size} weapon=${idWeapons.size} wing=${idWings.size} hullmod=${idHullmods.size} variant=${idVariants.size} faction=${idFactions.size}`);
console.log(`任务: ${missions.length} 个（jar 优先 ${inertCount} / Janino 活源码 ${liveCount}）；前缀白名单: ${[...prefixSet].join(',') || '(空)'}`);
const red = findings.filter(f => f.level === 'red'), warn = findings.filter(f => f.level === 'warn');
for (const f of red) console.log(`[red]   ${f.mission}: ${f.tok} — ${f.why}`);
for (const f of warn) console.log(`[warn]  ${f.mission}: ${f.tok} — ${f.why}`);
console.log(`red=${red.length} warn=${warn.length}`);
if (red.length) { console.log('FAIL — 修复后重跑；槽位闭包另跑 check_variant_slots.js，data 层互引另跑 check_refs.js'); process.exit(1); }
console.log('PASS（槽位闭包另跑 check_variant_slots.js，data 层互引另跑 check_refs.js）');
