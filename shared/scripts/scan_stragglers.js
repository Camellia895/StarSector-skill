// Scan a jar/class tree for constants that still look like English UI text
// (not replaced by the patch). Used as a quality net after patching.
const fs = require('fs');
const path = require('path');
const { walkCp, decodeModifiedUtf8 } = require('./patcher.js');

const dir = process.argv[2];
const outFile = process.argv[3] || 'C:/game/StarSector.v0.9.8a-RC8/mods/_rat_work/out/stragglers.json';

function walk(d) {
  const out = [];
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.class')) out.push(p);
  }
  return out;
}

const seen = new Map(); // str -> classes[]
for (const f of walk(dir)) {
  let buf;
  try { buf = fs.readFileSync(f); } catch (e) { continue; }
  let utf8s;
  try { utf8s = walkCp(buf).utf8s; } catch (e) { continue; }
  const rel = path.relative(dir, f).replace(/\\/g, '/');
  for (const u of utf8s) {
    const s = decodeModifiedUtf8(u.bytes);
    // looks like English UI text: has letters, has spaces or is a sentence-like phrase
    if (/[a-zA-Z]{3,}/.test(s) && /[\s]/.test(s) && s.length >= 8 && !/[\u4e00-\u9fff]/.test(s)) {
      if (!seen.has(s)) seen.set(s, []);
      seen.get(s).push(rel);
    }
  }
}
const arr = [];
for (const [s, cls] of seen) arr.push({ s, classes: cls.slice(0, 5), n: cls.length });
arr.sort((a, b) => b.n - a.n);
fs.writeFileSync(outFile, JSON.stringify(arr, null, 1), 'utf8');
console.log('remaining English-looking constants:', arr.length);
arr.slice(0, 40).forEach(x => console.log(`${x.n} | ${x.s.slice(0, 90)}`));
