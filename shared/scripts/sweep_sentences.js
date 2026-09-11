// sweep_sentences.js — 句子级漏译复查：专治"注释夹折叠"漏译与"弯引号键不匹配"。
// 用法:
//   node sweep_sentences.js <jarConstants.json> <translations.json> [outJson] [--out-all]
//     <jarConstants.json>  extract_jar_constants.js 或 analyze_jar_strings.js 的产物
//                          （两者都是 { 常量: classes | {classes,...} } 形态，兼容）
//     <translations.json>  EN→ZH 映射（{ "原文": "译文" }）；在 translations.json 里的键视为"已处理"
//     [outJson]            默认 <jarConstants.json 所在目录>/sweep_sentences.json；传 "-" 表示不写文件
//   node sweep_sentences.js --help
// 退出码: 0 = 无待处理候选；1 = 有候选（便于 run_check.js 记账）
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
  console.log('usage: node sweep_sentences.js <jarConstants.json> <translations.json> [outJson|-]');
  process.exit(argv.length ? 0 : 2);
}
const pos = argv.filter(a => !a.startsWith('--'));
const [jcFile, tcFile] = pos;
if (!jcFile || !tcFile) { console.error('缺少参数：见 --help'); process.exit(2); }
if (!fs.existsSync(jcFile)) { console.error('jarConstants 不存在: ' + jcFile); process.exit(2); }
if (!fs.existsSync(tcFile)) { console.error('translations 不存在: ' + tcFile); process.exit(2); }
const outArg = pos[2] === undefined ? path.join(path.dirname(path.resolve(jcFile)), 'sweep_sentences.json') : pos[2];
const outFile = outArg === '-' ? null : outArg;

const jcRaw = JSON.parse(fs.readFileSync(jcFile, 'utf8'));
// 兼容 analyze_jar_strings.js 的富形态 { classes, strRefs, asString, asId } 与 extract 的窄形态 [classes]
const classesOf = v => Array.isArray(v) ? v : (v && Array.isArray(v.classes) ? v.classes : []);
const jc = {};
for (const [k, v] of Object.entries(jcRaw)) jc[k] = classesOf(v);
const tc = JSON.parse(fs.readFileSync(tcFile, 'utf8'));

// 排除项：编译器产物/标识符/路径/本工程专有前缀。通用项在前，工程专有项可自行增删。
const EX = [
  /^\(\)/, /^\(\[/, /^\[\(/,
  /^Ljava\//, /^Lkotlin\//, /^Lorg\//, /^Lcom\//, /^Lme\//,
  /^SMAP/, /^SourceFile$/, /^SourceDebugExtension$/, /^BootstrapMethods$/, /^LineNumberTable$/, /^LocalVariableTable$/, /^StackMapTable$/,
  /^ConstantValue$/, /^NestHost$/, /^NestMembers$/, /^InnerClasses$/, /^EnclosingMethod$/, /^MethodParameters$/, /^AnnotationDefault$/,
  /^RuntimeVisible/, /^RuntimeInvisible/, /^Signature$/, /^Code$/, /^Exceptions$/, /^Deprecated$/, /^Synthetic$/, /^Bridge$/, /^Varargs$/,
  /^set[A-Z]/, /^get[A-Z]/, /^load[A-Z]/, /^pick[A-Z]/, /^spawn[A-Z]/, /^should[A-Z]/, /^show[A-Z]/, /^on[A-Z]/, /^update[A-Z]/,
  /^trigger[A-Z]/, /^transfer[A-Z]/, /^populate[A-Z]/, /^notify[A-Z]/, /^add[A-Z]/, /^remove[A-Z]/, /^play[A-Z]/, /^create[A-Z]/, /^init[A-Z]/,
  /^apply[A-Z]/, /^is[A-Z]/, /^has[A-Z]/, /^make[A-Z]/, /^start[A-Z]/, /^stop[A-Z]/, /^toggle[A-Z]/, /^sync[A-Z]/, /^un[A-Z]/,
  /^[a-z][a-zA-Z0-9_]*$/, /^[A-Z][A-Z0-9_]{2,}$/,
  /^graphics\//, /^data\//, /^sounds\//, /\.(png|jpg|json|csv|fnt|ttf|ogg|class|java|kt|ini)$/,
  /null cannot be cast/, /@NotNull parameter/, /Super calls with default arguments/,
  /^(Adding|Generating|Setting|Picked|Found|Finished|Skipping|Looking for|Adding %d|Adding up|  )/, /^  [A-Z]/, /^    /,
  /\([a-zA-Z_]+=/, /^_PROJ$/,
  /^(tex|texX|texY|arc|fx|dem|emp|map|get|set|ui|x|y|id|svc|gen|mod|iso|raw)$/,
  /^(this|val|value|textPanel)\$/, /^kotlin\//, /^org\//, /^com\//,
  /^[a-z0-9_]+$/, /^[a-z]+\d+$/, /_glow(_\d)?(\.png)?$/, /_normal$/, /_map$/, /_storm/, /_fragment$/, /_external$/, /_deep$/, /_icon$/, /_market$/, /_Hull$/, /_sil\.png$/, /_refined\.png$/,
];

const out = [];
for (const k of Object.keys(jc)) {
  if (k in tc) continue;
  if (/[\u4e00-\u9fff]/.test(k)) continue;
  if (!/[A-Za-z]{4,}/.test(k)) continue;
  if (/[\u0000\u0002-\u0008\u000b\u000c\u000e-\u001f]/.test(k)) continue;   // binary garbage (keep \t \n \r and \u0001 recipe)
  if (k.length < 14) continue;                      // sentence-like
  if (!/\s/.test(k) && !/^["“]/.test(k)) continue;  // must contain a space or be a quote
  if (EX.some(re => re.test(k))) continue;
  out.push({ c: k, classes: (jc[k] || []).slice(0, 2) });
}
out.sort((a, b) => a.c.localeCompare(b.c));
if (outFile) {
  fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(out, null, 1), 'utf8');
}
console.log('jarConstants:', jcFile, '| translations:', tcFile);
console.log('sentence-like un-translated candidates:', out.length);
for (const e of out) console.log(JSON.stringify(e.c).slice(0, 150));
if (outFile) console.log('->', outFile);
process.exit(out.length ? 1 : 0);
