// check_homoglyphs.js — **同形异义字符**探测（yellow 级，G1/G3）。
//
// 问题：西里尔/希腊字母与拉丁字母外观相同（`е`U+0435 vs `e`U+0065、`о`U+043E vs `o`）。
//   真实事故：上游 `skill_data.csv` 的描述里混入 2 个西里尔 `е`，伪装成 "your hеad"、"give mе"。
//   后果：① 中文核心字库**无该字形** → 游戏内显示 `?`（无报错、无日志，最易被当成"翻译没生效"）；
//        ② 让英文检索/替换**静默失败**（人眼看不出差异，grep 也搜不到）；
//        ③ 译者若照抄，会把问题带进成品。
//
// 判据：一行里同时出现"拉丁词"与"西里尔/希腊/亚美尼亚等近似字母集"的字符 → 可疑，单列出来。
//   只报"混在拉丁词里"的，纯非拉丁文本（如正常中文/俄文行）不报。
//
// 用法:
//   node check_homoglyphs.js <data目录或文件...> [outJson|-]
//   node check_homoglyphs.js --help
// 退出码: 0 = 无可疑；1 = 有可疑行；2 = 调用错误
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
  console.log('usage: node check_homoglyphs.js <data目录或文件...> [outJson|-]');
  console.log('检出"看起来像拉丁字母其实是西里尔/希腊字母"的字符（字库缺字形 → 显示 ?，且检索静默失败）');
  process.exit(argv.length ? 0 : 2);
}
const pos = argv.filter(a => !a.startsWith('--'));
const OUT = (pos.length > 1 && (pos[pos.length - 1] === '-' || /\.json$/i.test(pos[pos.length - 1])))
  ? pos.pop() : null;
if (!pos.length) { console.error('需要至少一个 <data目录或文件>'); process.exit(2); }

// 与拉丁字母易混的码位区间
const RANGES = [
  ['西里尔', 0x0400, 0x04FF],
  ['希腊', 0x0370, 0x03FF],
  ['亚美尼亚', 0x0530, 0x058F],
  ['希伯来', 0x0590, 0x05FF],
  ['阿拉伯', 0x0600, 0x06FF],
];
// 全角**字母/数字**单独判断：不能把 U+FF01–FF5E 整段当可疑——
// 那里面含中文全角标点（，。：；等），是**正常中文书写**，整段取会全表误报（实测 420 行误报）。
const isFullwidthAlnum = cp =>
  (cp >= 0xFF21 && cp <= 0xFF3A) ||   // Ａ-Ｚ
  (cp >= 0xFF41 && cp <= 0xFF5A) ||   // ａ-ｚ
  (cp >= 0xFF10 && cp <= 0xFF19);     // ０-９
const classify = cp => {
  for (const [name, lo, hi] of RANGES) if (cp >= lo && cp <= hi) return name;
  if (isFullwidthAlnum(cp)) return '全角字母/数字';
  return null;
};

const EXT = /\.(csv|json|faction|ship|skin|variant|system|wpn|proj|txt|version|skill)$/i;
function walk(p, out = []) {
  const st = fs.statSync(p);
  if (!st.isDirectory()) { if (EXT.test(p)) out.push(p); return out; }
  for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    const q = path.join(p, e.name);
    if (e.isDirectory()) walk(q, out);
    else if (EXT.test(e.name)) out.push(q);
  }
  return out;
}
let targets = [];
for (const p of pos) {
  if (!fs.existsSync(p)) { console.error('不存在: ' + p); process.exit(2); }
  targets = targets.concat(walk(p));
}
if (!targets.length) { console.error('没有可扫描的文本文件（扩展名清单见脚本头部）'); process.exit(2); }

const hits = [];
for (const f of targets) {
  let raw;
  try { raw = fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, ''); } catch (e) { continue; }
  const lines = raw.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, '');
    if (!/[A-Za-z]{2,}/.test(line)) continue;              // 必须有拉丁词才判"混入"
    const found = [];
    for (const ch of line) {
      const cp = ch.codePointAt(0);
      if (cp < 0x80) continue;
      const k = classify(cp);
      if (k) found.push({ ch, cp, k });
    }
    if (!found.length) continue;
    const annot = [...line].map(c => {
      const cp = c.codePointAt(0);
      return classify(cp) ? `«${c}=U+${cp.toString(16).toUpperCase()} ${classify(cp)}»` : c;
    }).join('');
    hits.push({
      file: f, line: i + 1,
      chars: found.map(x => `${x.ch} U+${x.cp.toString(16).toUpperCase()} (${x.k})`).join(', '),
      annotated: annot.slice(0, 400),
    });
  }
}

console.log('=== 同形异义字符探测 ===');
console.log(`扫描 ${targets.length} 个文件，命中 ${hits.length} 行\n`);
for (const h of hits.slice(0, 60)) {
  console.log(`  ${h.file}:${h.line}`);
  console.log(`     ${h.chars}`);
  console.log(`     ${JSON.stringify(h.annotated)}`);
}
if (hits.length > 60) console.log(`  …还有 ${hits.length - 60} 行`);
console.log('');
if (!hits.length) console.log('✓ 无可疑同形字符');
else {
  console.log('处置：把可疑字符换成对应拉丁字母（或改写成中文）；');
  console.log('      若是**上游原文**自带，译文整段替换后自然消失，不必单独改原文。');
}
if (OUT && OUT !== '-') { fs.writeFileSync(OUT, JSON.stringify(hits, null, 1), 'utf8'); console.log('written ' + OUT); }
process.exit(hits.length ? 1 : 0);
