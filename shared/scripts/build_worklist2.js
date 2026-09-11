// build_worklist2.js —【旧版·dormant】由 jar 常量 + 源码字面量生成工作清单。
// ⚠️ 已被 scan_jar_sources.js 取代（后者正确处理"注释夹折叠"与 Kotlin 片段）。新任务请用 scan_jar_sources.js。
// 用法: node build_worklist2.js <srcDir> <jarConstants.json> [outJson]
//   [outJson] 默认 <jarConstants.json 所在目录>/worklist2.json
//   node build_worklist2.js --help
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
  console.log('usage: node build_worklist2.js <srcDir> <jarConstants.json> [outJson]');
  console.log('（旧版脚本；新任务请用 scan_jar_sources.js <srcDir> <jarConstants.json> <out.json>）');
  process.exit(argv.length ? 0 : 2);
}
const SRC = argv[0];
const JARFILE = argv[1];
if (!SRC || !JARFILE) { console.error('缺少参数：见 --help'); process.exit(2); }
if (!fs.existsSync(SRC)) { console.error('srcDir 不存在: ' + SRC); process.exit(2); }
if (!fs.existsSync(JARFILE)) { console.error('jarConstants.json 不存在: ' + JARFILE); process.exit(2); }
const OUT = argv[2] || path.join(path.dirname(path.resolve(JARFILE)), 'worklist2.json');
const JAR = JSON.parse(fs.readFileSync(JARFILE, 'utf8'));
const jarSet = new Set(Object.keys(JAR));

function unescape(str) {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '\\') {
      const n = str[i + 1];
      switch (n) {
        case 'n': out += '\n'; i++; break;
        case 't': out += '\t'; i++; break;
        case 'r': out += '\r'; i++; break;
        case '"': out += '"'; i++; break;
        case '\\': out += '\\'; i++; break;
        case "'": out += "'"; i++; break;
        case 'u': out += String.fromCharCode(parseInt(str.slice(i + 2, i + 6), 16)); i += 5; break;
        case 'b': out += '\b'; i++; break;
        case 'f': out += '\f'; i++; break;
        case '0': out += '\0'; i++; break;
        default: out += n; i++; break;
      }
    } else out += ch;
  }
  return out;
}

// tokenize one line's double-quoted literals -> [{start, end, raw}]
function lineLiterals(line) {
  const toks = [];
  let i = 0;
  while (i < line.length) {
    const q = line.indexOf('"', i);
    if (q === -1) break;
    if (line.startsWith('"""', q)) { i = q + 3; continue; }
    let j = q + 1, closed = false;
    while (j < line.length) {
      if (line[j] === '\\') { j += 2; continue; }
      if (line[j] === '"') { closed = true; break; }
      j++;
    }
    if (!closed) { i = q + 1; continue; }
    toks.push({ start: q, end: j + 1, raw: line.slice(q + 1, j) });
    i = j + 1;
  }
  return toks;
}

// split raw literal content into items: {t:'frag', v} or {t:'interp'}
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

// fold: given ordered items, produce constant strings by merging consecutive frags (interps break)
function foldToConstants(items) {
  const out = [];
  let buf = '';
  for (const it of items) {
    if (it.t === 'frag') {
      buf += unescape(it.v);
    } else {
      if (buf) { out.push(buf); buf = ''; }
    }
  }
  if (buf) out.push(buf);
  return out;
}

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.kt') || e.name.endsWith('.java')) out.push(p);
  }
  return out;
}

const found = new Map(); // const -> {ctx, src, count}
for (const file of walk(SRC)) {
  const rel = path.relative(SRC, file).replace(/\\/g, '/');
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  // token stream with line numbers
  const stream = [];
  for (let ln = 0; ln < lines.length; ln++) {
    const toks = lineLiterals(lines[ln]);
    for (const t of toks) stream.push({ ...t, line: ln + 1, lineText: lines[ln].trim().slice(0, 150) });
  }
  // group adjacent tokens (gap only whitespace/+)
  let i = 0;
  while (i < stream.length) {
    let j = i;
    while (j + 1 < stream.length) {
      const gap = lines[stream[j].line - 1].slice(stream[j].end, undefined) + '\n' +
        lines.slice(stream[j].line, stream[j + 1].line - 1).join('\n') + '\n' +
        lines[stream[j + 1].line - 1].slice(0, stream[j + 1].start);
      if (/^[\s+]*$/.test(gap)) { j++; } else break;
    }
    // tokens i..j form one additive expression
    const items = [];
    for (let k = i; k <= j; k++) items.push(...splitItems(stream[k].raw));
    const consts = foldToConstants(items);
    for (const c of consts) {
      if (jarSet.has(c)) {
        if (!found.has(c)) found.set(c, { ctx: `${rel}:${stream[i].line}`, src: stream[i].lineText, count: 0 });
        found.get(c).count++;
      }
    }
    i = j + 1;
  }
}

const out = [];
for (const [c, meta] of found) {
  out.push({ c, ctx: meta.ctx, src: meta.src, classes: JAR[c], count: meta.count });
}
out.sort((a, b) => a.c.localeCompare(b.c));
fs.writeFileSync(OUT, JSON.stringify(out, null, 1), 'utf8');
console.log('worklist2 entries (jar constants matched to source):', out.length);
const lengths = {};
for (const e of out) {
  const l = e.c.length;
  const b = l < 5 ? '1-4' : l < 10 ? '5-9' : l < 20 ? '10-19' : l < 40 ? '20-39' : '40+';
  lengths[b] = (lengths[b] || 0) + 1;
}
console.log('length buckets:', JSON.stringify(lengths));
