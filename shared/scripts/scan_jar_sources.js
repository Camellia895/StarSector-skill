// scan_jar_sources.js — 把 jar 字符串常量与源码字面量对齐，产出带上下文的候选清单（通用版）。
// 同时支持 Java 与 Kotlin：
//  - Java/Kotlin 普通双引号字符串、转义（含 \uXXXX）、注释内文字剔除；
//  - 编译期常量折叠：相邻字面量之间仅隔空白/‘+’/注释行时会折叠成单一常量（“a”+“b”=>“ab”），
//    注释先行剔除（替换为空白）后自然放行——修正旧 build_worklist2.js 对注释夹折叠失效的问题；
//  - Kotlin ${...} 插值把字符串切成片段常量（片段逐个进 jar），翻译按片段、保证拼接通顺且顺序不变。
// 局限：Kotlin """ 原始字符串（多行）不纳入字面量扫描（其内容通常为文档/模板，需人工复核）。
//
// 用法：
//   node scan_jar_sources.js <srcDir> <jar_constants.json(analyze_jar_strings 输出)> <outJson>
// 输出：rows = [ { c, classes:[...], src:[{ctx,lineText}], asId:bool } ]，仅含 asString 候选且按 c 排序。
// 说明：jar_constants.json 里 asString=false 的常量（纯标识符）不入候选。
const fs = require('fs');
const path = require('path');

const SRCDIR = process.argv[2];
const JARJSON = process.argv[3];
const OUT = process.argv[4];
if (!SRCDIR || !JARJSON || !OUT) { console.error('usage: node scan_jar_sources.js <srcDir> <jarConstantsJson> <outJson>'); process.exit(1); }

const JAR = JSON.parse(fs.readFileSync(JARJSON, 'utf8'));
const jarMap = new Map();
for (const [s, m] of Object.entries(JAR)) if (m.asString) jarMap.set(s, m);

function unescape(str) {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '\\') {
      const n = str[i + 1];
      if (n === undefined) { out += ch; break; }
      switch (n) {
        case 'n': out += '\n'; i++; break;
        case 't': out += '\t'; i++; break;
        case 'r': out += '\r'; i++; break;
        case '"': out += '"'; i++; break;
        case '\\': out += '\\'; i++; break;
        case "'": out += "'"; i++; break;
        case 'b': out += '\b'; i++; break;
        case 'f': out += '\f'; i++; break;
        case '/': out += '/'; i++; break;
        case '0': out += '\0'; i++; break;
        case 'u': {
          const hex = str.slice(i + 2, i + 6);
          if (/^[0-9a-fA-F]{4}$/.test(hex)) { out += String.fromCharCode(parseInt(hex, 16)); i += 5; }
          else { out += n; i++; }
          break;
        }
        default: out += n; i++; break;
      }
    } else out += ch;
  }
  return out;
}

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.java') || e.name.endsWith('.kt')) out.push(p);
  }
  return out;
}

// 注释剔除（保留引号内与行结构），注释替换为空白使“夹注释折叠”自然成立
function stripComments(src) {
  let out = '';
  let inBlock = false, inLine = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i], n = src[i + 1];
    if (inBlock) {
      if (c === '*' && n === '/') { inBlock = false; out += '  '; i++; }
      else out += ' ';
      continue;
    }
    if (inLine) {
      if (c === '\n') { inLine = false; out += c; }
      else out += ' ';
      continue;
    }
    if (c === '/' && n === '/') { inLine = true; out += '  '; i++; continue; }
    if (c === '/' && n === '*') { inBlock = true; out += '  '; i++; continue; }
    if (c === '"') { out += c; continue; }
    if (c === "'") {
      let j = i + 1;
      while (j < src.length) { if (src[j] === '\\') j += 2; else if (src[j] === "'") break; else j++; }
      out += ' '.repeat(Math.max(1, j - i));
      i = j;
      continue;
    }
    out += c;
  }
  return out;
}

// Kotlin ${...} 把字面量切成片段：{t:'frag',v} 与 {t:'interp'}
function splitItems(raw) {
  const items = [];
  let cur = '';
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '\\') { cur += ch + (raw[i + 1] ?? ''); i++; continue; }
    if (ch === '$') {
      const n = raw[i + 1];
      if (n === '{') {
        let depth = 1, j = i + 2;
        while (j < raw.length && depth > 0) {
          if (raw[j] === '\\') { j += 2; continue; }
          if (raw[j] === '{') depth++;
          else if (raw[j] === '}') depth--;
          j++;
        }
        items.push({ t: 'frag', v: cur }); cur = '';
        items.push({ t: 'interp' });
        i = j - 1;
      } else if (n && /[A-Za-z_]/.test(n)) {
        let j = i + 1;
        while (j < raw.length && /[A-Za-z0-9_.]/.test(raw[j])) j++;
        items.push({ t: 'frag', v: cur }); cur = '';
        items.push({ t: 'interp' });
        i = j - 1;
      } else cur += ch;
    } else cur += ch;
  }
  items.push({ t: 'frag', v: cur });
  return items;
}

const found = new Map();
for (const file of walk(SRCDIR)) {
  const rel = path.relative(SRCDIR, file).replace(/\\/g, '/');
  const raw = fs.readFileSync(file, 'utf8');
  const clean = stripComments(raw);
  const lines = clean.split('\n');
  // 逐行扫描普通字符串；遇到 Kotlin """ 原始字符串则跳过（直到匹配的 """ 所在行）
  const stream = [];
  let inRaw = false;
  for (let ln = 0; ln < lines.length; ln++) {
    const line = lines[ln];
    let i = 0;
    while (i < line.length) {
      if (inRaw) {
        const end = line.indexOf('"""', i);
        if (end === -1) { i = line.length; }
        else { inRaw = false; i = end + 3; }
        continue;
      }
      const q = line.indexOf('"', i);
      if (q === -1) break;
      if (line.startsWith('"""', q)) { inRaw = true; i = q + 3; continue; }
      let j = q + 1, closed = false;
      while (j < line.length) {
        if (line[j] === '\\') { j += 2; continue; }
        if (line[j] === '"') { closed = true; break; }
        j++;
      }
      if (!closed) { i = q + 1; continue; }
      stream.push({ line: ln + 1, start: q, end: j + 1, raw: line.slice(q + 1, j), isKt: file.endsWith('.kt') });
      i = j + 1;
    }
  }
  // 折叠：相邻字面量间仅空白/‘+’（注释已被剔除）视为一个常量表达式
  let k = 0;
  while (k < stream.length) {
    let end = k;
    while (end + 1 < stream.length) {
      const a = stream[end], b = stream[end + 1];
      let gap;
      if (a.line === b.line) gap = lines[a.line - 1].slice(a.end, b.start);
      else {
        gap = lines[a.line - 1].slice(a.end) + '\n' + lines.slice(a.line, b.line - 1).join('\n') + '\n' + lines[b.line - 1].slice(0, b.start);
      }
      if (/^[\s+]*$/.test(gap)) end++;
      else break;
    }
    // 常量折叠只发生在“无插值”的纯常量拼接；插值会切断（此时各字面量自身即为常量）
    const items = [];
    let pure = true;
    for (let t = k; t <= end; t++) {
      items.push(...splitItems(stream[t].raw));
      if (stream[t].isKt) pure = false;   // Kotlin 片段逐个注册，不合并
    }
    const hasInterp = items.some(x => x.t === 'interp');
    const register = v => {
      if (jarMap.has(v)) {
        if (!found.has(v)) found.set(v, []);
        found.get(v).push({ ctx: rel + ':' + stream[k].line, lineText: lines[stream[k].line - 1].trim().slice(0, 160) });
      }
    };
    if (pure && !hasInterp && end > k) {
      // Java/无插值 Kotlin：整个 run 折叠成一个常量
      register(items.map(x => unescape(x.v)).join(''));
    } else if (hasInterp && stream[k].isKt) {
      // Kotlin 插值：逐片段注册（顺序保留，翻译后由译者保证拼接通顺）
      for (const it of items) if (it.t === 'frag' && it.v) register(unescape(it.v));
    } else {
      // 单字面量或 Java 插值：各自为常量
      for (let t = k; t <= end; t++) register(unescape(stream[t].raw));
    }
    k = end + 1;
  }
}

const rows = [];
for (const [c, meta] of jarMap) {
  rows.push({ c, classes: meta.classes, src: found.has(c) ? found.get(c) : [], asId: meta.asId });
}
rows.sort((a, b) => a.c.localeCompare(b.c));
fs.writeFileSync(OUT, JSON.stringify(rows, null, 1), 'utf8');
console.log('candidates:', rows.length, 'with src match:', rows.filter(r => r.src.length > 0).length);
