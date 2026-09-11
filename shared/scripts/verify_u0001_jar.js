// verify_u0001_jar.js — 补丁后校验（铁律 R6）：补丁目录里每个含 \u0001 的字符串常量，
// 其 \u0001 数量必须与"原文"（未被改动的原常量，或被替换译文的键）一致。
// 用法:
//   node verify_u0001_jar.js <jarConstants.json> <translations.json> <classDir>
//     <jarConstants.json> 原始 jar 的常量清单（extract_jar_constants.js 产物）
//     <translations.json> EN→ZH 映射
//     <classDir>          补丁后的解包目录（含 .class）
//   node verify_u0001_jar.js --help
// 退出码: 0 = 全部一致；1 = 存在不一致/无法溯源（便于 run_check.js 记账）
const fs = require('fs');
const path = require('path');
const { walkCp, decodeModifiedUtf8 } = require('./patcher.js');

const argv = process.argv.slice(2);
if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
  console.log('usage: node verify_u0001_jar.js <jarConstants.json> <translations.json> <classDir>');
  process.exit(argv.length ? 0 : 2);
}
const pos = argv.filter(a => !a.startsWith('--'));
const [jcFile, tcFile, dir] = pos;
for (const [label, p] of [['jarConstants', jcFile], ['translations', tcFile], ['classDir', dir]]) {
  if (!p) { console.error('缺少参数 ' + label + '：见 --help'); process.exit(2); }
  if (!fs.existsSync(p)) { console.error(label + ' 不存在: ' + p); process.exit(2); }
}
const jcRaw = JSON.parse(fs.readFileSync(jcFile, 'utf8'));
const jc = new Set(Object.keys(jcRaw));
const tc = JSON.parse(fs.readFileSync(tcFile, 'utf8'));
const count = s => (s.match(/\u0001/g) || []).length;
// reverse map: zh -> set of en keys
const zhToEn = new Map();
for (const [en, zh] of Object.entries(tc)) {
  if (!zh.includes('\u0001')) continue;
  if (!zhToEn.has(zh)) zhToEn.set(zh, []);
  zhToEn.get(zh).push(en);
}

function walk(d) {
  const out = [];
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.class')) out.push(p);
  }
  return out;
}

let checked = 0, bad = 0;
const badList = [];
for (const f of walk(dir)) {
  let buf, cp;
  try { buf = fs.readFileSync(f); cp = walkCp(buf); } catch (e) { continue; }
  const rel = path.relative(dir, f).replace(/\\/g, '/');
  for (const u of cp.utf8s) {
    if (!cp.stringRefs.has(u.index)) continue;
    const s = decodeModifiedUtf8(u.bytes);
    if (!s.includes('\u0001')) continue;
    checked++;
    let origText = null;
    if (jc.has(s)) {
      origText = s; // untouched original
    } else if (zhToEn.has(s)) {
      origText = zhToEn.get(s)[0]; // replaced by translation; its key is the original text
    }
    if (origText === null) {
      bad++; badList.push({ class: rel, text: s.slice(0, 80), note: 'cannot resolve original' });
      continue;
    }
    if (count(origText) !== count(s)) {
      bad++;
      badList.push({ class: rel, text: s.slice(0, 80), orig: count(origText), patched: count(s) });
    }
  }
}
console.log('classDir:', dir);
console.log('checked \\u0001 string constants:', checked);
console.log('count mismatches vs original:', bad);
if (badList.length) console.log(JSON.stringify(badList.slice(0, 15), null, 1));
process.exit(bad ? 1 : 0);

