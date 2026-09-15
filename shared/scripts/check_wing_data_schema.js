// 闸门 G-data-wing：mod 的 wing_data.csv 必须包含 FighterWingSpreadsheetLoader 硬读的全部列。
// 背景（2026-09-15 事故）：AI War 0.4.0 启动崩溃——0.7 时代 23 列表头缺 "role desc"，
// FighterWingSpreadsheetLoader.o00000 直接 JSONObject.getString → JSONException → 资源加载线程死亡。
// "引擎按表头名读列、缺列=默认" 对 hulls/weapons/hullmods 成立（sylphon 实证），
// 但对 wing_data 不成立（加载器硬需求，见下）。
// 用法：node check_wing_data_schema.js <mod 目录或 csv 路径>
const fs = require('fs');
const path = require('path');
const GAME = 'C:/game/StarSector.v0.9.8a-RC8';
// FighterWingSpreadsheetLoader 反汇编出的 getString 列名（javap -c 可复核）
const REQUIRED = ['id','variant','tier','tags','role desc','role','refit','rarity','range','op cost','num','formation','fleet pts','base value','attackRunRange','attackPositionOffset'];
let target = process.argv[2];
if (!target) { console.error('用法: node check_wing_data_schema.js <modDir|wing_data.csv>'); process.exit(2); }
const csv = target.endsWith('.csv') ? target : path.join(target, 'data', 'hulls', 'wing_data.csv');
if (!fs.existsSync(csv)) { console.log('PASS（无 wing_data.csv）:', csv); process.exit(0); }
const header = fs.readFileSync(csv, 'utf8').split(/\r?\n/)[0].split(',');
const missing = REQUIRED.filter(c => !header.includes(c));
if (missing.length) {
  console.log('FAIL:', csv);
  console.log('  缺少硬需求列:', missing.join(', '));
  console.log('  修复：按 core wing_data.csv 表头重建（参照 _work/mod_work/AIWar/tools/rebuild_wing_data.js）');
  process.exit(1);
} else {
  console.log('PASS:', csv, '（硬需求列', REQUIRED.length, '/', REQUIRED.length, '齐）');
}
