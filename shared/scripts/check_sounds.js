// 用法: node check_sounds.js <modDir>
// 核查 data/config/sounds.json 引用的音频文件是否存在（宽松 JSON：剥 # 注释 + 尾逗号）
const fs = require('fs'), path = require('path');
const modDir = process.argv[2];
const raw = fs.readFileSync(path.join(modDir, 'data/config/sounds.json'), 'utf8');
let t = raw.replace(/^\uFEFF/, '');
t = t.replace(/#[^\n]*/g, '');          // 游戏宽松语法：# 注释
t = t.replace(/,(\s*[}\]])/g, '$1');    // 尾逗号
const j = JSON.parse(t);
let miss = 0, total = 0;
// 值可能是数组（元素为 {file:...} 或字符串），也可能是对象含 sounds/file
for (const [id, e] of Object.entries(j)) {
  let items = e;
  if (!Array.isArray(items)) items = (e && (e.sounds || e.file)) || [];
  for (const it of items) {
    const f = typeof it === 'string' ? it : (it && it.file);
    if (!f) continue;
    total++;
    const p = path.join(modDir, f);
    if (!fs.existsSync(p)) { miss++; console.log('MISS', id, f); }
  }
}
console.log('sound files total=' + total, 'missing=' + miss);
