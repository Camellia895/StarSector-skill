// sweep_quoted_segments.js — data 层"引号段"兜底反查（scan_data_stragglers 的第二张反查网）。
//
// 背景（2026-10-02 Apex 1.2.14 迁移实测）：scan_data_stragglers 跳过 script/命令列（逻辑列），
// 而 rules.csv 的 script 列可以携带玩家可见文本（`AddText"…"textGrayColor`——AddText 与引号间
// 无空格的形态连 `AddText\s+"` 正则都会漏）。本工具不区分列，对全部数据文本文件做
// 引号段扫描 + 句子判据 + worklist 覆盖比对，专抓这类"两道既有网都罩不住"的漏译。
//
// 用法:
//   node sweep_quoted_segments.js <modRoot> <worklist.json...> [--json=<out>] [--min-len=20] [--exclude-dir=<name>]...
//     <modRoot>        mod 目录（英文原版或注入后均可；比对基准是 worklist 的 en/c 值）
//     <worklist.json>  一份或多份待译清单（条目需含 en 字段；jar 常量条目用 c 键）
//     --exclude-dir    额外跳过的目录名（默认已跳 .git / ai / out）
// 退出码: 0 = 无未覆盖的句子级候选；1 = 有候选（须人工判：注释行/禁用行(#id)/无引用死文件/开发者注释
//         是常见假阳性，逐条处置）；2 = 调用错误
//
// 已知边界：多行 CSV 单元格（真实换行）不在扫描范围（那类字段 stragglers 已按列扫）；
// CSV 内 `""` 转义会把含引号单元格切成多段（片段 < min-len 自然滤掉）。
'use strict';
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
  console.log('usage: node sweep_quoted_segments.js <modRoot> <worklist.json...> [--json=<out>] [--min-len=20] [--exclude-dir=<name>]...');
  process.exit(argv.length ? 0 : 2);
}
const MOD = path.resolve(argv[0]);
if (!fs.existsSync(MOD)) { console.error('modRoot 不存在: ' + MOD); process.exit(2); }
const wlFiles = argv.slice(1).filter(a => !a.startsWith('--'));
for (const f of wlFiles) if (!fs.existsSync(f)) { console.error('worklist 不存在: ' + f); process.exit(2); }
const getOpt = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : d; };
const MINLEN = parseInt(getOpt('min-len', '20'), 10) || 20;
const EXCLUDE = new Set(['.git', 'ai', 'out', ...argv.filter(a => a.startsWith('--exclude-dir=')).map(a => a.split('=').slice(1).join('='))]);
const OUTJSON = getOpt('json', null);

// ---- worklist 覆盖集 ----
const covered = new Set();
for (const f of wlFiles) {
  const arr = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const e of (Array.isArray(arr) ? arr : arr.entries || [])) {
    for (const k of ['en', 'c']) if (typeof e[k] === 'string') { covered.add(e[k]); covered.add(e[k].trim()); }
  }
}

// ---- 句子判据 ----
function sentenceLike(s) {
  if (s.length < MINLEN || s.length > 600 || /[\u4e00-\u9fff]/.test(s)) return false;
  if ((s.match(/\b[a-z]{3,}\b/g) || []).length < 5) return false;
  if (!/ (the|and|of|with|is|to|in|for|on|are|from) /.test(' ' + s + ' ')) return false;
  const parts = s.split(',');
  if (parts.length >= 3 && parts.every(p => /^[A-Za-z0-9_ .\-]*$/.test(p))) return false; // 逗号标签串(tags/hints)
  if (/^(graphics|sounds|data|config)[/\\]/.test(s)) return false; // 路径
  return true;
}

// ---- 扫描 ----
const TEXT_EXT = /\.(csv|json|txt|faction|ship|skin|variant)$/;
const candidates = [];
let files = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!TEXT_EXT.test(e.name)) continue;
    files++;
    const rel = path.relative(MOD, p).split(path.sep).join('/');
    const raw = fs.readFileSync(p, 'utf8');
    for (const m of raw.matchAll(new RegExp('"([^"\\n]{' + MINLEN + ',600})"', 'g'))) {
      const s = m[1].replace(/""/g, '"').trim();
      if (covered.has(s)) continue;
      if (!sentenceLike(s)) continue;
      candidates.push({ file: rel, snippet: s.slice(0, 140) });
    }
  }
})(MOD);

// 去重（同文件同片段）
const seen = new Set();
const uniq = candidates.filter(c => { const k = c.file + '|' + c.snippet; if (seen.has(k)) return false; seen.add(k); return true; });

console.log('sweep_quoted_segments: files scanned ' + files + ' | sentence-like uncovered candidates: ' + uniq.length);
for (const c of uniq) console.log('  ' + c.file + ' :: ' + JSON.stringify(c.snippet));
if (uniq.length) console.log('处置：逐条人工判——注释行/禁用行(#id)/无代码引用的死文件/开发者注释 = 假阳性留档；真漏译补进 worklist 重注入。');
if (OUTJSON) fs.writeFileSync(path.resolve(OUTJSON), JSON.stringify({ count: uniq.length, candidates: uniq }, null, 1), 'utf8');
process.exit(uniq.length ? 1 : 0);
