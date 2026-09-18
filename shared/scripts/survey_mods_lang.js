// survey_mods_lang.js — 快速判定每个 mod 是否已汉化（抽样数据文件的中文占比）
// 用法: node survey_mods_lang.js <modsDir>
const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./csvlib.js');

const modsDir = process.argv[2];
if (!modsDir) { console.error('usage: node survey_mods_lang.js <modsDir>'); process.exit(2); }

function cjkRatio(s) {
  const cjk = (s.match(/[\u4e00-\u9fff]/g) || []).length;
  const letters = (s.match(/[A-Za-z\u4e00-\u9fff]/g) || []).length;
  return letters ? cjk / letters : 0;
}

const out = [];
for (const e of fs.readdirSync(modsDir, { withFileTypes: true })) {
  if (!e.isDirectory()) continue;
  const root = path.join(modsDir, e.name);
  const probes = [];
  // hullmods name/desc
  const hm = path.join(root, 'data/hullmods/hull_mods.csv');
  if (fs.existsSync(hm)) {
    try {
      const { header, rows } = parseCsv(fs.readFileSync(hm, 'utf8'));
      const iN = header.indexOf('name'), iD = header.indexOf('desc');
      for (const r of rows.slice(0, 40)) {
        if (r.cells[iN]) probes.push(r.cells[iN]);
        if (iD >= 0 && r.cells[iD]) probes.push(String(r.cells[iD]).slice(0, 120));
      }
    } catch { }
  }
  // descriptions
  const ds = path.join(root, 'data/strings/descriptions.csv');
  if (fs.existsSync(ds)) {
    try {
      const { header, rows } = parseCsv(fs.readFileSync(ds, 'utf8'));
      const i1 = header.findIndex(h => /^text\d$/.test(h));
      if (i1 >= 0) for (const r of rows.slice(0, 40)) if (r.cells[i1]) probes.push(String(r.cells[i1]).slice(0, 120));
    } catch { }
  }
  const text = probes.join('\n');
  if (!text) continue;
  out.push({ mod: e.name, ratio: cjkRatio(text), samples: probes.length });
}
out.sort((a, b) => b.ratio - a.ratio);
console.log('mod'.padEnd(40) + 'CJK占比  采样段');
for (const o of out) console.log(o.mod.padEnd(40) + (o.ratio * 100).toFixed(1).padStart(6) + '%  ' + o.samples);
