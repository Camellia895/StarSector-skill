// pseudojson.js — Starsector “伪 JSON” 解析公共库。
// Starsector 数据 JSON 常带 # 注释、尾随逗号、Java float 后缀(1.2f)、甚至 BOM，
// 不能直接 JSON.parse，也禁止 ConvertFrom-Json 回写（会破坏原格式与注释）。
// 本库只负责“读”；回写一律用文本替换（见迁移 skill migrate_json.js 思路）。
// 用法：
//   const { parseJsonLoose, stripJsonComments, findLineOf, linesOf } = require('./pseudojson.js');
module.exports = { parseJsonLoose, stripJsonComments, findLineOf, linesOf };

// 逐字符去掉注释（字符串外的 # 到行尾），保留字符串内 #。
function stripJsonComments(raw) {
  let out = '';
  let inStr = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (inStr) {
      out += c;
      if (c === '\\') { out += raw[i + 1] || ''; i++; }
      else if (c === '"') inStr = false;
    } else if (c === '"') { inStr = true; out += c; }
    else if (c === '#') { while (i < raw.length && raw[i] !== '\n') i++; }
    else out += c;
  }
  return out;
}

// 宽松解析：去注释 → 去 Java float 后缀 → 去尾随逗号 → 裸枚举值加引号 → JSON.parse。
// 注意：文件内字符串若含 “数字+f” 字面（几乎不会），会被误伤；可先人工确认。
function parseJsonLoose(raw) {
  let s = stripJsonComments(raw);
  s = s.replace(/(\d+(?:\.\d+)?)f\b/g, '$1');   // 1.2f -> 1.2
  s = s.replace(/,\s*}/g, '}').replace(/,\s*\]/g, ']');
  // 引擎 JSON 允许裸枚举值（实测 custom_entities.json 的 "layers":[STATIONS]）：
  // 冒号/逗号/左括号之后的裸标识符按字符串值处理（true/false/null 除外）；只影响“读”，不回写。
  // 2026-09-16 修复：该替换必须跳过字符串内部——tips.json 实测 "…bombers, Daggers, Perditions…"
  // 这类行内 `, Word,` 会被误加引号，把合法字符串数组搅成非法 JSON（Vayra's Sector 汉化事故）。
  s = s.replace(/([:,\[]\s*)([A-Za-z_][A-Za-z_0-9]*)(?=\s*[,\]}]|\s*$)/gm, (m, pre, word, off) =>
    /^(true|false|null)$/.test(word) || insideString(s, off) ? m : pre + '"' + word + '"');
  return JSON.parse(s);
}

// 判定 offset 是否落在 JSON 字符串字面量内部（处理 \" 转义）。
function insideString(text, off) {
  let inStr = false;
  for (let i = 0; i < off; i++) {
    const c = text[i];
    if (inStr) { if (c === '\\') i++; else if (c === '"') inStr = false; }
    else if (c === '"') inStr = true;
  }
  return inStr;
}

// 原始文本按行切分（去掉行尾 \r）
function linesOf(raw) {
  return raw.split('\n').map(l => (l.endsWith('\r') ? l.slice(0, -1) : l));
}

// 返回包含指定子串的 1 基行号；找不到返回 1（仅作上下文参考，不用于回填定位）。
function findLineOf(raw, needle) {
  const lines = linesOf(raw);
  const i = lines.findIndex(l => l.includes(needle));
  return i < 0 ? 1 : i + 1;
}
