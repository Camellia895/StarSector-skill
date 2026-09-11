// check_install_source.js — **安装前置断言**：确认目标 mod 目录是"英文原版"（red 级）。
//
// 为什么必须有（真实事故）：
//   注入脚本按"英文原值 → 译文"替换；若目标目录**已经是中文**，替换全部失配。
//   而 options 之类"合成字段"在失配时会保留"原文"（其实是上一次的中文），
//   于是被追加成「英文行 + 中文行」→ 一行变两行、optionId 重复 → 游戏启动 NumberFormatException。
//   同时 .ship/.variant/.json 的替换会静默失败（打印一堆"未命中"），容易被忽视。
//   → 因此**写入前必须断言目标是英文原版**，而不是假设。
//
// 判据（可自由扩展）：给若干"探针"——(文件, id 列, id 值, 取值列, 英文原值)，逐条比对。
//   默认探针自动从英文原版备份里挑（挑取值列里最长的英文文本），无需手写。
//
// 用法:
//   node check_install_source.js <modRoot> <enBackupRoot> [--json]
//     <modRoot>       准备注入的目标目录
//     <enBackupRoot>  英文原版备份目录
//     --json          以 JSON 输出探针明细
//   node check_install_source.js --probe=<file>:<idCol>:<idVal>:<col> <modRoot> <enBackupRoot>
//     自定义探针（可重复）；给出 --probe 时不再自动挑选
//   node check_install_source.js --help
// 退出码: 0 = 目标目录是英文原版（可安全注入）；1 = 已非英文原版（应拒绝注入并先还原）；2 = 调用错误
const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./csvlib.js');

const argv = process.argv.slice(2);
if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
  console.log('usage: node check_install_source.js <modRoot> <enBackupRoot> [--json]');
  console.log('       node check_install_source.js --probe=<file>:<idCol>:<idVal>:<col> ... <modRoot> <enBackupRoot>');
  process.exit(argv.length ? 0 : 2);
}
const AS_JSON = argv.includes('--json');
const pos = argv.filter(a => !a.startsWith('--'));
const [MOD, BAK] = pos;
if (!MOD || !BAK) { console.error('用法见 --help：需要 <modRoot> <enBackupRoot>'); process.exit(2); }
for (const [n, p] of [['modRoot', MOD], ['enBackupRoot', BAK]]) {
  if (!fs.existsSync(p)) { console.error(`${n} 不存在: ${p}`); process.exit(2); }
}

// ---- 收集探针 ----
const probes = [];   // {file, idCol, idVal, col, expect}
const custom = argv.filter(a => a.startsWith('--probe=')).map(a => a.split('=').slice(1).join('='));
if (custom.length) {
  for (const c of custom) {
    const [file, idCol, idVal, col] = c.split(':');
    if (!file || !idCol || !idVal || !col) { console.error('--probe 格式: <file>:<idCol>:<idVal>:<col>'); process.exit(2); }
    const p = path.join(BAK, file);
    if (!fs.existsSync(p)) { console.error('probe 文件不存在于备份: ' + file); process.exit(2); }
    const { header, rows } = parseCsv(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
    const ii = header.indexOf(idCol), ci = header.indexOf(col);
    const row = rows.find(r => (r.cells[ii] || '').trim() === idVal);
    probes.push({ file, idCol, idVal, col, expect: row ? (row.cells[ci] || '').trim() : '' });
  }
} else {
  // 自动挑选：优先这些"人可读文本列"，取英文原版里最长的一条
  const PREF = [
    ['data/hulls/ship_data.csv', 'name'],
    ['data/hullmods/hull_mods.csv', 'name'],
    ['data/weapons/weapon_data.csv', 'name'],
    ['data/shipsystems/ship_systems.csv', 'name'],
    ['data/campaign/commodities.csv', 'name'],
    ['data/campaign/industries.csv', 'name'],
  ];
  for (const [file, col] of PREF) {
    const p = path.join(BAK, file);
    if (!fs.existsSync(p)) continue;
    let parsed;
    try { parsed = parseCsv(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '')); } catch (e) { continue; }
    const { header, rows } = parsed;
    const iId = header.indexOf('id'), ci = header.indexOf(col);
    if (iId < 0 || ci < 0) continue;
    let best = null;
    for (const r of rows) {
      const id = (r.cells[iId] || '').trim();
      const v = (r.cells[ci] || '').trim();
      if (!id || id.startsWith('#') || !v) continue;
      if (!/[A-Za-z]{3}/.test(v)) continue;                       // 需要英文才能判"是否已汉化"
      if (!best || v.length > best.expect.length) best = { file, idCol: 'id', idVal: id, col, expect: v };
    }
    if (best) probes.push(best);
  }
}
if (!probes.length) { console.error('没有可用探针（备份里找不到可判定的英文文本列）'); process.exit(2); }

// ---- 比对 ----
const results = [];
for (const pr of probes) {
  const p = path.join(MOD, pr.file);
  let got = '(文件缺失)';
  if (fs.existsSync(p)) {
    let parsed;
    try { parsed = parseCsv(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '')); } catch (e) { parsed = null; }
    if (parsed) {
      const { header, rows } = parsed;
      const ii = header.indexOf(pr.idCol), ci = header.indexOf(pr.col);
      const row = rows.find(r => (r.cells[ii] || '').trim() === pr.idVal);
      got = row ? (row.cells[ci] || '').trim() : '(未找到该 id)';
    } else got = '(解析失败)';
  }
  results.push({ ...pr, got, ok: got === pr.expect });
}
const fails = results.filter(r => !r.ok);

if (AS_JSON) {
  console.log(JSON.stringify({ modRoot: MOD, enBackupRoot: BAK, ok: fails.length === 0, results }, null, 1));
  process.exit(fails.length ? 1 : 0);
}

console.log('=== 安装前置断言：目标目录是否为英文原版 ===');
console.log(`目标: ${MOD}\n英文基线: ${BAK}\n探针 ${results.length} 个\n`);
for (const r of results) {
  console.log(`  ${r.ok ? '✓' : '✗'} ${r.file} [${r.idVal}].${r.col}`);
  if (!r.ok) console.log(`      期望(英文): ${JSON.stringify(r.expect)}\n      实际:       ${JSON.stringify(r.got)}`);
}
if (!fails.length) {
  console.log('\n✓ 目标目录是英文原版 —— 可安全注入');
  process.exit(0);
}
console.log(`\n✗ 目标目录**不是英文原版**（${fails.length}/${results.length} 个探针不符）。`);
console.log('  它很可能已经汉化过。继续注入会把"中文"当成"英文原值"，');
console.log('  对合成字段（如 rules.csv 的 options）会追加成"一行变两行 + optionId 重复" → 启动崩溃。');
console.log('\n正确处理：先从英文原版恢复，再注入。例如：');
console.log(`  Copy-Item -Recurse -Force "${BAK}\\*" "${MOD}\\"`);
console.log('  （或在注入脚本里用 --from-backup=<EN备份目录> 让脚本自动恢复后再装）');
process.exit(1);
