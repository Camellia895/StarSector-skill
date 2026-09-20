// smoke_scan.js — 启动烟测的**日志指纹扫描**（输出极简，专为省上下文）
//
// 背景：`starsector.log` 起步几十 MB，**不能整篇读进上下文**。本脚本只回答两件事：
//   ① 这次启动**有没有**致命信号（决定烟测过不过）；
//   ② **是哪一个已知错误指纹**（直接指回铁律编号 R# 与该跑哪个闸门）。
//
// 用法：
//   node smoke_scan.js <starsector.log>                      # 人读：一屏以内
//   node smoke_scan.js <starsector.log> --json               # 机读
//   node smoke_scan.js <starsector.log> --context=3          # 每个命中附 3 行上下文（默认 0）
//
// 退出码（与 run_check.js 约定一致，便于记账）：
//   0 = 无致命信号（干净）  1 = 命中致命指纹 / 有 Fatal·ERROR  2 = 用法错误
const fs = require('fs');

const argv = process.argv.slice(2);
const file = argv.find(a => !a.startsWith('--'));
const opt = {};
for (const a of argv) { const m = a.match(/^--([A-Za-z-]+)(?:=(.*))?$/s); if (m) opt[m[1]] = m[2] === undefined ? true : m[2]; }
if (!file) { console.error('用法: node smoke_scan.js <starsector.log> [--json] [--context=N]'); process.exit(2); }
if (!fs.existsSync(file)) { console.error('找不到日志: ' + file); process.exit(2); }
const CTX = Number(opt.context || 0);
const JSON_OUT = !!opt.json;

// ---------------- 指纹表 ----------------
// fatal:true 的算"致命信号"；fatal:false 只是"提示"（原版与别的 mod 常见，不代表本次失败）。
// rule 指回 <skills>\shared\iron-rules.md 的编号；gate 指该跑哪个闸门脚本。
// 加新指纹 = 往这里加一行，**不要**把日志原文塞进任何文档。
const PATTERNS = [
  // —— 汉化引入（与铁律一一对应）——
  { name: 'R12 逻辑键误译（启动 Fatal 头号成因）', re: /ExceptionInInitializerError/, rule: 'R12', gate: 'scan_logic_keys.js', fatal: true, why: '常量池里"显示文本"与"查找键"字面相同，键被译成中文后查不到' },
  { name: 'R12 逻辑键误译（mod id 找不到）', re: /Could not find mod/, rule: 'R12', gate: 'scan_logic_keys.js', fatal: true, why: 'mod id / 引擎常量被当显示文本译了' },
  { name: 'R12/R19 键查找返回 null', re: /getBoolean\(|getModSpec\(|isModEnabled\(/, rule: 'R12', gate: 'scan_logic_keys.js', fatal: true, why: '查找类调用收到 null' },
  { name: 'R13 options 结构损坏（数值被当 optionId）', re: /NumberFormatException: For input string/, rule: 'R13', gate: 'check_options_structure.js', fatal: true, why: 'rules.csv 合成字段 options 结构被破坏' },
  { name: 'R13/R15 options 缺键或行数不符', re: /JSONObject\["options"\] not found/, rule: 'R13', gate: 'check_options_structure.js + check_install_source.js', fatal: true, why: 'CSV 被拆列（R1）或对已汉化目录二次注入（R15）' },
  // ⚠️ R1 只认"引擎解析 CSV 失败"的**异常头**。`ResourceLoaderState.init` 是**通用调用栈帧**，
  //    任何资源加载失败都会出现它 —— 实测把"武器 spec 缺失崩溃"误报成 R1，故不可作指纹。
  { name: 'R1 CSV 引号拆列（CSV 行被拆 → 缺列键）', re: /JSONObject\["(options|id|trigger)"\] not found/, rule: 'R1', gate: 'check_csv_quotes.js + TestCsv.java', fatal: true, why: '弯引号归一化后拆散行列（判据：行数与英文基线不同）' },
  { name: 'R7 标识符被误译（闪退）', re: /NoSuchFieldError|NoSuchMethodError/, rule: 'R7', gate: 'verify_identifiers.js', fatal: true, why: '字段/方法/类名被补丁改成了中文' },
  { name: 'R6 \u0001 recipe 数量被改', re: /StringConcatException|BootstrapMethodError/, rule: 'R6', gate: 'check_u0001.js', fatal: true, why: 'Kotlin indy 拼接占位符数量/位置变了' },
  { name: 'R4 字面 % 未写 %%', re: /UnknownFormatConversionException/, rule: 'R4', gate: 'check_content.js', fatal: true, why: 'tooltip 文本经 String.format 渲染失败' },
  { name: 'R10 designTypeColors 键重复', re: /Duplicate key/, rule: 'R10', gate: 'verify_all_data.js', fatal: true, why: '两个设计类型名译成同一个中文键' },
  { name: 'R19 伪 JSON 引号未转义 / BOM', re: /JSONObject text must begin with|Expected .* at character/, rule: 'R19', gate: 'JsonProbe.java', fatal: true, why: '伪 JSON 值里出现未转义 ASCII 引号，或有 BOM' },
  { name: 'R15 对已汉化目录二次注入（合成字段被追加）', re: /一行变两行|duplicated|twice/, rule: 'R15', gate: 'check_install_source.js', fatal: false, why: '形近描述，需人工确认' },
  // —— 引用断链（**启动崩溃**）：平时是 WARN 级噪音，一旦以 RuntimeException 冒上来就致命 ——
  { name: '引用断链：武器 spec 缺失（启动崩溃）', re: /RuntimeException: Weapon spec .* not found/, rule: 'R5/引用', gate: 'check_refs.js + check_assets.js', fatal: true, why: '某个 .variant/.wpn 装备了不存在的武器 id（汉化误改 csv 的 id 列或漏该武器行也会造成）' },
  { name: '引用断链：舰体 spec 缺失（启动崩溃）', re: /RuntimeException: (Ship hull|Hull) spec .* not found/, rule: '引用', gate: 'check_refs.js', fatal: true, why: '.variant/.skin 指向不存在的 hull id' },
  // —— 环境类（假阳性高发，别当汉化的错）——
  { name: '环境：StackMapTable（本机 API jar 被改过，游戏自带 -noverify 无感）', re: /VerifyError|StackMapTable/, rule: 'env.md §4', gate: '—（离线程序需加 -noverify）', fatal: false, why: '自己写的离线验证程序会看到假崩溃' },
  { name: '环境：类版本不匹配', re: /UnsupportedClassVersionError/, rule: 'env.md §4', gate: '—', fatal: true, why: '编译目标 class 版本高于游戏 JRE' },
  { name: '环境：内存不足', re: /OutOfMemoryError/, rule: 'env.md', gate: 'drive.ps1（JVM -Xmx16g 固定）', fatal: true, why: '禁止双实例' },
  // —— 加载期噪音（**不代表失败**）——
  { name: '噪音：插件初始化报错（GameState/Factory 未就绪，常为良性）', re: /Error while initializing plugin/, rule: '—', gate: '—', fatal: false, why: '原版与多个 mod 都有，verdict=PASS 时也会出现' },
  { name: '噪音：spec 缺失 **警告**（WARN 级；多为别人的 mod）', re: /^\s*\d+ \[.*\]\s+WARN\s+.*(Weapon|Ship hull|spec) .* not found/, rule: '—', gate: '—', fatal: false, why: 'WARN 级：不代表失败；若同一 id 以 RuntimeException 冒上来才会致命（见上面的"引用断链"指纹）' },
  { name: '噪音：缺 mod 依赖弹窗', re: /(is required|Missing mod|requires mod)/i, rule: '—', gate: 'check mod_info.dependencies', fatal: false, why: '缺前置，属安装问题不是汉化问题' },
];

// ---------------- 扫描（流式，逐行）----------------
const text = fs.readFileSync(file, 'latin1');          // 字节级读取：GBK 也能匹配 ASCII 指纹
const lines = text.split('\n');
const hits = new Map();                                 // name -> {count, samples:[{line,text}]}
let fatalCount = 0;
let errorCount = 0;

for (let i = 0; i < lines.length; i++) {
  const raw = lines[i];
  const s = raw.replace(/\r$/, '');
  if (/\bFATAL\b/.test(s)) fatalCount++;
  if (/\bERROR\b/.test(s)) errorCount++;
  for (const p of PATTERNS) {
    if (!p.re.test(s)) continue;
    if (!hits.has(p.name)) hits.set(p.name, { ...p, count: 0, samples: [] });
    const h = hits.get(p.name);
    h.count++;
    if (h.samples.length < 3) {
      // 只留"关键那一段"：截到 200 字符，且去掉 GBK 乱码字节
      const clean = s.replace(/[^\x20-\x7E]/g, '·').trim().slice(0, 200);
      h.samples.push({ line: i + 1, text: clean });
    }
  }
}

// 最近一次会话的致命行（日志轮转后就是本次；多会话时取最后 1 条 FATAL）
let lastFatal = null;
for (let i = lines.length - 1; i >= 0; i--) {
  if (/\bFATAL\b/.test(lines[i])) { lastFatal = { line: i + 1, text: lines[i].replace(/[^\x20-\x7E]/g, '·').trim().slice(0, 220) }; break; }
}

const fatalHits = [...hits.values()].filter(h => h.fatal);
const noiseHits = [...hits.values()].filter(h => !h.fatal);
const verdict = (fatalHits.length || fatalCount) ? 'FAIL' : 'PASS';

if (JSON_OUT) {
  console.log(JSON.stringify({
    log: file, verdict,
    fatalCount, errorCount,
    lastFatal,
    fatalHits: fatalHits.map(h => ({ name: h.name, rule: h.rule, gate: h.gate, count: h.count, samples: h.samples })),
    noiseHits: noiseHits.map(h => ({ name: h.name, count: h.count })),
  }, null, 2));
  process.exit(verdict === 'PASS' ? 0 : 1);
}

// ---------------- 人读输出：一屏以内 ----------------
console.log('===== 烟测日志指纹 =====');
console.log(`${file}`);
console.log(`判定: ${verdict}   FATAL=${fatalCount}  ERROR=${errorCount}  (文件 ${(text.length / 1048576).toFixed(1)} MB，未整篇读入)`);

if (!fatalHits.length && !fatalCount) {
  console.log('\n未命中任何致命指纹。');
} else {
  console.log('\n-- 致命指纹（按铁律编号 → 该跑的闸门）--');
  for (const h of fatalHits) {
    console.log(`  [${h.rule}] ${h.name}  ×${h.count}`);
    console.log(`       原因: ${h.why}`);
    console.log(`       闸门: node <skills>\\shared\\scripts\\${h.gate}`);
    for (const s of h.samples) console.log(`       L${s.line}: ${s.text}`);
    if (CTX > 0) { /* 需要上下文时用 --context 自行加读，默认不刷屏 */ }
  }
}
if (lastFatal) console.log(`\n最后一条 FATAL（L${lastFatal.line}）: ${lastFatal.text}`);

if (noiseHits.length) {
  console.log('\n-- 非致命提示（**不代表失败**，原版/别的 mod 也常见）--');
  for (const h of noiseHits) console.log(`  ${h.name}  ×${h.count}`);
}

if (verdict !== 'PASS') {
  console.log('\n下一步：按上面的 [R#] 去 <skills>\\workflows\\wf-launch-audit.md §1 查表，');
  console.log('        或直接跑它列的"定位/修复"命令；**不要**整篇打开 starsector.log。');
}
process.exit(verdict === 'PASS' ? 0 : 1);
