// migrate_json.js — 写操作：注释 JSON / 伪 JSON 的**文本替换**式迁移（铁律 R8：绝不用 ConvertTo-Json 回写）。
// 保持 `#` 注释、缩进、尾随逗号原样，只把指定片段替换为译文片段。
//
// 用法:
//   node migrate_json.js <plan.json> [--dry]
//     plan.json:
//     {
//       "root": "C:/game/.../mods/<Mod>",            // 可选：相对路径的基准目录
//       "ops": [
//         { "file": "data/campaign/channels.json",
//           "find": "\"name\":\"En\"", "repl": "\"name\":\"中\"",
//           "note": "可选说明", "required": true },   // required=false 时找不到只警告不失败
//         { "file": "...", "find": "...", "repl": "...", "occurrence": 2 }  // 只替换第 N 处（默认第 1 处）
//       ]
//     }
//   node migrate_json.js --help
//
// 说明：旧版把某工程的替换对写死在脚本里；改为 plan.json 外置后同一脚本可用于任何 mod。
// 每个 find 只替换**一处**（occurrence 指定第几处），避免误伤同文本的其它位置。
// 退出码: 0 = 全部命中；1 = 有未命中项；2 = 参数/文件错误
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
  console.log('usage: node migrate_json.js <plan.json> [--dry]');
  console.log('plan.json 结构见脚本头部注释。');
  process.exit(argv.length ? 0 : 2);
}
const DRY = argv.includes('--dry');
const planFile = argv.filter(a => !a.startsWith('--'))[0];
if (!planFile || !fs.existsSync(planFile)) { console.error('plan.json 不存在: ' + planFile); process.exit(2); }
const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
const root = plan.root || path.dirname(path.resolve(planFile));
const ops = plan.ops || [];
if (!ops.length) { console.error('plan.ops 为空'); process.exit(2); }

function replaceNth(text, find, repl, n) {
  let idx = -1;
  for (let k = 0; k < n; k++) {
    idx = text.indexOf(find, idx + 1);
    if (idx < 0) return { text, ok: false };
  }
  return { text: text.slice(0, idx) + repl + text.slice(idx + find.length), ok: true };
}

// 同一文件可能有多条 op：把改动攒在内存里，最后一次性写盘（避免读了旧内容）
const cache = new Map();
let ok = 0, miss = 0;
for (const op of ops) {
  const file = path.isAbsolute(op.file) ? op.file : path.join(root, op.file);
  if (!cache.has(file)) cache.set(file, fs.readFileSync(file, 'utf8'));
  let t = cache.get(file);
  const n = op.occurrence || 1;
  if (t.indexOf(op.find) < 0) {
    console.log('  NOT FOUND ' + op.file + ' : ' + JSON.stringify(op.find).slice(0, 100) + (op.note ? '   (' + op.note + ')' : ''));
    if (op.required === false) { console.log('    (required=false，仅警告)'); } else { miss++; }
    continue;
  }
  const r = replaceNth(t, op.find, op.repl, n);
  if (!r.ok) { console.log('  NOT FOUND(第 ' + n + ' 处) ' + op.file + ' : ' + JSON.stringify(op.find).slice(0, 100)); miss++; continue; }
  cache.set(file, r.text);
  ok++;
  console.log('  OK ' + op.file + (op.note ? '   (' + op.note + ')' : ''));
}
if (!DRY) for (const [file, text] of cache) fs.writeFileSync(file, text, 'utf8');
console.log('root:', root);
console.log('applied:', ok, '| missing:', miss, DRY ? '(dry-run, 未写盘)' : '');
process.exit(miss ? 1 : 0);
