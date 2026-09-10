// check_font_glyphs.js — 中文核心字体字形覆盖预检（Bug C：缺字形 → 游戏显示 "?"）
//
// 背景（详见 <skills>\skills\starsector-engine-diagnose\SKILL.md §3.3，铁律 R3）：
//   中文核心把 6 个字体文件替换为含 CJK 的位图字库（各 ~795KB，约 6742 字形）：
//     starsector-core/graphics/fonts/{insignia15LTaa,insignia21LTaa,insignia25LTaa,victor10,victor14,victor16}.fnt
//   （EN 版同名文件仅 ~27KB、无 CJK）。**字形表未覆盖的字符在游戏内渲染为 "?"**，
//   不会报错、不进日志，属"看得见但查不到"的问题。
//   常见缺字形字符（实测）：「」『』〈〉〔〕（U+300C..U+3015 中部分）、生僻字（如 艏 U+824F）、全角空格 U+3000。
//   有字形的安全替代：【】 《》 （） — … 、 。 ， ： ； ？ ！ · (U+00B7) 与弯引号 “”‘’。
//
// 用法:
//   node check_font_glyphs.js <待检目录或文件> [更多路径...]
//   node check_font_glyphs.js <待检目录> --fonts=<字体目录>     # 默认游戏 fonts 目录
// 退出码: 发现缺字形 → 1；全部覆盖 → 0。
'use strict';
const fs = require('fs');
const path = require('path');

const FONT_DIR_DEFAULT = 'C:/game/StarSector.v0.9.8a-RC8/starsector-core/graphics/fonts';
const FONT_FILES = ['insignia15LTaa.fnt', 'insignia21LTaa.fnt', 'insignia25LTaa.fnt', 'victor10.fnt', 'victor14.fnt', 'victor16.fnt'];

const argv = process.argv.slice(2);
const fontArg = argv.find(a => a.startsWith('--fonts='));
const fontDir = fontArg ? fontArg.slice('--fonts='.length) : FONT_DIR_DEFAULT;
const targets = argv.filter(a => !a.startsWith('--'));
if (!targets.length) { console.error('usage: node check_font_glyphs.js <dir|file> [...] [--fonts=<dir>]'); process.exit(2); }

const sets = [];
for (const f of FONT_FILES) {
  const p = path.join(fontDir, f);
  if (!fs.existsSync(p)) continue;
  const t = fs.readFileSync(p, 'utf8');
  const s = new Set();
  for (const m of t.matchAll(/^char id=(\d+)/gm)) s.add(Number(m[1]));
  sets.push({ name: f, s });
}
if (!sets.length) { console.error('未找到字体文件: ' + fontDir); process.exit(2); }
const union = new Set();
for (const { s } of sets) for (const c of s) union.add(c);
console.log(`字体: ${sets.map(x => x.name).join(', ')} | 字形并集 ${union.size}`);

const TEXT_EXT = /\.(csv|json|faction|ship|skin|variant|skill|system|wpn|proj|txt|md)$/i;
function walk(p, acc = []) {
  const st = fs.statSync(p);
  if (st.isFile()) { if (TEXT_EXT.test(p)) acc.push(p); return acc; }
  for (const e of fs.readdirSync(p, { withFileTypes: true })) walk(path.join(p, e.name), acc);
  return acc;
}
const files = [];
for (const t of targets) { if (fs.existsSync(t)) walk(t, files); else console.error('跳过不存在的路径: ' + t); }

const gaps = new Map(); // cp -> {count, samples[]}
for (const f of files) {
  const t = fs.readFileSync(f, 'utf8');
  const chars = [...t];
  for (let i = 0; i < chars.length; i++) {
    const cp = chars[i].codePointAt(0);
    if (cp < 0x80) continue;                       // ASCII 由英文字体覆盖
    if (union.has(cp)) continue;
    if (!gaps.has(cp)) gaps.set(cp, { count: 0, samples: [] });
    const g = gaps.get(cp);
    g.count++;
    if (g.samples.length < 3) g.samples.push(f + ' :: ' + chars.slice(Math.max(0, i - 10), i + 10).join(''));
  }
}
const arr = [...gaps.entries()].sort((a, b) => b[1].count - a[1].count);
console.log(`扫描文件 ${files.length} | 缺字形字符种类 ${arr.length} | 总出现 ${arr.reduce((s, [, v]) => s + v.count, 0)}`);
for (const [cp, v] of arr) {
  const holders = sets.filter(x => x.s.has(cp)).map(x => x.name.replace('.fnt', ''));
  console.log(`  ${String.fromCodePoint(cp)}  U+${cp.toString(16).toUpperCase().padStart(4, '0')}  x${v.count}  [有字形字体: ${holders.length ? holders.join(',') : '无'}]`);
  v.samples.forEach(s => console.log('      ' + s.slice(0, 150)));
}
// 零宽 / 格式类字符（Cf）：无字形也没关系——渲染为空，**不会显示成 "?"**。
// 与普通缺字形区分开，避免误报"会显示 ?"（实测：官方中文核心 rules.csv 含 U+200B ×3，无实际影响）。
const isZeroWidth = cp =>
  cp === 0x200B || cp === 0x200C || cp === 0x200D || cp === 0xFEFF ||
  (cp >= 0x2060 && cp <= 0x2064) ||
  (cp >= 0x200E && cp <= 0x200F) ||
  (cp >= 0x202A && cp <= 0x202E) ||
  /\p{Cf}/u.test(String.fromCodePoint(cp));

const real = arr.filter(([cp]) => !isZeroWidth(cp));
const zero = arr.filter(([cp]) => isZeroWidth(cp));
if (real.length) console.log('!! 上述字符在游戏内会显示为 "?"；改用【】《》（）等有字形字符，或换成同义常用字。');
if (zero.length) console.log(
  `注意：其中 ${zero.length} 类为零宽/格式字符（如 U+200B），渲染为空、**不会显示成 "?"**，` +
  `无实际影响；建议清理但不阻塞交付。`
);
// 退出码只由"会显示成 ?"的真实缺字形决定 → 避免零宽字符造成假阳性命中（记账口径见 shared\verification-ledger.md）
process.exit(real.length ? 1 : 0);
