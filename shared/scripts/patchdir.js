// Patch all .class files under a directory tree (in place) using the EN->ZH mapping.
// Usage: node patchdir.js <mapping.json> <classDir>
const fs = require('fs');
const path = require('path');
const { patchClass, encodeModifiedUtf8 } = require('./patcher.js');

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.class')) out.push(p);
  }
  return out;
}

const mappingFile = process.argv[2];
const classDir = process.argv[3];
const raw = JSON.parse(fs.readFileSync(mappingFile, 'utf8'));
const mapping = new Map();
for (const k of Object.keys(raw)) mapping.set(k, encodeModifiedUtf8(raw[k]));

const files = walk(classDir);
let replacedTotal = 0, changedClasses = 0, unchanged = 0;
const foundKeys = new Set();

// pass 1: read originals, count key presence, compute patches
const patches = []; // {file, buf} for changed classes
for (const f of files) {
  let buf;
  try { buf = fs.readFileSync(f); } catch (e) { continue; }
  const { walkCp } = require('./patcher.js');
  const { decodeModifiedUtf8 } = require('./patcher.js');
  try {
    const { utf8s } = walkCp(buf);
    for (const u of utf8s) {
      const s = decodeModifiedUtf8(u.bytes);
      if (mapping.has(s)) foundKeys.add(s);
    }
  } catch (e) { }
  let r;
  try { r = patchClass(buf, mapping); } catch (e) { console.log('PATCH FAIL:', f, e.message); continue; }
  if (r.buf) {
    patches.push({ file: f, buf: r.buf });
    replacedTotal += r.count;
    changedClasses++;
  } else {
    unchanged++;
  }
}
// pass 2: write patches
for (const p of patches) fs.writeFileSync(p.file, p.buf);
console.log('classes:', files.length, 'changed:', changedClasses, 'unchanged:', unchanged, 'total replacements:', replacedTotal);
const allKeys = new Set(mapping.keys());
const misses = [...allKeys].filter(k => !foundKeys.has(k));
console.log('mapping keys:', allKeys.size, 'found in jar:', foundKeys.size, 'MISSING:', misses.length);
if (misses.length) {
  fs.writeFileSync('C:/game/StarSector.v0.9.8a-RC8/mods/_rat_work/out/missing_keys.json', JSON.stringify(misses, null, 1), 'utf8');
  console.log('missing keys saved to out/missing_keys.json');
}
