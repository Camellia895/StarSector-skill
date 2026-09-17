// scan_jar_cjk.js — 解包后的 class 目录：找"被译的中文常量"与"单类常量"
//
// 用途（汉化迁移第 0 步取证，见 starsector-mod-localization-migrate §0.0 / §2 第 4 情形）：
//   ① 量旧汉化 jar 的**有效复用面**：哪些常量真被译了（asString && 含 CJK）
//      —— 不是"常量总数"，也不是"含中文的文件数"；
//   ② 量新 jar 的**硬编码残留**：CJK = 0 ⇒ 文案已外置，本次不需要常量池补丁（可写进交付说明）；
//   ③ 单类速查：某条英文/中文出现在哪个类、以什么形态（String 字面量 / 标识符）。
//
// 用法:
//   node scan_jar_cjk.js <解包class目录> [--class=<相对路径或类名>] [--grep=<子串>] [--json=<out.json>]
// 例:
//   node scan_jar_cjk.js _work/mod_work/X/jarwork/old_zh                       # 列出全部含 CJK 的字面量
//   node scan_jar_cjk.js _work/mod_work/X/jarwork/new_en --json=out/new_cjk.json
//   node scan_jar_cjk.js _work/mod_work/X/jarwork/old_zh --class=retroLib/ModPlugin.class
//   node scan_jar_cjk.js _work/mod_work/X/jarwork/new_en --grep=requires
//
// 输出分类:
//   [str] 被 CONSTANT_String 引用且**不被**标识符条目引用 ⇒ 真实字面量（可安全替换的候选）
//   [id]  同时被标识符条目引用（Class/NameAndType/Fieldref/…）⇒ **禁改**（铁律 R7）
// 退出码: 0 = 干净（无 CJK 字面量）；1 = 有命中（便于 run_check.js 记账）
const fs = require('fs');
const path = require('path');
const { parseClass } = require('./classparser.js');

const DIR = process.argv[2];
if (!DIR || DIR === '--help') {
  console.error('usage: node scan_jar_cjk.js <extractedClassDir> [--class=<rel>] [--grep=<substr>] [--json=<out>]');
  process.exit(DIR ? 0 : 2);
}
const opt = (name) => { const a = process.argv.find(s => s.startsWith('--' + name + '=')); return a ? a.slice(name.length + 3) : null; };
const CLS = opt('class');
const GREP = opt('grep');
const JSONOUT = opt('json');

function walk(d) { const o = []; for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) o.push(...walk(p)); else if (e.name.endsWith('.class')) o.push(p); } return o; }

// 常量池引用类型分析：哪些 cp 索引被 String(8) / 标识符类条目引用
function refs(buf) {
  const entries = [null];
  let p = 8;
  const count = (buf[p] << 8) | buf[p + 1]; p += 2;
  for (let i = 1; i < count; i++) {
    const tag = buf[p]; p += 1;
    let operand = null;
    switch (tag) {
      case 1: { const len = (buf[p] << 8) | buf[p + 1]; p += 2; p += len; break; }
      case 3: case 4: p += 4; break;
      case 5: case 6: p += 8; i++; entries.push({ tag }); break;
      case 7: case 8: case 16: case 19: case 20: operand = (buf[p] << 8) | buf[p + 1]; p += 2; break;
      case 9: case 10: case 11: case 12: case 17: case 18: operand = (buf[p] << 8) | buf[p + 1]; p += 2; operand = (operand << 16) | ((buf[p] << 8) | buf[p + 1]); p += 2; break;
      case 15: p += 3; break;
      default: throw new Error('tag ' + tag);
    }
    entries.push({ tag, operand });
  }
  const isStr = new Set(), isId = new Set();
  for (let i = 1; i < entries.length; i++) {
    const e = entries[i];
    if (!e) continue;
    if (e.tag === 8) isStr.add(e.operand);
    if (e.tag === 7) isId.add(e.operand);
    if (e.tag === 9 || e.tag === 10 || e.tag === 11) isId.add(e.operand & 0xFFFF);
    if (e.tag === 12) { isId.add((e.operand >> 16) & 0xFFFF); isId.add(e.operand & 0xFFFF); }
    if (e.tag === 16) isId.add(e.operand);
  }
  return { isStr, isId };
}

const files = CLS ? walk(DIR).filter(f => path.relative(DIR, f).replace(/\\/g, '/').toLowerCase() === CLS.replace(/\\/g, '/').toLowerCase() || path.basename(f) === path.basename(CLS)) : walk(DIR);
if (!files.length) { console.error('no class matched:', CLS || DIR); process.exit(2); }

const cjkHits = [];
let classes = 0, utf8 = 0, asString = 0;
for (const f of files) {
  const rel = path.relative(DIR, f).replace(/\\/g, '/');
  let buf, cp, rf;
  try { buf = fs.readFileSync(f); cp = parseClass(buf).cp; rf = refs(buf); } catch (e) { continue; }
  classes++;
  const seen = new Set();
  for (let i = 1; i < cp.length; i++) {
    const e = cp[i];
    if (!e || e.tag !== 1 || seen.has(e.str)) continue;
    seen.add(e.str);
    utf8++;
    const isStr = rf.isStr.has(i);
    if (isStr) asString++;
    if (CLS) console.log((isStr ? (rf.isId.has(i) ? '[id] ' : '[str]') : '[   ]') + ' ' + JSON.stringify(e.str));
    if (isStr && /[\u4e00-\u9fff]/.test(e.str)) cjkHits.push({ s: e.str, cls: rel, asId: rf.isId.has(i) });
  }
}

if (JSONOUT) fs.writeFileSync(JSONOUT, JSON.stringify(cjkHits, null, 1), 'utf8');

if (!CLS) {
  console.log(`classes ${classes} | 唯一 Utf8 ${utf8} | string-ref 候选 ${asString} | **含 CJK 的字面量 ${cjkHits.length}**`);
  for (const h of cjkHits) console.log((h.asId ? '[id!] ' : '      ') + JSON.stringify(h.s) + '   <= ' + h.cls);
}
if (GREP) {
  console.log(`--- grep "${GREP}" ---`);
  for (const f of files) {
    let cp; try { cp = parseClass(fs.readFileSync(f)).cp; } catch (e) { continue; }
    const seen = new Set();
    for (let i = 1; i < cp.length; i++) { const e = cp[i]; if (e && e.tag === 1 && !seen.has(e.str) && e.str.includes(GREP)) { seen.add(e.str); console.log('  ' + path.relative(DIR, f).replace(/\\/g, '/') + ' :: ' + JSON.stringify(e.str)); } }
  }
}
process.exit(cjkHits.length ? 1 : 0);
