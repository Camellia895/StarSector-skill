// Compare normalized javap -c output between two class dirs, class by class.
// Gate for "recompiled classes are bytecode-equivalent to the shipped jar;
// the only allowed diffs are the intended code changes (e.g. added null guards)".
// Normalization: strip '#NN' constant-pool indices and '// String ...' operand comments,
// keep numeric/float operand comments (catches changed folded constants).
// Usage: node cmp_build.js <oldDir> <newDir> <classpathForOld> <classpathForNew>
// Exit codes: 0 = all compared classes identical, 1 = diffs found, 2 = usage error.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const JAVAP = 'C:/Program Files/Android/Android Studio/jbr/bin/javap.exe';

const [oldDir, newDir, oldCp, newCp] = process.argv.slice(2);
if (!oldDir || !newDir || !oldCp || !newCp) {
  console.error('usage: node cmp_build.js <oldDir> <newDir> <classpathForOld> <classpathForNew>');
  process.exit(2);
}

function listClasses(dir) {
  const out = [];
  (function walk(root, d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(root, p, out);
      else if (e.name.endsWith('.class')) out.push(path.relative(root, p).split(path.sep).join('/'));
    }
  })(dir, dir);
  return out.sort();
}

function javapNormalized(cp, binaryName) {
  let raw;
  try {
    raw = execFileSync(JAVAP, ['-c', '-p', '-cp', cp, binaryName], { maxBuffer: 64 * 1024 * 1024 })
      .toString('utf8');
  } catch (e) {
    return 'JAVAP_FAILED: ' + (e.stderr ? e.stderr.toString() : e.message);
  }
  const kept = [];
  for (let ln of raw.split(/\r?\n/)) {
    ln = ln.replace(/#[0-9]+/g, '#');
    ln = ln.replace(/\/\/\s*String\s+.*/, '// String <str>'); // string CONTENT excluded (zh/en diff is expected); float/int comments kept
    ln = ln.replace(/\s+/g, ' ').trim();
    if (ln) kept.push(ln);
  }
  return kept.join('\n');
}

const oldClasses = listClasses(oldDir);
const newClasses = listClasses(newDir);
if (JSON.stringify(oldClasses) !== JSON.stringify(newClasses)) {
  console.log('CLASS LIST MISMATCH (expected if one side has extra classes, e.g. untouched ones)');
  console.log('old-only: ' + oldClasses.filter(c => !newClasses.includes(c)).join(', '));
  console.log('new-only: ' + newClasses.filter(c => !oldClasses.includes(c)).join(', '));
}
let same = 0, diff = 0;
for (const rel of oldClasses) {
  if (!newClasses.includes(rel)) continue;
  const bin = rel.replace(/\.class$/, '');
  const a = javapNormalized(oldCp, bin);
  const b = javapNormalized(newCp, bin);
  if (a === b) { same++; continue; }
  diff++;
  const al = a.split('\n'), bl = b.split('\n');
  console.log('=== DIFF ' + rel + '  (' + al.length + ' vs ' + bl.length + ' lines)');
  let shown = 0;
  for (let i = 0; i < Math.max(al.length, bl.length) && shown < 14; i++) {
    if (al[i] !== bl[i]) { console.log('  old[' + i + ']: ' + (al[i] || '<none>')); console.log('  new[' + i + ']: ' + (bl[i] || '<none>')); shown++; }
  }
}
console.log('SUMMARY: same=' + same + ' diff=' + diff + ' total=' + oldClasses.length);
process.exit(diff ? 1 : 0);
