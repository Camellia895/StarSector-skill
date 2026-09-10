// Patch RAT jar classes: replace English string constants with Chinese (modified UTF-8).
// Also provides minimal zip read/write with forward-slash entry names.
const fs = require('fs');
const zlib = require('zlib');

// ---------- modified UTF-8 ----------
function encodeModifiedUtf8(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 0x80) {
      bytes.push(c);
    } else if (c < 0x800) {
      bytes.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F));
    } else if (c >= 0xD800 && c <= 0xDBFF && i + 1 < str.length) {
      const lo = str.charCodeAt(i + 1);
      if (lo >= 0xDC00 && lo <= 0xDFFF) {
        for (const s of [c, lo]) {
          bytes.push(0xED | ((s >> 8) & 0x03), 0x80 | ((s >> 2) & 0x3F), 0x80 | (s & 0x3F));
        }
        i++;
      } else {
        bytes.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F));
      }
    } else {
      bytes.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F));
    }
  }
  return Buffer.from(bytes);
}

function decodeModifiedUtf8(bytes) {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const c = bytes[i];
    if (c < 0x80) { out += String.fromCharCode(c); i++; }
    else if ((c & 0xE0) === 0xC0) { out += String.fromCharCode(((c & 0x1F) << 6) | (bytes[i + 1] & 0x3F)); i += 2; }
    else if ((c & 0xF0) === 0xE0) { out += String.fromCharCode(((c & 0x0F) << 12) | ((bytes[i + 1] & 0x3F) << 6) | (bytes[i + 2] & 0x3F)); i += 3; }
    else { i += 6; }
  }
  return out;
}

// ---------- class constant pool ----------
function readU2(b, p) { return (b[p] << 8) | b[p + 1]; }
function readU1(b, p) { return b[p]; }

function walkCp(buf) {
  const cpCount = readU2(buf, 8);
  let p = 10;
  const utf8s = [];
  const stringRefs = new Set(); // Utf8 indices referenced by CONSTANT_String (string literals)
  const identRefs = new Set();  // Utf8 indices referenced by identifier entries (Class/NameAndType/MethodType/Module/Package)
  for (let i = 1; i < cpCount; i++) {
    const tag = readU1(buf, p);
    const entryStart = p;
    p += 1;
    switch (tag) {
      case 1: {
        const len = readU2(buf, p);
        const dataStart = p + 2;
        const dataEnd = dataStart + len;
        utf8s.push({ index: i, bytes: buf.subarray(dataStart, dataEnd), start: entryStart, lenStart: p, dataStart, dataEnd });
        p = dataEnd;
        break;
      }
      case 3: case 4: p += 4; break;
      case 5: case 6: p += 8; i++; break;
      case 7: { const idx = readU2(buf, p); identRefs.add(idx); p += 2; break; }   // Class -> class name
      case 8: { const idx = readU2(buf, p); stringRefs.add(idx); p += 2; break; } // String -> literal
      case 16: case 19: case 20: { const idx = readU2(buf, p); identRefs.add(idx); p += 2; break; }
      case 12: { const a = readU2(buf, p); const b = readU2(buf, p + 2); identRefs.add(a); identRefs.add(b); p += 4; break; } // NameAndType -> name+descriptor
      case 9: case 10: case 11: case 17: case 18: p += 4; break; // reference NameAndType (covered above)
      case 15: p += 3; break;
      default: throw new Error('Unknown cp tag ' + tag + ' at ' + entryStart);
    }
  }
  return { cpCount, cpEnd: p, utf8s, stringRefs, identRefs };
}

// Patch one class: returns {buf, count}; buf=null if unchanged.
// Only replaces Utf8 constants that are string literals AND not referenced as
// identifiers (field/method/class names). Identifiers are never touched.
function patchClass(buf, mapping) {
  let { cpCount, cpEnd, utf8s, stringRefs, identRefs } = walkCp(buf);
  const repl = new Map();
  let count = 0;
  for (const u of utf8s) {
    if (!stringRefs.has(u.index)) continue;
    if (identRefs.has(u.index)) continue;
    const str = decodeModifiedUtf8(u.bytes);
    if (mapping.has(str)) {
      repl.set(u.index, mapping.get(str));
      count++;
    }
  }
  if (count === 0) return { buf: null, count: 0 };
  const parts = [];
  parts.push(buf.subarray(0, 10));
  let p = 10;
  const seenLong = new Set();
  for (let i = 1; i < cpCount; i++) {
    if (seenLong.has(i)) { seenLong.delete(i); continue; }
    const tag = readU1(buf, p);
    const entryStart = p;
    p += 1;
    switch (tag) {
      case 1: {
        const len = readU2(buf, p);
        const dataStart = p + 2;
        p = dataStart + len;
        if (repl.has(i)) {
          const nb = repl.get(i);
          if (nb.length > 65535) throw new Error('Utf8 too long');
          const h = Buffer.alloc(3);
          h[0] = 1; h[1] = (nb.length >> 8) & 0xFF; h[2] = nb.length & 0xFF;
          parts.push(h, nb);
        } else {
          parts.push(buf.subarray(entryStart, p));
        }
        break;
      }
      case 3: case 4: p += 4; parts.push(buf.subarray(entryStart, p)); break;
      case 5: case 6: p += 8; parts.push(buf.subarray(entryStart, p)); seenLong.add(i + 1); break;
      case 7: case 8: case 16: case 19: case 20: p += 2; parts.push(buf.subarray(entryStart, p)); break;
      case 9: case 10: case 11: case 12: case 17: case 18: p += 4; parts.push(buf.subarray(entryStart, p)); break;
      case 15: p += 3; parts.push(buf.subarray(entryStart, p)); break;
      default: throw new Error('Unknown cp tag ' + tag);
    }
  }
  parts.push(buf.subarray(cpEnd));
  return { buf: Buffer.concat(parts), count };
}

// ---------- minimal zip (forward-slash entry names) ----------
class ZipArchive {
  constructor(file) { if (file) this.file = file; }
  readEntries() {
    const buf = fs.readFileSync(this.file);
    const entries = [];
    let p = 0;
    while (p < buf.length - 4) {
      const s = buf.readUInt32LE(p);
      if (s === 0x02014b50) break; // central directory
      if (s === 0x04034b50) {
        const method = buf.readUInt16LE(p + 8);
        const csize = buf.readUInt32LE(p + 18);
        const nlen = buf.readUInt16LE(p + 26);
        const elen = buf.readUInt16LE(p + 28);
        const name = buf.subarray(p + 30, p + 30 + nlen).toString('utf8');
        const comp = buf.subarray(p + 30 + nlen + elen, p + 30 + nlen + elen + csize);
        let data;
        if (method === 0) data = Buffer.from(comp);
        else if (method === 8) data = zlib.inflateRawSync(comp);
        else throw new Error('unsupported method ' + method + ' for ' + name);
        entries.push({ name, data });
        p += 30 + nlen + elen + csize;
      } else {
        p++;
      }
    }
    return entries;
  }
  write(outFile, entries) {
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    for (const e of entries) {
      const nameBuf = Buffer.from(e.name, 'utf8');
      const comp = e.data.length < 200000 ? zlib.deflateRawSync(e.data, { level: 6 }) : zlib.deflateRawSync(e.data, { level: 1 });
      const lh = Buffer.alloc(30);
      lh.writeUInt32LE(0x04034b50, 0);
      lh.writeUInt16LE(20, 4);
      lh.writeUInt16LE(0x0800, 6);
      lh.writeUInt16LE(8, 8);
      lh.writeUInt32LE(0, 14);
      lh.writeUInt32LE(comp.length, 18);
      lh.writeUInt32LE(e.data.length, 22);
      lh.writeUInt16LE(nameBuf.length, 26);
      lh.writeUInt16LE(0, 28);
      localParts.push(lh, nameBuf, comp);
      const ch = Buffer.alloc(46);
      ch.writeUInt32LE(0x02014b50, 0);
      ch.writeUInt16LE(20, 4);
      ch.writeUInt16LE(20, 6);
      ch.writeUInt16LE(0x0800, 8);
      ch.writeUInt16LE(8, 10);
      ch.writeUInt32LE(0, 16);
      ch.writeUInt32LE(comp.length, 20);
      ch.writeUInt32LE(e.data.length, 24);
      ch.writeUInt16LE(nameBuf.length, 28);
      ch.writeUInt32LE(0, 38);
      ch.writeUInt32LE(offset, 42);
      centralParts.push(ch, nameBuf);
      offset += lh.length + nameBuf.length + comp.length;
    }
    const cd = Buffer.concat(centralParts);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(entries.length, 8);
    eocd.writeUInt16LE(entries.length, 10);
    eocd.writeUInt32LE(cd.length, 12);
    eocd.writeUInt32LE(offset, 16);
    fs.writeFileSync(outFile, Buffer.concat([...localParts, cd, eocd]));
  }
}

module.exports = { patchClass, encodeModifiedUtf8, decodeModifiedUtf8, walkCp, ZipArchive };
