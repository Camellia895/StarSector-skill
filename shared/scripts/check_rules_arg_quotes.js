// check_rules_arg_quotes.js — rules.csv 命令参数内嵌引号预检（Bug B：不崩溃、但文本截断）
//
// 背景（详见 <skills>\skills\starsector-engine-diagnose\SKILL.md §3.2，铁律 R2）：
//   rules.csv 的 script 列是"命令文本"（如 `AddText "..." textBlueColor`、`SetTooltip id "..."`）。
//   规则解释器把命令字符串参数取到**第一对引号**为止：
//     - 引擎读 CSV 前会把弯引号 “”→"、‘’→'（与汉化合并器写入前归一化一致）；
//     - 因此命令参数内若出现会被归一化成 ASCII `"` 的弯引号、或直接写 ASCII `"`，
//       解释器会在第一个内嵌引号处截断 → 游戏里只显示前半句（无崩溃、难察觉）。
//   纯文本列（text/options 显示文本）不受此限制（原版自身就常含引号，显示层安全）。
//   需要中文强调观感时用 【】（有字形、不与命令引号冲突；「」无字形，见 R3）。
//
// 三道检测：
//   1. 严格 RFC4180 结构解析：未加引号字段中段出现 " / 引号未闭合 → 文件结构已被破坏。
//   2. script 列弯引号计数（归一化后必然变 ASCII 引号 → 必然截断）。
//   3. 每行命令的引号**配对**检查：引号数必须为**偶数**（= 成对）。
//
// ★ 关于第 3 道的口径修正（2026-09，真实误报）：
//   旧版用"一行 >2 个引号即 SUSPECT"，把**合法多参数命令**全判成问题。实测原版 rules.csv 有：
//       SetTextHighlights "who reminds oblivion of what used to be?" "die." "never"
//   这是 3 个独立的字符串参数（6 个引号），英文原版就这样，完全合法。
//   因此改为：**奇数个引号**才是真问题（未成对 → 解释器读到一半就是行尾）；
//   偶数个引号只是"多参数"，单独统计为 INFO，不再计入命中。
//
// 用法:  node check_rules_arg_quotes.js <rules.csv> [--show-info]
// 期望:  0 结构问题 + 0 疑似内嵌（奇数引号行） + script 列 0 弯引号 → exit 0。
'use strict';
const fs = require('fs');
const argv = process.argv.slice(2);
if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
  console.log('usage: node check_rules_arg_quotes.js <rules.csv> [--show-info]');
  console.log('  退出码: 0 = 干净；1 = 有结构问题或奇数引号（会截断）；2 = 调用错误');
  process.exit(argv.length ? 0 : 2);
}
const SHOW_INFO = argv.includes('--show-info');
const file = argv.filter(a => !a.startsWith('--'))[0];
if (!file || !fs.existsSync(file)) { console.error('rules.csv 不存在: ' + file); process.exit(2); }
const text = fs.readFileSync(file, 'utf8');
const norm = t => t.replace(/[\u201c\u201d]+/g, '"').replace(/[\u2018\u2019\ufffd]+/g, "'");
const tNorm = norm(text);

// ---- 1) 严格 RFC4180 结构解析（引擎归一化后等价文本上执行）----
function strictParse(src) {
  let i = 0, n = src.length, line = 1, fieldStart = true, inQ = false;
  const err = m => ({ ok: false, msg: m + ' (line ' + line + ')' });
  while (i < n) {
    const c = src[i];
    if (inQ) {
      if (c === '"') { if (src[i + 1] === '"') { i += 2; continue; } inQ = false; i++; fieldStart = false; continue; }
      if (c === '\n') line++;
      i++; continue;
    }
    if (c === '"') { if (!fieldStart) return err('未加引号字段中段出现 "（弯引号归一化/引号未转义？）'); inQ = true; fieldStart = false; i++; continue; }
    if (c === ',') { fieldStart = true; i++; continue; }
    if (c === '\n') { fieldStart = true; line++; i++; continue; }
    if (c === '\r') { i++; continue; }
    fieldStart = false; i++;
  }
  if (inQ) return { ok: false, msg: '引号未闭合 (EOF)' };
  return { ok: true };
}
const st = strictParse(tNorm);
if (!st.ok) console.log(`[STRUCT] ${st.msg} —— 文件结构已被破坏（游戏会拆行列/丢列或崩溃）`);
const structBad = st.ok ? 0 : 1;

// ---- RFC4180 宽松解析出单元格 ----
function parse(raw) {
  const rows = [];
  let cur = [], field = '', inQ = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (inQ) {
      if (c === '"') { if (raw[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { cur.push(field); field = ''; }
      else if (c === '\n') { cur.push(field); field = ''; rows.push(cur); cur = []; }
      else if (c !== '\r') field += c;
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  return rows;
}
const rows = parse(tNorm);
const header = rows[0] || [];
const idx = {};
header.forEach((h, i) => idx[h] = i);
const idIdx = idx['id'], scIdx = idx['script'], opIdx = idx['options'];
if (idIdx === undefined || scIdx === undefined) {
  console.error('找不到 id/script 列（确认文件是 rules.csv 结构）'); process.exit(2);
}

// ---- 2/3) 逐行检查 ----
let oddSuspect = 0, curlyScript = 0, multiArgInfo = 0;
const infos = [];
for (let r = 1; r < rows.length; r++) {
  const row = rows[r];
  const id = (row[idIdx] || '').trim();
  if (!id || id.startsWith('#')) continue;
  for (const [tag, ci] of [['script', scIdx], ['options', opIdx]]) {
    if (ci === undefined) continue;
    const cell = row[ci] !== undefined ? row[ci] : '';
    if (tag === 'script') curlyScript += (cell.match(/[\u201c\u201d\u2018\u2019]/g) || []).length;
    for (const line of cell.split('\n')) {
      const q = (line.match(/"/g) || []).length;
      if (q === 0) continue;
      if (q % 2 === 1) {
        oddSuspect++;
        console.log(`[SUSPECT-ODD] ${tag} id=${id} 行: ${line.slice(0, 140)}`);
        console.log(`              引号数=${q}（奇数 → 未成对，解释器会在行尾前就断在半句）`);
      } else if (q > 2) {
        // 偶数且 >2：合法多参数命令（如 SetTextHighlights "a" "b" "c"），仅记录
        multiArgInfo++;
        if (SHOW_INFO) infos.push(`[INFO-MULTIARG] ${tag} id=${id} 引号数=${q} 行: ${line.slice(0, 120)}`);
      }
    }
  }
}
if (SHOW_INFO) for (const i of infos) console.log(i);
console.log(`script 列弯引号计数: ${curlyScript}（应=0；>0 → 归一化后即内嵌 ASCII 引号 → 必然截断，须改 【】 或去掉；勿用「」，无字形见 R3）`);
console.log(`严格结构问题: ${structBad}（应=0）`);
console.log(`奇数引号行（疑似命令参数内嵌引号 → 截断）: ${oddSuspect}（应=0）`);
console.log(`多参数命令行（偶数引号，合法，仅记录）: ${multiArgInfo}${multiArgInfo ? '（加 --show-info 看明细；英文原版自身也会有，如 SetTextHighlights "a" "b" "c"）' : ''}`);
process.exit((structBad || oddSuspect || curlyScript) ? 1 : 0);
