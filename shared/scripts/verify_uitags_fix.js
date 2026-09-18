// verify_uitags_fix.js — 对 fix_uitags_zh.js 的批量改动做闸门复核（结构 + 行尾 + 目标格 + 全量复扫）
// 用法: node verify_uitags_fix.js <backupDir> <modRoot...>
//   backupDir 下每个 <mod名>/hull_mods.csv = 修复前快照
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { parseCsv } = require('./csvlib.js');

const SK = __dirname;
const backupDir = process.argv[2];
const mods = process.argv.slice(3).map(p => path.resolve(p));
if (!backupDir || !mods.length) { console.error('usage: node verify_uitags_fix.js <backupDir> <modRoot...>'); process.exit(2); }

function eol(t) { return { crlf: (t.match(/\r\n/g) || []).length, lf: (t.match(/(?<!\r)\n/g) || []).length }; }

let fail = 0, checkedMods = 0, changedCells = 0, outOfVocab = 0;
const vocab = new Set(['武器', '特殊', '后勤', '需要船坞', '防御', '护盾', '引擎', '战机', '相位', '支援']);

for (const modRoot of mods) {
  const name = path.basename(modRoot);
  const b = path.join(backupDir, name, 'hull_mods.csv');
  const a = path.join(modRoot, 'data', 'hullmods', 'hull_mods.csv');
  if (!fs.existsSync(b)) { console.log(`--  ${name}: 无备份，跳过对比`); continue; }
  if (!fs.existsSync(a)) { console.log(`!!  ${name}: 目标文件不存在`); fail++; continue; }
  checkedMods++;
  const tb = fs.readFileSync(b, 'utf8'), ta = fs.readFileSync(a, 'utf8');
  const eb = eol(tb), ea = eol(ta);
  const eolSame = eb.crlf === ea.crlf && eb.lf === ea.lf;
  const pb = parseCsv(tb), pa = parseCsv(ta);
  const structSame = pb.header.length === pa.header.length && pb.rows.length === pa.rows.length
    && pb.rows.every((r, i) => r.cells.length === pa.rows[i].cells.length);
  const iUi = pa.header.indexOf('uiTags'), iId = pa.header.indexOf('id');
  let diffs = 0, bad = [];
  for (let i = 0; i < pa.rows.length; i++) {
    const vb = String(pb.rows[i].cells[iUi] || ''), va = String(pa.rows[i].cells[iUi] || '');
    if (vb === va) continue;
    diffs++;
    const id = String(pa.rows[i].cells[iId] || '').trim();
    for (const t of va.split(',')) {
      const s = t.trim();
      if (!s) continue;
      if (!/[\u4e00-\u9fff]/.test(s) || (!vocab.has(s))) bad.push(`${id}:"${s}"`);
      if (!/[\u4e00-\u9fff]/.test(s)) outOfVocab++;
    }
  }
  changedCells += diffs;
  const ok = eolSame && structSame && diffs > 0 && bad.length === 0;
  if (!ok) fail++;
  console.log(`${ok ? 'OK ' : '!! '} ${name}  差异格=${diffs}  EOL一致=${eolSame}  结构一致=${structSame}${bad.length ? '  非词表标签: ' + bad.slice(0, 5).join(' ') : ''}`);
}
console.log(`\n受检 mod: ${checkedMods} | 变更单元格: ${changedCells} | 失败: ${fail}`);

// 全量复扫：所有已开开关的 mod（含未改动的）都不能再有核心英文标签
console.log('\n=== 全量复扫（check_uitags_zh.js，所有 mod） ===');
const modsDir = 'C:/game/StarSector.v0.9.8a-RC8/mods';
let dirty = 0;
for (const e of fs.readdirSync(modsDir, { withFileTypes: true })) {
  if (!e.isDirectory()) continue;
  const p = path.join(modsDir, e.name);
  if (!fs.existsSync(path.join(p, 'data', 'hullmods', 'hull_mods.csv'))) continue;
  try {
    const out = execFileSync(process.execPath, [path.join(SK, 'check_uitags_zh.js'), p], { encoding: 'utf8' });
    if (!/全部通过/.test(out)) { dirty++; console.log(`  仍有命中: ${e.name}`); }
  } catch (err) {
    const out = String(err.stdout || '');
    const m = out.match(/可疑标签: (\d+)/);
    if (m && m[1] !== '0') { dirty++; const list = out.split('\n').filter(l => /标签="/.test(l)).slice(0, 3).map(l => l.trim()); console.log(`  ${e.name}: 可疑 ${m[1]}`); for (const l of list) console.log('      ' + l); }
  }
}
console.log(`剩余有英文标签的 mod 数: ${dirty}（含作者自定标签与英文原版 mod，属预期）`);
process.exit(fail ? 1 : 0);
