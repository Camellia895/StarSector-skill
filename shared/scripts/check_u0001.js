// check_u0001.js — 映射层校验（铁律 R6）：含 \u0001 的键与其译文的 \u0001 **数量必须一致**。
// 用法:
//   node check_u0001.js <translations.json> [outJson|-]
//     <translations.json> EN→ZH 映射（{ "原文": "译文" }）
//     [outJson|-]         不匹配项落盘路径；默认 <translations.json 所在目录>/u0001_mismatch.json，"-" 表示不写文件
//   node check_u0001.js --help
// 退出码: 0 = 数量全部一致；1 = 存在不匹配（便于 run_check.js 记账）
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
  console.log('usage: node check_u0001.js <translations.json> [outJson|-]');
  process.exit(argv.length ? 0 : 2);
}
const pos = argv.filter(a => !a.startsWith('--'));
const tcFile = pos[0];
if (!tcFile || !fs.existsSync(tcFile)) { console.error('translations 不存在: ' + tcFile); process.exit(2); }
const outArg = pos[1] === undefined ? path.join(path.dirname(path.resolve(tcFile)), 'u0001_mismatch.json') : pos[1];
const tc = JSON.parse(fs.readFileSync(tcFile, 'utf8'));

const count = s => (s.match(/\u0001/g) || []).length;
let bad = [];
let totalU = 0;
for (const [k, v] of Object.entries(tc)) {
  const kc = count(k), vc = count(v);
  if (kc > 0 || vc > 0) {
    totalU++;
    if (kc !== vc) bad.push({ key: k, keyCount: kc, zhCount: vc, zh: v });
  }
}
console.log('translations:', tcFile);
console.log('entries containing \\u0001:', totalU);
console.log('MISMATCHED count:', bad.length);
if (outArg !== '-') {
  fs.mkdirSync(path.dirname(path.resolve(outArg)), { recursive: true });
  fs.writeFileSync(outArg, JSON.stringify(bad, null, 1), 'utf8');
  console.log('->', outArg);
}
for (const b of bad) {
  console.log('--- key has ' + b.keyCount + ', zh has ' + b.zhCount);
  console.log('KEY:', JSON.stringify(b.key).slice(0, 90));
  console.log('ZH :', JSON.stringify(b.zh).slice(0, 90));
}
process.exit(bad.length ? 1 : 0);

