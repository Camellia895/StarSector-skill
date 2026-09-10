// build_data_worklist.js — Starsector mod“全新汉化（无旧译）”数据层待译清单生成器（通用版）。
//
// 用途：把 mod 的 data 层（CSV/伪 JSON/文本）中所有玩家可见文本，按 recipe 规则抽成
// 统一 schema 的翻译清单 JSON（供人工填 zh / 子代理初译）：
//   { file, id, field, line, en, zh:"", note }
//   - file : 相对 mod 根路径（正斜杠）；line 为文件内 1 基物理起始行（仅上下文参考，
//     合并回填以 id+field 为准，避免多行单元格导致行号漂移）。
//
// 用法：
//   node build_data_worklist.js <modRoot> <recipe.json> <outDir>
//
// recipe.json 结构（数组节段，每段一个输出文件）：
// {
//   "sections": [
//     { "out": "01_data_descriptions",
//       "rules": [
//         { "kind":"csv", "file":"data/strings/descriptions.csv",
//           "idCol":"id", "idFilter":"^fds_",            // 可选：id 正则（如只译本 mod 前缀行）
//           "fields":[ {"col":"text1","note":"图鉴描述"}, {"col":"text2"} ] },
//         { "kind":"hullNames", "dirs":["data/hulls","data/hulls/skins"] },
//         { "kind":"variantDisplayNames", "dir":"data/variants" },
//         { "kind":"rulesCsv", "file":"data/campaign/rules.csv" },
//         { "kind":"lunaSettings", "file":"data/config/LunaSettings.csv" },
//         { "kind":"tips", "file":"data/strings/tips.json" },
//         { "kind":"shipNames", "file":"data/strings/ship_names.json" },
//         { "kind":"jsonObjects", "file":"data/config/custom_entities.json",
//           "valueKeys":[{"key":"defaultName","note":"星图区域标签"}] },
//         { "kind":"jsonScalars", "file":"mod_info.json",
//           "id":"FDS_ROTS",
//           "fields":[{"path":"name","note":"启动器显示名"},{"path":"description","note":"启动器简介"}] },
//         { "kind":"factionFile", "file":"data/world/factions/x.faction",
//           "id":"faction_id", "displayKeys":["displayName","displayNameWithArticle",
//             "displayNameLong","displayNameLongWithArticle","description"],
//           "ranks":true },        // 额外抓取 {"...":{"name":"..."}} 军衔/职务名
//         { "kind":"jsonDirObjects", "dir":"data/config/gsounty", "glob":"*.json",
//           "keys":[{"key":"description","note":"通缉令简介"},{"key":"dialog","note":"对话"}] },
//         { "kind":"missionDir", "dir":"data/missions",
//           "descriptorKeys":["title","description","difficulty"], "missionText":true },
//         { "kind":"wholeText", "file":"data/missions/x/mission_text.txt", "id":"x", "note":"..." }
//       ] }
//   ]
// }
//
// 已知易漏坑（本工具已内置处理，写 recipe 时留意）：
//  - rules.csv 部分行省略空 script 列（如 TradePanelFlavorText 行把 AddText 文本放在
//    script 槽），按 header 固定列会漏行 → rulesCsv 自动按行语义探测显示单元。
//  - 伪 JSON（# 注释/1.2f/尾逗号/BOM）→ 内部用 pseudojson.js。
//  - 全原版副本角色表（如只含原版 id 的 fighter_wings/weapon_categories）不要纳入，
//    否则会把中文核心覆盖回英文——用 idFilter 排除或干脆不写该 rule。
const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./csvlib.js');
const { parseJsonLoose, findLineOf } = require('./pseudojson.js');

const MOD = process.argv[2];
const RECIPE = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const OUT = process.argv[4];
fs.mkdirSync(OUT, { recursive: true });

const ENTRIES = [];
const add = e => ENTRIES.push(e);

// ---------- helpers ----------
function readLines(file) {
  return fs.readFileSync(path.join(MOD, file), 'utf8').split('\n').map(l => l.endsWith('\r') ? l.slice(0, -1) : l);
}
function walkFiles(dir, ext) {
  const out = [];
  const base = path.join(MOD, dir);
  if (!fs.existsSync(base)) return out;
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    const abs = path.join(MOD, d);
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const rel = d + '/' + e.name;
      if (e.isDirectory()) stack.push(rel);
      else if (e.name.endsWith(ext)) out.push(rel);
    }
  }
  return out;
}
const norm = p => p.split(path.sep).join('/').replace(/^\.\//, '');

// ---------- kinds ----------
function kCsv(rule) {
  const file = rule.file;
  const p = path.join(MOD, file);
  if (!fs.existsSync(p)) { console.log('missing', file); return; }
  const { header, rows } = parseCsv(fs.readFileSync(p, 'utf8'));
  const idIdx = typeof rule.idCol === 'string' ? header.indexOf(rule.idCol) : rule.idCol;
  if (idIdx < 0) throw new Error('idCol not found: ' + rule.idCol + ' in ' + file);
  const re = rule.idFilter ? new RegExp(rule.idFilter) : null;
  for (const r of rows) {
    const id = (r.cells[idIdx] || '').trim();
    if (!id || (re && !re.test(id))) continue;
    for (const f of rule.fields) {
      const idx = typeof f.col === 'string' ? header.indexOf(f.col) : f.col;
      if (idx < 0) continue;
      const v = (r.cells[idx] || '').trim();
      if (!v) continue;
      const fieldName = f.label || (typeof f.col === 'number' ? 'col' + f.col : f.col);
      add({ file, id, field: fieldName, line: r.line, en: v, zh: '', note: f.note || '' });
    }
  }
}

const _seenFiles = new Set();   // 防止重叠目录(如 data/hulls 与 data/hulls/skins)重复扫描
function kHullNames(rule) {
  for (const dir of rule.dirs || []) {
    for (const f of walkFiles(dir, '').filter(x => /\.(ship|skin)$/.test(x))) {
      if (_seenFiles.has(f)) continue;
      _seenFiles.add(f);
      const raw = fs.readFileSync(path.join(MOD, f), 'utf8');
      raw.split('\n').forEach((l, i) => {
        const m = l.match(/^\s*"hullName"\s*:\s*"(.*)",?\s*$/);
        if (m) add({ file: norm(f), id: path.basename(f).replace(/\.(ship|skin)$/, ''), field: 'hullName', line: i + 1, en: m[1], zh: '', note: '舰船显示名 (.ship/.skin 内 hullName)' });
      });
    }
  }
}

function kVariantDisplay(rule) {
  for (const f of walkFiles(rule.dir || 'data/variants', '.variant')) {
    if (_seenFiles.has(f)) continue;
    _seenFiles.add(f);
    const raw = fs.readFileSync(path.join(MOD, f), 'utf8');
    raw.split('\n').forEach((l, i) => {
      const m = l.match(/^\s*"displayName"\s*:\s*"(.*)",?\s*$/);
      if (m) add({ file: norm(f), id: path.basename(f, '.variant'), field: 'displayName', line: i + 1, en: m[1], zh: '', note: '装配变体名 (整备界面变体列表)' });
    });
  }
}

function kRulesCsv(rule) {
  const file = rule.file || 'data/campaign/rules.csv';
  const { header, rows } = parseCsv(fs.readFileSync(path.join(MOD, file), 'utf8'));
  const idIdx = header.indexOf('id');
  const textIdx = header.indexOf('text');
  const optIdx = header.indexOf('options');
  for (const r of rows) {
    const id = (r.cells[idIdx] || '').trim();
    if (!id || id.startsWith('#')) continue;
    const trigger = (r.cells[1] || '').trim();
    const tText = textIdx >= 0 ? (r.cells[textIdx] || '').trim() : '';
    const tScript = (r.cells[3] || '').trim();
    const dc = tText ? { en: tText, field: 'text', code: false }
      : (tScript.includes('AddText') ? { en: tScript, field: 'script(AddText)', code: true } : null);
    if (dc) {
      const hasCode = /(AddText|FireBest|CallEvent|SetTextHighlights|AddRemoveCommodity|AdjustRep|RepairAll|ShowPersonVisual|AddAbility|\$[A-Za-z_]+\s*=)/.test(dc.en);
      add({ file, id, field: dc.field, line: r.line, en: dc.en, zh: '',
        note: (dc.code ? '[AddText 指令单元: 只译引号内显示文字, 保留 AddText/颜色参数/引号] '
          : hasCode ? '[含脚本/指令: 只译引号内与面向玩家的文字, 保留 $变量/指令/引号] ' : '')
          + '对话/事件显示文本 (可自由口语化); 保留 $变量 (trigger=' + trigger + ')' });
    }
    if (optIdx >= 0) {
      const o = (r.cells[optIdx] || '').trim();
      if (o) add({ file, id, field: 'options', line: r.line, en: o, zh: '', note: '选项列表 (num:optionId:标签 或 optionId:标签; 只译标签部分, 保留 id/序号/引号)' });
    }
  }
}

function kLunaSettings(rule) {
  const file = rule.file || 'data/config/LunaSettings.csv';
  const { header, rows } = parseCsv(fs.readFileSync(path.join(MOD, file), 'utf8'));
  const idIdx = header.indexOf('fieldID'), nameIdx = header.indexOf('fieldName'),
    typeIdx = header.indexOf('fieldType'), defIdx = header.indexOf('defaultValue'), descIdx = header.indexOf('fieldDescription');
  for (const r of rows) {
    const fid = (r.cells[idIdx] || '').trim();
    if (!fid || fid.startsWith('#')) continue;
    const ftype = (r.cells[typeIdx] || '').trim();
    const nm = (r.cells[nameIdx] || '').trim();
    if (nm) add({ file, id: fid, field: 'fieldName', line: r.line, en: nm, zh: '', note: 'LunaLib 设置项名称' });
    if ((ftype === 'Header' || ftype === 'Text') && defIdx >= 0) {   // 仅 Header/Text 的 defaultValue 是显示文本
      const dv = (r.cells[defIdx] || '').trim();
      if (dv) add({ file, id: fid, field: 'defaultValue(' + ftype + ')', line: r.line, en: dv, zh: '', note: ftype === 'Header' ? '设置页标题下说明文字' : 'Text 型默认显示文本' });
    }
    const dd = descIdx >= 0 ? (r.cells[descIdx] || '').trim() : '';
    if (dd) add({ file, id: fid, field: 'fieldDescription', line: r.line, en: dd, zh: '', note: '设置项说明' });
  }
}

function kTips(rule) {
  const file = rule.file || 'data/strings/tips.json';
  const raw = fs.readFileSync(path.join(MOD, file), 'utf8').replace(/^\uFEFF/, '');
  const m = raw.match(/\{\s*tips\s*:\s*\[([\s\S]*?)\]\s*,?\s*\}/);
  if (!m) { console.log('tips parse fail:', file); return; }
  const arr = parseJsonLoose('[' + m[1] + ']');
  arr.forEach((tip, i) => add({ file, id: 'tip' + (i + 1), field: 'text', line: findLineOf(raw, tip.slice(0, 40)), en: tip, zh: '', note: '加载界面提示' }));
}

function kShipNames(rule) {
  const file = rule.file || 'data/strings/ship_names.json';
  const raw = fs.readFileSync(path.join(MOD, file), 'utf8');
  const obj = parseJsonLoose(raw);
  for (const [listName, names] of Object.entries(obj)) {
    if (!Array.isArray(names)) continue;
    for (const nm of names) add({ file, id: listName, field: nm, line: findLineOf(raw, '"' + nm + '"'), en: nm, zh: '', note: '随机舰名 (列表 ' + listName + ') — 可意译或保留, 需项目统一' });
  }
}

function kJsonObjects(rule) {
  const file = rule.file;
  const raw = fs.readFileSync(path.join(MOD, file), 'utf8');
  const obj = parseJsonLoose(raw);
  for (const [id, cfg] of Object.entries(obj)) {
    if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) continue;
    for (const vk of rule.valueKeys) {
      if (cfg[vk.key] !== undefined && cfg[vk.key] !== '') {
        add({ file, id, field: vk.key, line: findLineOf(raw, cfg[vk.key]), en: cfg[vk.key], zh: '', note: vk.note || '' });
      }
    }
  }
}

function kJsonScalars(rule) {
  const file = rule.file;
  const raw = fs.readFileSync(path.join(MOD, file), 'utf8');
  const obj = parseJsonLoose(raw);
  for (const f of rule.fields) {
    const v = f.path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
    if (v === undefined || v === '') continue;
    add({ file, id: rule.id, field: f.path, line: findLineOf(raw, '"' + f.path.split('.').pop() + '"'), en: v, zh: '', note: f.note || '' });
  }
}

function kFactionFile(rule) {
  const file = rule.file;
  const raw = fs.readFileSync(path.join(MOD, file), 'utf8');
  for (const k of rule.displayKeys) {
    const re = new RegExp('^\\s*"' + k + '"\\s*:\\s*"([^"]*)"\\s*,?\\s*$', 'm');
    const m = raw.match(re);
    if (m) add({ file, id: rule.id, field: k, line: findLineOf(raw, '"' + k + '"'), en: m[1], zh: '', note: k === 'description' ? '势力简介 (情报界面)' : '势力显示名变体 (带冠词版与主名一致即可)' });
  }
  if (rule.ranks) {
    const re = /"([A-Za-z]+)"\s*:\s*\{\s*"name"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
    let m;
    while ((m = re.exec(raw))) add({ file, id: m[1], field: 'rank/name', line: findLineOf(raw, m[2]), en: m[2], zh: '', note: '军衔/职务名 (对话与称号显示)' });
  }
}

function kJsonDirObjects(rule) {
  const dir = rule.dir;
  if (!fs.existsSync(path.join(MOD, dir))) return;
  for (const f of fs.readdirSync(path.join(MOD, dir))) {
    if (rule.glob && !f.endsWith(rule.glob.replace('*', ''))) continue;
    if (!/\.json$/i.test(f)) continue;
    const file = norm(path.join(dir, f));
    const raw = fs.readFileSync(path.join(MOD, file), 'utf8');
    const obj = parseJsonLoose(raw);
    const id = f.replace(/\.json$/i, '');
    for (const vk of rule.keys) {
      if (obj[vk.key] !== undefined && obj[vk.key] !== '') add({ file, id, field: vk.key, line: findLineOf(raw, '"' + vk.key + '"'), en: obj[vk.key], zh: '', note: vk.note || '' });
    }
  }
}

function kMissionDir(rule) {
  const dir = rule.dir || 'data/missions';
  if (!fs.existsSync(path.join(MOD, dir))) return;
  for (const sub of fs.readdirSync(path.join(MOD, dir))) {
    const sdir = path.join(dir, sub);
    if (!fs.statSync(path.join(MOD, sdir)).isDirectory()) continue;
    const dp = path.join(sdir, 'descriptor.json');
    if (fs.existsSync(path.join(MOD, dp))) {
      const raw = fs.readFileSync(path.join(MOD, dp), 'utf8');
      const obj = parseJsonLoose(raw);
      for (const k of rule.descriptorKeys || ['title', 'description']) {
        if (obj[k] !== undefined && obj[k] !== '') add({ file: norm(dp), id: sub, field: k, line: findLineOf(raw, '"' + k + '"'), en: obj[k], zh: '', note: k === 'title' ? '任务选单 标题' : k === 'difficulty' ? '难度标签 (确认界面是否显示后再定)' : '任务选单 简介' });
      }
    }
    if (rule.missionText) {
      const tp = path.join(sdir, 'mission_text.txt');
      if (fs.existsSync(path.join(MOD, tp))) {
        const txt = fs.readFileSync(path.join(MOD, tp), 'utf8').replace(/^\uFEFF/, '');
        add({ file: norm(tp), id: sub, field: 'text', line: 1, en: txt, zh: '', note: '任务简报全文 (保留段落格式; Location/Date 行可意译)' });
      }
    }
  }
}

function kWholeText(rule) {
  const file = rule.file;
  const txt = fs.readFileSync(path.join(MOD, file), 'utf8').replace(/^\uFEFF/, '');
  add({ file: norm(file), id: rule.id || path.basename(file), field: 'text', line: 1, en: txt, zh: '', note: rule.note || '整文件文本' });
}

const HANDLERS = {
  csv: kCsv,
  hullNames: kHullNames,
  variantDisplayNames: kVariantDisplay,
  rulesCsv: kRulesCsv,
  lunaSettings: kLunaSettings,
  tips: kTips,
  shipNames: kShipNames,
  jsonObjects: kJsonObjects,
  jsonScalars: kJsonScalars,
  factionFile: kFactionFile,
  jsonDirObjects: kJsonDirObjects,
  missionDir: kMissionDir,
  wholeText: kWholeText,
};

for (const sec of RECIPE.sections) {
  const before = ENTRIES.length;
  for (const rule of sec.rules) {
    const h = HANDLERS[rule.kind];
    if (!h) throw new Error('unknown kind: ' + rule.kind);
    h(rule);
  }
  const list = ENTRIES.slice(before).map(e => ({ file: e.file, id: e.id, field: e.field, line: e.line, en: e.en, zh: e.zh, note: e.note }));
  fs.writeFileSync(path.join(OUT, sec.out + '.json'), JSON.stringify(list, null, 1), 'utf8');
  console.log(sec.out + '.json => ' + list.length);
}
console.log('total:', ENTRIES.length);

