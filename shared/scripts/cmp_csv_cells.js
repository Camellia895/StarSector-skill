// cmp_csv_cells.js — 逐格对比英文基线与注入后文件：报告差异格数，并核对差异都在待译清单内
// 用法: node cmp_csv_cells.js <基线目录> <注入后目录> <worklistDir> <文件...>
const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./csvlib.js');

const A = process.argv[2], B = process.argv[3], WL = process.argv[4];
const files = process.argv.slice(5);

// 收集 (file,id,原值) 白名单
const allowed = new Set();
for (const f of fs.readdirSync(WL).filter(x => /^\d.*\.json$/.test(x))) {
  for (const e of JSON.parse(fs.readFileSync(path.join(WL, f), 'utf8'))) {
    if (e.c !== undefined) continue;
    allowed.add(e.file + '\u0000' + e.id + '\u0000' + String(e.en).trim());
  }
}
let totalDiff = 0, unexplained = 0;
for (const rel of files) {
  const a = parseCsv(fs.readFileSync(path.join(A, rel), 'utf8'));
  const b = parseCsv(fs.readFileSync(path.join(B, rel), 'utf8'));
  const idIdx = a.header.indexOf('id') >= 0 ? a.header.indexOf('id') : a.header.indexOf('fieldID');
  let diff = 0;
  const detail = [];
  for (let i = 0; i < Math.min(a.rows.length, b.rows.length); i++) {
    const id = String(a.rows[i].cells[idIdx] || '').trim();
    for (let c = 0; c < a.header.length; c++) {
      const va = String(a.rows[i].cells[c] === undefined ? '' : a.rows[i].cells[c]);
      const vb = String(b.rows[i].cells[c] === undefined ? '' : b.rows[i].cells[c]);
      if (va === vb) continue;
      diff++;
      // 差异格：值必须能在清单里找到（整格 en==va，或 rules 子串 va.includes(en)）
      const ok = [...allowed].some(k => {
        const [kf, kid, ken] = k.split('\u0000');
        if (kf !== rel || kid !== id) return false;
        return va.trim() === ken || va.includes(ken);
      });
      if (!ok) { unexplained++; detail.push('  未登记差异: id=' + id + ' 列=' + a.header[c] + ' 原=' + JSON.stringify(va.slice(0, 60)) + ' 新=' + JSON.stringify(vb.slice(0, 60))); }
    }
  }
  totalDiff += diff;
  console.log((diff ? 'OK  ' : '!!  ') + rel + ' 差异格数=' + diff + (diff ? '' : '（无变化，异常）'));
  for (const d of detail.slice(0, 10)) console.log(d);
}
console.log('---');
console.log('总差异格数: ' + totalDiff + ' | 未登记差异: ' + unexplained);
process.exit(unexplained ? 1 : 0);
