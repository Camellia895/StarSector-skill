// check_zh_quality.js — 回传译文质量闸门：检测"机器翻译直翻的中英混杂 salad"（2026-09 armaa 沉淀）。
//
// 背景：一次回传的 6003 条译文里 3340 条（53%）是 MT 直翻（"你的记录和联盟说道为了 itself。
// 受信任由小组领袖…"），人工抽检根本看不完。词表朴素启发式（见文末）误报率高——它会把
// 保留的专有名词（Dawn/Blue/TriLink）、脚本语法（AddText）、$变量、选项 id 全部标红。
//
// 本脚本用两阶段判据（实测 armaa 6003 条：v1 误标 1657，v2 对重制版判 0 真 MT）：
//   先剥掉：$变量、行首选项 id（xxx:）、脚本关键字（AddText/SetTextHighlights…）
//   再找英文 token，分类：
//     · 大写开头（Dawn、Blue）          → 专有名词，保留合法
//     · 白名单缩写/品牌/术语             → 合法（可用 --keep 扩充）
//     · 小写实词两侧紧邻 CJK（交错模式） → 记 1 个"交错点"（"说道为了 itself" 的形态）
//     · 机翻高频词表命中（consumed/selected/compromised…）→ 直接判 MT
//   条目级判定 = 交错点 ≥ 2，或机翻高频词 ≥ 1。
//   交错点 = 1 的计入 borderline（人工抽检即可，不算失败）。
//
// 用法:
//   node check_zh_quality.js <zhDir> [--json=<out.json>|-]
//     <zhDir>   回传清单目录（01_*.json … 形态见 conventions.md §4）
//     --json    输出命中明细（默认只打印汇总）
//   退出码: 0 = 干净；1 = 有真机翻命中；2 = 用法错误
// 档位: yellow / cond（回传验收轮必跑；见 verification-ledger.md §8）
'use strict';
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
  console.log('usage: node check_zh_quality.js <zhDir> [--json=<out.json>|-]');
  process.exit(argv.length ? 0 : 2);
}
const zhDir = argv.find(a => !a.startsWith('--'));
const jsonArg = (argv.find(a => a.startsWith('--json=')) || '').split('=').slice(1).join('=') || '';

// 白名单：常见保留词（小写比较）。专有名词靠"大写开头"规则天然豁免，无需穷举。
const KEEP = new Set(('stims flux hardflux elite hud dp cr op sec ops ao iff lpc awacs npc ai midline lowtech hightech ' +
  'lambda alpha beta gamma delta omega nex merc drone turret hardpoint missile hybrid kinetic he explosive ' +
  'addon dex sic uaf ioc tasc ora tiandong interstellarimperium dxui').split(' '));
const MT_WORDS = new Set(('consumed replenish selected compromised throwing afford enjoy speaks itself trusted respected ' +
  'unimpeded equipped unremarkable overwhelmed reinforced redundant viable granted prepares shutting').split(' '));

function stripSyntax(zh) {
  let s = String(zh).replace(/\$[A-Za-z_][A-Za-z0-9_]*/g, '＃');
  s = s.replace(/^[A-Za-z][A-Za-z0-9_]*\s*:\s*/, '');                                   // 选项 id 前缀
  s = s.replace(/\b(AddText|SetTextHighlights|AddRemoveCommodity|FireBest|FireAll|CallEvent|AdjustRep|AdjustRepPerson|ShowPersonVisual|ShowSecondPerson|ShowThirdPerson|AddAbility|RepairAll|SetShortcut|SetTooltip)\b/g, '＃');
  return s;
}
function analyze(zh) {
  const s = stripSyntax(zh);
  const interleaves = [], mtHits = [];
  for (const m of s.matchAll(/[A-Za-z][A-Za-z0-9']{2,}/g)) {
    const w = m[0].toLowerCase();
    if (KEEP.has(w)) continue;
    if (/^[A-Z]/.test(m[0])) continue; // 专有名词
    const before = s.slice(Math.max(0, m.index - 1), m.index);
    const after = s.slice(m.index + m[0].length, m.index + m[0].length + 1);
    if (/[\u4e00-\u9fff]/.test(before) && /[\u4e00-\u9fff]/.test(after)) interleaves.push(w);
    if (MT_WORDS.has(w)) mtHits.push(w);
  }
  return { interleaves, mtHits, real: interleaves.length >= 2 || mtHits.length >= 1 };
}

if (!fs.existsSync(zhDir) || !fs.statSync(zhDir).isDirectory()) {
  console.error('目录不存在: ' + zhDir); process.exit(2);
}
const files = fs.readdirSync(zhDir).filter(f => /^\d+_.*\.json$/.test(f)).sort();
if (!files.length) { console.error('zh 目录里没有 NN_*.json 清单: ' + zhDir); process.exit(2); }

const report = { translated: 0, realMT: 0, borderline: 0, byShard: {}, hits: [] };
for (const f of files) {
  const a = JSON.parse(fs.readFileSync(path.join(zhDir, f), 'utf8'));
  const st = { translated: 0, realMT: 0, borderline: 0 };
  for (const e of a) {
    if (!e.zh || e.zh === e.en) continue;
    st.translated++; report.translated++;
    const r = analyze(e.zh);
    if (r.real) {
      st.realMT++; report.realMT++;
      if (report.hits.length < 400) report.hits.push({ shard: f, id: String(e.id).slice(0, 70), en: String(e.en).slice(0, 100), zh: String(e.zh).slice(0, 120), interleaves: r.interleaves.slice(0, 5), mt: r.mtHits });
    } else if (r.interleaves.length === 1) { st.borderline++; report.borderline++; }
  }
  report.byShard[f] = st;
  console.log(f.padEnd(28), 'translated', String(st.translated).padStart(5), ' realMT', String(st.realMT).padStart(4), ' borderline', st.borderline);
}
console.log('合计 translated:', report.translated, '| 真机翻:', report.realMT, '| 边缘(单处交错,人工抽检):', report.borderline);
if (jsonArg && jsonArg !== '-') fs.writeFileSync(jsonArg === '-' ? '-' : jsonArg, JSON.stringify(report, null, 1), 'utf8');
process.exit(report.realMT > 0 ? 1 : 0);
