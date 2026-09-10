// check_content.js — Starsector 汉化"内容层"快速自检（配套 starsector-mod-localization-content skill）。
// 用法: node check_content.js <file.csv> <可翻译列名...>
//   例: node check_content.js data/hullmods/hull_mods.csv name desc short
// 逐单元格检查（尊重引号解析，跨行单元格也处理）：
//   [ERROR] 字面裸 %（非 %% 也非 %s/%d/%f/%n 占位）→ tooltip String.format 崩溃风险
//   [WARN ] %s/%d 等占位符（需确认调用方确有传参）
//   [WARN ] 未加引号单元格内的 ASCII 逗号/引号（结构风险）
//   [WARN ] 中文文本中的半角标点 , ; : ! ?（风格）
//   [WARN ] 疑似整句英文残留（字母为主且含空格的长文本；id/枚举值不会被选入列）
// 退出码：有 ERROR 为 1，否则 0。
const fs = require('fs');

const file = process.argv[2];
const cols = process.argv.slice(3);
if (!file || cols.length === 0) {
  console.error('usage: node check_content.js <file.csv> <translatableCol...>');
  process.exit(2);
}

// RFC4180 感知：返回数组的数组（支持引号内逗号/换行/双引号转义）
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQ = false;
      } else cell += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.length > 1 || row[0] !== '') rows.push(row);
  return rows;
}

const rows = parseCsv(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const hdr = rows[0].map(h => h.trim());
const idx = cols.map(c => {
  const i = hdr.indexOf(c);
  if (i < 0) console.warn(`[skip] 列不存在: ${c}`);
  return i;
}).filter(i => i >= 0);

let errors = 0, warns = 0;

function isCjk(ch) { return /[\u4e00-\u9fff]/.test(ch); }

for (let r = 1; r < rows.length; r++) {
  for (const ci of idx) {
    const cell = rows[r][ci] === undefined ? '' : rows[r][ci];
    if (cell.trim() === '') continue;
    const loc = `row ${r + 1} col ${hdr[ci]}`;
    // 1) 裸 %
    let m;
    const re = /%/g;
    while ((m = re.exec(cell)) !== null) {
      const nxt = cell[m.index + 1];
      if (nxt === '%') { re.lastIndex++; continue; }          // %% 转义，OK
      if (nxt === 's' || nxt === 'd' || nxt === 'f' || nxt === 'n' || nxt === '%') {
        console.log(`[WARN ] ${file}:${loc} 占位符 %${nxt}（确认调用方有传参）`);
        warns++;
      } else {
        console.log(`[ERROR] ${file}:${loc} 字面裸 % 后接 ${JSON.stringify(nxt || '行尾')} → 写 %%`);
        errors++;
      }
    }
    // 2) 未加引号单元格内 ASCII 逗号/引号（单元格开头无引号才提示）
    const raw = cell;
    if (!raw.startsWith('"') && /[",]/.test(raw)) {
      console.log(`[WARN ] ${file}:${loc} 含 ASCII 逗号/引号且未加引号 → 检查是否拆列`);
      warns++;
    }
    // 3) 中文间的半角标点
    if (/[\u4e00-\u9fff][,;:!?][\u4e00-\u9fff]/.test(raw)) {
      console.log(`[WARN ] ${file}:${loc} 中文间出现半角标点 → 用全角，。；：！？`);
      warns++;
    }
    // 4) 疑似整句英文残留（≥12 字符、字母为主、含空格；不含 CJK）
    const letters = (raw.match(/[A-Za-z]/g) || []).length;
    if (letters >= 12 && !isCjk(raw[0]) && letters / raw.length > 0.6 && /\s/.test(raw) && !/[\u4e00-\u9fff]/.test(raw)) {
      console.log(`[WARN ] ${file}:${loc} 疑似整句英文残留: ${raw.slice(0, 60)}`);
      warns++;
    }
  }
}
console.log(`--- ${file}: ${rows.length - 1} 行, ${errors} ERROR, ${warns} WARN`);
process.exit(errors ? 1 : 0);
