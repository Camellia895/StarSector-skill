// check_java_residue.js — Java 层独立残留复查（与 extract_java_strings.js 不同的解析路径）：
// 逐物理行用正则抓 "..." 字面量（不做状态机），凡含 ≥2 个连续英文字母的词且不在
// （translate ∪ excluded）覆盖集合里的 → 候选。注释行跳过（不进编译产物）。
// 用法: node check_java_residue.js <modRoot> <literalsJson> <outDir(含分类清单)>
const fs = require('fs');
const path = require('path');

const MOD = process.argv[2], LIT = process.argv[3], OUTDIR = process.argv[4];

const covered = new Set();
for (const e of JSON.parse(fs.readFileSync(LIT, 'utf8'))) covered.add(e.file + '|' + e.en);
// 分类清单与排除审计都要覆盖
for (const f of ['08_java_aptitudes', '09_java_skill_tooltips', '10_java_milestones', '11_java_misc'])
  for (const e of JSON.parse(fs.readFileSync(path.join(OUTDIR, f + '.json'), 'utf8'))) covered.add(e.file + '|' + e.en);
for (const e of JSON.parse(fs.readFileSync(path.join(OUTDIR, 'java_excluded_audit.json'), 'utf8'))) covered.add(e.file + '|' + e.en);

const cand = [];
(function walk(rel) {
  const base = path.join(MOD, rel);
  if (!fs.existsSync(base)) return;
  for (const x of fs.readdirSync(base, { withFileTypes: true })) {
    const r = rel + '/' + x.name;
    if (x.isDirectory()) walk(r);
    else if (x.name.endsWith('.java')) {
      const file = r.replace(/\\/g, '/');
      const lines = fs.readFileSync(path.join(MOD, r), 'utf8').split(/\r?\n/);
      let inBlock = false;
      lines.forEach((l, i) => {
        let t = l;
        if (inBlock) { if (t.includes('*/')) { inBlock = false; t = t.replace(/^[\s\S]*?\*\//, ''); } else return; }
        // 去掉行注释与块注释（简化：同行 /* */ 可能嵌字面量——保守，整行若含 /* 先粗删）
        const lineNo = i + 1;
        const beforeComment = t;
        t = t.replace(/\/\/.*$/, '');
        if (/[a-zA-Z]"|"[a-zA-Z]/.test(t) || /"/.test(t)) {
          for (const m of t.matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
            const en = m[1];
            if (!/[A-Za-z]{2}/.test(en)) continue; // 无英文词
            if (/^[^a-zA-Z]*$/.test(en)) continue;
            if (!covered.has(file + '|' + en)) {
              cand.push({ file, line: lineNo, en, stmt: beforeComment.trim().slice(0, 90) });
            }
          }
        }
        // 块注释开始（粗略：行内 /* 后无 */）
        const stripped = t;
        if (stripped.includes('/*') && !stripped.includes('*/')) inBlock = true;
      });
    }
  }
})('data/plugins');
(function walk(rel) {
  const base = path.join(MOD, rel);
  if (!fs.existsSync(base)) return;
  for (const x of fs.readdirSync(base, { withFileTypes: true })) {
    const r = rel + '/' + x.name;
    if (x.isDirectory()) walk(r);
    else if (x.name.endsWith('.java')) {
      const file = r.replace(/\\/g, '/');
      const lines = fs.readFileSync(path.join(MOD, r), 'utf8').split(/\r?\n/);
      lines.forEach((l, i) => {
        const t = l.replace(/\/\/.*$/, '');
        if (!t.includes('"')) return;
        for (const m of t.matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
          const en = m[1];
          if (!/[A-Za-z]{2}/.test(en)) continue;
          if (!covered.has(file + '|' + en)) cand.push({ file, line: i + 1, en, stmt: t.trim().slice(0, 90) });
        }
      });
    }
  }
})('data/scripts');

if (cand.length) {
  console.log('候选 ' + cand.length + ' 条：');
  for (const c of cand) console.log('  ' + c.file.replace('data/', '') + ' L' + c.line + ' | ' + JSON.stringify(c.en.slice(0, 80)) + '  [stmt] ' + c.stmt.slice(0, 60));
  process.exit(1);
} else {
  console.log('Java 残留复查：0 候选 ✓');
}
