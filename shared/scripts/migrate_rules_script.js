// Migrate rules.csv script column: translate AddText "..." and $marketLeaveTooltip = "..."
// contents from old zh, keeping the rule syntax (AddText, AdjustRep, $vars, \n) intact.
const fs = require('fs');
const { parseCSV, toCSV } = require('./csvtool.js');
const OLD = 'C:/game/StarSector.v0.9.8a-RC8/mods/Templars-old/data/campaign/rules.csv';
const NEW = 'C:/game/StarSector.v0.9.8a-RC8/mods/Templars/data/campaign/rules.csv';

const oldRows = parseCSV(fs.readFileSync(OLD, 'utf8'));
const newRows = parseCSV(fs.readFileSync(NEW, 'utf8'));
const h = newRows[0];
const idIdx = h.indexOf('id'), scriptIdx = h.indexOf('script');
const oldMap = new Map();
for (const r of oldRows.slice(1)) oldMap.set(r[0], r);

function translateScriptLine(oldScript, newScript) {
  // Strategy: for each AddText "..." or $xxxTooltip = "..." segment in NEW script,
  // find the corresponding segment in OLD script (same surrounding tokens), and
  // replace the quoted text with the old zh text.
  // We do a line-by-line diff: old and new scripts have same line count & same
  // non-quoted tokens (verified by inspection). So we zip lines.
  const ol = oldScript.split(/\r?\n|\n/);
  const nl = newScript.split(/\r?\n|\n/);
  const out = [];
  for (let i = 0; i < nl.length; i++) {
    let line = nl[i];
    const oldLine = ol[i];
    if (oldLine === undefined) { out.push(line); continue; }
    // match AddText "..." pattern
    const m = line.match(/^(\s*(?:AddText|AddText\s*)("|\\"\\")(.*?)\2(\s*marketFlavorTextColor)?\s*$)/s);
    const om = oldLine.match(/(?:"|\\"\\")([^"\\]*(?:\\.[^"\\]*)*)(?:"|\\"\\")/);
    if (m && om && /[\u4e00-\u9fff]/.test(om[1])) {
      // reconstruct: keep everything before the quote, replace content
      const idxQ = line.indexOf('"');
      const endQ = line.lastIndexOf('"');
      if (idxQ >= 0 && endQ > idxQ) {
        const prefix = line.slice(0, idxQ);
        const suffix = line.slice(endQ + 1);
        line = prefix + '"' + om[1] + '"' + suffix;
      }
    }
    // match $marketLeaveTooltip = "..." / $xxx = "..."
    const tm = line.match(/^(\s*\$\w+\s*=\s*")(.*)("\s*\d?\s*)$/);
    const otm = oldLine.match(/^(\s*\$\w+\s*=\s*")(.*)("\s*\d?\s*)$/);
    if (tm && otm && /[\u4e00-\u9fff]/.test(otm[2])) {
      line = tm[1] + otm[2] + tm[3];
    }
    out.push(line);
  }
  return out.join('\n');
}

let changed = 0;
const out = [h];
for (const r of newRows.slice(1)) {
  const or = oldMap.get(r[0]);
  if (or && or[scriptIdx] && /[\u4e00-\u9fff]/.test(or[scriptIdx]) && or[scriptIdx] !== r[scriptIdx]) {
    const fixed = translateScriptLine(or[scriptIdx], r[scriptIdx]);
    if (fixed !== r[scriptIdx]) { r[scriptIdx] = fixed; changed++; }
  }
  out.push(r);
}
fs.writeFileSync(NEW, toCSV(out), 'utf8');
console.log('script column migrated for', changed, 'rules');
