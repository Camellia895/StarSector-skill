// check_eol.js — 行尾风格审计：注入后目录 vs 英文基线，逐文件比较行尾风格必须全等。
//
// 为什么需要（铁律 R17，San-Iris 1.1.0 实测事故）：
//   注入器整文件重写 CSV 时若硬编码 CRLF，而该 mod 的 data 文件其实是 LF-only
//   （与原版核心 CRLF 相反），就会把 10 个 CSV 改风格；rules.csv 这类含多行引号单元格的
//   文件更会变成【混合行尾】（单元格内 LF + 物理行 CRLF）。
//   `cmp_csv_struct.js` **查不出来** —— 它按解析结果比对，行尾被吞掉一样"结构一致"。
//   本脚本按**原始字节**分类行尾，是"结构一致"之外的必要补充。
//
// 比较三项：CRLF 数 / 单独 LF 数 / 是否以换行结尾。三者全等才算通过。
//
// 用法:
//   node check_eol.js <基线目录> <注入后目录> [扩展名...]
//     <基线目录>   英文原版 mod 目录（或其 data 目录）
//     <注入后目录> 注入后的 mod 目录（或其 data 目录）
//     [扩展名]     默认 .csv；可传 .json .faction .ship .variant 等
//   node check_eol.js --help
// 退出码: 0 = 行尾风格完全一致；1 = 存在不一致；2 = 参数错误
const fs = require('node:fs');
const path = require('node:path');

const argv = process.argv.slice(2);
if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
  console.log('usage: node check_eol.js <baselineDir> <injectedDir> [ext...]');
  console.log('  比较 CRLF 数 / 单独 LF 数 / 是否以换行结尾，三者全等才算一致。');
  process.exit(argv.length ? 0 : 2);
}
const EXT = argv.slice(2).map((e) => (e.startsWith('.') ? e.toLowerCase() : '.' + e.toLowerCase()));
const exts = EXT.length ? EXT : ['.csv'];
const [A, B] = argv;
if (!A || !B) { console.error('缺少参数：见 --help'); process.exit(2); }
for (const [n, p] of [['基线目录', A], ['注入后目录', B]]) {
  if (!fs.existsSync(p)) { console.error(`${n} 不存在: ${p}`); process.exit(2); }
}

// 允许直接传 mod 根或其 data 目录：以文件名相对化，两边各挑能对上的根
function rootOf(p) {
  return fs.existsSync(path.join(p, 'data')) ? p : path.dirname(p);
}
const RA = rootOf(A), RB = rootOf(B);

function stats(p) {
  const b = fs.readFileSync(p, 'utf8');
  const crlf = (b.match(/\r\n/g) || []).length;
  const lf = (b.match(/\n/g) || []).length;
  return { crlf, loneLf: lf - crlf, finalEol: /\r?\n$/.test(b) };
}

const files = [];
(function walk(dir, rel = '') {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) walk(path.join(dir, e.name), r);
    else if (exts.includes(path.extname(e.name).toLowerCase())) files.push(r);
  }
})(A, '');

let checked = 0, mismatches = 0;
const byStyle = { crlf: 0, lf: 0 };
for (const rel of files.sort()) {
  const pb = path.join(RB, rel);
  if (!fs.existsSync(pb)) { console.log(`MISSING-IN-B ${rel}`); mismatches++; continue; }
  const a = stats(path.join(RA, rel));
  const b = stats(pb);
  checked++;
  if (a.crlf > 0) byStyle.crlf++; else byStyle.lf++;
  const same = a.crlf === b.crlf && a.loneLf === b.loneLf && a.finalEol === b.finalEol;
  if (!same) {
    mismatches++;
    console.log(`DIFF ${rel}`);
    console.log(`     baseline: crlf=${a.crlf} loneLF=${a.loneLf} finalEol=${a.finalEol}`);
    console.log(`     injected: crlf=${b.crlf} loneLF=${b.loneLf} finalEol=${b.finalEol}`);
  }
}
console.log(`\nfiles checked: ${checked} (CRLF-style ${byStyle.crlf} / LF-style ${byStyle.lf})`);
console.log(`line-ending mismatches: ${mismatches}`);
console.log(mismatches === 0 ? '✓ 行尾风格与基线完全一致' : '✗ 存在行尾风格变化（会静默改变文件字节风格）');
process.exit(mismatches === 0 ? 0 : 1);
