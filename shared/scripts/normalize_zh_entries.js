// normalize_zh_entries.js — 译者回传清单的注入前机械规范化（写回原文件）。
// 背景：译版迭代实测（YRXP v1→v3 同日三轮），每轮译者都会带回三类会出问题的形态：
//   1) R1: CSV 条目里的中文弯引号 “” —— 引擎读 CSV 会把弯引号归一化为直引号再切列 → 拆列崩溃
//      （字库有字形≠CSV 安全；jar/JSON/纯文本不经该归一化，弯引号保留）
//   2) R3: 缺字形字（舰艏→舰首、全角 ／→/、～→~）—— 字库无字形 → 游戏显示 "?"
//   3) R4: en(或 c) 不含 %s/%d 的条目出现 %% —— 该串不经 String.format，%% 会双写显示
// 有意保留原文（zh 逐字等于 en/c）与空 zh 跳过。
//
// 用法: node normalize_zh_entries.js <zhDir> [--glyph=<json>]
//   <zhDir>      译者回传目录（读入全部 NN_*.json 数组，写回原文件）
//   --glyph      额外缺字形替换表 json（{"舰艏":"舰首"} 形态，与内置表合并）
// 退出码: 0 = 无需修改或已完成；1 = 参数错误
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
if (!dir || !fs.existsSync(dir)) { console.error('用法: node normalize_zh_entries.js <zhDir> [--glyph=<json>]'); process.exit(1); }
const glyphArg = process.argv.slice(2).find(a => a.startsWith('--glyph='));
const glyphs = Object.assign({ '舰艏': '舰首', '／': '/', '～': '~' },
  glyphArg ? JSON.parse(fs.readFileSync(glyphArg.slice(8), 'utf8')) : {});

let r1 = 0, r3 = 0, r4 = 0, keep = 0, files = 0;
for (const f of fs.readdirSync(dir).filter(x => /^\d{2}_.*\.json$/.test(x))) {
  const p = path.join(dir, f);
  const arr = JSON.parse(fs.readFileSync(p, 'utf8'));
  let n = 0;
  for (const e of arr) {
    if (!e.zh || e.zh === e.en || e.zh === e.c) { if (e.zh && (e.zh === e.en || e.zh === e.c)) keep++; continue; }
    const en = e.en !== undefined ? e.en : e.c;
    const before = e.zh;
    const isCsv = typeof e.file === 'string' && e.file.endsWith('.csv');
    if (isCsv) e.zh = e.zh.replace(/[\u201c\u201d]/g, m => (m === '\u201c' ? '【' : '】'));
    for (const [a, b] of Object.entries(glyphs)) e.zh = e.zh.split(a).join(b);
    if (!/%[sd]/.test(en) && e.zh.includes('%%')) e.zh = e.zh.split('%%').join('%');
    if (e.zh !== before) {
      n++;
      if (isCsv && /[\u201c\u201d]/.test(before)) r1++;
      if (Object.keys(glyphs).some(k => before.includes(k))) r3++;
      if (before.includes('%%') && !/%[sd]/.test(en)) r4++;
    }
  }
  if (n) fs.writeFileSync(p, JSON.stringify(arr, null, 1), 'utf8');
  if (n) files++;
  console.log(f + ': 规范化 ' + n + ' 条');
}
console.log('合计: 弯引号(R1) ' + r1 + ' | 缺字形(R3) ' + r3 + ' | %% (R4) ' + r4 + ' | 改动文件 ' + files + ' | 保留原文跳过 ' + keep);
