// csvcheck.js —— 打印 CSV 表头/列数，并统计指定列的非空取值（只读）
// 用法: node csvcheck.js <file.csv> [列名...]
//
// 关键：使用**完整 CSV 状态机**（处理引号内换行）。本机原版 hull_mods.csv 的 desc 字段就含真实换行
// （295 物理行 vs 152 逻辑行）——用逐行 split(',') 会把行数/列数算错，进而产生大量假断点。
const fs = require('fs');

function parseCsvFull(text) {
  const rows = []; let row = []; let cur = ''; let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (c !== '\r') cur += c;
    }
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

const file = process.argv[2];
if (!file) { console.error('用法: node csvcheck.js <file.csv> [列名...]'); process.exit(2); }
const raw = fs.readFileSync(file, 'utf8');
const rows = parseCsvFull(raw).filter(r => r.length > 1 || (r[0] || '').trim() !== '');
const hdr = rows[0].map(s => s.trim().replace(/^"/, '').replace(/"$/, ''));

const physLines = raw.split(/\r?\n/).length;
console.log(`file: ${file}`);
console.log(`物理行数 ${physLines} / 逻辑行数 ${rows.length}（差值说明引号内有换行）`);
console.log(`header cols: ${hdr.length}   data rows: ${rows.length - 1}`);
console.log('columns: ' + hdr.map((h, i) => `[${i}]${h}`).join(' '));

for (const a of process.argv.slice(3)) {
  const idx = hdr.indexOf(a);
  if (idx < 0) { console.log(`  [${a}] NOT IN HEADER`); continue; }
  const vals = rows.slice(1).map(r => (r[idx] === undefined ? '' : r[idx])).filter(v => v !== '');
  const uniq = [...new Set(vals)];
  console.log(`  [${idx}] ${a}: nonEmpty=${vals.length} uniq=${uniq.length} sample=${uniq.slice(0, 8).join(' | ')}`);
}
