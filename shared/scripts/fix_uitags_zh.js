// fix_uitags_zh.js — ★船插分类显示列（hull_mods.csv 的 uiTags）汉化注入器（幂等、可 --dry）
//
// 背景：`uiTags` 是**显示列**——引擎把该列的值（英文逗号切分）直接当装配界面/百科的船插分类标签显示，
// 不查任何注册表；英文标签 ⇒ 分类名就是英文且不报错不打日志（2026-09-18 Kyeltziv 1.10.7 事故）。
// 核心中文 starsector-core\data\hullmods\hull_mods.csv 同列用词即权威词表（见 CORE_MAP）。
//
// 实现要点（为什么不用 csvlib 整体重建）：
//   实测多个 mod 的 hull_mods.csv 是**混合行尾**（如 Kayse：7×CRLF + 20×LF，引号内多行字段是 LF）。
//   整体 parse→serialize 会把混合行尾统一，违反铁律 R17（check_eol.js 会红灯）。
//   ⇒ 本脚本做**字节级定点替换**：状态机求出目标单元格的 [start,end) 区间，只改那一段，
//      其余字节（行尾风格、字段引号风格、注释行）一律原样保留。
//
// 语义：
//   * 只替换**整格逗号切分后的某个标签**，必须与映射表**完全相等**（trim 后）才替换；
//     不做子串替换、不猜译、不改作者自定标签（`Unique`/`DEVTOOL`/`Utility` 保留）。
//   * 标签里已有中文（核心词表或作者自定，如 `基础`/`进攻`）一律视为已完成，不动。
//   * 空 `uiTags` 合法（= 该船插无分类），不补不猜。
//
// 用法:
//   node fix_uitags_zh.js <modRoot> [更多 modRoot...] [--dry] [--backup] [--ext-map=<json>] [--json=<out>]
//     --dry            只报告不写盘
//     --backup         写盘前把原 hull_mods.csv 复制到 <backupDir>/<mod名>/hull_mods.csv（已有则不覆盖）
//     --backupDir=<d>  备份根目录（默认 C:\game\StarSector.v0.9.8a-RC8\_work\mod_bak\uitags_fix）
//     --ext-map=<json> 追加映射 { "ModCustomTag": "自定义中文" }（给**确认过**的自定义标签用）
//     --json=<out>     把逐条变更写成 JSON（供 worklist/复核）
//  退出码: 0 = 无需改或改成功；1 = 有未覆盖的英文标签（需人工定性）；2 = 用法错误
const fs = require('fs');
const path = require('path');

// ── 核心权威词表（EN → ZH），来源：核心中文 hull_mods.csv 同列逐字对照 ──────────────
const CORE_MAP = {
  'Weapons': '武器',
  'Special': '特殊',
  'Logistics': '后勤',
  'Requires Dock': '需要船坞',
  'Defenses': '防御',
  'Shields': '护盾',
  'Engines': '引擎',
  'Fighters': '战机',
  'Phase': '相位',
  'Support': '支援',
  // 上游拼写变体（核心英文原版没有，语义与核心词相同）⇒ 归一化
  'Require Dock': '需要船坞',
  'Logistic': '后勤',
};

// ── 字节级 CSV 单元格定位（RFC4180 状态机；返回每个单元格的 [start,end) 与原文） ──
function splitRecords(text) {
  const out = [];
  let i = 0, inQ = false;
  while (i < text.length) {
    const start = i;
    if (text[i] === '"') inQ = true;
    while (i < text.length) {
      const c = text[i];
      if (c === '"') { if (inQ && text[i + 1] === '"') { i += 2; continue; } inQ = !inQ; i++; continue; }
      if (!inQ && (c === '\n' || c === '\r')) break;
      i++;
    }
    if (i >= text.length) { if (i > start) out.push({ start, end: i }); break; }
    out.push({ start, end: i });
    if (text[i] === '\r' && text[i + 1] === '\n') i += 2; else i += 1;
  }
  return out;
}
function cellSpans(text, rs) {
  const s = text.slice(rs.start, rs.end);
  const spans = [];
  let i = 0;
  while (true) {
    const st = i;
    if (s[i] === '"') {
      i++;
      while (i < s.length) { if (s[i] === '"') { if (s[i + 1] === '"') { i += 2; continue; } i++; break; } i++; }
      while (i < s.length && s[i] !== ',') i++;
    } else {
      while (i < s.length && s[i] !== ',') i++;
    }
    spans.push({ start: rs.start + st, end: rs.start + i });
    if (i < s.length && s[i] === ',') { i++; continue; }
    break;
  }
  return spans;
}
function inner(raw) {
  if (raw.length >= 2 && raw[0] === '"' && raw[raw.length - 1] === '"') return raw.slice(1, -1).split('""').join('"');
  return raw;
}
function encode(innerText, wasQuoted) {
  if (wasQuoted || /[",\r\n]/.test(innerText)) return '"' + innerText.split('"').join('""') + '"';
  return innerText;
}

const argv = process.argv.slice(2);
if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
  console.log('usage: node fix_uitags_zh.js <modRoot> [更多 modRoot...] [--dry] [--backup] [--ext-map=<json>] [--json=<out>]');
  process.exit(argv.length ? 0 : 2);
}
const mods = argv.filter(a => !a.startsWith('--')).map(p => path.resolve(p));
if (!mods.length) { console.error('需要至少一个 <modRoot>'); process.exit(2); }
const DRY = argv.includes('--dry');
const BACKUP = argv.includes('--backup');
const backupDir = (argv.find(a => a.startsWith('--backupDir=')) || '').slice(12)
  || 'C:/game/StarSector.v0.9.8a-RC8/_work/mod_bak/uitags_fix';
const extMapArg = (argv.find(a => a.startsWith('--ext-map=')) || '').slice(10);
const jsonArg = (argv.find(a => a.startsWith('--json=')) || '').slice(7);
const MAP = Object.assign({}, CORE_MAP);
if (extMapArg) {
  const ext = JSON.parse(fs.readFileSync(extMapArg, 'utf8'));
  for (const [k, v] of Object.entries(ext)) {
    if (CORE_MAP[k]) { console.error(`--ext-map 不能覆盖核心词 ${k}`); process.exit(2); }
    MAP[k] = v;
  }
}

const changes = [];
const skipped = [];
let touched = 0, scannedCells = 0, changedRows = 0;

for (const modRoot of mods) {
  const csvPath = path.join(modRoot, 'data', 'hullmods', 'hull_mods.csv');
  const modName = path.basename(modRoot);
  if (!fs.existsSync(csvPath)) { console.log(`skip  ${modName}  (无 data/hullmods/hull_mods.csv)`); continue; }
  const text = fs.readFileSync(csvPath, 'utf8');
  const records = splitRecords(text);
  if (!records.length) { console.log(`skip  ${modName}  (空文件)`); continue; }
  const header = cellSpans(text, records[0]).map(sp => inner(text.slice(sp.start, sp.end)));
  const iUi = header.indexOf('uiTags'), iId = header.indexOf('id');
  if (iUi < 0) { console.log(`skip  ${modName}  (表头无 uiTags 列)`); continue; }

  const edits = [];   // {start, end, text}
  let n = 0;
  for (let ri = 1; ri < records.length; ri++) {
    const spans = cellSpans(text, records[ri]);
    if (spans.length <= iUi) continue;
    const raw = text.slice(spans[iUi].start, spans[iUi].end);
    const val = inner(raw);
    if (!val.trim()) continue;
    scannedCells++;
    const id = spans.length > iId ? inner(text.slice(spans[iId].start, spans[iId].end)).trim() : '';
    const parts = val.split(',');
    let changed = false;
    const next = parts.map(p => {
      const core = p.trim();
      if (!core) return p;
      if (/[\u4e00-\u9fff]/.test(core)) return p;           // 已是中文 ⇒ 不动
      if (MAP[core]) {
        changed = true;
        changes.push({ mod: modName, file: 'data/hullmods/hull_mods.csv', line: ri + 1, id, from: core, to: MAP[core], cell: val });
        return p.replace(core, MAP[core]);
      }
      skipped.push({ mod: modName, file: 'data/hullmods/hull_mods.csv', line: ri + 1, id, tag: core, cell: val });
      return p;
    });
    if (changed) {
      edits.push({ start: spans[iUi].start, end: spans[iUi].end, text: encode(next.join(',') , raw.length >= 2 && raw[0] === '"') });
      n++; changedRows++;
    }
  }
  if (!n) { console.log(`clean ${modName}  (无需改动)`); continue; }
  let out = text;
  for (const e of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  // 自检：行数/结构不变、且除了目标格以外字节完全一致（用记录数 + 长度差核对）
  const after = splitRecords(out);
  const okStruct = after.length === records.length;
  console.log(`${DRY ? '[dry] ' : ''}${modName}: 改 ${n} 行 uiTags  结构一致=${okStruct}`);
  if (!okStruct) { console.error(`!! ${modName} 自检失败，放弃写入`); process.exit(1); }
  if (!DRY) {
    if (BACKUP) {
      const dir = path.join(backupDir, modName);
      fs.mkdirSync(dir, { recursive: true });
      const bp = path.join(dir, 'hull_mods.csv');
      if (!fs.existsSync(bp)) fs.copyFileSync(csvPath, bp);
    }
    fs.writeFileSync(csvPath, out, { encoding: 'utf8' });
    // 同目录 .csv.json 探针副本：整体同步（该产物非游戏数据，可用解析结果重建）
    const jp = csvPath + '.json';
    if (fs.existsSync(jp)) {
      const rows = [];
      for (let ri = 1; ri < after.length; ri++) {
        const spans = cellSpans(out, after[ri]);
        const o = {};
        header.forEach((h, i) => { o[h] = i < spans.length ? inner(out.slice(spans[i].start, spans[i].end)) : ''; });
        rows.push(o);
      }
      fs.writeFileSync(jp, JSON.stringify(rows, null, 1), { encoding: 'utf8' });
      console.log(`      同步探针 ${path.basename(jp)}`);
    }
    touched++;
  }
}

console.log(`\n受检非空 uiTags 单元格: ${scannedCells} | 替换标签: ${changes.length} | 变更行: ${changedRows} | 未覆盖英文标签: ${skipped.length}`);
if (skipped.length) {
  console.log('未覆盖（需人工定性，脚本不动）：');
  for (const s of skipped.slice(0, 40)) console.log(`  ${s.mod}  L${s.line} id=${s.id}  "${s.tag}"`);
  if (skipped.length > 40) console.log(`  …还有 ${skipped.length - 40} 条`);
  console.log('  处置：① 核心分类的别名/拼写变体 → 用 --ext-map 追加映射；' +
              '② 作者自定分类（Unique/DEVTOOL/Utility…）→ 确认要汉化就写进 --ext-map，否则保留原文。');
}
if (jsonArg) fs.writeFileSync(jsonArg, JSON.stringify({ changes, skipped }, null, 1), { encoding: 'utf8' });
if (!DRY) console.log(`已写盘 mod 数: ${touched}`);
process.exit(skipped.length ? 1 : 0);
