// run_check.js — 带记账的校验执行包装（verification ledger 的写入端）
//
// 目的：让"校验是否命中"变成**机械事实（退出码）**，而不是靠人回忆。
//       只记 (check, exit, hit, target, time)，**不记原始输出** —— 账本不能自己变成吃上下文的东西。
//
// 用法：
//   node run_check.js --check=<名> [--target=<标签>] [--note=<备注>] [--probe] [--out]
//                     [--expect-args=<N>] [--allow-silent-hit] -- <命令...>
//   node run_check.js --check=verify_identifiers.js --expect-args=1 --target=FDS_ROTS -- node <skills>\shared\scripts\verify_identifiers.js <classDir>
//   node run_check.js --check=validate_star_system.ps1 --target=Sol -- powershell -File <skill>\scripts\validate_star_system.ps1 -ModPath mods\Sol
//   node run_check.js --check=check_font_glyphs.js --porcelain --expect-args=1 -- node ... <data目录>   # 只输出 hit/clean/invalid
//
// 退出码语义（本技能库统一约定，见 shared\verification-ledger.md §7）：
//   0   = clean（干净，记减票）
//   1   = hit  （命中，记加票）
//   2+  = invalid（用法错误/文件缺失/环境问题）→ **不计票**
//
// ⚠️ 防污染：部分脚本（实测 verify_identifiers.js）在**用法错误时也返回 1**。
//    因此推荐给每条调用加 `--expect-args=<N>` 声明该命令最少需要几个参数，不足即判 invalid。
//    兜底规则：exit=1 且**完全无输出**也判 invalid。
//    `--out` 会把子命令输出透传出来（默认只打印一行摘要，避免刷屏与浪费上下文）。
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SHARED = path.resolve(__dirname, '..');
const LEDGER = path.join(SHARED, 'verification-ledger.jsonl');

// ---- 解析参数（-- 之前是本脚本的，之后是要执行的命令）----
const argv = process.argv.slice(2);
const sep = argv.indexOf('--');
const head = sep >= 0 ? argv.slice(0, sep) : [];
const cmd = sep >= 0 ? argv.slice(sep + 1) : [];
const opt = {};
for (const a of head) {
  let m;
  if ((m = a.match(/^--([A-Za-z-]+)=(.*)$/s))) opt[m[1]] = m[2];
  else if ((m = a.match(/^--([A-Za-z-]+)$/))) opt[m[1]] = true;
}
if (!cmd.length) {
  console.error('用法: node run_check.js --check=<名> [--target=<标签>] [--note=<备注>] [--probe] [--out] -- <命令...>');
  console.error('示例: node run_check.js --check=check_font_glyphs.js --target=FDS_ROTS -- node <skills>\\shared\\scripts\\check_font_glyphs.js <data目录>');
  process.exit(2);
}
if (!opt.check) { console.error('缺少 --check=<校验名>（建议用脚本文件名，便于与档位表对应）'); process.exit(2); }

// ---- 执行（默认捕获输出但不打印：既省上下文，又能用"有无输出"判别静默用法错误）----
const [exe, ...rest] = cmd;
const res = spawnSync(exe, rest, {
  stdio: opt.out ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024
});
if (res.error) {
  console.error('执行失败: ' + res.error.message);
  console.error('（未记账：这是调用问题，不是校验结果）');
  process.exit(2);
}
const exit = res.status === null ? -1 : res.status;

// ---- 判定 ----
// ⚠️ 已知不一致：并非所有校验脚本都遵守 "2+ = 用法错误" 约定
//    （实测 verify_identifiers.js 在给出用法提示时仍返回 1，且**会打印输出**）。
//    两级防线：
//     ① 显式声明：--expect-args=<N> 表示该命令至少需要 N 个参数，不足 ⇒ 直接判 invalid（最可靠）
//     ② 静默兜底：exit=1 且完全无输出 ⇒ 视为调用错误
//    真有意义的"静默命中"用 --allow-silent-hit 显式放行。
const needArgs = opt['expect-args'] !== undefined ? Number(opt['expect-args']) : null;
// 只数"脚本自身的参数"：跳过解释器与脚本文件（node xxx.js / java Yyy / powershell -File zzz.ps1 / py.exe w.py）
function scriptArgCount(tokens) {
  const [a, b] = tokens;
  if (!a) return 0;
  if (/^(node|node\.exe)$/i.test(a)) return Math.max(0, tokens.length - 2);
  if (/^(java|java\.exe|java[w]?\.exe)$/i.test(a)) {
    // java [opts] MainClass args…：跳过 -D/-X/-cp 及其值
    let i = 1;
    while (i < tokens.length && /^-/.test(tokens[i])) { i += /^(-cp|-classpath|--class-path)$/i.test(tokens[i]) ? 2 : 1; }
    return Math.max(0, tokens.length - i - 1);
  }
  if (/^(powershell|powershell\.exe|pwsh|pwsh\.exe)$/i.test(a)) {
    // powershell -File x.ps1 args… / -Command …（-Command 之后无法可靠切分，按全部计入）
    const fi = tokens.findIndex(t => /^-f(ile)?$/i.test(t));
    if (fi >= 0) return Math.max(0, tokens.length - fi - 2);
    const ci = tokens.findIndex(t => /^-c(ommand)?$/i.test(t));
    if (ci >= 0) return Math.max(0, tokens.length - ci - 1);
    return Math.max(0, tokens.length - 1);
  }
  if (/^(py|python|python3)(\.exe)?$/i.test(a)) return Math.max(0, tokens.length - 2);
  return Math.max(0, tokens.length - 1);
}
const argCount = scriptArgCount(cmd);
const tooFewArgs = needArgs !== null && !Number.isNaN(needArgs) && argCount < needArgs;

const outText = opt.out ? null : String(res.stdout || '') + String(res.stderr || '');
const silent = outText !== null && outText.trim() === '';
let verdict;
if (tooFewArgs) verdict = 'invalid';
else if (exit === 0) verdict = 'clean';
else if (exit === 1) verdict = (silent && !opt['allow-silent-hit']) ? 'invalid' : 'hit';
else verdict = 'invalid';

// ---- 记账（invalid 不写账）----
if (verdict !== 'invalid') {
  const row = {
    t: new Date().toISOString(),
    check: String(opt.check),
    target: opt.target ? String(opt.target) : '',
    exit,
    hit: verdict === 'hit',
    probe: !!opt.probe,
    note: opt.note ? String(opt.note) : ''
  };
  try {
    fs.appendFileSync(LEDGER, JSON.stringify(row) + '\n', 'utf8');
  } catch (e) {
    console.error('写账本失败: ' + e.message);
    process.exit(2);
  }
}

if (opt.porcelain) console.log(verdict);
else console.log(`[ledger] ${opt.check} → ${verdict} (exit=${exit})${opt.target ? ' @' + opt.target : ''}${verdict === 'invalid' ? ' · 未记账' + (tooFewArgs ? `（参数不足：需 ≥${needArgs}，实给 ${argCount}）` : (silent ? '（exit=1 但无输出 ⇒ 视为调用错误）' : '')) : ''}`);

// 原样传递子命令退出码，便于串在流水线里
process.exit(exit < 0 ? 1 : exit);
