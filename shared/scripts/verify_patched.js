// Verify patched classes: no \u0001-containing string constants, and report any
// English sentence-like strings remaining (straggler scan on the patched jar tree).
const fs = require('fs');
const path = require('path');
const { walkCp, decodeModifiedUtf8 } = require('./patcher.js');

const dir = process.argv[2] || 'C:/game/StarSector.v0.9.8a-RC8/mods/_templars_work/jarwork';

function walk(d) {
  const out = [];
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.class')) out.push(p);
  }
  return out;
}

let u0001 = 0;
const stragglers = new Map(); // s -> classes
for (const f of walk(dir)) {
  let buf;
  try { buf = fs.readFileSync(f); } catch (e) { continue; }
  let c;
  try { c = walkCp(buf); } catch (e) { continue; }
  const rel = path.relative(dir, f).replace(/\\/g, '/');
  for (const u of c.utf8s) {
    if (!c.stringRefs.has(u.index) || c.identRefs.has(u.index)) continue;
    const s = decodeModifiedUtf8(u.bytes);
    if (s.includes('\u0001')) { u0001++; console.log('u0001 in', rel, JSON.stringify(s.slice(0, 80))); }
    // sentence-like English remaining
    if (/[a-zA-Z]{4,}/.test(s) && /\s/.test(s) && s.length >= 10 && !/[\u4e00-\u9fff]/.test(s)) {
      if (/^(graphics|data|sounds)\//.test(s)) continue;
      if (/^tem_/.test(s)) continue;
      if (/\.(png|jpg|json|csv|fnt|ttf|ogg|class|java|wav)$/.test(s)) continue;
      if (!stragglers.has(s)) stragglers.set(s, []);
      stragglers.get(s).push(rel);
    }
  }
}
console.log('u0001 constants:', u0001);
console.log('remaining sentence-like English literals:', stragglers.size);
const arr = [...stragglers.entries()].sort((a, b) => a[0].localeCompare(b[0]));
for (const [s, cls] of arr) console.log(JSON.stringify(s.slice(0, 100)), '<-', cls.slice(0, 2).join(';'));
