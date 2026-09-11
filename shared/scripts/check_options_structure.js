// check_options_structure.js — rules.csv / zgrstuff.csv 的 options 单元格结构校验（red 级）。
//
// 为什么单列这条闸门：
//   options 是**合成字段**——每行 `optionId:标签`，或长式 `数字:optionId:标签`。
//   常规检查（列数=header、引号数=0）**完全看不出**它坏了：
//     · optionId 重复   → "ncamcb_start:ncamcb_start:询问绝密悬赏。"（一行变两段语义）
//     · optionId 被挤掉 → "0:标签"（长式外层编号把 optionId 挤没了）
//   引擎解析时把首段当数字/ID → `java.lang.NumberFormatException: For input string: "ncamcb_start"`
//   → **启动崩溃**（本项目实测；且日志里只会在 rules 加载阶段抛一次，很容易被当成别的 mod 的错）。
//   另两个格式事实：多行 options 用**真实换行**分隔（不是字面 `\n`）；含换行必须按 RFC4180 加引号。
//
// 用法:
//   node check_options_structure.js <modRoot> <enBackupRoot> [--renamed=FROM:TO ...]
//     <modRoot>       注入后的 mod 目录
//     <enBackupRoot>  英文原版备份目录（结构基准）
//     --renamed=A:B   已知并接受的 optionId 改写（例：--renamed=zgr_makePitch11:na_zgr_makePitch11）；
//                     仅在**确认该 id 无任何引用**（不是 FireBest 目标、不参与条件判断）后使用
//   node check_options_structure.js --help
// 退出码: 0 = 结构等价；1 = 结构不符或出现字面 \n；2 = 调用错误
const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./csvlib.js');

const argv = process.argv.slice(2);
if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
  console.log('usage: node check_options_structure.js <modRoot> <enBackupRoot> [--renamed=FROM:TO ...]');
  process.exit(argv.length ? 0 : 2);
}
const pos = argv.filter(a => !a.startsWith('--'));
const [MOD, BAK] = pos;
if (!MOD || !BAK) { console.error('用法见 --help：需要 <modRoot> <enBackupRoot>'); process.exit(2); }
for (const [n, p] of [['modRoot', MOD], ['enBackupRoot', BAK]]) {
  if (!fs.existsSync(p)) { console.error(`${n} 不存在: ${p}`); process.exit(2); }
}
const RENAMED = {};
for (const a of argv.filter(x => x.startsWith('--renamed='))) {
  for (const pair of a.split('=').slice(1).join('=').split(',')) {
    const [from, to] = pair.split(':');
    if (from && to) RENAMED[from.trim()] = to.trim();
  }
}

const rels = ['data/campaign/rules.csv', 'data/campaign/zgrstuff.csv'];
// options 单元格的分行：真实换行 或 字面 \n 都切（后者本身就是要报的错）
const parts = s => String(s).replace(/^\s*"|"\s*$/g, '').split(/\\n|\r\n|\n|\r/).map(x => x.trim()).filter(Boolean);
const head = l => { const i = l.indexOf(':'); return i < 0 ? l.trim() : l.slice(0, i).trim(); };
const body = l => { const i = l.indexOf(':'); return i < 0 ? '' : l.slice(i + 1); };

let total = 0, literalN = 0, bad = 0, skippedFiles = 0;
for (const rel of rels) {
  const load = root => {
    const p = path.join(root, rel);
    if (!fs.existsSync(p)) return null;
    const { header, rows } = parseCsv(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
    const iId = header.indexOf('id'), iOpt = header.indexOf('options');
    if (iId < 0 || iOpt < 0) return null;
    const m = new Map();
    for (const r of rows) { const id = (r.cells[iId] || '').trim(); if (id) m.set(id, r.cells[iOpt] || ''); }
    return m;
  };
  const zh = load(MOD), en = load(BAK);
  if (!zh || !en) { skippedFiles++; continue; }
  console.log(`=== ${rel} ===`);
  for (const [id, zo] of zh) {
    const eo = en.get(id);
    if (eo === undefined || !String(zo).trim()) continue;
    total++;
    const probs = [];
    if (/\\n/.test(zo) && !/\\n/.test(eo)) { literalN++; probs.push('出现字面 \\n（应写真实换行，否则单元格不会被引号包裹、游戏内显示字面 \\n 且选项解析错乱）'); }
    const Z = parts(zo), E = parts(eo);
    if (Z.length !== E.length) probs.push(`段数 ${E.length}→${Z.length}（optionId 被重复或被挤掉）`);
    else for (let i = 0; i < E.length; i++) {
      const eh = head(E[i]), zh2 = head(Z[i]);
      if (eh !== zh2 && RENAMED[eh] !== zh2) probs.push(`第 ${i + 1} 段 optionId ${JSON.stringify(eh)}→${JSON.stringify(zh2)}`);
      // 标签里又出现自己的 id → 说明原文被整段复制进译名
      else if (new RegExp('^' + zh2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':').test(body(Z[i]))) probs.push(`第 ${i + 1} 段标签内残留 optionId`);
    }
    if (probs.length) { bad++; console.log(`  ✗ ${id} :: ${probs.join(' ; ')}`); }
  }
}
if (skippedFiles === rels.length) { console.error('两个目标文件都不存在或无 options 列 —— 请确认路径'); process.exit(2); }
console.log(`\noptions 条目 ${total} 条 | 结构问题 ${bad} 条 | 字面 \\n ${literalN} 条`);
if (!bad && !literalN) {
  console.log('✓ options 结构与英文原版等价（可避免引擎 Float.parseFloat / 选项解析崩溃）');
  process.exit(0);
}
console.log('✗ 必须修复：把 optionId 改为与英文原版一致，只翻译标签；多行用真实换行。');
console.log('  若确需改写 optionId，先确认全项目无引用，再用 --renamed=FROM:TO 显式声明。');
process.exit(1);
