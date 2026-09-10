// Extract ALL string constants from all classes in the RAT jar (already extracted to _jarcheck).
// Output: jar_constants.json -> { const: [class1, class2...] } (deduped)
const fs = require('fs');
const path = require('path');
const { parseClass } = require('./classparser.js');

const JARCHECK = 'C:/game/StarSector.v0.9.8a-RC8/mods/_jarcheck';
const OUT = 'C:/game/StarSector.v0.9.8a-RC8/mods/_rat_work/out/jar_constants.json';

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.class')) out.push(p);
  }
  return out;
}

const files = walk(JARCHECK);
const map = new Map(); // const -> Set<class rel>
let total = 0;
for (const f of files) {
  let buf;
  try { buf = fs.readFileSync(f); } catch (e) { continue; }
  let cp;
  try { cp = parseClass(buf).cp; } catch (e) { console.log('parse fail:', f, e.message); continue; }
  const rel = path.relative(JARCHECK, f).replace(/\\/g, '/');
  for (const e of cp) {
    if (e && e.tag === 1) {
      total++;
      if (!map.has(e.str)) map.set(e.str, new Set());
      map.get(e.str).add(rel);
    }
  }
}
const out = {};
for (const [s, cls] of map) out[s] = Array.from(cls);
fs.writeFileSync(OUT, JSON.stringify(out, null, 1), 'utf8');
console.log('classes:', files.length, 'utf8 entries:', total, 'unique constants:', Object.keys(out).length);
