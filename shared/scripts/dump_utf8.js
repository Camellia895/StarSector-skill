// Dump all CONSTANT_Utf8 entries of .class files in constant-pool order.
// Usage: node dump_utf8.js <classDir> <out.json> [prefix]
// Reads every *.class under <classDir> recursively; writes
// { "rel/path/Name.class": ["utf8", ...] } keyed by classDir-relative path.
'use strict';
const fs = require('fs');
const path = require('path');

function dumpClass(file) {
  const buf = fs.readFileSync(file);
  if (buf.length < 10) throw new Error('too small: ' + file);
  if (buf.readUInt32BE(0) !== 0xCAFEBABE) throw new Error('not a class file: ' + file);
  const count = buf.readUInt16BE(8); // constant_pool_count
  const strings = [];
  let i = 10;
  for (let idx = 1; idx < count; idx++) {
    const tag = buf[i];
    if (tag === 1) { // Utf8: u2 len + bytes
      const len = buf.readUInt16BE(i + 1);
      strings.push(buf.toString('utf8', i + 3, i + 3 + len));
      i += 3 + len;
    } else if (tag === 5 || tag === 6) { // Long/Double take two pool slots
      i += 9; idx++;
    } else if (tag === 7 || tag === 8 || tag === 16 || tag === 19 || tag === 20) {
      i += 3; // Class/String/MethodType/Module/Package: u2 index
    } else if (tag === 15) {
      i += 4; // MethodHandle: u1 ref_kind + u2 ref_index
    } else {
      i += 5; // Integer/Float/Fieldref/Methodref/InterfaceMethodref/NameAndType/InvokeDynamic
    }
  }
  return strings;
}

function walk(root, dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(root, p, out);
    else if (e.name.endsWith('.class')) {
      out[path.relative(root, p).split(path.sep).join('/')] = dumpClass(p);
    }
  }
}

const [inDir, outFile] = process.argv.slice(2);
if (!inDir || !outFile) {
  console.error('usage: node dump_utf8.js <classDir> <out.json>');
  process.exit(2);
}
const result = {};
walk(inDir, inDir, result);
fs.writeFileSync(outFile, JSON.stringify(result, null, 1), 'utf8');
console.log('dumped ' + Object.keys(result).length + ' classes -> ' + outFile);
