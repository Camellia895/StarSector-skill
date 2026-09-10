// Post-patch verification: every \u0001-containing string literal in the patched classes
// must have the same \u0001 count as its ORIGINAL text (either it was untouched, or it was
// replaced by a translation whose key—the original text—has the same count).
const fs = require('fs');
const path = require('path');
const { walkCp, decodeModifiedUtf8 } = require('./patcher.js');
const jc = JSON.parse(fs.readFileSync('C:/game/StarSector.v0.9.8a-RC8/mods/_rat_work/out/jar_constants.json', 'utf8'));
const tc = JSON.parse(fs.readFileSync('C:/game/StarSector.v0.9.8a-RC8/mods/_rat_work/out/translations_code.json', 'utf8'));

const dir = 'C:/game/StarSector.v0.9.8a-RC8/mods/_rat_work/jarwork';
const count = s => (s.match(/\u0001/g) || []).length;
// reverse map: zh -> set of en keys
const zhToEn = new Map();
for (const [en, zh] of Object.entries(tc)) {
  if (!zh.includes('\u0001')) continue;
  if (!zhToEn.has(zh)) zhToEn.set(zh, []);
  zhToEn.get(zh).push(en);
}

function walk(d) {
  const out = [];
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.class')) out.push(p);
  }
  return out;
}

let checked = 0, bad = 0;
const badList = [];
for (const f of walk(dir)) {
  let buf, cp;
  try { buf = fs.readFileSync(f); cp = walkCp(buf); } catch (e) { continue; }
  const rel = path.relative(dir, f).replace(/\\/g, '/');
  for (const u of cp.utf8s) {
    if (!cp.stringRefs.has(u.index)) continue;
    const s = decodeModifiedUtf8(u.bytes);
    if (!s.includes('\u0001')) continue;
    checked++;
    let origText = null;
    if (s in jc) {
      origText = s; // untouched original
    } else if (zhToEn.has(s)) {
      origText = zhToEn.get(s)[0]; // replaced by translation; its key is the original text
    }
    if (origText === null) {
      bad++; badList.push({ class: rel, text: s.slice(0, 80), note: 'cannot resolve original' });
      continue;
    }
    if (count(origText) !== count(s)) {
      bad++;
      badList.push({ class: rel, text: s.slice(0, 80), orig: count(origText), patched: count(s) });
    }
  }
}
console.log('checked \\u0001 string constants:', checked);
console.log('count mismatches vs original:', bad);
if (badList.length) console.log(JSON.stringify(badList.slice(0, 15), null, 1));
