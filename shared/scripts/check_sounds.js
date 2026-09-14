// 用法: node check_sounds.js <modDir>
// 核查 data/config/sounds.json 引用的音频文件是否存在（宽松 JSON：剥 # 注释 + 尾逗号）
// 搜索范围 = 本 mod + starsector-core + 其余已装 mod（引擎 VFS 语义；2026-09-15 修正：
// 此前只搜 mod 目录，引用核心 ogg 的 mod 全部假 MISS——core 的 sounds/sfx_*/ 就在 starsector-core 下）。
// 带 "source" 的条目（音乐打包在 .bin 里，如 core 的 music.bin）磁盘上无独立文件，跳过不查。
const fs = require('fs'), path = require('path');
const modDir = process.argv[2];
if (!modDir) { console.error('用法: node check_sounds.js <modDir>'); process.exit(2); }
const raw = fs.readFileSync(path.join(modDir, 'data/config/sounds.json'), 'utf8');
let t = raw.replace(/^\uFEFF/, '');
t = t.replace(/#[^\n]*/g, '');          // 游戏宽松语法：# 注释
t = t.replace(/,(\s*[}\]])/g, '$1');    // 尾逗号
const j = JSON.parse(t);

const gameRoot = path.resolve(modDir, '..', '..');
const roots = [modDir, path.join(gameRoot, 'starsector-core')];
try {
  const modsDir = path.join(gameRoot, 'mods');
  for (const d of fs.readdirSync(modsDir)) {
    const p = path.join(modsDir, d);
    if (p !== modDir && fs.statSync(p).isDirectory()) roots.push(p);
  }
} catch (e) { /* 无 mods 目录就只查 mod + core */ }

let miss = 0, total = 0, skipped = 0;
// 值可能是数组（元素为 {file:...} 或字符串），也可能是对象含 sounds/file
for (const [id, e] of Object.entries(j)) {
  let items = e;
  if (!Array.isArray(items)) items = (e && (e.sounds || e.file)) || [];
  for (const it of items) {
    const f = typeof it === 'string' ? it : (it && it.file);
    if (!f) continue;
    if (it && it.source) { skipped++; continue; } // 打包音频（music.bin 等），磁盘无独立文件
    total++;
    if (!roots.some(r => fs.existsSync(path.join(r, f)))) { miss++; console.log('MISS', id, f); }
  }
}
console.log('sound files total=' + total, 'missing=' + miss, 'packed-skipped=' + skipped);
process.exit(miss ? 1 : 0); // 登记表契约：0=干净，1=有命中
