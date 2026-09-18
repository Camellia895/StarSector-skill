// uitags_lib.js — uiTags 系列脚本共用的小工具：CSV 记录读取 + 注释行识别。
// ⚠️ 为什么需要注释行识别：引擎的 CSV 读取器把 `#` 开头的行整行当注释跳过，而 csvlib 会把
//    「# Accelerated Shields,advancedshieldemitter,…」这种行当成一条数据记录解析 ⇒
//    该行第 7 格（uiTags 列）会取到 `Shields` 之类的英文，被闸门误报为"分类未汉化"。
//    实测：TreasureHunt / Trails of Tooth and Claw 的 data\config\hull_mods.csv 整份就是
//    模板文件（只有一行示例 + 三行 # 注释），两个闸门都因此各报 1 处假命中。
const fs = require('fs');
const { parseCsv } = require('./csvlib.js');

// 记录是否为注释行（物理行以 # 开头，允许前导空白）
function isCommentRecord(text, record) {
  const line = text.slice(record.start, record.end).replace(/^\uFEFF/, '');
  return /^\s*#/.test(line);
}

// 读一个 CSV：返回 { header, rows }，其中 rows 保留 csvlib 的 {cells,line} 形态。
// 注释行识别规则（与引擎一致 + 实测事故导向）：
//   * 物理行以 `#` 开头（允许前导空白）⇒ 整行注释；
//   * 该行**任意单元格**里出现 `#`（如 `# Accelerated Shields` 被当第 1 格）⇒ 也按注释处理。
//     严格说引擎只在行首判 `#`，但"单元格里带 #"的行一定是模板/注释残留，不该进闸门。
function readCsvNoComments(file) {
  const text = fs.readFileSync(file, 'utf8');
  const t = parseCsv(text);
  const rows = t.rows.filter(r => {
    if (!r.cells.length) return false;
    if (/^\s*#/.test(String(r.cells[0] === undefined ? '' : r.cells[0]))) return false;
    return !r.cells.some(c => String(c).includes('#'));
  });
  return { header: t.header, rows, raw: text };
}

module.exports = { isCommentRecord, readCsvNoComments };
