// audit_uitags_visibility.js — 逐个「仍有非中文 uiTags」的船插行，打印 hidden/hiddenEverywhere/desc，
// 用于判断该分类标签是否**玩家可见**（用户口径：只要玩家看得见且汉化不报错 → 就应该汉化）。
// 用法: node audit_uitags_visibility.js <modsDir> [--core=<核心data目录>]
const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./csvlib.js');

const argv = process.argv.slice(2);
const modsDir = argv.filter(a => !a.startsWith('--'))[0];
const coreArg = (argv.find(a => a.startsWith('--core=')) || '').slice(7) || 'C:/game/StarSector.v0.9.8a-RC8/starsector-core/data';
if (!modsDir) { console.error('usage: node audit_uitags_visibility.js <modsDir> [--core=<核心data目录>]'); process.exit(2); }

const vocab = new Set();
const coreCsv = path.join(coreArg, 'hullmods', 'hull_mods.csv');
if (fs.existsSync(coreCsv)) {
  const t = parseCsv(fs.readFileSync(coreCsv, 'utf8'));
  const i = t.header.indexOf('uiTags');
  for (const r of t.rows) for (const x of String(r.cells[i] || '').split(',')) {
    const s = x.trim(); if (s && /[\u4e00-\u9fff]/.test(s)) vocab.add(s);
  }
}

for (const e of fs.readdirSync(modsDir, { withFileTypes: true })) {
  if (!e.isDirectory()) continue;
  const csv = path.join(modsDir, e.name, 'data', 'hullmods', 'hull_mods.csv');
  if (!fs.existsSync(csv)) continue;
  const t = parseCsv(fs.readFileSync(csv, 'utf8'));
  const iId = t.header.indexOf('id'), iUi = t.header.indexOf('uiTags'), iN = t.header.indexOf('name');
  const iHid = t.header.indexOf('hidden'), iHE = t.header.indexOf('hiddenEverywhere'), iD = t.header.indexOf('desc');
  const rows = [];
  for (const r of t.rows) {
    // 注释行/模板行（引擎跳过，本审计也跳过）
    if (/^\s*#/.test(String(r.cells[0] === undefined ? '' : r.cells[0]))) continue;
    if (r.cells.some(c => String(c).includes('#'))) continue;
    const raw = String(r.cells[iUi] || '').trim();
    if (!raw) continue;
    const bad = raw.split(',').map(s => s.trim()).filter(s => s && (!vocab.has(s)));
    const ascii = bad.filter(s => /^[\x20-\x7E]+$/.test(s));
    if (!ascii.length) continue;
    rows.push({
      line: r.line, id: String(r.cells[iId] || '').trim(), name: String(r.cells[iN] || '').trim(),
      tag: ascii.join('|'),
      hidden: String(r.cells[iHid] || '').trim(), hiddenEverywhere: String(r.cells[iHE] || '').trim(),
      desc: String(r.cells[iD] || '').trim().slice(0, 70),
    });
  }
  if (!rows.length) continue;
  console.log(`\n=== ${e.name} （${rows.length} 行有英文标签） ===`);
  for (const x of rows) {
    const vis = (x.hidden.toUpperCase() === 'TRUE' || x.hiddenEverywhere.toUpperCase() === 'TRUE') ? '不可见(hidden)' : '★玩家可见';
    console.log(`  L${String(x.line).padStart(3)} ${vis.padEnd(14)} tag=${x.tag.padEnd(12)} id=${x.id}`);
    if (x.desc) console.log(`        名字="${x.name}"  desc="${x.desc}"`);
  }
}
