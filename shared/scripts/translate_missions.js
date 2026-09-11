// translate_missions.js — 写操作：按「任务 id → { 原文: 译文 }」映射替换 data/missions/*/MissionDefinition.java
// 里的字符串字面量（这些都是运行时由 Janino 编译的源码），只动引号内文本，保持 Java 语法与转义。
//
// 用法:
//   node translate_missions.js <missionsDir> <mapping.json> [--dry]
//     <missionsDir>  <mod>/data/missions
//     <mapping.json> { "tem_ahardplace": { "英文原文": "中文译文", ... }, ... }
//                    键失效（找不到字面量）时会逐条打印 NOT FOUND，便于发现上游文案变更
//     --dry          只报告将替换多少处，不写文件
//   node translate_missions.js --help
//
// 注意：映射数据一律外置到 JSON —— 旧版把某工程的映射写死在脚本里，换 mod 就必须改脚本。
// 退出码: 0 = 完成；1 = 有键未命中（便于复核）；2 = 参数/文件错误
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
  console.log('usage: node translate_missions.js <missionsDir> <mapping.json> [--dry]');
  process.exit(argv.length ? 0 : 2);
}
const DRY = argv.includes('--dry');
const pos = argv.filter(a => !a.startsWith('--'));
const [base, mapFile] = pos;
if (!base || !mapFile) { console.error('缺少参数：见 --help'); process.exit(2); }
if (!fs.existsSync(base)) { console.error('missionsDir 不存在: ' + base); process.exit(2); }
if (!fs.existsSync(mapFile)) { console.error('mapping.json 不存在: ' + mapFile); process.exit(2); }

const missions = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
let totalReplaced = 0, totalMissed = 0;

for (const [mission, map] of Object.entries(missions)) {
  const file = path.join(base, mission, 'MissionDefinition.java');
  if (!fs.existsSync(file)) { console.log('MISSING FILE ' + file); totalMissed += Object.keys(map).length; continue; }
  let t = fs.readFileSync(file, 'utf8');
  let replaced = 0;
  for (const [en, zh] of Object.entries(map)) {
    const esc = en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('"' + esc + '"', 'g');
    const hits = (t.match(re) || []).length;
    if (hits === 0) { console.log('  NOT FOUND ' + mission + ': ' + JSON.stringify(en)); totalMissed++; continue; }
    t = t.replace(re, '"' + String(zh).replace(/"/g, '\\"') + '"');
    replaced += hits;
  }
  if (!DRY) fs.writeFileSync(file, t, 'utf8');
  totalReplaced += replaced;
  console.log(mission + ': replaced ' + replaced + ' literals' + (DRY ? ' (dry-run, 未写盘)' : ''));
}
console.log('total replaced:', totalReplaced, '| missing keys:', totalMissed);
process.exit(totalMissed ? 1 : 0);
