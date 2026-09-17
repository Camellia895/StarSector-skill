// verify_strings_json.js — 【JSON 字符串表汉化】闸门（界面文本外置型 mod 通用）
//
// 场景：mod 把玩家可见文本全部外置在一个宽松 JSON 里（Starsector 1.1+ 的 `data/strings/strings.json`、
// 或第三方 mod 自建的 strings 表），键名由代码用 `getString(ns, key)` / `get(key)` 精确查找。
// 这类汉化**不动 jar、不动 CSV**，全部风险集中在"键名/占位符/字节"三处，本脚本一次查完。
//
// 用法:
//   node verify_strings_json.js <英文基线JSON> <汉化后JSON> <命名空间> [译文清单JSON|-]
// 例:
//   node verify_strings_json.js _work/mod_bak/X_1.2_EN_backup/data/strings/strings.json \
//        mods/X/data/strings/strings.json RetroLib _work/mod_work/X/worklist/01_worklist_strings.json
//
// 闸门:
//   G1 提取完整：键集 + 键序与英文基线一致；清单（可选）逐键覆盖且无多余
//   G2 译文完整：无空译文；占位符集合逐键一致；无整句英文残留
//   G3 字节安全：UTF-8 无 BOM；CRLF/单独 LF 计数与基线一致；无弯引号（R1/R19）；其它命名空间未被动过
//
// 退出码: 0 = 全过；1 = 有 FAIL；2 = 用法错
//
// 占位符可识别: $变量 %s %d %% \n \u0001 [TOKEN] {brace}  —— 需要更多令牌时改 TOKEN_RE。
const fs = require('fs');
const path = require('path');

const [EN, ZH, NS, WL] = process.argv.slice(2);
if (!EN || !ZH || !NS) {
  console.error('usage: node verify_strings_json.js <enJson> <zhJson> <namespace> [worklistJson|-]');
  process.exit(2);
}
if (EN === '--help' || ZH === '--help') { console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(0, 20).join('\n')); process.exit(0); }

const { parseJsonLoose } = require('./pseudojson.js');
const TOKEN_RE = /\$[A-Za-z_][A-Za-z0-9_]*|%[sd]|%%|\[[A-Z][A-Z0-9_]*\]|\{[A-Za-z0-9_]+\}|\\n|\\u0001/g;

const enRaw = fs.readFileSync(EN, 'utf8');
const zhBuf = fs.readFileSync(ZH);
const zhRaw = zhBuf.toString('utf8');
const enAll = parseJsonLoose(enRaw);
const zhAll = parseJsonLoose(zhRaw);

const fails = [];
const warns = [];

// ---- 其它命名空间未被误改（防"顺手改了别人的表"）----
for (const k of Object.keys(enAll)) {
  if (k === NS) continue;
  const a = JSON.stringify(enAll[k]), b = JSON.stringify(zhAll[k]);
  if (a !== b) fails.push(`G3 非目标命名空间被改动: ${k}`);
}

const en = enAll[NS], zh = zhAll[NS];
if (!en) { console.error(`FAIL: 英文基线没有命名空间 "${NS}"`); process.exit(1); }
if (!zh) { console.error(`FAIL: 汉化版没有命名空间 "${NS}"`); process.exit(1); }

const enKeys = Object.keys(en), zhKeys = Object.keys(zh);

// ---- G1 ----
if (JSON.stringify(enKeys) !== JSON.stringify(zhKeys)) {
  const lost = enKeys.filter(k => !zhKeys.includes(k));
  const added = zhKeys.filter(k => !enKeys.includes(k));
  fails.push(`G1 键集/键序不一致（丢失 ${lost.length}: ${lost.slice(0, 8).join(',')}；多出 ${added.length}: ${added.slice(0, 8).join(',')}）`);
}
let wl = null;
if (WL && WL !== '-') {
  wl = parseJsonLoose(fs.readFileSync(WL, 'utf8'));
  const arr = Array.isArray(wl) ? wl : (wl.entries || []);
  const wlKeys = new Set(arr.map(w => (w.field || w.key || '').replace(NS + '.', '')));
  const uncovered = enKeys.filter(k => !wlKeys.has(k));
  if (uncovered.length) fails.push(`G1 清单未覆盖 ${uncovered.length} 键: ${uncovered.slice(0, 8).join(',')}`);
  if (arr.length !== enKeys.length) warns.push(`G1 清单条数 ${arr.length} != 键数 ${enKeys.length}（分片清单可忽略）`);
}

// ---- G2 ----
const tokenDrift = [], enResidue = [], curly = [], empty = [];
for (const k of enKeys) {
  const v = zh[k];
  if (typeof v !== 'string' || v.trim() === '') { empty.push(k); continue; }
  if (/[\u201c\u201d\u2018\u2019]/.test(v)) curly.push(k);
  const a = (en[k].match(TOKEN_RE) || []).sort().join('|');
  const b = (v.match(TOKEN_RE) || []).sort().join('|');
  if (a !== b) tokenDrift.push(`${k}: en[${a}] zh[${b}]`);
  // 英文残留：剥掉占位符后仍有 >=3 个连续英文词
  const stripped = v.replace(TOKEN_RE, ' ').replace(/%/g, ' ');
  if (/[A-Za-z]{2,}[ ,]+[A-Za-z]{2,}[ ,]+[A-Za-z]{2,}/.test(stripped)) enResidue.push(`${k}: ${v}`);
}
if (empty.length) fails.push(`G2 空译文 ${empty.length}: ${empty.slice(0, 8).join(',')}`);
if (tokenDrift.length) fails.push('G2 占位符漂移:\n    ' + tokenDrift.join('\n    '));
if (enResidue.length) fails.push('G2 英文残留:\n    ' + enResidue.join('\n    '));
if (curly.length) fails.push(`G2/G3 弯引号 ${curly.length}: ${curly.slice(0, 8).join(',')}`);

// ---- G3 ----
if (zhBuf.length >= 3 && zhBuf[0] === 0xEF && zhBuf[1] === 0xBB && zhBuf[2] === 0xBF) fails.push('G3 汉化版含 UTF-8 BOM');
const eolOf = (t) => { let crlf = 0, lf = 0; for (let i = 0; i < t.length; i++) if (t[i] === '\n') { if (t[i - 1] === '\r') crlf++; else lf++; } return { crlf, lf }; };
const e1 = eolOf(enRaw), e2 = eolOf(zhRaw);
if (e1.crlf !== e2.crlf || e1.lf !== e2.lf) fails.push(`G3 行尾风格变化 en(CRLF ${e1.crlf}/LF ${e1.lf}) vs zh(CRLF ${e2.crlf}/LF ${e2.lf})`);

// ---- 报告 ----
const cjk = (zhRaw.match(/[\u4e00-\u9fff]/g) || []).length;
console.log(`命名空间 "${NS}": 键 ${enKeys.length} | CJK 字符 ${cjk} | 行尾 en(${e1.crlf}/${e1.lf}) zh(${e2.crlf}/${e2.lf})`);
if (wl) {
  const src = {};
  for (const w of (Array.isArray(wl) ? wl : wl.entries || [])) src[w.source || '?'] = (src[w.source || '?'] || 0) + 1;
  console.log('清单来源分布:', JSON.stringify(src));
}
if (warns.length) console.log('WARN:\n - ' + warns.join('\n - '));
console.log(fails.length ? 'FAIL:\n - ' + fails.join('\n - ') : 'ALL GATES PASS (G1/G2/G3)');
process.exit(fails.length ? 1 : 0);
