// Rezip a directory tree into a jar with forward-slash entry names.
// Usage: node rezip.js <dir> <out.jar>
const fs = require('fs');
const path = require('path');
const { ZipArchive } = require('./patcher.js');

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const dir = process.argv[2];
const outFile = process.argv[3];
const files = walk(dir);
const entries = [];
for (const f of files) {
  const rel = path.relative(dir, f).replace(/\\/g, '/');
  entries.push({ name: rel, data: fs.readFileSync(f) });
}
const zip = new ZipArchive();
zip.write(outFile, entries);
console.log('zipped', entries.length, 'entries ->', outFile);
