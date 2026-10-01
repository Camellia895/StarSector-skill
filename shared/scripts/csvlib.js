// csvlib.js — RFC4180 CSV 解析/写回公共库（Starsector 数据文件通用）。
// 特点：
//  - 解析：支持引号内逗号、引号内换行、"" 转义；每条记录记录其起始物理行号（1 基）。
//  - 写回：仅当字段含 ", \n \r 之一时才加引号并做 "" 转义（Starsector 写回铁律）；
//    其余原样输出，避免多余引号改变游戏解析。
// ⚠️ 弯引号铁律（铁律 R1；详见 <skills>\shared\iron-rules.md 与 starsector-engine-diagnose §3.1）：引擎解析 CSV 前把 [\u201c\u201d]+ 归一化为 "、
//    [\u2018\u2019\ufffd]+ 归一化为 '。因此**写入数据 CSV 前必须先把译文弯引号转成 ASCII 引号**
//    （再交由本库引号/"" 转义）；否则弯引号贴字段边界会拆散行列 → JSONObject["options"] not found。
//    本库保持通用不自动转换——转换由调用方（汉化合并脚本）在写前完成；JSON/纯文本无此归一化。
//  - 文本一律按 UTF-8 处理；文件保存由调用方负责（产出 UTF-8 无 BOM）。
//
// 用法：
//   const { parseCsv, csvCell, csvJoinRow } = require('./csvlib.js');
//   const { header, rows } = parseCsv(fs.readFileSync(file,'utf8'));
//   rows.forEach(r => { r.line /*起始行*/; r.cells[colIdx] });
//
// ⚠️⚠️ 表头不属于 rows（2026-10-02 Hyperion 事故）：parseCsv 返回的 `rows` **不含表头行**（header 单独返回）。
//   **整文件重写必须显式把表头拼回**：`[csvJoinRow(header), ...rows.map(r => csvJoinRow(r.cells))].join(EOL) + EOL`。
//   直接 `rows.map(...)` 重写 = 表头丢失 → 全表列解析崩坏（引擎把首行数据当列名）。
//   该事故在字节层的指纹：每文件恰好 **少 1 个 CRLF**（check_eol.js 的 ±1 计数差最先暴露，样式本身没变）。
module.exports = { parseCsv, csvCell, csvJoinRow };

// text -> { header:[...], rows:[{cells:[...], line: number}] }
// header 取第一行（首个非空字段行亦可自定义：调用方可自行 slice）。
function parseCsv(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // 容错 BOM
  const lines = text.split('\n');
  const rows = [];
  let cur = [];
  let inQ = false;
  let field = '';
  let recStart = 0;
  const flushField = () => { cur.push(field); field = ''; };
  const flushRow = () => { flushField(); rows.push({ cells: cur, line: recStart }); cur = []; };
  for (let li = 0; li < lines.length; li++) {
    let s = lines[li];
    if (s.endsWith('\r')) s = s.slice(0, -1);
    if (cur.length === 0 && field === '') recStart = li + 1;
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (inQ) {
        if (c === '"') {
          if (s[i + 1] === '"') { field += '"'; i += 2; }
          else { inQ = false; i += 1; }
        } else { field += c; i += 1; }
      } else {
        if (c === '"') { inQ = true; i += 1; }      // 容错：允许引号出现在字段中部
        else if (c === ',') { flushField(); i += 1; }
        else { field += c; i += 1; }
      }
    }
    if (inQ) field += '\n';                          // 多行单元格
    else flushRow();
  }
  // 去掉文件末尾换行产生的空行
  if (rows.length && rows[rows.length - 1].cells.length === 1 && rows[rows.length - 1].cells[0] === '') rows.pop();
  if (rows.length === 0) return { header: [], rows };
  return { header: rows[0].cells, rows: rows.slice(1) };
}

// 单个字段写回：仅当含 ", \n \r（或本身以空白开头/结尾、为空串的特殊情况按需）才加引号。
function csvCell(cell) {
  if (cell === undefined || cell === null) return '';
  const s = String(cell);
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// cells -> 一行 CSV（行尾不含换行；调用方自行决定 \r\n 或 \n）。
function csvJoinRow(cells) {
  return cells.map(csvCell).join(',');
}
