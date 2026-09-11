// sync_to_mod.js — 把 skills 库的**当前状态**同步进指定 mod 的 `ai\` 目录，供交付包内自带工作文档与工具。
//
// 背景：`mods\<Mod>\ai\` 是 skills 库的**快照副本**（随交付包发给下一位译者/维护者）。
//   若改了 skills 库却忘了同步，交付包里就是旧文档旧脚本 —— 下一位译者会照旧版踩同一个坑。
//   故把同步做成脚本，避免"记得就同步"。
//
// 同步内容（**只覆盖 ai\skills 下这几项**，不动 ai\ 下的术语表/交接/一次性诊断脚本）：
//   1. `<skills>\skills\*`（各 skill 的 SKILL.md 与自带 scripts）→ `ai\skills\*`
//   2. `<skills>\shared\glossary.md`  → `ai\skills\core-glossary.md`（改名，历史沿用）
//      `<skills>\shared\iron-rules.md`→ `ai\skills\iron-rules.md`
//      `<skills>\shared\conventions.md`/`script-registry.md`/`verification-ledger.md`/`env.md`
//                                     → `ai\skills\<原名>`
//   3. `<skills>\workflows\*`        → `ai\skills\workflows\*`
//   4. `<skills>\shared\scripts\*`   → `ai\脚本\*`（**共享脚本全量镜像**）
//      例外：`<skills>\shared\scripts` 里不存在的文件**不删除**（`ai\脚本` 另有大量本项目一次性诊断脚本，
//            它们不属于 skills 库，绝不能被镜像误删）。
//
// 用法:
//   node sync_to_mod.js <skillsDir> <modAiDir> [--dry]
//   node sync_to_mod.js _work/skills mods/Nightcross/ai
// 退出码: 0 = 已同步（或 dry-run 完成）；2 = 调用/路径错误
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const dry = argv.includes('--dry');
const pos = argv.filter(a => !a.startsWith('--'));
const [SKILLS, AI] = pos;
if (!SKILLS || !AI) { console.error('usage: node sync_to_mod.js <skillsDir> <modAiDir> [--dry]'); process.exit(2); }
for (const d of [SKILLS, AI]) if (!fs.existsSync(d)) { console.error('路径不存在: ' + d); process.exit(2); }

const norm = p => p.replace(/\\/g, '/');
let copied = 0, same = 0, made = 0;
const changed = [];

// 逐文件比较内容后复制；目录按需创建
function put(src, dst, label) {
  const a = fs.readFileSync(src);
  if (fs.existsSync(dst) && Buffer.compare(a, fs.readFileSync(dst)) === 0) { same++; return; }
  changed.push(label);
  if (!dry) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, a);
  }
  copied++;
}
function mirrorDir(srcDir, dstDir, label) {
  if (!fs.existsSync(srcDir)) return;
  for (const e of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const s = path.join(srcDir, e.name), d = path.join(dstDir, e.name);
    if (e.isDirectory()) mirrorDir(s, d, label + '/' + e.name);
    else put(s, d, label + '/' + e.name);
  }
}

// 1. 各 skill 目录
const sk = path.join(SKILLS, 'skills');
if (fs.existsSync(sk)) {
  for (const e of fs.readdirSync(sk, { withFileTypes: true })) {
    if (e.isDirectory()) mirrorDir(path.join(sk, e.name), path.join(AI, 'skills', e.name), 'skills/' + e.name);
  }
}

// 2. shared 的文档（glossary 改名）
const SH = path.join(SKILLS, 'shared');
const DOC_MAP = {
  'glossary.md': 'core-glossary.md',
  'iron-rules.md': 'iron-rules.md',
  'conventions.md': 'conventions.md',
  'script-registry.md': 'script-registry.md',
  'verification-ledger.md': 'verification-ledger.md',
  'env.md': 'env.md',
};
for (const [from, to] of Object.entries(DOC_MAP)) {
  const s = path.join(SH, from);
  if (fs.existsSync(s)) put(s, path.join(AI, 'skills', to), 'skills/' + to);
}

// 3. workflows
mirrorDir(path.join(SKILLS, 'workflows'), path.join(AI, 'skills', 'workflows'), 'skills/workflows');

// 4. 共享脚本 → ai\脚本（只增改不删）
const SS = path.join(SH, 'scripts');
const SCRIPT_DST = path.join(AI, '脚本');
if (fs.existsSync(SS)) {
  fs.mkdirSync(SCRIPT_DST, { recursive: true });
  for (const e of fs.readdirSync(SS, { withFileTypes: true })) {
    if (e.isFile()) put(path.join(SS, e.name), path.join(SCRIPT_DST, e.name), '脚本/' + e.name);
  }
}

console.log(`skills 库 → ${norm(AI)}`);
console.log(`  更新 ${copied} 个 / 已一致 ${same} 个${dry ? '  [DRY-RUN，未写入]' : ''}`);
for (const c of changed) console.log('    ' + c);
