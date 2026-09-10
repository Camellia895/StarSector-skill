// analyze_jar_strings.js — 解包 jar 类文件常量池分析（通用版）。
// 与姊妹脚本 extract_jar_constants.js 的区别：额外给出“补丁安全”分类——
//   每个 Utf8 常量是否被 CONSTANT_String 引用（asString，= 真实字符串字面量候选），
//   以及是否被 Class/NameAndType/MethodType/Module/Package/Fieldref/Methodref/
//   InterfaceMethodref 引用（asId，= 标识符，禁止替换）。
// 用法：
//   （1）先解包：Add-Type System.IO.Compression.FileSystem;
//        [System.IO.Compression.ZipFile]::ExtractToDirectory("mods\<Mod>\jars\<Mod>.jar", "<tmpDir>")
//   （2）node analyze_jar_strings.js <tmpDir> <outJson>
// 输出：{ "常量文本": { classes:[...], strRefs:[...], asString:bool, asId:bool }, ... }
const fs = require('fs');
const path = require('path');
const { parseClass } = require('./classparser.js');

const JARDIR = process.argv[2];
const OUT = process.argv[3];
if (!JARDIR || !OUT) { console.error('usage: node analyze_jar_strings.js <extractedJarDir> <outJson>'); process.exit(1); }
fs.mkdirSync(path.dirname(OUT), { recursive: true });

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.class')) out.push(p);
  }
  return out;
}

// 解析常量池并记录：哪些 cp 索引被 String(8)/标识符类条目引用
function fullAnalyze(buf) {
  const entries = [null];
  let p = 8;
  let count = (buf[p] << 8) | buf[p + 1]; p += 2;
  for (let i = 1; i < count; i++) {
    const tag = buf[p]; p += 1;
    let operand = null;
    switch (tag) {
      case 1: { const len = (buf[p] << 8) | buf[p + 1]; p += 2; p += len; break; }
      case 3: case 4: p += 4; break;
      case 5: case 6: p += 8; i++; entries.push({ tag }); break;
      case 7: case 8: case 16: case 19: case 20: operand = (buf[p] << 8) | buf[p + 1]; p += 2; break;
      case 9: case 10: case 11: case 12: case 17: case 18:
        operand = (buf[p] << 8) | buf[p + 1]; p += 2;
        operand = (operand << 16) | ((buf[p] << 8) | buf[p + 1]); p += 2;
        break;
      case 15: p += 3; break;
      default: throw new Error('tag ' + tag + ' @' + p);
    }
    entries.push({ tag, operand });
  }
  const isStr = new Set(), isId = new Set();
  for (let i = 1; i < entries.length; i++) {
    const e = entries[i];
    if (e.tag === 8) isStr.add(e.operand);
    if (e.tag === 7) isId.add(e.operand);
    if (e.tag === 9 || e.tag === 10 || e.tag === 11) isId.add(e.operand & 0xFFFF);
    if (e.tag === 12) { isId.add((e.operand >> 16) & 0xFFFF); isId.add(e.operand & 0xFFFF); }
    if (e.tag === 16) isId.add(e.operand);
    if (e.tag === 19 || e.tag === 20) { /* module/package: 名称在 NameAndType 下，已覆盖 */ }
  }
  return { isStr, isId };
}

const files = walk(JARDIR);
const map = new Map();
let totalCp = 0, classCount = 0, parseErr = 0;
for (const f of files) {
  let buf;
  try { buf = fs.readFileSync(f); } catch (e) { continue; }
  let cp;
  try { cp = parseClass(buf).cp; } catch (e) { parseErr++; continue; }
  let refs;
  try { refs = fullAnalyze(buf); } catch (e) { parseErr++; continue; }
  classCount++;
  const rel = path.relative(JARDIR, f).replace(/\\/g, '/');
  for (let i = 1; i < cp.length; i++) {
    const e = cp[i];
    if (e && e.tag === 1) {
      totalCp++;
      if (!map.has(e.str)) map.set(e.str, { classes: new Set(), strClasses: new Set(), asId: false });
      const m = map.get(e.str);
      m.classes.add(rel);
      if (refs.isStr.has(i)) m.strClasses.add(rel);
      if (refs.isId.has(i)) m.asId = true;
    }
  }
}
const out = {};
for (const [s, m] of map) {
  out[s] = { classes: Array.from(m.classes), strRefs: Array.from(m.strClasses), asString: m.strClasses.size > 0, asId: m.asId };
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1), 'utf8');
const vals = Object.values(out);
console.log('classes parsed:', classCount, '(parse errors:', parseErr + ')', 'utf8 entries:', totalCp,
  'unique:', vals.length, '| string-ref candidates:', vals.filter(o => o.asString).length);
