// check_java_equiv.js — Java 源码注入等价性证明（Janino 源码层的 G4/G5 替代闸门）：
//  1) 骨架等价：把每个 .java 的字符串字面量内容替换为 §N 占位后，EN 基线与注入版必须逐字节相同
//     ⇒ 证明"只改了字符串字面量内容，未动任何代码结构"；
//  2) 字面量数量一致（防增删）；
//  3) 词法完整性：状态机扫完整个文件（无未闭合字面量/注释）。
// 用法: node check_java_equiv.js <enBackupRoot> <modRoot>
const fs = require('fs');
const path = require('path');

const EN = process.argv[2], MOD = process.argv[3];
let bad = 0, n = 0;

function lex(src) {
  // 返回 {skeleton, count, ok}
  let i = 0, state = 'code', buf = '', count = 0, skeleton = '', ok = true;
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (state === 'code') {
      if (c === '/' && d === '/') { state = 'line'; skeleton += '//'; i += 2; continue; }
      if (c === '/' && d === '*') { state = 'block'; skeleton += '/*'; i += 2; continue; }
      if (c === '"') { state = 'str'; buf = ''; count++; skeleton += '"§' + count + '"'; i++; continue; }
      if (c === "'") { state = 'chr'; skeleton += c; i++; continue; }
      skeleton += c; i++; continue;
    }
    if (state === 'line') { skeleton += c; if (c === '\n') state = 'code'; i++; continue; }
    if (state === 'block') {
      if (c === '*' && d === '/') { state = 'code'; skeleton += '*/'; i += 2; } else { skeleton += c; i++; }
      continue;
    }
    if (state === 'str') {
      if (c === '\\') { buf += src.substr(i, 2); i += 2; continue; }
      if (c === '"') { state = 'code'; i++; continue; }
      buf += c; i++; continue;
    }
    if (state === 'chr') {
      if (c === '\\') { i += 2; continue; }
      if (c === "'") { state = 'code'; }
      i++; continue;
    }
  }
  if (state !== 'code') ok = false;
  return { skeleton, count, ok };
}

(function walk(rel) {
  const base = path.join(MOD, rel);
  if (!fs.existsSync(base)) return;
  for (const e of fs.readdirSync(base, { withFileTypes: true })) {
    const r = rel + '/' + e.name;
    if (e.isDirectory()) { walk(r); continue; }
    if (!e.name.endsWith('.java')) continue;
    const a = fs.readFileSync(path.join(EN, r), 'utf8');
    const b = fs.readFileSync(path.join(MOD, r), 'utf8');
    const la = lex(a), lb = lex(b);
    n++;
    if (!lb.ok) { console.log('✗ 词法不完整: ' + r); bad++; continue; }
    if (la.count !== lb.count) { console.log('✗ 字面量数不符: ' + r + ' EN=' + la.count + ' ZH=' + lb.count); bad++; continue; }
    if (la.skeleton !== lb.skeleton) {
      console.log('✗ 骨架不等价: ' + r);
      // 定位第一处差异行
      const A = la.skeleton.split('\n'), B = lb.skeleton.split('\n');
      for (let k = 0; k < Math.max(A.length, B.length); k++) {
        if (A[k] !== B[k]) { console.log('   首差异行 L' + (k + 1) + '\n   EN: ' + (A[k] || '').trim().slice(0, 90) + '\n   ZH: ' + (B[k] || '').trim().slice(0, 90)); break; }
      }
      bad++; continue;
    }
  }
})('data');

console.log('检查 .java 文件 ' + n + ' 个：' + (bad === 0 ? '骨架/字面量数/词法 全部等价 ✓' : bad + ' 个异常'));
process.exit(bad === 0 ? 0 : 1);
