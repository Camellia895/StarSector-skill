// scan_refs.js — 列出"某个字面量"在哪些 class 里出现，并区分是 CONSTANT_String 还是 Fieldref/Methodref 名称
// 用途：枚举改名白名单必须覆盖**所有**引用类（漏一个就 NoSuchFieldError）
// 用法: node scan_refs.js <jarDir> <字面量1> [字面量2...]
const fs = require('fs');
const path = require('path');

function walk(d) {
  const o = [];
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) o.push(...walk(p));
    else if (e.name.endsWith('.class')) o.push(p);
  }
  return o;
}
function analyze(buf) {
  let p = 8;
  const cpCount = (buf[p] << 8) | buf[p + 1]; p += 2;
  const utf8 = [], cls = [], nat = [], strRef = new Set(), fieldRef = new Set(), methRef = new Set();
  for (let i = 1; i < cpCount; i++) {
    const tag = buf[p]; p += 1;
    if (tag === 1) { const l = (buf[p] << 8) | buf[p + 1]; utf8[i] = buf.toString('utf8', p + 2, p + 2 + l); p += 2 + l; }
    else if (tag === 3 || tag === 4) p += 4;
    else if (tag === 5 || tag === 6) { p += 8; i++; }
    else if (tag === 7) { cls[i] = (buf[p] << 8) | buf[p + 1]; p += 2; }
    else if (tag === 8) { strRef.add((buf[p] << 8) | buf[p + 1]); p += 2; }
    else if (tag === 16 || tag === 19 || tag === 20) p += 2;
    else if (tag === 12) { nat[i] = { n: (buf[p] << 8) | buf[p + 1], d: (buf[p + 2] << 8) | buf[p + 3] }; p += 4; }
    else if (tag === 9) { fieldRef.add((buf[p + 2] << 8) | buf[p + 3]); p += 4; }
    else if (tag === 10 || tag === 11) { methRef.add((buf[p + 2] << 8) | buf[p + 3]); p += 4; }
    else if (tag === 17 || tag === 18) p += 4;
    else if (tag === 15) p += 3;
  }
  return { utf8, cls, nat, strRef, fieldRef, methRef };
}
const dir = process.argv[2];
const names = process.argv.slice(3);
const isDirArg = fs.existsSync(dir) && fs.statSync(dir).isDirectory();
const files = isDirArg ? walk(dir) : [];
if (!files.length) {
  // 也支持直接给 jar 文件：调用方可用 unzip 解包后再传目录
  console.error('用法: node scan_refs.js <已解包的 class 目录> <字面量...>');
  process.exit(1);
}
const rows = [];
for (const f of files) {
  const rel = path.relative(dir, f).replace(/\\/g, '/');
  const a = analyze(fs.readFileSync(f));
  for (const nm of names) {
    for (let i = 1; i < a.utf8.length; i++) {
      if (a.utf8[i] !== nm) continue;
      const where = [];
      if (a.strRef.has(i)) where.push('String');
      for (let k = 1; k < a.nat.length; k++) {
        if (!a.nat[k] || a.nat[k].n !== i) continue;
        if (a.fieldRef.has(k)) where.push('Fieldref');
        if (a.methRef.has(k)) where.push('Methodref');
      }
      if (!where.length) where.push('其他/未归类');
      rows.push(rel + '   ' + JSON.stringify(nm) + '   ← ' + where.join('+'));
    }
  }
}
rows.sort();
console.log('命中 ' + rows.length + ' 处：');
for (const r of rows) console.log('  ' + r);
// --strict：出现任何 Fieldref 命中就以 exit 1 结束（用于"枚举改名必须改全"的门槛）
if (process.argv.includes('--strict')) {
  const bad = rows.filter(r => r.includes('Fieldref'));
  console.log('--- strict 模式：仍作为 Fieldref 被引用的旧名 = ' + bad.length + (bad.length ? '  <== 必须清零' : '  （OK）'));
  process.exit(bad.length ? 1 : 0);
}
