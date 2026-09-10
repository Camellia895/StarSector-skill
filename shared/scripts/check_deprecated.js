// check_deprecated.js —— 检查 mod 源码是否用到 API 里 @Deprecated 的成员（只读）
// 用法: node check_deprecated.js <apiSrcDir> <modSrcDir>
//   例: node check_deprecated.js _work\mod_work\<Mod>\_api_src\com\fs\starfarer\api mods\<Mod>\jars\src
//
// 为什么重要：@Deprecated 成员在 0.98a 有的"仍然生效"、有的"已变成空操作"（javadoc 里会写
// "Does nothing. Replaced with ..."）。签名相同的调用会静默失效 —— 这是最隐蔽的一类 0.98 回归。
// 注意：脚本只做初筛，命中后**必须回 apiSrcDir 读该成员的 javadoc**确认是否真失效（会有假阳性，
// 例如 .getWing( / .getCredits( 与真正弃用的 .getWingMembers( / setFreeTransfer( 只差前缀）。
const fs = require('fs');
const path = require('path');

const apiDir = process.argv[2];
const srcDir = process.argv[3];
if (!apiDir || !srcDir) { console.error('用法: node check_deprecated.js <apiSrcDir> <modSrcDir>'); process.exit(2); }

function walk(d, out = []) {
  if (!fs.existsSync(d)) return out;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

// 1) 收集 @Deprecated 后面那个声明里的成员名
const deprecated = new Map();
for (const f of walk(apiDir).filter(x => x.endsWith('.java'))) {
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*@Deprecated/.test(lines[i])) continue;
    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
      const m = lines[j].match(/(?:public|protected|private)?\s*(?:static\s+)?(?:final\s+)?[\w<>\[\],.\s?]+\s+(\w+)\s*[;(=]/);
      if (m) { if (!deprecated.has(m[1])) deprecated.set(m[1], path.relative(apiDir, f) + ':' + (j + 1)); break; }
    }
  }
}
console.log(`API 中 @Deprecated 成员 ${deprecated.size} 个`);

// 2) 在 mod 源码里找使用
const srcs = walk(srcDir).filter(x => x.endsWith('.java')).map(f => ({ f, t: fs.readFileSync(f, 'utf8') }));
const hits = [];
for (const [name, where] of [...deprecated.entries()].sort()) {
  for (const { f, t } of srcs) {
    const re = new RegExp('\\.' + name + '\\s*\\(|\\.' + name + '\\b');
    if (re.test(t)) { hits.push(`  ${name}  <- ${path.relative(srcDir, f)}   (API: ${where})`); break; }
  }
}
console.log(`mod 源码命中 ${hits.length} 处（需逐条回 API 源码看 javadoc 判断是否真失效）：`);
hits.forEach(h => console.log(h));
if (hits.length) {
  console.log('\n提示：用 `Select-String -Path <api.java> -Pattern "<成员名>" -Context 6,2` 看 javadoc，');
  console.log('      出现 "Does nothing. Replaced with X" 才是真失效，需要改；仅标 @Deprecated 的通常仍生效。');
}
