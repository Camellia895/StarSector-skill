#!/usr/bin/env node
/**
 * balance_apply.js — 断言式批量数值补丁工具（wf-balance-revision §2）
 * 用法: node balance_apply.js <modRoot> <revision_items.json> [--dry]
 *
 * 纪律:
 *  - 每格改前断言旧值; 断言失败记 conflict(仍应用目标值) 或 failed(找不到目标=停)
 *  - CSV: 状态机 split(处理成对引号), 只替换目标行的目标列, 行内其余字节不动; 写回保持原行尾(R17)
 *  - 含逗号/引号的单元格写回时按 RFC 加引号转义(R1); 跳过 # 注释行(R21)
 *  - .ship 等 JSON: 先做 parse→stringify 空转对照, 非字节一致则拒绝编辑该文件(R8 安全阀)
 *  - 输出 applied / conflict / failed 三张表; failed>0 时退出码 1
 */
'use strict';
const fs = require('fs');
const path = require('path');

const [modRoot, recipePath] = process.argv.slice(2);
const DRY = process.argv.includes('--dry');
if (!modRoot || !recipePath) { console.error('用法: node balance_apply.js <modRoot> <recipe.json> [--dry]'); process.exit(2); }
const recipe = JSON.parse(fs.readFileSync(recipePath, 'utf8'));

// ---------- CSV 状态机 ----------
function splitCsvLine(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else {
      if (c === '"') q = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}
function csvJoinCell(v) {
  v = String(v);
  return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}
function joinCsvRow(cells) { return cells.map(csvJoinCell).join(','); }

// ---------- 文件缓存 ----------
const csvCache = new Map();   // abs -> {eol, lines, header, cells}
function loadCsv(abs) {
  if (csvCache.has(abs)) return csvCache.get(abs);
  const raw = fs.readFileSync(abs, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const hadTrailing = raw.endsWith('\n');
  const lines = raw.split(/\r?\n/);
  if (hadTrailing && lines[lines.length - 1] === '') lines.pop();
  const header = splitCsvLine(lines[0]);
  const rec = { eol, hadTrailing, lines, header, dirty: false, abs };
  csvCache.set(abs, rec);
  return rec;
}
function saveCsv(rec) {
  if (!rec.dirty || DRY) return;
  let t = rec.lines.join(rec.eol);
  if (rec.hadTrailing) t += rec.eol;
  fs.writeFileSync(rec.abs, t, 'utf8'); // utf8 无 BOM
}

const jsonCache = new Map();  // (保留占位: json 编辑已改为原文手术 editJsonText)

// ---------- JSON 原文手术(R8/R18: 只动 needle, 不整体重序列化, 规避 -0 等格式漂移) ----------
function editJsonText(abs, fn) {
  const raw = fs.readFileSync(abs, 'utf8');
  JSON.parse(raw); // 编辑前必须是合法 JSON
  const { text, note } = fn(raw, raw.includes('\r\n') ? '\r\n' : '\n');
  JSON.parse(text); // 编辑后仍必须是合法 JSON
  if (!DRY) fs.writeFileSync(abs, text, 'utf8');
  return { actual: note.actual, changed: text !== raw };
}
function slotFieldSurgery(slotId, field, value) {
  return (raw) => {
    // 槽位对象无嵌套 {}; 用 id 作锚
    const re = new RegExp('\\{[^{}]*"id"\\s*:\\s*"' + slotId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^{}]*\\}');
    const m = re.exec(raw);
    if (!m) return { text: raw, note: { actual: 'SLOT_NOT_FOUND' } };
    const obj = m[0];
    const fm = new RegExp('"' + field + '"\\s*:\\s*("?[^,}\\s]+"?)');
    const old = fm.exec(obj);
    if (!old) return { text: raw, note: { actual: 'FIELD_NOT_FOUND' } };
    const actual = old[1].replace(/"/g, '');
    const newObj = obj.replace(fm, `"${field}": ${typeof value === 'string' ? '"' + value + '"' : value}`);
    return { text: raw.slice(0, m.index) + newObj + raw.slice(m.index + obj.length), note: { actual } };
  };
}
function builtinModsSurgery(op, modId) {
  return (raw, eol) => {
    const bm = /"builtInMods"\s*:\s*\[([^\]]*)\]/.exec(raw);
    if (!bm) return { text: raw, note: { actual: 'BLOCK_NOT_FOUND' } };
    const inner = bm[1];
    const elems = inner.split(',').map(s => s.trim().replace(/^"|"$/g, '')).filter(s => s.length);
    let text;
    if (op === 'arrayAdd') {
      if (elems.includes(modId)) return { text: raw, note: { actual: 'present' } };
      const ind = (inner.match(/\r?\n(\s*)/) || [, '    '])[1] || '    ';
      const add = (inner.trim().length ? ',' : '') + eol + ind + `"${modId}"`;
      text = raw.slice(0, bm.index + bm[0].length - 1) + add + raw.slice(bm.index + bm[0].length - 1);
      return { text, note: { actual: 'absent' } };
    } else {
      if (!elems.includes(modId)) return { text: raw, note: { actual: 'absent' } };
      const ind = (inner.match(/\r?\n(\s*)/) || [, '    '])[1] || '    ';
      const kept = elems.filter(x => x !== modId).map(x => `"${x}"`);
      const block = `"builtInMods": [` + eol + ind + kept.join(',' + eol + ind) + eol + '  ' + `]`;
      text = raw.slice(0, bm.index) + block + raw.slice(bm.index + bm[0].length);
      return { text, note: { actual: 'present' } };
    }
  };
}

// ---------- 断言 ----------
function checkAssert(kind, actual, item) {
  // 返回 null=通过, 'conflict'=旧值不符(仍应用), 'failed'=目标不存在
  if (kind === 'failed') return 'failed';
  if (item.assertOld === undefined || item.assertOld === null) return null;
  const a = item.assertOld;
  if (typeof a === 'string' && a.startsWith('contains:'))
    return (kind === 'json' ? actual === 'present' : String(actual).includes(a.slice(9))) ? null : 'conflict';
  if (typeof a === 'string' && a.startsWith('notContains:'))
    return (kind === 'json' ? actual === 'absent' : !String(actual).includes(a.slice(12))) ? null : 'conflict';
  return String(actual) === String(a) ? null : 'conflict';
}

// ---------- 主循环 ----------
const applied = [], conflicts = [], failed = [];
for (const item of recipe.items) {
  const abs = path.join(modRoot, item.file);
  try {
    let kind, actual, apply = () => {};
    if (item.kind === 'csv_cell') {
      const rec = loadCsv(abs);
      const { matchId, column } = item.locator;
      const ci = rec.header.indexOf(column);
      if (ci < 0) throw new Error(`列不存在: ${column}`);
      const ri = rec.lines.findIndex((l, i) => i > 0 && !l.startsWith('#') && splitCsvLine(l)[rec.header.indexOf('id')] === matchId);
      if (ri < 0) throw new Error(`找不到 id=${matchId}`);
      const cells = splitCsvLine(rec.lines[ri]);
      actual = cells[ci];
      apply = () => { cells[ci] = item.value; rec.lines[ri] = joinCsvRow(cells); rec.dirty = true; saveCsv(rec); };
      kind = 'csv';
    } else if (item.kind === 'ship_slot') {
      const probe = slotFieldSurgery(item.locator.slotId, item.locator.field, item.value)(fs.readFileSync(abs, 'utf8'));
      actual = probe.note.actual;
      if (actual === 'SLOT_NOT_FOUND' || actual === 'FIELD_NOT_FOUND') { failed.push({ id: item.id, why: `槽位/字段未找到: ${item.locator.slotId}.${item.locator.field}` }); continue; }
      apply = () => { editJsonText(abs, slotFieldSurgery(item.locator.slotId, item.locator.field, item.value)); };
      kind = 'slot';
    } else if (item.kind === 'json_mut') {
      const op = item.locator.op, modId = item.locator.value;
      const probe = builtinModsSurgery(op, modId)(fs.readFileSync(abs, 'utf8'), fs.readFileSync(abs, 'utf8').includes('\r\n') ? '\r\n' : '\n');
      actual = probe.note.actual;
      if (probe.note.actual === 'BLOCK_NOT_FOUND') { failed.push({ id: item.id, why: 'builtInMods 块不存在' }); continue; }
      // no-op 情形: add 已存在 / remove 不存在 ⇒ 视为无需改动, 算 applied(幂等) 而非 conflict
      if ((op === 'arrayAdd' && actual === 'present') || (op === 'arrayRemove' && actual === 'absent')) {
        applied.push({ id: item.id, note: '幂等跳过(已是目标状态)' });
        continue;
      }
      apply = () => { editJsonText(abs, builtinModsSurgery(op, modId)); };
      kind = 'json';
    } else if (item.kind === 'text') {
      const rec = loadCsv(abs);
      const { matchId, type, column, op } = item.locator;
      const idCi = rec.header.indexOf('id'), tyCi = rec.header.indexOf('type'), txCi = rec.header.indexOf(column);
      if (txCi < 0) throw new Error(`列不存在: ${column}`);
      const ri = rec.lines.findIndex((l, i) => {
        if (i === 0 || l.startsWith('#')) return false;
        const c = splitCsvLine(l);
        return c[idCi] === matchId && (type === undefined || c[tyCi] === type);
      });
      if (ri < 0) throw new Error(`找不到描述行 id=${matchId}${type ? ' type=' + type : ''}`);
      const cells = splitCsvLine(rec.lines[ri]);
      actual = cells[txCi];
      const has = item.assertContains || null;
      if (has && !actual.includes(has)) { failed.push({ id: item.id, why: `assertContains 未命中: ${has}` }); continue; }
      apply = () => {
        if (op === 'append') cells[txCi] = actual.replace(/。\s*$/, '。') + item.value;
        else cells[txCi] = item.value;
        rec.lines[ri] = joinCsvRow(cells); rec.dirty = true; saveCsv(rec);
      };
      kind = 'text';
    } else throw new Error(`未知 kind: ${item.kind}`);

    const verdict = checkAssert(kind, actual, item);
    if (verdict === 'failed') { failed.push({ id: item.id, why: `目标不存在 (actual=${JSON.stringify(actual)})` }); continue; }
    if (!DRY) apply();
    if (verdict === 'conflict') { conflicts.push({ id: item.id, doc: item.doc, assertOld: item.assertOld, actual: String(actual), applied: String(item.value) }); }
    else applied.push({ id: item.id, note: item.note || '' });
  } catch (e) {
    failed.push({ id: item.id, why: e.message });
  }
}

console.log(`== 应用结果 ==  共 ${recipe.items.length} 条`);
console.log(`applied: ${applied.length}  conflict(旧值不符,已按目标值应用): ${conflicts.length}  failed: ${failed.length}`);
if (conflicts.length) {
  console.log('\n-- conflicts --');
  for (const c of conflicts) console.log(`  [${c.id}] 断言=${c.assertOld} 实际=${c.actual} → 已设为 ${c.applied}`);
}
if (failed.length) {
  console.log('\n-- failed --');
  for (const f of failed) console.log(`  [${f.id}] ${f.why}`);
}
if (DRY) console.log('\n(dry-run, 未写盘)');
process.exit(failed.length ? 1 : 0);
