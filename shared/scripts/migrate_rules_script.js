// migrate_rules_script.js — 写操作：rules.csv **script 列**迁移。把 `AddText "…"`、
// `$xxxTooltip = "…"` 等引号内文字从旧（中文）文件搬到新（英文）文件，
// 保留规则语法、颜色参数与 `$变量`。
//
// 用法:
//   node migrate_rules_script.js <oldRules.csv> <newRules.csv> [outCsv|--inplace] [--dry]
//     默认 --inplace：改写 <newRules.csv>（写前请自行备份）
//     传 outCsv 则写到新路径，不动输入文件
//   node migrate_rules_script.js --help
// 改完必跑 check_rules_arg_quotes.js（R2：script 参数内嵌引号只截断不崩溃）
// 退出码: 0 = 完成；2 = 参数/文件错误
const fs = require('fs');
const { parseCSV, toCSV } = require('./csvtool.js');

const argv = process.argv.slice(2);
if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
  console.log('usage: node migrate_rules_script.js <oldRules.csv> <newRules.csv> [outCsv|--inplace] [--dry]');
  process.exit(argv.length ? 0 : 2);
}
const DRY = argv.includes('--dry');
const pos = argv.filter(a => !a.startsWith('--'));
const OLD = pos[0], NEW = pos[1];
const OUT = (pos[2] && pos[2] !== '--inplace') ? pos[2] : NEW;
if (!OLD || !NEW) { console.error('缺少参数：见 --help'); process.exit(2); }
if (!fs.existsSync(OLD)) { console.error('旧 rules.csv 不存在: ' + OLD); process.exit(2); }
if (!fs.existsSync(NEW)) { console.error('新 rules.csv 不存在: ' + NEW); process.exit(2); }

const oldRows = parseCSV(fs.readFileSync(OLD, 'utf8'));
const newRows = parseCSV(fs.readFileSync(NEW, 'utf8'));
const h = newRows[0];
const idIdx = h.indexOf('id'), scriptIdx = h.indexOf('script');
const oldMap = new Map();
for (const r of oldRows.slice(1)) oldMap.set(r[0], r);

function translateScriptLine(oldScript, newScript) {
  // Strategy: for each AddText "..." or $xxxTooltip = "..." segment in NEW script,
  // find the corresponding segment in OLD script (same surrounding tokens), and
  // replace the quoted text with the old zh text.
  // We do a line-by-line diff: old and new scripts have same line count & same
  // non-quoted tokens (verified by inspection). So we zip lines.
  const ol = oldScript.split(/\r?\n|\n/);
  const nl = newScript.split(/\r?\n|\n/);
  const out = [];
  for (let i = 0; i < nl.length; i++) {
    let line = nl[i];
    const oldLine = ol[i];
    if (oldLine === undefined) { out.push(line); continue; }
    // match AddText "..." pattern
    const m = line.match(/^(\s*(?:AddText|AddText\s*)("|\\"\\")(.*?)\2(\s*marketFlavorTextColor)?\s*$)/s);
    const om = oldLine.match(/(?:"|\\"\\")([^"\\]*(?:\\.[^"\\]*)*)(?:"|\\"\\")/);
    if (m && om && /[\u4e00-\u9fff]/.test(om[1])) {
      // reconstruct: keep everything before the quote, replace content
      const idxQ = line.indexOf('"');
      const endQ = line.lastIndexOf('"');
      if (idxQ >= 0 && endQ > idxQ) {
        const prefix = line.slice(0, idxQ);
        const suffix = line.slice(endQ + 1);
        line = prefix + '"' + om[1] + '"' + suffix;
      }
    }
    // match $marketLeaveTooltip = "..." / $xxx = "..."
    const tm = line.match(/^(\s*\$\w+\s*=\s*")(.*)("\s*\d?\s*)$/);
    const otm = oldLine.match(/^(\s*\$\w+\s*=\s*")(.*)("\s*\d?\s*)$/);
    if (tm && otm && /[\u4e00-\u9fff]/.test(otm[2])) {
      line = tm[1] + otm[2] + tm[3];
    }
    out.push(line);
  }
  return out.join('\n');
}

let changed = 0;
const out = [h];
for (const r of newRows.slice(1)) {
  const or = oldMap.get(r[0]);
  if (or && or[scriptIdx] && /[\u4e00-\u9fff]/.test(or[scriptIdx]) && or[scriptIdx] !== r[scriptIdx]) {
    const fixed = translateScriptLine(or[scriptIdx], r[scriptIdx]);
    if (fixed !== r[scriptIdx]) { r[scriptIdx] = fixed; changed++; }
  }
  out.push(r);
}
if (!DRY) fs.writeFileSync(OUT, toCSV(out), 'utf8');
console.log('script column migrated for', changed, 'rules', DRY ? '(dry-run, 未写盘)' : '-> ' + OUT);
