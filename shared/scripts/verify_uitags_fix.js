// verify_uitags_fix.js — 对 fix_uitags_zh.js 的批量改动做闸门复核（结构 + 行尾 + 目标格 + 全量复扫）
// 用法: node verify_uitags_fix.js <backupDir> <modRoot...> [--ext-map=<json>]
//   backupDir 下按 `<mod名>/<相对路径>`（如 <mod>/data/hullmods/hull_mods.csv）存修复前快照
//   比较 mod 下**所有** hull_mods.csv（含 data\config\ 等非标准位置）
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { parseCsv } = require('./csvlib.js');

const SK = __dirname;
const argv = process.argv.slice(2);
const backupDir = argv.filter(a => !a.startsWith('--'))[0];
const mods = argv.filter(a => !a.startsWith('--')).slice(1).map(p => path.resolve(p));
if (!backupDir || !mods.length) { console.error('usage: node verify_uitags_fix.js <backupDir> <modRoot...> [--ext-map=<json>]'); process.exit(2); }

const vocab = new Set(['武器', '特殊', '后勤', '需要船坞', '防御', '护盾', '引擎', '战机', '相位', '支援']);
const extMapArg = (argv.find(a => a.startsWith('--ext-map=')) || '').slice(10);
if (extMapArg) for (const v of Object.values(JSON.parse(fs.readFileSync(extMapArg, 'utf8')))) vocab.add(v);

function eol(t) { return { crlf: (t.match(/\r\n/g) || []).length, lf: (t.match(/(?<!\r)\n/g) || []).length }; }
function findAllHullMods(modRoot) {
  const out = [];
  const stack = [modRoot];
  while (stack.length) {
    const d = stack.pop();
    let ents = [];
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== '.git') stack.push(p); continue; }
      if (e.name === 'hull_mods.csv') out.push(p);
    }
  }
  return out;
}

let fail = 0, checkedMods = 0, changedCells = 0;
for (const modRoot of mods) {
  const name = path.basename(modRoot);
  let any = false, bad = false;
  for (const a of findAllHullMods(modRoot)) {
    const rel = path.relative(modRoot, a);
    // 备份布局（fix_uitags_zh.js）：标准位置存 <mod>/hull_mods.csv；非标准位置存 <mod>/<相对路径中的 \ → __>__hull_mods.csv
    const flat = rel.replace(/[\\/]/g, '__') + '.csv';
    const isStd = rel.replace(/[\\/]/g, '/') === 'data/hullmods/hull_mods.csv';
    const cands = [
      path.join(backupDir, name, rel),             // 新布局：<mod>/<相对路径>
      path.join(backupDir, name, 'bypath', flat),  // 非标准位置（扁平化相对路径）
    ];
    // 老布局（<mod>/hull_mods.csv）只对**标准位置**成立，否则会拿主文件去比 data\config\ 模板
    if (isStd) cands.push(path.join(backupDir, name, 'hull_mods.csv'));
    const b = cands.find(p => fs.existsSync(p));
    if (!b) continue;   // 该文件未改过（无备份）
    any = true;
    const tb = fs.readFileSync(b, 'utf8'), ta = fs.readFileSync(a, 'utf8');
    const eb = eol(tb), ea = eol(ta);
    const eolSame = eb.crlf === ea.crlf && eb.lf === ea.lf;
    const pb = parseCsv(tb), pa = parseCsv(ta);
    const iUi = pa.header.indexOf('uiTags'), iId = pa.header.indexOf('id');
    const structSame = pb.header.length === pa.header.length && pb.rows.length === pa.rows.length
      && pb.rows.every((r, i) => pa.rows[i] && r.cells.length === pa.rows[i].cells.length);
    // 按 id 索引比对（不按行号）：备份与当前记录数不同也不会越界/错配
    const byId = new Map();
    for (const r of pb.rows) {
      const id = String(r.cells[iId] === undefined ? '' : r.cells[iId]).trim();
      if (id && !byId.has(id)) byId.set(id, r);
    }
    let diffs = 0; const badTags = [];
    for (const ra of pa.rows) {
      const id = String(ra.cells[iId] === undefined ? '' : ra.cells[iId]).trim();
      if (!id) continue;                       // 空 id 行（分区注释/空行）跳过：它们不是船插条目
      const rb = byId.get(id);
      const va = String(ra.cells[iUi] || '');
      const vb = rb ? String(rb.cells[iUi] || '') : null;
      if (vb !== null && vb === va) continue;
      diffs++;
      for (const t of va.split(',')) {
        const s = t.trim();
        if (!s) continue;
        if (!vocab.has(s)) badTags.push(`${id}:"${s}"`);
      }
    }
    changedCells += diffs;
    const ok = eolSame && structSame && diffs > 0 && badTags.length === 0;
    if (!ok) { fail++; bad = true; }
    console.log(`${ok ? 'OK ' : '!! '} ${name}/${rel}  差异格=${diffs}  EOL一致=${eolSame}  结构一致=${structSame}${badTags.length ? '  非词表标签: ' + badTags.slice(0, 5).join(' ') : ''}`);
  }
  if (any && !bad) checkedMods++;
}
console.log(`\n完全通过的 mod: ${checkedMods} | 变更单元格: ${changedCells} | 失败: ${fail}`);

// 全量复扫：所有 mod（含未改动的）列出剩余英文标签
console.log('\n=== 全量复扫（check_uitags_zh.js，所有 mod） ===');
const modsDir = process.env.MODS_DIR || 'C:/game/StarSector.v0.9.8a-RC8/mods';
let dirty = 0;
for (const e of fs.readdirSync(modsDir, { withFileTypes: true })) {
  if (!e.isDirectory()) continue;
  const p = path.join(modsDir, e.name);
  let out = '';
  try { out = execFileSync(process.execPath, [path.join(SK, 'check_uitags_zh.js'), p], { encoding: 'utf8' }); }
  catch (err) { out = String(err.stdout || ''); }
  const m = out.match(/可疑标签: (\d+)/);
  if (!m || m[1] === '0') continue;
  dirty++;
  const tags = [...out.matchAll(/标签="([^"]+)"/g)].map(x => x[1]);
  const uniq = [...new Set(tags)];
  const core = uniq.filter(t => /^(Weapons|Special|Logistics|Requires Dock|Defenses|Shields|Engines|Fighters|Phase|Support|Require Dock|Logistic)$/.test(t));
  console.log(`  ${e.name}: ${m[1]} 处 | 标签=${uniq.join(',')} | 核心英文残留=${core.length ? '有(' + core.join(',') + ')' : '无'}`);
}
console.log(`剩余有英文标签的 mod 数: ${dirty}（"核心英文残留=无"= 只剩作者自定标签，属预期）`);
process.exit(fail ? 1 : 0);
