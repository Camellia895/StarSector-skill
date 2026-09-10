// check_rules_arg_quotes.js — rules.csv 命令参数内嵌引号预检（Bug B：不崩溃、但文本截断）
//
// 背景（详见 <skills>\skills\starsector-engine-diagnose\SKILL.md §3.2，铁律 R2）：
//   rules.csv 的 script 列是“命令文本”（如 `AddText "..." textBlueColor`、`SetTooltip id "..."`）。
//   规则解释器把命令字符串参数取到**第一对引号**为止：
//     - 引擎读 CSV 前会把弯引号 “”→"、‘’→'（与汉化合并器写入前归一化一致）；
//     - 因此命令参数内若出现会被归一化成 ASCII `"` 的弯引号、或直接写 ASCII `"`，
//       解释器会在第一个内嵌引号处截断 → 游戏里只显示前半句（无崩溃、难察觉）。
//   纯文本列（text/options 显示文本）不受此限制（原版自身就常含引号，显示层安全）。
//   需要中文强调观感时用 「」『』（不在归一化名单、不与命令引号冲突）。
//
// 两道检测（缺一不可）：
//   1. 严格 RFC4180 结构解析：未加引号字段中段出现 " / 引号未闭合 → 文件结构已被破坏
//      （写入器未按 RFC 转义或人为直改文本的典型症状；游戏会拆行列或丢列）。
//   2. 逐行引号计数：对解析后的 script 列值按行数 " ，>2 即命令参数内嵌引号
//      （写入器按 RFC 正确包裹时，解析回的值保持原样，此计数即解释器所见）。
//
// 用法:  node check_rules_arg_quotes.js <rules.csv>
// 期望:  0 结构问题 + 0 疑似内嵌 + script 列 0 弯引号 → exit 0。
'use strict';
const fs = require('fs');
const file = process.argv[2];
if (!file) { console.error('usage: node check_rules_arg_quotes.js <rules.csv>'); process.exit(1); }
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
  console.error('找不到 id/script 列（确认文件是 rules.csv 结构）'); process.exit(1);
}

// ---- 2) 逐行引号计数（命令参数内嵌引号）----
let suspect = 0, curlyScript = 0;
const flag = (tag, id, line) => { suspect++; console.log(`[SUSPECT] ${tag} id=${id} 行: ${line.slice(0, 140)}`); };
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
      if (q > 2) flag(tag, id, line);
    }
  }
}
console.log(`script 列弯引号计数: ${curlyScript}（应=0；>0 → 归一化后即内嵌 ASCII 引号 → 必然截断，须改 【】 或去掉；勿用「」，无字形见 §3.6）`);
console.log(`严格结构问题: ${structBad}（应=0）`);
console.log(`疑似命令参数内嵌引号行: ${suspect}（应=0；>0 时 AddText/SetTooltip 等参数会在首个内嵌引号处截断）`);
process.exit((structBad || suspect || curlyScript) ? 1 : 0);
