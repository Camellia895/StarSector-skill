// EN->ZH mapping from old jar pair, ALWAYS LCS-aligned (old translated jar was recompiled,
// so positional zip is invalid even when literal counts match).
const fs = require('fs');
const path = require('path');
const { walkCp, decodeModifiedUtf8 } = require('./patcher.js');

const ORIG_DIR = process.argv[2];
const ZH_DIR = process.argv[3];
const OUT = process.argv[4];

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.class')) out.push(p);
  }
  return out;
}
function litList(buf) {
  const { utf8s, stringRefs, identRefs } = walkCp(buf);
  const list = [];
  for (const u of utf8s) {
    if (!stringRefs.has(u.index) || identRefs.has(u.index)) continue;
    list.push(decodeModifiedUtf8(u.bytes));
  }
  return list;
}
function align(a, b) {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const pairs = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { pairs.push([i, j]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return pairs;
}
// LCS-based pairing for EVERY index of the shorter list; returns [[ai,bj],...] for all a-indices
function lcsPairing(a, b) {
  const anchors = align(a, b);
  const n = a.length, m = b.length;
  const aIdx = new Array(n).fill(-1);
  const bUsed = new Array(m).fill(false);
  for (const [ai, bj] of anchors) { aIdx[ai] = bj; bUsed[bj] = true; }
  // pair remaining a indices to the nearest unused b index within their segment
  const out = [];
  const segStarts = [0, ...anchors.map(x => x[0] + 1)];
  const segB = [];
  let prev = -1;
  for (const [ai, bj] of anchors) {
    segB.push([prev + 1, bj]);
    prev = bj;
  }
  segB.push([prev + 1, m]);
  for (let s = 0; s < segStarts.length; s++) {
    const a0 = segStarts[s], a1 = (s < anchors.length ? anchors[s][0] : n);
    const b0 = segB[s][0], b1 = segB[s][1];
    // fill a-indices in this segment with b-indices in order
    let bi = b0;
    for (let ai = a0; ai < a1; ai++) {
      if (aIdx[ai] === -1) {
        while (bi < b1 && bUsed[bi]) bi++;
        if (bi < b1) { aIdx[ai] = bi; bUsed[bi] = true; bi++; }
      }
    }
  }
  for (let ai = 0; ai < n; ai++) if (aIdx[ai] !== -1) out.push([ai, aIdx[ai]]);
  return out;
}

const zhMap = new Map();
for (const f of walk(ZH_DIR)) zhMap.set(path.relative(ZH_DIR, f).replace(/\\/g, '/'), f);

const mapping = new Map();
const byClass = new Map();
let total = 0, classes = 0;
for (const f of walk(ORIG_DIR)) {
  const rel = path.relative(ORIG_DIR, f).replace(/\\/g, '/');
  if (!zhMap.has(rel)) continue;
  const o = litList(fs.readFileSync(f));
  const z = litList(fs.readFileSync(zhMap.get(rel)));
  const pairs = lcsPairing(o, z);
  let cls = 0;
  const clsPairs = [];
  for (const [oi, zi] of pairs) {
    const en = o[oi], zh = z[zi];
    if (en !== zh && /[\u4e00-\u9fff]/.test(zh)) {
      if (!mapping.has(en)) mapping.set(en, zh);
      clsPairs.push({ en, zh });
      total++;
      cls++;
    }
  }
  if (cls > 0) { classes++; byClass.set(rel, clsPairs); }
}
fs.writeFileSync(OUT, JSON.stringify(Object.fromEntries(mapping), null, 1), 'utf8');
fs.writeFileSync(OUT.replace('.json', '_byclass.json'), JSON.stringify(Object.fromEntries(byClass), null, 1), 'utf8');
console.log('classes with pairs:', classes, 'unique pairs:', mapping.size);
