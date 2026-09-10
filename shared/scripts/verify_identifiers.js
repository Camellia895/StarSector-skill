// Verify: no CJK in any NameAndType names or Class names across all classes
// (i.e. identifiers were not accidentally patched).
const fs = require('fs');
const path = require('path');
const { walkCp, decodeModifiedUtf8 } = require('./patcher.js');

function readU2(b, p) { return (b[p] << 8) | b[p + 1]; }
function readU1(b, p) { return b[p]; }

function checkClass(buf) {
  const cpCount = readU2(buf, 8);
  let p = 10;
  const cp = [null];
  for (let i = 1; i < cpCount; i++) {
    const tag = readU1(buf, p); p += 1;
    switch (tag) {
      case 1: { const len = readU2(buf, p); p += 2; const b = buf.subarray(p, p + len); p += len; cp.push({ tag: 1, str: decodeModifiedUtf8(b) }); break; }
      case 3: case 4: p += 4; cp.push({ tag }); break;
      case 5: case 6: p += 8; cp.push({ tag }); cp.push({ tag, wide: true }); i++; break;
      case 7: case 8: case 16: case 19: case 20: { const idx = readU2(buf, p); p += 2; cp.push({ tag, idx }); break; }
      case 9: case 10: case 11: case 12: case 17: case 18: { const a = readU2(buf, p); const b = readU2(buf, p + 2); p += 4; cp.push({ tag, a, b }); break; }
      case 15: p += 3; cp.push({ tag }); break;
      default: throw new Error('tag ' + tag);
    }
  }
  const bad = [];
  // NameAndType(12).a = name_index (field/method name); Class(7).idx = class name
  for (let i = 1; i < cp.length; i++) {
    const e = cp[i];
    if (!e) continue;
    if (e.tag === 12) {
      const name = cp[e.a];
      if (name && name.tag === 1 && /[\u4e00-\u9fff]/.test(name.str)) bad.push('field/method name: ' + name.str);
    }
    if (e.tag === 7) {
      const name = cp[e.idx];
      if (name && name.tag === 1 && /[\u4e00-\u9fff]/.test(name.str)) bad.push('class name: ' + name.str);
    }
  }
  return bad;
}

const dir = process.argv[2];
function walk(d) {
  const out = [];
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.class')) out.push(p);
  }
  return out;
}
let badCount = 0;
for (const f of walk(dir)) {
  try {
    const bad = checkClass(fs.readFileSync(f));
    if (bad.length) {
      badCount++;
      console.log(path.relative(dir, f) + ': ' + bad.join('; '));
    }
  } catch (e) { console.log('parse fail ' + f + ': ' + e.message); }
}
console.log('classes with CJK identifiers: ' + badCount);
