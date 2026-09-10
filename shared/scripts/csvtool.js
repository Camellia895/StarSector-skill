// RFC4180 CSV parser/writer (handles quoted fields with embedded commas/newlines/quotes).
// Usage: node csvtool.js parse <file>   -> JSON array of row objects
//        node csvtool.js migrate <oldFile> <newFile> <idCol> [col1,col2,...] [outFile]
//        node csvtool.js migrateAll <config.json>
module.exports = { parseCSV, toCSV };

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
      i++; continue;
    }
    field += c; i++;
  }
  if (field !== '' || row.length > 0) { row.push(field); if (row.length > 1 || row[0] !== '') rows.push(row); }
  return rows;
}

function needsQuotes(v) {
  return /[",\r\n]/.test(v);
}

function toCSV(rows) {
  return rows.map(r => r.map(f => {
    if (f === null || f === undefined) f = '';
    f = String(f);
    return needsQuotes(f) ? '"' + f.replace(/"/g, '""') + '"' : f;
  }).join(',')).join('\r\n') + '\r\n';
}

if (require.main === module) {
  const fs = require('fs');
  const cmd = process.argv[2];
  if (cmd === 'parse') {
    const file = process.argv[3];
    const rows = parseCSV(fs.readFileSync(file, 'utf8'));
    const header = rows[0];
    const out = rows.slice(1).map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
    fs.writeFileSync(file + '.json', JSON.stringify(out, null, 1), 'utf8');
    console.log('rows:', out.length, 'columns:', header.length);
  } else if (cmd === 'migrate') {
    const oldFile = process.argv[3], newFile = process.argv[4];
    const idCol = process.argv[5];
    const cols = process.argv[6] ? process.argv[6].split(',').filter(Boolean) : null;
    const outFile = process.argv[7] || newFile;
    const oldRows = parseCSV(fs.readFileSync(oldFile, 'utf8'));
    const newRows = parseCSV(fs.readFileSync(newFile, 'utf8'));
    const header = newRows[0];
    const idIdx = header.indexOf(idCol);
    if (idIdx < 0) { console.log('id col not found:', idCol); process.exit(1); }
    const colIdx = cols ? cols.map(c => header.indexOf(c)) : null;
    const oldMap = new Map();
    for (const r of oldRows.slice(1)) oldMap.set(r[idIdx], r);
    let migrated = 0, newIds = 0;
    const out = [header];
    for (const r of newRows.slice(1)) {
      const id = r[idIdx];
      const or = oldMap.get(id);
      if (or) {
        if (colIdx) {
          for (let k = 0; k < colIdx.length; k++) {
            if (colIdx[k] >= 0 && or[colIdx[k]] !== undefined && or[colIdx[k]] !== '') {
              if (r[colIdx[k]] !== or[colIdx[k]]) { r[colIdx[k]] = or[colIdx[k]]; }
            }
          }
        } else {
          for (let j = 0; j < header.length; j++) {
            if (or[j] !== undefined && or[j] !== '' && /[\u4e00-\u9fff]/.test(or[j])) r[j] = or[j];
          }
        }
        migrated++;
      } else {
        newIds++;
      }
      out.push(r);
    }
    fs.writeFileSync(outFile, toCSV(out), 'utf8');
    console.log('migrated rows:', migrated, 'new (untranslated):', newIds, '->', outFile);
  }
}
