// survey_uitags.js — 全 mods 目录 uiTags 普查：按「标签值」聚合，区分核心已知分类 vs 未知标签。
// 用法: node survey_uitags.js <modsDir> [--core=<核心data目录>] [--json=<out>]
const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./csvlib.js');

const argv = process.argv.slice(2);
const modsDir = argv.filter(a => !a.startsWith('--'))[0];
const coreArg = (argv.find(a => a.startsWith('--core=')) || '').slice(7) || 'C:/game/StarSector.v0.9.8a-RC8/starsector-core/data';
const jsonArg = (argv.find(a => a.startsWith('--json=')) || '').slice(7);
if (!modsDir) { console.error('usage: node survey_uitags.js <modsDir> [--core=<核心data目录>] [--json=<out>]'); process.exit(2); }

// 核心中文词表（含 CJK 的标签）
const coreVocab = new Set();
const coreCsv = path.join(coreArg, 'hullmods', 'hull_mods.csv');
if (fs.existsSync(coreCsv)) {
  const { header, rows } = parseCsv(fs.readFileSync(coreCsv, 'utf8'));
  const i = header.indexOf('uiTags');
  for (const r of rows) for (const t of String(r.cells[i] || '').split(',')) {
    const s = t.trim(); if (s && /[\u4e00-\u9fff]/.test(s)) coreVocab.add(s);
  }
}
// 英文核心词表（英文原版 tags）
const enVocab = new Set();
const enCsv = 'C:/game/StarSector.v0.9.8a-RC8/en/Starsector/starsector-core/data/hullmods/hull_mods.csv';
if (fs.existsSync(enCsv)) {
  const { header, rows } = parseCsv(fs.readFileSync(enCsv, 'utf8'));
  const i = header.indexOf('uiTags');
  for (const r of rows) for (const t of String(r.cells[i] || '').split(',')) {
    const s = t.trim(); if (s) enVocab.add(s);
  }
}

const tagStats = new Map();   // tag -> { mods:Set, cells:n }
const perMod = new Map();
for (const e of fs.readdirSync(modsDir, { withFileTypes: true })) {
  if (!e.isDirectory()) continue;
  const csv = path.join(modsDir, e.name, 'data', 'hullmods', 'hull_mods.csv');
  if (!fs.existsSync(csv)) continue;
  let parsed;
  try { parsed = parseCsv(fs.readFileSync(csv, 'utf8')); } catch { continue; }
  const i = parsed.header.indexOf('uiTags'), iId = parsed.header.indexOf('id');
  if (i < 0) continue;
  for (const r of parsed.rows) {
    const raw = String(r.cells[i] || '').trim();
    if (!raw) continue;
    for (const t of raw.split(',')) {
      const s = t.trim();
      if (!s) continue;
      const isAscii = /^[\x20-\x7E]+$/.test(s);
      if (!isAscii && coreVocab.has(s)) continue;   // 已汉化且是核心用词
      if (!tagStats.has(s)) tagStats.set(s, { mods: new Set(), cells: 0 });
      const rec = tagStats.get(s);
      rec.mods.add(e.name); rec.cells++;
      if (!perMod.has(e.name)) perMod.set(e.name, new Set());
      perMod.get(e.name).add(s);
    }
  }
}

const rows = [...tagStats.entries()].sort((a, b) => b[1].cells - a[1].cells);
console.log('=== 可疑/未汉化 uiTags 标签聚合 ===');
console.log('标签'.padEnd(24) + '格数  出现 mod 数  核心英文有?  已知中文?');
for (const [tag, rec] of rows) {
  const inEn = enVocab.has(tag) ? 'Y' : '-';
  const known = /[\u4e00-\u9fff]/.test(tag) ? 'CJK(非核心词表)' : '-';
  console.log(tag.padEnd(24) + String(rec.cells).padEnd(6) + String(rec.mods.size).padEnd(13) + inEn.padEnd(13) + known);
}
console.log('\n=== 按 mod 汇总 ===');
for (const [mod, set] of [...perMod.entries()].sort()) console.log(mod.padEnd(38) + [...set].join(' | '));
if (jsonArg) fs.writeFileSync(jsonArg, JSON.stringify({ coreVocab: [...coreVocab], tags: rows.map(([t, r]) => ({ tag: t, cells: r.cells, mods: [...r.mods] })) }, null, 1), { encoding: 'utf8' });
