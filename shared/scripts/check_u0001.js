// Verify: every mapping key containing \u0001 must have the SAME count of \u0001 in its translation.
const fs = require('fs');
const tc = JSON.parse(fs.readFileSync('C:/game/StarSector.v0.9.8a-RC8/mods/_rat_work/out/translations_code.json', 'utf8'));

const count = s => (s.match(/\u0001/g) || []).length;
let bad = [];
let totalU = 0;
for (const [k, v] of Object.entries(tc)) {
  const kc = count(k), vc = count(v);
  if (kc > 0 || vc > 0) {
    totalU++;
    if (kc !== vc) bad.push({ key: k, keyCount: kc, zhCount: vc, zh: v });
  }
}
console.log('entries containing \\u0001:', totalU);
console.log('MISMATCHED count:', bad.length);
fs.writeFileSync('C:/game/StarSector.v0.9.8a-RC8/mods/_rat_work/out/u0001_mismatch.json', JSON.stringify(bad, null, 1), 'utf8');
for (const b of bad) {
  console.log('--- key has ' + b.keyCount + ', zh has ' + b.zhCount);
  console.log('KEY:', JSON.stringify(b.key).slice(0, 90));
  console.log('ZH :', JSON.stringify(b.zh).slice(0, 90));
}
