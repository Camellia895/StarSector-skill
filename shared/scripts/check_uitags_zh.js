// check_uitags_zh.js — ★船插分类显示列（hull_mods.csv 的 uiTags）汉化闸门（铁律：显示列用核心中文词表）
//
// 事故（2026-09-18 Kyeltziv Technocracy 1.10.7 汉化修复）：
//   `hull_mods.csv` 的 `uiTags` 是**显示列**——引擎直接把该列的值（英文逗号切分）当成装配界面/百科的
//   船插分类标签显示，**不查任何注册表**。旧 1.9 中文版本来写的是中文（`特殊, 防御, 引擎`），
//   1.10.7 迁移时被作者英文原文覆盖回 `Special, Defenses, Engines` ⇒ 分类名变英文且**不报错、不打日志**。
//   既有闸门全部漏检：check_designtype.js 只查 tech/manufacturer；verify_all_data.js 不看这一列；
//   scan_data_stragglers.js 只找"英文自然语言"，而 `Special`/`Defenses` 这类单词不在其句子判据内。
//
// 判据：核心中文 starsector-core\data\hullmods\hull_mods.csv 的 uiTags 词表（实测 2026-09）：
//   武器 19 · 特殊 18 · 后勤 11 · 需要船坞 11 · 防御 10 · 护盾 8 · 引擎 6 · 战机 5 · 相位 2 · 支援 2
//   （核心自己还有 2 处未译：`Weapons`/`Defenses` 各 1 —— 那是核心汉化的既有瑕疵，不作为本闸门的白名单）
//
// 用法: node check_uitags_zh.js <modRoot> [--core=<核心 data 目录>] [--json=<out>]
//   退出码 0 = 干净；1 = 有英文标签（或非核心词表的标签）；2 = 用法错误
// 已知假阳性：无（本闸门只比对词表，不做语义推断）；若要新增合法标签，请先确认核心同列确实用了它。
const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./csvlib.js');

const argv = process.argv.slice(2);
if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
  console.log('usage: node check_uitags_zh.js <modRoot> [--core=<核心 data 目录>] [--json=<out>]');
  process.exit(argv.length ? 0 : 2);
}
const pos = argv.filter(a => !a.startsWith('--'));
const modRoot = pos[0];
if (!modRoot) { console.error('usage: node check_uitags_zh.js <modRoot> [--core=<核心 data 目录>] [--json=<out>]'); process.exit(2); }
const coreArg = (argv.find(a => a.startsWith('--core=')) || '').slice(7) || 'C:/game/StarSector.v0.9.8a-RC8/starsector-core/data';
const jsonArg = (argv.find(a => a.startsWith('--json=')) || '').slice(7);

// 核心词表（可由核心文件动态提取；核心缺失时回落到实测表）
const FALLBACK = ['武器', '特殊', '后勤', '需要船坞', '防御', '护盾', '引擎', '战机', '相位', '支援'];
let vocab = new Set(FALLBACK);
let vocabSource = '内置实测表';
const coreCsv = path.join(coreArg, 'hullmods', 'hull_mods.csv');
if (fs.existsSync(coreCsv)) {
  try {
    const { header, rows } = parseCsv(fs.readFileSync(coreCsv, 'utf8'));
    const i = header.indexOf('uiTags');
    if (i >= 0) {
      const set = new Set();
      for (const r of rows) {
        for (const t of String(r.cells[i] || '').split(',')) {
          const s = t.trim();
          // 只收「含 CJK」的标签，避免把核心自己没译的 Weapons/Defenses 收成白名单
          if (s && /[\u4e00-\u9fff]/.test(s)) set.add(s);
        }
      }
      if (set.size) { vocab = set; vocabSource = coreCsv; }
    }
  } catch (e) { /* 回落 */ }
}

const hits = [];
let checked = 0;
function scan(modDir) {
  const dirs = [modDir];
  while (dirs.length) {
    const d = dirs.pop();
    let ents = [];
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { dirs.push(p); continue; }
      if (e.name !== 'hull_mods.csv') continue;
      const { header, rows } = parseCsv(fs.readFileSync(p, 'utf8'));
      const i = header.indexOf('uiTags');
      const iId = header.indexOf('id');
      if (i < 0) continue;
      for (const r of rows) {
        // 注释行/模板行：`#` 开头（或任一格含 `#`，如 `# Accelerated Shields,…` 模板行）——引擎跳过，本闸门也跳过
        if (/^\s*#/.test(String(r.cells[0] === undefined ? '' : r.cells[0]))) continue;
        if (r.cells.some(c => String(c).includes('#'))) continue;
        const raw = String(r.cells[i] || '').trim();
        if (!raw) continue;
        checked++;
        for (const t of raw.split(',')) {
          const s = t.trim();
          if (!s) continue;
          const isAscii = /^[\x20-\x7E]+$/.test(s);
          if (isAscii || !vocab.has(s)) {
            hits.push({ file: path.relative(modRoot, p).replace(/\\/g, '/'), line: r.line, id: String(r.cells[iId] || '').trim(), tag: s, raw });
          }
        }
      }
    }
  }
}
scan(modRoot);

console.log('=== hull_mods.csv uiTags（船插分类显示列）汉化检查 ===');
console.log(`核心词表来源: ${vocabSource}`);
console.log(`词表(${vocab.size}): ${[...vocab].sort().join(' / ')}`);
console.log(`受检非空 uiTags 单元格: ${checked} | 可疑标签: ${hits.length}`);
for (const h of hits.slice(0, 40)) {
  console.log(`  [${h.file}] L${h.line} id=${h.id}  标签="${h.tag}"  （整格="${h.raw}"）`);
}
if (hits.length > 40) console.log(`  …还有 ${hits.length - 40} 条`);
if (hits.length) {
  console.log('\n处置：把英文标签换成核心同列用词（该列是**显示列**，引擎不查表）：');
  console.log('  Special→特殊  Defenses→防御  Weapons→武器  Shields→护盾  Engines→引擎  Fighters→战机');
  console.log('  Logistics→后勤  Requires Dock→需要船坞  Phase→相位  Support→支援');
  console.log('  注意：若上游原文该格为空，说明该船插本就无分类，**留空不要猜**。');
}
if (jsonArg) fs.writeFileSync(jsonArg, JSON.stringify({ vocabSource, vocab: [...vocab], checked, hits }, null, 1), { encoding: 'utf8' });
console.log('\n===== 结果: ' + (hits.length ? hits.length + ' 处可疑 ✘' : '全部通过 ✔') + ' =====');
process.exit(hits.length ? 1 : 0);
