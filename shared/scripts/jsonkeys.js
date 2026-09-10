// jsonkeys.js —— 比较两个 JSON 风格的顶层键（只读，容错）
// 用法: node jsonkeys.js <a.json> [b.json]
//
// 说明：游戏数据允许 `#` 注释、尾随逗号、裸键、`;` 结尾、`[STATIONS]` 这类枚举值、未加引号的
// 字符串值（如 "morality":amoral）。本脚本先做轻量预处理尝试 JSON.parse；**失败则退化为
// "文本级顶层键提取"**（会标注 heuristic）。
// 想得到"游戏到底能不能读这个文件"的权威结论，请用 JsonProbe.java（调用游戏自带 org.json）。
const fs = require('fs');

function preprocess(s) {
  let out = ''; let inStr = false; let esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      out += c;
      if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; out += c; continue; }
    if (c === '#') { while (i < s.length && s[i] !== '\n') i++; out += '\n'; continue; }
    if (c === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') i++; out += '\n'; continue; }
    out += c;
  }
  out = out.replace(/\}\s*;/g, '},').replace(/\]\s*;/g, '],');   // `;` 当逗号
  out = out.replace(/,\s*([}\]])/g, '$1').replace(/,\s*$/, '');  // 尾随逗号
  out = out.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":'); // 裸键
  return out;
}

// 文本级顶层键提取：只在"深度 1 + 后面紧跟冒号"的字符串算顶层键
function topKeysHeuristic(txt) {
  const keys = [];
  let depth = 0; let i = txt.indexOf('{');
  if (i < 0) return keys;
  for (; i < txt.length; i++) {
    const c = txt[i];
    if (c === '"') {
      const start = i + 1;
      let k = start, e2 = false;
      for (; k < txt.length; k++) {
        if (e2) { e2 = false; continue; }
        if (txt[k] === '\\') { e2 = true; continue; }
        if (txt[k] === '"') break;
      }
      let j = k + 1;
      while (j < txt.length && /\s/.test(txt[j])) j++;
      if (txt[j] === ':' && depth === 1) keys.push(txt.slice(start, k));
      i = k;
      continue;
    }
    if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') depth--;
  }
  return keys.filter((v, idx, arr) => arr.indexOf(v) === idx);
}

function read(file) {
  const pre = preprocess(fs.readFileSync(file, 'utf8'));
  try {
    const o = JSON.parse(pre);
    return { keys: Object.keys(o), how: 'parsed' };
  } catch (e) {
    return { keys: topKeysHeuristic(pre), how: 'heuristic' };
  }
}

const A = process.argv[2], B = process.argv[3];
if (!A) { console.error('用法: node jsonkeys.js <a.json> [b.json]'); process.exit(2); }
const ra = read(A);
console.log(`A = ${A}`);
console.log(`  方式: ${ra.how}   顶层键 ${ra.keys.length} 个`);
console.log('  keys: ' + ra.keys.join(', '));

let anyHeuristic = ra.how !== 'parsed';
if (B) {
  const rb = read(B);
  if (rb.how !== 'parsed') anyHeuristic = true;
  console.log(`B = ${B}`);
  console.log(`  方式: ${rb.how}   顶层键 ${rb.keys.length} 个`);
  console.log('  keys: ' + rb.keys.join(', '));
  console.log('  IN B NOT A: ' + (rb.keys.filter(k => !ra.keys.includes(k)).join(', ') || '(none)'));
  console.log('  IN A NOT B: ' + (ra.keys.filter(k => !rb.keys.includes(k)).join(', ') || '(none)'));
}
if (anyHeuristic) {
  console.log('\n提示：出现 heuristic 说明该文件不符合严格 JSON（游戏数据常见，属正常）。');
  console.log('      要确认"游戏能否读取"，请用 scripts\\JsonProbe.java（调用游戏自带 org.json）。');
}
