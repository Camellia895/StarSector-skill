// Multiset-based Utf8 diff per class between two dump_utf8.js outputs.
// Gate for "recompiled jar preserves patched (localized) string constants":
// old-only strings = zh translations to backfill (before rebuild);
// old-vs-final diff MUST be empty (after rebuild).
// Usage: node diff_utf8_multiset.js <utf8_old.json> <utf8_new.json> [--out=<zhList.json>]
// Exit codes: 0 = identical multisets (all classes), 1 = differences found, 2 = usage error.
'use strict';
const fs = require('fs');
const argv = process.argv.slice(2);
const pos = argv.filter(a => !a.startsWith('--'));
const outArg = (argv.find(a => a.startsWith('--out=')) || '').split('=').slice(1).join('=') || null;
if (pos.length < 2) {
  console.error('usage: node diff_utf8_multiset.js <utf8_old.json> <utf8_new.json> [--out=<zhList.json>]');
  process.exit(2);
}

function multiset(arr) {
  const m = new Map();
  for (const s of arr) m.set(s, (m.get(s) || 0) + 1);
  return m;
}
function minus(a, b) {
  const m = new Map(a);
  for (const [s, n] of b) {
    const left = (m.get(s) || 0) - n;
    if (left > 0) m.set(s, left); else m.delete(s);
  }
  return m;
}

const oldD = JSON.parse(fs.readFileSync(pos[0], 'utf8'));
const newD = JSON.parse(fs.readFileSync(pos[1], 'utf8'));
const collected = new Set();
let dirty = 0;
const oldKeys = new Set(Object.keys(oldD));
for (const cls of Object.keys(newD).sort()) {
  if (!oldKeys.has(cls)) { console.log('!! new-only class: ' + cls); dirty++; continue; }
  const o = multiset(oldD[cls]), n = multiset(newD[cls]);
  const oldOnly = [...minus(o, n).keys()];
  const newOnly = [...minus(n, o).keys()];
  if (!oldOnly.length && !newOnly.length) continue;
  dirty++;
  console.log('=== ' + cls);
  for (const s of newOnly) console.log('  NEW: ' + JSON.stringify(s));
  for (const s of oldOnly) { console.log('  OLD: ' + JSON.stringify(s)); collected.add(s); }
  if (oldOnly.length !== newOnly.length) console.log('  !! COUNT MISMATCH old=' + oldOnly.length + ' new=' + newOnly.length);
}
for (const cls of oldKeys) {
  if (!newD[cls]) { console.log('!! old-only class: ' + cls); dirty++; }
}
if (outArg) fs.writeFileSync(outArg, JSON.stringify([...collected], null, 1), 'utf8');
console.log('SUMMARY: classes with diffs = ' + dirty + (outArg ? '; old-only strings -> ' + outArg : ''));
process.exit(dirty ? 1 : 0);
