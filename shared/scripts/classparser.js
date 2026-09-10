// Parse .class files: extract constant pool UTF8 strings (modified UTF-8 aware).
// Used to (a) verify source fragments exist in the jar, (b) later patch them.
const fs = require('fs');

function readU1(b, p) { return [b[p], p + 1]; }
function readU2(b, p) { return [(b[p] << 8) | b[p + 1], p + 2]; }
function readU4(b, p) { return [((b[p] << 24) >>> 0) + (b[p + 1] << 16) + (b[p + 2] << 8) + b[p + 3], p + 4]; }

function decodeModifiedUtf8(bytes) {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const c = bytes[i];
    if (c < 0x80) { out += String.fromCharCode(c); i++; }
    else if ((c & 0xE0) === 0xC0) {
      out += String.fromCharCode(((c & 0x1F) << 6) | (bytes[i + 1] & 0x3F));
      i += 2;
    } else if ((c & 0xF0) === 0xE0) {
      out += String.fromCharCode(((c & 0x0F) << 12) | ((bytes[i + 1] & 0x3F) << 6) | (bytes[i + 2] & 0x3F));
      i += 3;
    } else if ((c & 0xF8) === 0xF0) {
      // supplementary: decode surrogate pair (modified UTF-8 encodes as two 3-byte surrogates)
      const hi = ((c & 0x07) << 12) | ((bytes[i + 1] & 0x3F) << 6) | (bytes[i + 2] & 0x3F);
      const lo = ((bytes[i + 3] & 0x0F) << 12) | ((bytes[i + 4] & 0x3F) << 6) | (bytes[i + 5] & 0x3F);
      out += String.fromCharCode(hi, lo);
      i += 6;
    } else { i++; }
  }
  return out;
}

function parseClass(buf) {
  const cp = [null]; // index 0 unused
  let p = 8; // skip magic + minor + major
  let count = readU2(buf, p); p = count[1];
  for (let i = 1; i < count[0]; i++) {
    const tag = readU1(buf, p); p = tag[1];
    switch (tag[0]) {
      case 1: { // Utf8
        const len = readU2(buf, p); p = len[1];
        const bytes = buf.subarray(p, p + len[0]);
        p += len[0];
        cp.push({ tag: 1, str: decodeModifiedUtf8(bytes) });
        break;
      }
      case 3: case 4: p += 4; cp.push({ tag: tag[0] }); break;
      case 5: case 6: p += 8; cp.push({ tag: tag[0] }); cp.push({ tag: tag[0], wide: true }); i++; break;
      case 7: case 8: case 16: case 19: case 20: p += 2; cp.push({ tag: tag[0] }); break;
      case 9: case 10: case 11: case 12: case 17: case 18: p += 4; cp.push({ tag: tag[0] }); break;
      case 15: p += 3; cp.push({ tag: tag[0] }); break;
      default: throw new Error('Unknown cp tag ' + tag[0] + ' at ' + p);
    }
  }
  return { cp };
}

module.exports = { parseClass, decodeModifiedUtf8 };

if (require.main === module) {
  const file = process.argv[2];
  const buf = fs.readFileSync(file);
  const { cp } = parseClass(buf);
  const strings = cp.filter(e => e && e.tag === 1).map(e => e.str);
  console.log('class:', file);
  console.log('utf8 constants:', strings.length);
  // test known fragments
  const tests = [
    'Enables a procedure based on the sustained burn on all ships in the fleet, specificly tweaked for the landscape of the abyssal depths.',
    'Increases the maximum burn level by %s, at the expense of slightly lower acceleration, ',
    'Engage in battle',
  ];
  for (const t of tests) {
    console.log((strings.includes(t) ? 'FOUND  ' : 'MISSING') + ' | ' + t.slice(0, 70));
  }
}
