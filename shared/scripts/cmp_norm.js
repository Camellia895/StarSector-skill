// cmp_norm.js — compare installed vs source after normalizing EOL and trailing whitespace
// 2026-10-02 Hyperion 实测：发布包与 git 仓库行尾风格不同会让逐文件 SHA-256 全挂（92/158），
// 规范化后 0 内容差异——先排除风格差再谈内容差异（repo-source skill §7 一致性校验用本工具替代裸哈希）
const fs = require('fs');
const path = require('path');

const INST = process.argv[2];
const SRC = process.argv[3];
if (!INST || !SRC) {
  console.error('usage: node cmp_norm.js <目录A> <目录B>');
  console.error('  规范化行尾+尾随空白后逐文件比对两边 data/（只报内容差异）');
  process.exit(2);
}

function walk(dir, base, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    const rel = path.relative(base, p).replace(/\\/g, '/');
    if (e.isDirectory()) walk(p, base, out);
    else out[rel] = p;
  }
  return out;
}
const norm = p => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '');

const instFiles = walk(path.join(INST, 'data'), path.join(INST, 'data'), {});
const srcFiles = walk(path.join(SRC, 'data'), path.join(SRC, 'data'), {});
let same = 0; const diff = [];
for (const rel of Object.keys(instFiles).sort()) {
  if (!srcFiles[rel]) continue;
  if (norm(instFiles[rel]) === norm(srcFiles[rel])) same++;
  else diff.push(rel);
}
console.log(`normalized: same=${same} contentDiff=${diff.length}`);
diff.forEach(f => console.log('  ! ' + f));
