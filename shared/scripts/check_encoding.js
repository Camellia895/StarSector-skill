// check_encoding.js — 检查数据文件是否为合法 UTF-8 无 BOM、无乱码（铁律：产出文件一律 UTF-8 无 BOM）。
// 用法:
//   node check_encoding.js <modRoot|目录|文件> [更多路径...] [--all]
//     传目录时默认只查「游戏会严格解析」的文本文件（*.csv/json/faction/version/ini/txt/md/java 等）；
//     --all 则把目录下所有文件都查一遍（含 jar/图片，仅做 BOM/乱码判定）
//   node check_encoding.js --list          # 打印默认文件清单（便于核对漏查）
//   node check_encoding.js --help
// 退出码: 0 = 全部合格；1 = 有 BOM / 非法 UTF-8（便于 run_check.js 记账）
// 注：判"是否 UTF-8"用宽松解码 —— 出现 U+FFFD 替换字符即视为非法。
const fs = require('fs');
const path = require('path');

const TEXT_EXT = new Set(['.csv', '.json', '.faction', '.version', '.ini', '.txt', '.md', '.java', '.kt', '.xml', '.yaml', '.yml', '.skin', '.ship', '.variant', '.system', '.wpn', '.proj', '.json5']);
const DEFAULT_REL = [
  'mod_info.json',
  'data/strings/descriptions.csv',
  'data/weapons/weapon_data.csv',
  'data/shipsystems/ship_systems.csv',
  'data/hullmods/hull_mods.csv',
  'data/hulls/ship_data.csv',
  'data/hulls/wing_data.csv',
  'data/campaign/rules.csv',
  'data/campaign/commodities.csv',
  'data/campaign/market_conditions.csv',
  'data/campaign/channels.json',
  'data/config/custom_entities.json',
  'data/config/settings.json',
  'data/config/LunaSettings.csv',
  'data/config/exerelin/customStarts.json',
];

const argv = process.argv.slice(2);
if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
  console.log('usage: node check_encoding.js <modRoot|dir|file> [...] [--all]');
  console.log('       node check_encoding.js --list');
  process.exit(argv.length ? 0 : 2);
}
if (argv.includes('--list')) {
  console.log('默认相对路径（存在才查）:');
  DEFAULT_REL.forEach(r => console.log('  ' + r));
  console.log('目录模式（未加 --all 时）按扩展名过滤: ' + [...TEXT_EXT].join(' '));
  process.exit(0);
}
const ALL = argv.includes('--all');
const targets = argv.filter(a => !a.startsWith('--'));

function walk(d, out) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (ALL || TEXT_EXT.has(path.extname(e.name).toLowerCase())) out.push(p);
  }
  return out;
}

// 收集待查文件
const files = [];
for (const t of targets) {
  if (!fs.existsSync(t)) { console.log('MISSING  ' + t); files.push({ p: t, missing: true }); continue; }
  const st = fs.statSync(t);
  if (st.isDirectory()) {
    // 目录：先看是不是 mod 根（有 mod_info.json），是则按默认清单 + 目录扫描
    for (const rel of DEFAULT_REL) {
      const p = path.join(t, rel);
      if (fs.existsSync(p) && !files.some(f => f.p === p)) files.push({ p });
    }
    for (const p of walk(t, [])) if (!files.some(f => f.p === p)) files.push({ p });
  } else {
    files.push({ p: t });
  }
}
if (!files.length) { console.error('没有可检查的文件'); process.exit(2); }

let bom = 0, invalid = 0, missing = 0;
for (const f of files) {
  if (f.missing) { missing++; continue; }
  const buf = fs.readFileSync(f.p);
  const hasBOM = buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF;
  const t = buf.toString('utf8');
  const hasReplacement = t.includes('\uFFFD');
  if (hasBOM) bom++;
  if (hasReplacement) invalid++;
  console.log(
    (hasBOM ? 'BOM! ' : 'ok ') +
    (hasReplacement ? 'INVALID-UTF8! ' : 'valid ') +
    f.p.replace(/\\/g, '/') + ' size=' + buf.length
  );
}
console.log('---');
console.log('files:', files.length, 'BOM:', bom, 'invalid-utf8:', invalid, 'missing:', missing);
process.exit((bom || invalid || missing) ? 1 : 0);

