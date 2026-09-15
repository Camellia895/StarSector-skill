// extract_java_strings.js — 提取 Janino 运行时编译 mod 的 .java 源码字符串字面量。
// 本 mod 无 jars/（data/plugins + data/scripts 由游戏启动时 Janino 编译），
// 文本硬编码在源码里 ⇒ 翻译载体就是 .java 文件本身（改字符串字面量，其余逐字不动）。
//
// 状态机词法：跳过 // 与 /* */ 注释；解析 "..." 字面量（保留内部原始转义，不做解码，
// 以便注入时按字节替换）；'...' 字符字面量跳过。
//
// 每条输出：file / line / en(引号内原文) / stmt(所在完整语句行，含拼接上下文) / decl(所在声明或调用提示)
// 用法: node extract_java_strings.js <modRoot> <outJson>
const fs = require('fs');
const path = require('path');

const MOD = process.argv[2];
const OUT = process.argv[3];

const DIRS = ['data/plugins', 'data/scripts'];
const files = [];
for (const d of DIRS) {
  const base = path.join(MOD, d);
  if (!fs.existsSync(base)) continue;
  (function walk(rel) {
    for (const e of fs.readdirSync(path.join(MOD, rel), { withFileTypes: true })) {
      const r = rel + '/' + e.name;
      if (e.isDirectory()) walk(r);
      else if (e.name.endsWith('.java')) files.push(r);
    }
  })(d);
}

const out = [];
for (const f of files.sort()) {
  const src = fs.readFileSync(path.join(MOD, f), 'utf8');
  const lines = src.split(/\r?\n/);
  // EOL 风格记录（R17：注入时保持原风格）
  const crlf = (src.match(/\r\n/g) || []).length;
  const lfOnly = (src.match(/(?<!\r)\n/g) || []).length;
  const eol = crlf > 0 ? 'CRLF' : 'LF';

  let i = 0, line = 1, state = 'code', buf = '', litStartLine = 0, litStartIdx = -1;
  const lits = [];
  function curLineText() { return lines[line - 1] !== undefined ? lines[line - 1] : ''; }
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (c === '\n') { if (state === 'line') state = 'code'; line++; i++; continue; }
    if (state === 'code') {
      if (c === '/' && n === '/') { state = 'line'; i += 2; continue; }
      if (c === '/' && n === '*') { state = 'block'; i += 2; continue; }
      if (c === '"') { state = 'str'; buf = ''; litStartLine = line; litStartIdx = i; i++; continue; }
      if (c === "'") { state = 'chr'; i++; continue; }
      i++; continue;
    }
    if (state === 'line') { if (c === '\n') state = 'code'; i++; continue; }
    if (state === 'block') { if (c === '*' && n === '/') { state = 'code'; i += 2; } else { if (c === '\n') line++; i++; } continue; }
    if (state === 'str') {
      if (c === '\\') { buf += src.substr(i, 2); i += 2; continue; }
      if (c === '"') {
        lits.push({ en: buf, line: litStartLine, col: litStartIdx });
        state = 'code'; i++; continue;
      }
      buf += c; i++; continue;
    }
    if (state === 'chr') {
      if (c === '\\') { i += 2; continue; }
      if (c === "'") { state = 'code'; }
      i++; continue;
    }
  }

  for (const L of lits) {
    // stmt：字面量起始于哪一物理行，就取该行全文（本 mod 的语句基本单行/少行）
    out.push({
      file: f.replace(/\\/g, '/'),
      line: L.line,
      en: L.en,
      stmt: (lines[L.line - 1] || '').trim(),
      eol,
    });
  }
  if (lits.length) console.log(f + '  literals=' + lits.length + '  eol=' + eol + (crlf && lfOnly ? '  (MIXED!)' : ''));
}

fs.writeFileSync(OUT, JSON.stringify(out, null, 1), 'utf8');
console.log('total literals: ' + out.length + '  files: ' + files.length);
