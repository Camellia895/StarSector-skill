// fix_csv_eol.js v3 — 对行尾风格被破坏的 CSV 做字节级修复：
//   1) 从基线恢复原文件字节（保留全部原始行尾风格）
//   2) 逐字符 RFC4180 解析：span 含单元格两侧引号（若有）
//   3) 按 worklist (id, field) 精确替换单元格；单元格内换行沿用原单元格风格
const fs = require('fs');
const path = require('path');
const MOD = process.argv[2];
const BAK = process.argv[3];
const WL = process.argv[4];
const FILES = process.argv.slice(5);
const ID_COL = {
  'data/strings/descriptions.csv': 'id', 'data/config/vayraBounties/unique_bounty_data.csv': 'bounty_id',
  'data/config/vayraProcgenEntities/lore_objects.csv': 'unique_id', 'data/console/commands.csv': 'command',
  'data/config/vayraBounties/rare_flagships.csv': 'bounty',
};

function walk(raw) {
  const recs = [];
  let i = 0; const n = raw.length;
  let cells = [], spans = [], quotes = [], recStart = 0, cur = '', curStart = 0, inQ = false, cellQ = false;
  const pushCell = end => { cells.push(cur); spans.push([curStart, end]); quotes.push(cellQ); cur = ''; cellQ = false; };
  const pushRec = end => { recs.push({ cells, spans, quotes, recStart, recEnd: end }); cells = []; spans = []; quotes = []; recStart = end; };
  while (i < n) {
    const c = raw[i];
    if (inQ) {
      if (c === '"') { if (raw[i + 1] === '"') { cur += '"'; i += 2; continue; } inQ = false; i++; continue; }
      cur += c; i++; continue;
    }
    if (c === '"') { inQ = true; cellQ = true; curStart = i; i++; continue; }
    if (c === ',') { pushCell(i); i++; continue; }
    if (c === '\r' && raw[i + 1] === '\n') { pushCell(i); pushRec(i + 2); i += 2; continue; }
    if (c === '\n') { pushCell(i); pushRec(i + 1); i++; continue; }
    if (cur === '') curStart = i;
    cur += c; i++;
  }
  if (cur !== '' || cells.length) { pushCell(n); pushRec(n); }
  return recs;
}
const unq = (t, q) => q ? t.slice(1, -1).replace(/""/g, '"') : t;

let entries = [];
for (const f of fs.readdirSync(WL).filter(x => x.endsWith('.json') && !/excluded/.test(x))) {
  const arr = JSON.parse(fs.readFileSync(path.join(WL, f), 'utf8'));
  if (Array.isArray(arr)) entries.push(...arr);
}
const byFile = new Map();
for (const e of entries) if (FILES.includes(e.file) && e.zh && e.zh !== e.en) byFile.set(e.file, (byFile.get(e.file) || []).concat(e));

for (const file of FILES) {
  const list = byFile.get(file);
  if (!list || !list.length) { console.log(file, 'no entries'); continue; }
  const raw = fs.readFileSync(path.join(BAK, file), 'utf8');
  const recs = walk(raw);
  const header = recs[0];
  const idCol = ID_COL[file] || 'id';
  const idIdx = header.cells.findIndex((t, ci) => unq(t, header.quotes[ci]) === idCol);
  const rows = [];
  for (let k = 1; k < recs.length; k++) {
    const r = recs[k];
    const id = r.cells[idIdx] !== undefined ? unq(r.cells[idIdx], r.quotes[idIdx]).trim() : '';
    if (id.startsWith('#')) continue;
    rows.push({ r, id });
  }
  const edits = [];
  let miss = 0;
  for (const e of list) {
    const field = e.field.replace(/\(.*\)$/, '');
    const colIdx = header.cells.findIndex((t, ci) => unq(t, header.quotes[ci]) === field);
    if (colIdx < 0) { console.log('  MISS col', file, field); miss++; continue; }
    const hit = rows.find(x => x.id === e.id);
    if (!hit) { console.log('  MISS row', file, e.id); miss++; continue; }
    const span = hit.r.spans[colIdx];
    const wasQuoted = hit.r.quotes[colIdx];
    const absStart = span[0];
    const absEnd = span[1];
    const orig = raw.slice(absStart, absEnd);
    const origContent = unq(orig, wasQuoted);
    let zh = e.zh;
    if (origContent.includes('\r\n')) zh = zh.replace(/\r?\n/g, '\r\n');
    else if (/(^|[^\r])\n/.test(origContent)) zh = zh.replace(/\r?\n/g, '\n');
    const needQuote = wasQuoted || /["\n,]/.test(zh) || /\r/.test(zh);
    const newCell = needQuote ? '"' + zh.replace(/"/g, '""') + '"' : zh;
    if (edits.some(x => x[0] === absStart && x[1] === absEnd)) continue;
    edits.push([absStart, absEnd, newCell, e.id + '&' + field]);
  }
  edits.sort((a, b) => b[0] - a[0]);
  let result = raw;
  for (const [s, t, rep] of edits) result = result.slice(0, s) + rep + result.slice(t);
  fs.writeFileSync(path.join(MOD, file), result, 'utf8');
  console.log(file, 'cells replaced:', edits.length, 'miss:', miss);
}
