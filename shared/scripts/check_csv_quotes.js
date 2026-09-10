// Fast pre-check for data CSVs the game will parse (rules.csv etc.):
//  1. counts curly quotes (a game normalization turns them into ASCII quotes before parse)
//  2. simulates that normalization + RFC4180 parse and flags rows whose cell count is
//     lower than the header row (missing trailing columns -> engine JSON key errors)
//  3. reports row-count delta vs an optional baseline file (e.g. the EN original)
// Usage: node check_csv_quotes.js <file.csv> [baseline.csv]
'use strict';
const fs = require('fs');

const file = process.argv[2];
const baselineFile = process.argv[3];
if (!file) { console.error('usage: node check_csv_quotes.js <file.csv> [baseline.csv]'); process.exit(1); }

const text = fs.readFileSync(file, 'utf8');

// 1) curly quote census (per the game's normalization list)
const curlyD = (text.match(/[\u201c\u201d]/g) || []).length;
const curlyS = (text.match(/[\u2018\u2019\ufffd]/g) || []).length;
console.log(`curly double quotes “”: ${curlyD}   curly single ‘’/replacement: ${curlyS}`);

// 2) simulate game normalization then RFC4180 parse
function parse(raw) {
  const rows = [];
  let cur = [], field = '', inQ = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (inQ) {
      if (c === '"') { if (raw[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { cur.push(field); field = ''; }
      else if (c === '\n') { cur.push(field); field = ''; rows.push(cur); cur = []; }
      else if (c !== '\r') field += c;
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  return rows;
}
function gameParse(t) {
  t = t.replace(/[\u201c\u201d]+/g, '"').replace(/[\u2018\u2019\ufffd]+/g, "'");
  return parse(t);
}
const rows = gameParse(text).filter(r => r.length && r[0] !== 'id' && r[0].trim() !== '' && !r[0].trim().startsWith('#'));
const headerCount = parse(text)[0].length;
let bad = 0;
for (const r of rows) {
  if (r.length < headerCount) {
    bad++;
    console.log(`  [SHORT-ROW] id=${r[0] || '(empty)'} cells=${r.length} < header=${headerCount}`);
  }
}
console.log(`data rows: ${rows.length} | rows shorter than header: ${bad}`);
if (bad > 0) console.log('!! some rows lost trailing columns after normalization -> the engine would throw (e.g. JSONObject["options"] not found)');

// 3) baseline comparison
if (baselineFile) {
  const base = gameParse(fs.readFileSync(baselineFile, 'utf8')).filter(r => r.length && r[0] !== 'id' && r[0].trim() !== '' && !r[0].trim().startsWith('#'));
  console.log(`baseline rows: ${base.length} (this file: ${rows.length}) -> ${rows.length === base.length ? 'OK same' : 'WARN differ (rows split/merged?)'}`);
}
