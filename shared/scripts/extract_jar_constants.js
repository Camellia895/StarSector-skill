// extract_jar_constants.js — 提取解包后 jar 目录内全部 class 的 Utf8 常量（去重）。
// 输出形态：{ "常量文本": ["相对/类路径.class", ...] }（供 sweep_sentences.js / verify_u0001_jar.js 消费）。
// 用法:
//   node extract_jar_constants.js <jarDir> [outJson]
//     <jarDir>  解包后的 jar 目录（含 .class）
//     [outJson] 输出路径；省略时写到 <jarDir>/../jar_constants.json
//   node extract_jar_constants.js --help
// 相关：需要"补丁安全性分类"（asString/asId）请用 analyze_jar_strings.js。
const fs = require('fs');
const path = require('path');
const { parseClass } = require('./classparser.js');

const args = process.argv.slice(2);
if (!args.length || args.includes('--help') || args.includes('-h')) {
  console.log('usage: node extract_jar_constants.js <jarDir> [outJson]');
  console.log('  <jarDir>  解包后的 jar 目录（含 .class）');
  console.log('  [outJson] 默认 <jarDir>/../jar_constants.json');
  process.exit(args.length ? 0 : 2);
}
const JARCHECK = args[0];
if (!fs.existsSync(JARCHECK)) { console.error('jarDir 不存在: ' + JARCHECK); process.exit(2); }
const OUT = args[1] || path.join(JARCHECK, '..', 'jar_constants.json');

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.class')) out.push(p);
  }
  return out;
}

const files = walk(JARCHECK);
const map = new Map(); // const -> Set<class rel>
let total = 0;
let parseFail = 0;
for (const f of files) {
  let buf;
  try { buf = fs.readFileSync(f); } catch (e) { continue; }
  let cp;
  try { cp = parseClass(buf).cp; } catch (e) { parseFail++; continue; }
  const rel = path.relative(JARCHECK, f).replace(/\\/g, '/');
  for (const e of cp) {
    if (e && e.tag === 1) {
      total++;
      if (!map.has(e.str)) map.set(e.str, new Set());
      map.get(e.str).add(rel);
    }
  }
}
const out = {};
for (const [s, cls] of map) out[s] = Array.from(cls);
fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1), 'utf8');
console.log('jarDir:', JARCHECK);
console.log('classes:', files.length, '(parse fail: ' + parseFail + ')', 'utf8 entries:', total, 'unique constants:', Object.keys(out).length);
console.log('->', OUT);

