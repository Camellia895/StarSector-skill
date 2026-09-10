// Migrate templars.faction by prefix matching:
// old line: <indent>"spaceSailor":{"name":"侍从"},
// new line: <indent>"spaceSailor":{"name":"Page"},
// shared prefix: <indent>"spaceSailor":{"name":"  -> replace the quoted value after it.
const fs = require('fs');
const oldFile = 'C:/game/StarSector.v0.9.8a-RC8/mods/Templars-old/data/world/factions/templars.faction';
const newFile = 'C:/game/StarSector.v0.9.8a-RC8/mods/Templars/data/world/factions/templars.faction';

const oldLines = fs.readFileSync(oldFile, 'utf8').split(/\r?\n/);
let newLines = fs.readFileSync(newFile, 'utf8').split(/\r?\n/);

// build list of (prefix, oldValue) from old file where oldValue contains CJK
const repls = [];
for (const l of oldLines) {
  // forms:
  //  "displayName":"圣殿骑士",
  //  "spaceSailor":{"name":"侍从"},
  //  "patrolSmall":"巡逻队",
  let m = l.match(/^(\s*"[A-Za-z]+"\s*:\s*\{?"name"\s*:\s*")([^"]*)("\},?)\s*$/);
  if (!m) m = l.match(/^(\s*"[A-Za-z]+"\s*:\s*")([^"]*)(",?)\s*$/);
  if (m && /[\u4e00-\u9fff]/.test(m[2])) {
    repls.push({ prefix: m[1], oldVal: m[2], suffix: m[3] });
  }
}

let replaced = 0;
for (const r of repls) {
  for (let i = 0; i < newLines.length; i++) {
    if (newLines[i].includes(r.prefix) && !/[\u4e00-\u9fff]/.test(newLines[i])) {
      const newValMatch = newLines[i].match(new RegExp('^(' + r.prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')[^"]*'));
      if (newValMatch) {
        newLines[i] = newValMatch[1] + r.oldVal + r.suffix;
        replaced++;
      }
    }
  }
}
fs.writeFileSync(newFile, newLines.join('\r\n'), 'utf8');
console.log('replaced:', replaced);
const after = fs.readFileSync(newFile, 'utf8');
console.log('CJK count now:', (after.match(/[\u4e00-\u9fff]/g) || []).length);
