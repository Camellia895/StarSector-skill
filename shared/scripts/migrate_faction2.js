// migrate_faction2.js — 写操作：`.faction` 嵌套对象（ranks/posts/fleetTypeNames/displayName）
// 按「行前缀 + 引号值」把**旧版中文**迁到新文件（`#` 注释行跳过，保持缩进）。
//
// 用法:
//   node migrate_faction2.js <oldFactionFile> <newFactionFile> [--dry]
//   node migrate_faction2.js --help
// 匹配的三类行形态：
//   "displayName":"圣殿骑士",
//   "spaceSailor":{"name":"侍从"},
//   "patrolSmall":"巡逻队",
// 退出码: 0 = 完成；2 = 参数/文件错误
const fs = require('fs');

const argv = process.argv.slice(2);
if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
  console.log('usage: node migrate_faction2.js <oldFactionFile> <newFactionFile> [--dry]');
  process.exit(argv.length ? 0 : 2);
}
const DRY = argv.includes('--dry');
const pos = argv.filter(a => !a.startsWith('--'));
const oldFile = pos[0], newFile = pos[1];
if (!oldFile || !newFile) { console.error('缺少参数：见 --help'); process.exit(2); }
if (!fs.existsSync(oldFile)) { console.error('旧文件不存在: ' + oldFile); process.exit(2); }
if (!fs.existsSync(newFile)) { console.error('新文件不存在: ' + newFile); process.exit(2); }

const oldLines = fs.readFileSync(oldFile, 'utf8').split(/\r?\n/);
let newLines = fs.readFileSync(newFile, 'utf8').split(/\r?\n/);

// build list of (prefix, oldValue) from old file where oldValue contains CJK
const repls = [];
for (const l of oldLines) {
  // forms:
  //  "displayName":"圣殿骑士",
  //  "spaceSailor":{"name":"侍从"},
  //  "patrolSmall":"巡逻队",
  let m = l.match(/^(\s*"[A-Za-z]+"\s*:\s*\{?"name"\s*:\s*")([^"]*)("\},?)\s*$/);
  if (!m) m = l.match(/^(\s*"[A-Za-z]+"\s*:\s*")([^"]*)(",?)\s*$/);
  if (m && /[\u4e00-\u9fff]/.test(m[2])) {
    repls.push({ prefix: m[1], oldVal: m[2], suffix: m[3] });
  }
}

let replaced = 0;
for (const r of repls) {
  for (let i = 0; i < newLines.length; i++) {
    if (newLines[i].includes(r.prefix) && !/[\u4e00-\u9fff]/.test(newLines[i])) {
      const newValMatch = newLines[i].match(new RegExp('^(' + r.prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')[^"]*'));
      if (newValMatch) {
        newLines[i] = newValMatch[1] + r.oldVal + r.suffix;
        replaced++;
      }
    }
  }
}
if (!DRY) fs.writeFileSync(newFile, newLines.join('\r\n'), 'utf8');
console.log('replaced:', replaced, DRY ? '(dry-run, 未写盘)' : '');
const after = (DRY ? newLines.join('\r\n') : fs.readFileSync(newFile, 'utf8'));
console.log('CJK count now:', (after.match(/[\u4e00-\u9fff]/g) || []).length);
