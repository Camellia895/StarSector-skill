# 铁律（唯一权威）

> 每一条都出过真实事故。写入任何数据文件 / jar 常量前**必须**核对本文件；
> 各 skill 与 workflow 只引用编号（`铁律 R2`），不重复内容。离线复现与校验工具见
> `<skills>\skills\starsector-engine-diagnose\`。

## R1 · 数据 CSV 引号：字段边界禁弯引号（会**崩溃**）

**引擎事实**：游戏解析 CSV **前**会把弯引号归一化为 ASCII 引号（`SpecStore.?00000`）：
`[\u201c\u201d]+ → "`，`[\u2018\u2019\ufffd]+ → '`（作用于整个文件文本）。

若归一化后的 `"` 落在**字段边界/字段开头**（典型：整格译文用 `“` 包裹对话，`"“text”"` → `""text""`），
CSV 字段被提前闭合 → 该行拆成多行、列错位 → 引擎读 `options`/`script` 缺键 →
启动崩溃 `JSONException: JSONObject["options"] not found`。

**安全写法**：
1. 引号一律写 **ASCII 引号并按 RFC 转义**（成对 `""`）——与引擎归一化结果一致，显示为直引号；或
2. 弯引号只出现在**非引用字段的中段**（字段整体无逗号/换行）；或
3. 需要中文引号观感时用 **`【】`/`《》`**，**不要用 `“”`**，**也不要用 `「」『』`**（见 R3）。

**校验**：`node <skills>\shared\scripts\check_csv_quotes.js <csv>`（弯引号计数 + 归一化后行列数预检）、
权威复现 `TestCsv.java`（行数 = EN 基线、0 缺键）。

## R2 · rules script 列：命令参数内禁引号（**不崩溃**，静默截断）

rules.csv 的 `script` 列是**命令文本**（`AddText "…" textBlueColor`、`SetTooltip <optionId> "…"`）。
解释器把字符串参数读到**第一对 ASCII 引号**为止——参数内再出现 `"`（含被归一化的 `“”`）即提前闭合，
游戏里只显示到第一个内嵌引号为止（事故：整句在 `Tania最` 处戛然而止），**无崩溃、无 ERROR**，极易漏检。

- **Bug A（R1）vs Bug B（R2）**：R1 作用于 CSV **结构层**（崩溃）；R2 作用于解析之后的**命令解释层**（截断）。
  `""` 转义只保护 CSV 结构，**保护不了**命令解释器的引号配对。
- **约束范围**：只针对会被解释器二次解析的 **script 列命令参数**；`text`/`options` 纯显示列不受限（原版本就含引号）。
- 命令参数内要中文强调 → 用 **`【】`**（有字形，也不与命令引号冲突）。
- 合法行恰 2 个引号（`AddText "…"`）；`FireAll x`、`$var = true` 等无引号行不算。

**校验**：`node <skills>\shared\scripts\check_rules_arg_quotes.js <rules.csv>`
→ 三项全 0：`script 列弯引号计数`、`严格结构问题`、`疑似命令参数内嵌引号行`。

## R3 · 字库覆盖：缺字形显示 `?`（无报错）

中文核心把 6 个字体文件替换为含 CJK 的位图字库（`<game>\starsector-core\graphics\fonts\`）：
`insignia15/21/25LTaa.fnt`、`victor10/14/16.fnt`，各约 **6742 字形**（`.fnt` 为 AngelCode 文本格式，
逐行 `char id=<十进制码点>`）；**表外字符渲染为 `?`**，无崩溃、无日志，最易被误判成"翻译没生效"。

- **缺字形**：`「」『』〈〉〔〕`、生僻字（`艏` U+824F 等）、全角空格 U+3000。
- **半/全角"符号类"全缺（2026-09 实测，易踩）**：全角减号 `－` U+FF0D、全角斜杠 `／` U+FF0F、全角加号 `＋` U+FF0B、全角波浪 `～` U+FF5E
  —— 写字面连接符/分数/并列时**一律用 ASCII**（`-` `/` `+` `~`）；而**全角标点有字形**：`：（）！？，` 正常可用。
- **有字形**：`【】`(U+3010/11)、`《》`、`（）`、`—`、`…`、`、。，：；？！`、`·`、弯引号 `“”‘’`。
- **规范**：中文强调优先 **`【】`**（在 rules 命令参数内同样安全）；次选 `《》`/`（）`；**禁用 `「」『』`**；
  生僻字换同义常用字（`舰艏`→`舰首`）；**需要"减号/斜杠"观感时用 ASCII 半角**（原版英文母本就写作 `- only if threat`）。
- **落笔后必跑** `check_font_glyphs.js`（`node <skills>\shared\scripts\check_font_glyphs.js <data目录> [更多文件]`），
  合格标准 = 缺字形字符种类 0 / 总出现 0；**别只在脑子里过一遍**——实测 `－`/`／` 就是这么漏掉的。

**校验**：`node <skills>\shared\scripts\check_font_glyphs.js <data目录> [更多文件/目录] [--fonts=<字体目录>]`
→ 合格标准：缺字形字符种类 0 / 总出现 0。

## R4 · 格式符：字面 `%` 必须写 `%%`

tooltip/描述会经 `String.format` 渲染：单个 `%` 后接汉字或非法字符 →
`UnknownFormatConversionException`（事故：hull_mods 写 `10%时`，改装界面悬停即崩）。

- 字面百分号写 `%%`（渲染为单个 `%`）；`%s`/`%d` 按需保留，**没有对应传参就不要写占位符**。
- `\n` 原样保留；`{%s}` 是旧版风格，新版一律用 `%s`（否则游戏显示字面 `{750}`）。

## R5 · Kotlin 模板 `${}`：后接汉字必须加花括号

`"…$typeString护航"` 会把「护航」并进变量名 → 编译错误 unresolved reference；
必须写 `"…${typeString}护航"`。Java 无此坑。

## R6 · `\u0001` recipe：数量与位置不变

Kotlin 2.x indy 拼接把字面文本与 `\u0001` 占位符合并在**同一个**常量里。
翻译时保留 `\u0001` 的**数量与位置**不变，否则运行时
`BootstrapMethodError: StringConcatException: Mismatched number of concat arguments`。

**校验**：`check_u0001.js`（映射层键/译文数量一致）+ `verify_u0001_jar.js`（补丁后 jar 与原始 jar 数量一致）。

## R7 · 标识符绝不可译（`NoSuchFieldError` 闪退）

类文件里字段/方法/类名同样是 Utf8 常量，且编译器对**相同文本复用同一个 Utf8 条目**
（字段 `x` 与字符串 `"x"` 共享条目）。误改 → `NoSuchFieldError`/`NoSuchMethodError`
（事故：字段 `x` 译成"倍"导致 `TylosShipsystem.apply` 崩溃）。

**强制规则**：只替换「**被 `CONSTANT_String` 引用、且不被任何标识符条目
（`Class`/`NameAndType`/`MethodType`/`Module`/`Package`）引用**」的 Utf8 常量。
`<skills>\shared\scripts\patcher.js` 已按此实现，**不要回退到全量替换**。

**校验**：`verify_identifiers.js` → 全量 class 的 `NameAndType` 名称与 `Class` 名称**不得含 CJK**，0 异常。

## R8 · 伪 JSON：禁严格解析器判死刑

Starsector 的 JSON 带 `#` 注释（整行或行内）、尾随逗号 `,}`/`,]`、裸键、`;` 结尾、`025`、`.0f`、`.5`、
`[STATIONS]` 之类 —— 游戏自己的 `org.json` 全部接受。

- **禁用** `JSON.parse` / `ConvertFrom-Json` 给游戏数据判死刑（会误报一大批"假 bug"）。
- **严禁** `ConvertTo-Json` 回写（破坏原格式；输入为 null 时可能写出完全无关的内容——真实事故：`settings.json` 被写成 `channels.json` 的内容）。
- 一律**文本替换**式改写（`migrate_json.js` 的 `replaceOnce(path, 原片段, 译文片段)`），保持注释与缩进原样。
- 解析一律用 `<skills>\shared\scripts\pseudojson.js`（`parseJsonLoose`）；权威验证用 `JsonProbe.java`（游戏 `json.jar`）。

## R9 · zip / jar 条目名必须正斜杠

.NET `CreateFromDirectory` 在 Windows 写**反斜杠**，Java 不认（mod 直接失效）。
重打包用 `<skills>\shared\scripts\rezip.js`；保留 `META-INF/`。

## R10 · 术语与专名一致性

同一概念跨层必须同词：势力显示名（`.faction` 的 4 个 `displayName` 键同填一个中文）须与
`weapon_data.csv` 的 `tech/manufacturer`、rules/任务文本一致；`ship_roles.csv` 类名列必须与
对应 `.ship` 的 `hullName` 译文一致；`settings.json` 的 `designTypeColors` **键**须译为与 CSV
`tech/manufacturer` 中文值**精确一致**且**键唯一**（事故：`Abyss`/`Abyssal` 都译"深渊" →
`Duplicate key "深渊"` fatal）。术语表见 `<skills>\shared\glossary.md`。

## R11 · 随机舰名/加权词表：重复词是设计

`ship_names.json` 内**重复词是加权设计**，同词同译、按出现次序逐条回填，不要去重。
