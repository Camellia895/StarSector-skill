// ledger_report.js — 校验记账本聚合报告（verification ledger 的读出端）
//
// 用途：从 shared\verification-ledger.jsonl 算票，对照 shared\verification-ledger.md 的档位表，
//       输出「该升档 / 该降档 / 可退役 / 必须探针 / 需修复」的行动清单。
//       省上下文的关键：报告是**建议**，是否改档位表由人（或"校验审计"流程）确认后落笔。
//
// 用法：
//   node ledger_report.js                 # 人读报告
//   node ledger_report.js --json          # 机读（供自动流程消费）
//   node ledger_report.js --check=<名>    # 只看某一条
//
// 规则来源见 shared\verification-ledger.md §1–§5：
//   prio = Σ(severity权重 × 命中次数) − 1 × 运行次数
//   cond → sample：连续 10 次 clean
//   sample → dormant：连续 25 次 clean（**红级 + 未探针通过 禁止降档**）
//   命中 ≥ 1 的校验不允许停留在 dormant（升级优先于降级）
//   exit=2+（invalid）记录不计票（run_check.js 本就不写账，此处再兜一层）
const fs = require('fs');
const path = require('path');

const SHARED = path.resolve(__dirname, '..');
const LEDGER = path.join(SHARED, 'verification-ledger.jsonl');
const DOC = path.join(SHARED, 'verification-ledger.md');
const WEIGHT = { red: 3, yellow: 2, green: 1 };
const T3 = ['base', 'cond', 'sample', 'dormant'];

const argv = process.argv.slice(2);
const opt = {};
for (const a of argv) {
  const m = a.match(/^--([A-Za-z-]+)(?:=(.*))?$/s);
  if (m) opt[m[1]] = m[2] === undefined ? true : m[2];
}
const onlyCheck = typeof opt.check === 'string' ? opt.check : null;

// ---------- 1. 解析档位表（verification-ledger.md §8） ----------
function parseRegistry() {
  if (!fs.existsSync(DOC)) { console.error('找不到档位表: ' + DOC); process.exit(2); }
  const lines = fs.readFileSync(DOC, 'utf8').split(/\r?\n/);
  const reg = new Map();
  let inTable = false;
  for (const line of lines) {
    if (/^\|\s*校验\s*\|/.test(line)) { inTable = true; continue; }
    if (inTable && /^\|\s*-+/.test(line)) continue;
    if (inTable) {
      if (!/^\|/.test(line)) { inTable = false; continue; }
      const cells = line.split('|').slice(1, -1).map(s => s.trim());
      if (cells.length < 3) continue;
      const [name, sev, tier, note] = cells;
      const clean = name.replace(/`/g, '').trim();
      if (!clean || !WEIGHT[sev]) continue;
      reg.set(clean, { name: clean, severity: sev, tier, note: note || '' });
    }
  }
  return reg;
}

// ---------- 2. 读账本 ----------
function readLedger() {
  if (!fs.existsSync(LEDGER)) return [];
  const out = [];
  const raw = fs.readFileSync(LEDGER, 'utf8').split(/\r?\n/);
  for (const line of raw) {
    const s = line.trim();
    if (!s) continue;
    try {
      const r = JSON.parse(s);
      if (typeof r.exit === 'number' && r.exit >= 2) continue;   // invalid 不计票
      out.push(r);
    } catch { /* 跳过坏行，不中断报告 */ }
  }
  return out;
}

// ---------- 3. 聚合 ----------
function aggregate(rows) {
  const agg = new Map();
  const touched = new Set();
  for (const r of rows) {
    const c = r.check;
    touched.add(c);
    if (!agg.has(c)) agg.set(c, { runs: 0, hits: 0, clean: 0, cleanStreak: 0, probes: 0, probeWorked: 0, last: '', lastHit: '' });
    const a = agg.get(c);
    // 按时间顺序统计"连续 clean"：账本通常已按时间 append，但为稳妥按 t 排序后重算由外层负责
    a.runs++;
    if (r.hit) { a.hits++; a.cleanStreak = 0; a.lastHit = r.t; }
    else { a.clean++; a.cleanStreak++; }
    if (r.probe) { a.probes++; if (r.hit) a.probeWorked++; }
    if (!a.last || r.t > a.last) a.last = r.t;
  }
  return { agg, touched };
}

// 更准确：按时间排序后重新计算 cleanStreak
function cleanStreakOf(rows, check) {
  const seq = rows.filter(r => r.check === check).sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));
  let s = 0;
  for (let i = seq.length - 1; i >= 0; i--) { if (seq[i].hit) break; s++; }
  return s;
}

// ---------- 4. 建议 ----------
function recommend(reg, agg, rows) {
  const out = [];
  for (const [name, meta] of reg) {
    const a = agg.get(name) || { runs: 0, hits: 0, clean: 0, probes: 0, probeWorked: 0, last: '', lastHit: '' };
    const w = WEIGHT[meta.severity];
    const cleanStreak = cleanStreakOf(rows, name);
    const prio = w * a.hits - a.runs;                 // c = 1
    let rec = meta.tier, reason = '', flags = [];

    const probeCleared = a.probes > 0 && a.probeWorked > 0;   // 探针确认"能发现东西"
    const probeNeeded = a.runs >= 10 && a.hits === 0 && !probeCleared;

    if (probeNeeded) flags.push('需探针');
    if (a.probes > 0 && a.probeWorked === 0) flags.push('需修复');   // 注入了缺陷却报不出来

    if (meta.tier === 'base') {
      if (a.hits >= 1) { reason = `base 命中 ${a.hits} 次，保持`; }
      else if (meta.severity === 'red') {
        if (a.runs >= 25 && !probeCleared) { rec = 'base'; reason = `红级 ${a.runs} 次未命中 → 允许降 sample，但**未探针**，先探针`; flags.push('未探针禁降'); }
        else if (a.runs >= 25 && probeCleared) { rec = 'sample'; reason = `红级 ${a.runs} 次未命中，探针已确认有效 → 降 sample（永不退役）`; }
        else reason = `红级，${a.runs} 次运行（未达 25 次降档门槛）`;
      } else if (a.runs >= 10) { rec = 'cond'; reason = `黄/绿级 ${a.runs} 次未命中 → 降 cond`; }
      else reason = `${a.runs} 次运行（不足降档门槛）`;
    } else if (meta.tier === 'cond') {
      if (cleanStreak >= 10) { rec = 'sample'; reason = `连续 ${cleanStreak} 次 clean → 降 sample`; }
      else if (a.hits >= 1) { reason = `命中 ${a.hits} 次，保持 cond`; }
      else reason = `连续 ${cleanStreak} 次 clean（门槛 10）`;
    } else if (meta.tier === 'sample') {
      if (a.hits >= 1 && meta.severity === 'red') { rec = 'base'; reason = `红级再次命中 → 升回 base`; }
      else if (cleanStreak >= 25) {
        if (meta.severity === 'red' && !probeCleared) { rec = 'sample'; reason = `连续 ${cleanStreak} 次 clean，但红级且**未探针** → 禁止转 dormant`; flags.push('未探针禁退役'); }
        else { rec = 'dormant'; reason = `连续 ${cleanStreak} 次 clean → 可转 dormant`; }
      } else reason = `连续 ${cleanStreak} 次 clean（门槛 25）`;
    } else if (meta.tier === 'dormant') {
      if (a.hits >= 1) { rec = 'sample'; reason = `dormant 却仍命中 ${a.hits} 次 → 升回 sample（升级优先）`; }
      else reason = '休眠中（手动启用；命中即自动升回）';
    }

    out.push({
      check: name, severity: meta.severity, tier: meta.tier, recommended: rec,
      runs: a.runs, hits: a.hits, cleanStreak, prio,
      probes: a.probes, probeWorked: a.probeWorked,
      last: a.last ? a.last.slice(0, 19).replace('T', ' ') : '',
      lastHit: a.lastHit ? a.lastHit.slice(0, 19).replace('T', ' ') : '',
      flags, reason
    });
  }
  // 账本里出现但档位表未登记 → 未登记项
  const orphans = [...new Set(rows.map(r => r.check))].filter(c => !reg.has(c));
  return { items: out, orphans };
}

// ---------- 5. 输出 ----------
const reg = parseRegistry();
const rows = readLedger();
const { agg } = aggregate(rows);
let { items, orphans } = recommend(reg, agg, rows);
if (onlyCheck) items = items.filter(i => i.check === onlyCheck);

if (opt.json) {
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), ledgerRows: rows.length, items, orphans }, null, 2));
  process.exit(0);
}

const pad = (s, n) => { s = String(s); let w = 0; for (const ch of s) w += ch.charCodeAt(0) > 0x2e80 ? 2 : 1; return s + ' '.repeat(Math.max(0, n - w)); };
const changes = items.filter(i => i.recommended !== i.tier);
const flagged = items.filter(i => i.flags.length);

console.log('===== 校验记账本报告 =====');
console.log(`账本行数 ${rows.length} · 登记校验 ${items.length} 条 · 建议变更 ${changes.length} 条 · 待处理标记 ${flagged.length} 条`);
if (!rows.length) console.log('\n（账本为空：所有校验尚无历史。跑校验请用 run_check.js 包装以自动记账。）');

console.log('\n-- 建议变更 --');
if (!changes.length) console.log('  （无；档位表与账本一致）');
for (const i of changes) console.log(`  ${pad(i.check, 28)} ${i.tier} → ${i.recommended}   ${i.reason}`);

console.log('\n-- 待处理标记 --');
if (!flagged.length) console.log('  （无）');
for (const i of flagged) console.log(`  ${pad(i.check, 28)} [${i.flags.join(' / ')}]   run=${i.runs} hit=${i.hits} probe=${i.probeWorked}/${i.probes}`);

console.log('\n-- 全量（run / hit / clean连续 / prio） --');
for (const i of items.slice().sort((a, b) => b.prio - a.prio)) {
  console.log(`  ${pad(i.check, 28)} ${pad(i.severity, 7)} ${pad(i.tier, 8)} run=${pad(i.runs, 4)} hit=${pad(i.hits, 3)} cleanStreak=${pad(i.cleanStreak, 4)} prio=${pad(i.prio, 5)} ${i.lastHit ? 'lastHit=' + i.lastHit : ''}`);
}

if (orphans.length) {
  console.log('\n-- 账本里有、档位表未登记（请补登到 verification-ledger.md §8） --');
  for (const o of orphans) console.log('  ' + o);
}
console.log('\n提示：档位表是人工维护的权威；本报告只给建议。确认后改 shared\\verification-ledger.md §8。');
