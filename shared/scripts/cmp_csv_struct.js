// cmp_csv_struct.js — 对比「英文基线」与「注入后」CSV 的**解析结构**：行数、每行单元格数、id 序列
// 这是判断注入是否破坏 CSV 结构的权威口径（比"列数=header"更贴合引擎实际解析结果）
// 用法: node cmp_csv_struct.js <基线目录> <注入后目录> <文件相对路径> [更多文件...]
const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./csvlib.js');

const A = process.argv[2], B = process.argv[3];
let bad = 0;
for (const rel of process.argv.slice(4)) {
  const fa = path.join(A, rel), fb = path.join(B, rel);
  const a = parseCsv(fs.readFileSync(fa, 'utf8'));
  const b = parseCsv(fs.readFileSync(fb, 'utf8'));
  const la = fs.readFileSync(fa, 'utf8').split('\n').length;
  const lb = fs.readFileSync(fb, 'utf8').split('\n').length;
  const rowsA = a.rows.length, rowsB = b.rows.length;
  const idIdxA = a.header.indexOf('id') >= 0 ? a.header.indexOf('id') : 0;
  const idIdxB = b.header.indexOf('id') >= 0 ? b.header.indexOf('id') : 0;
  const idsA = a.rows.map(r => (r.cells[idIdxA] || '').trim()).join('|');
  const idsB = b.rows.map(r => (r.cells[idIdxB] || '').trim()).join('|');
  const colMismatch = [];
  const n = Math.min(rowsA, rowsB);
  for (let i = 0; i < n; i++) {
    if (a.rows[i].cells.length !== b.rows[i].cells.length) colMismatch.push(i + ': ' + a.rows[i].cells.length + '→' + b.rows[i].cells.length);
  }
  const ok = rowsA === rowsB && idsA === idsB && colMismatch.length === 0 && la === lb;
  if (!ok) bad++;
  console.log((ok ? 'OK   ' : '!!   ') + rel);
  console.log('     物理行 ' + la + '→' + lb + ' | 解析数据行 ' + rowsA + '→' + rowsB + ' | id 序列一致: ' + (idsA === idsB));
  if (colMismatch.length) console.log('     单元格数不一致行: ' + colMismatch.slice(0, 8).join(', '));
  if (idsA !== idsB) {
    const sa = idsA.split('|'), sb = idsB.split('|');
    for (let i = 0; i < Math.max(sa.length, sb.length); i++) if (sa[i] !== sb[i]) { console.log('     首个 id 差异 @' + i + ': ' + JSON.stringify(sa[i]) + ' → ' + JSON.stringify(sb[i])); break; }
  }
}
console.log(bad ? '\n结论: ' + bad + ' 个文件结构有变化（需检查）' : '\n结论: 全部文件解析结构一致');
process.exit(bad ? 1 : 0);
