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

**两类弯引号后果不同，别一刀切（2026-09 修正一处过严的判据）**：

| 字符 | 归一化为 | 是否破坏 CSV 结构 |
|---|---|---|
| `\u201c` `\u201d`（弯**双**引号） | `"` | **会** —— 落在字段边界/字段开头即提前闭合字段 → 拆列 |
| `\u2018` `\u2019`（弯**单**引号） | `'` | **不会** —— 解析器不把 `'` 当引号，任何位置都安全 |

实测证据（`CsvProbe`）：把一段对话里的弯双引号**原样**写在单元格中（不加 CSV 引号包裹）时，
归一化出的 `"` 落进裸字段，解析器按"空引用字段 + 游离引号"处理 →
**4 个引号只剩 1 个，首句引号被静默吞掉**；改为"ASCII 引号 + RFC4180 包裹/转义（`""`）"后
**12 个引号全部保住**。因此：**写回前把弯引号归一化成 ASCII 引号、并让写入器按 RFC4180 包裹转义**
是最稳的做法（与引擎归一化结果一致）。单引号可原样保留，不必报错。

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

**R10 补充：`designTypeColors` 是"注册表"，查不到不报错、而是把原值当分类名显示。**
任何进入"舰船设计类型/制造商"字段的值都必须**逐字命中** `settings.json` 的 `designTypeColors` 键集合。
该字段出现在**两处**（R14 的漏译重灾区）：

| 出现位置 | 字段 | 说明 |
|---|---|---|
| `data/hulls/ship_data.csv` | `tech`、`manufacturer` | 图鉴列表与详情页的"分类/制造商" |
| `data/hulls/skins/*.skin`、`data/hulls/*.ship` | `tech` | **只改 CSV 不改这里 → 界面仍显示英文**（事故：卡塞峡谷 (E) 分类显示英文 `Nightcross`） |

**两种失效模式，方向相反，都必须防**：

- 把注册**键**译了 → 查不到 → 原值（中文）被当分类名显示 → 键与 CSV 值不再匹配。
- 把值译成**未注册**的中文（如键是「夜十字军械」而值是「夜十字」）→ 同样查不到 → **英文原值被原样显示**。
  这类**静默降级**不报错、不打日志，只看代码永远发现不了；症状就是"分类名还是英文"。

因此 `tech`/`manufacturer` 的值应当是"各设计类型的规范名"，全 mod 必须**同族同词**。
`.skin`/`.ship` 里值等于已注册键集合中某个键时，属**保留项**：`zh` 写死等于 `en`
（例如 `TWINDRILL`），**不要留空**——留空是"待译"语义，会让 `preflight` 报 `[空译文]`。
闸门：`check_designtype.js`（见 `script-registry.md` D 节）。

## R11 · 随机舰名/加权词表：重复词是设计

`ship_names.json` 内**重复词是加权设计**，同词同译、按出现次序逐条回填，不要去重。

## R12 · 逻辑键绝不译：显示文本与查找键在常量池里**字面相同**（会**启动 Fatal**）

**引擎事实**：同一个字面量常同时充当"显示文本"与"查找键"，**无法按字面区分**：

```java
LunaSettings.getBoolean("Nightcross", "na_pascal_system")                      // ← modID 键
Global.getSettings().getMergedSpreadsheetDataForMod("id", CSV, "Nightcross")   // ← modID 键
system.addPlanet("nightcross", pascal, "Nightcross", "na_nightcross", …)       // ← 显示名
sector.createStarSystem("Pascal")                                              // ← 星系内部名
```

把查找键当显示文本翻译 → 查找失败。实测事故：`"Nightcross"` 被译成 `"夜十字"` 后

```
ERROR lunalib.lunaSettings.LunaSettings - LunaSettings: Could not find mod 夜十字
java.lang.NullPointerException: … LunaSettings.getBoolean(String, String) is null
  at data.scripts.campaign.plugins.NA_SettingsListener.<clinit>   ← 静态初始化 booleanValue()
→ ExceptionInInitializerError at NAModPlugin.onApplicationLoad → 启动 Fatal
```

**强制约束**：

1. **保留键名单**：mod id、引擎常量、spec id、星系内部名（与 `corvus_capitals.csv` 等白名单表一致的那些）
   在清单里记为「有意保留原文」（`zh === c`），注入脚本自动跳过。
2. 判断某常量该不该译，**必须看调用点**：出现在 `getBoolean/getString/getModSpec/isModEnabled/
   addSettingsListener/loadCSV/getMergedSpreadsheetDataForMod/getStarSystem/addCustomEntity/hasTag`
   等**查找类 API 的实参**位置 → 绝不译；出现在 `addPara/setText/setName` 等显示位置 → 译。
3. **R7 保护不了它**：R7 只保护**标识符**（`NameAndType`/`Class`）；这类键是被 `CONSTANT_String`
   引用的**普通字符串**，安全替换照样会改它们。

**校验**：`node <skills>\shared\scripts\scan_logic_keys.js <patch_map.json> <原classDir> <保留键...>`
（A 类 = 保留键被译 → 必错；B 类 = 键查找上下文里"像 id"的常量被译 → 待人工确认）。

> 实测提醒：**首次启动就崩**时，先在日志里搜 `Could not find mod`——若 mod 名是中文，基本就是本条。
> 另：`getMergedSpreadsheetDataForMod` 拿错 modID **不抛异常**，只静默返回空数组（表现为"白名单没生效"），
> 比崩溃更难发现。

## R13 · 合成字段（rules.csv 的 `options`）结构必须与英文原版等价（会**启动崩溃**）

**引擎事实**：`options` 不是纯显示文本，而是**合成结构**——每行 `optionId:标签`，或长式 `数字:optionId:标签`。
引擎解析时对首段做数值/ID 处理（实测 `Rules.o00000` 执行 `Float.parseFloat(首段)`）。

**事故形态**（汉化极易犯）：

- 把「整格」或「整行」当成一个标签替换 → **optionId 被挤掉**（长式变成 `0:标签`）
- 译名里把 optionId 又抄了一遍 → `ncamcb_start:ncamcb_start:询问绝密悬赏。`（一行变两段语义）

→ 引擎拿 `"ncamcb_start"` 去 `Float.parseFloat` → `NumberFormatException` → **启动崩溃**。

**另两个格式事实**：

- 多行 options 用**真实换行**分隔，不是字面 `\n`；写成字面 `\n` 则单元格不含 `, "` 换行 →
  不被引号包裹 → 游戏内显示字面 `\n` 且选项解析错乱。
- 单元格含换行 → 必须按 RFC4180 用引号包裹（见 R1）。

**安全做法**：以**英文结构为基准**逐行重建、只替换标签；行数或 optionId 不符时**报错并保留原文**，绝不猜。
要改写 optionId 必须先确认全项目无引用（不是 `FireBest` 目标、不参与 `conditions`）。

**校验**：`node <skills>\shared\scripts\check_options_structure.js <modRoot> <enBackupRoot> [--renamed=FROM:TO]`
（**列数=header、引号数=0 这类常规检查完全看不出本问题**，必须单独跑。）

## R14 · 提取完整性：recipe 只能覆盖"你想到的列"（漏译的头号来源）

玩家可见文本分散在**远多于直觉**的位置。实测一个中等体量 mod 的遗漏点：

| 位置 | 字段 | 表现 |
|---|---|---|
| `.skin` / `.ship` | `descriptionPrefix` | 图鉴描述前缀（引擎按 `prefix + "\n\n" + descriptions.csv 正文` 渲染 → "英文前缀 + 中文正文"混排） |
| `weapon_data.csv` | `customPrimary`/`customPrimaryHL`/`customAncillary`/`customAncillaryHL`/`primaryRoleStr`/`speedStr`/`trackingStr`/`accuracyStr` | 武器 tooltip 的**覆写文案**（会替换默认文案） |
| `.skin` | `hullDesignation` | 人可读短语（`Light Cruiser`）直接显示需译；ENUM（`frigate`）由引擎本地化 → 不译 |
| `industries.csv` | `data` 列**内嵌** `fleetName:…` | 列名看似逻辑列，整列被跳过 |
| `config/exerelin/mercConfig.json` | `name` / `desc` | Nexerelin 佣兵团名与简介 |

**强制做法**：提取阶段**必须**用"枚举 → 判覆盖"的反向网，而不是只写 recipe：

```powershell
# 提取阶段（拿英文原版当 mod）＋ 交付前（拿注入后目录）：两者都必须 0 候选
node <skills>\shared\scripts\scan_data_stragglers.js <modRoot> <EN原版目录> <worklistDir>
```

发现候选 → 补提取 → 重跑；**不要**靠"目检文件"。

> 另一类盲区：**同名字段在不同文件里语义不同**。`hullName` 与 `ship_data.csv#name` 都要译且要一致；
> 而 `id`/`tech`/`skinHullId` 绝不译。判据是"引擎读它做什么"，不是"它像不像名字"。

## R15 · 注入前必须断言目标目录是**英文原版**（否则合成字段被追加 → 启动崩溃）

**事故**：对**已经汉化**的 mod 目录再跑一次注入。替换按"英文原值 → 译文"匹配，全部失配；
而 `options` 之类**合成字段**在失配时会保留"原文"（其实是上一次的中文），于是被追加成
「英文行 + 中文行」→ 一行变两行、optionId 重复 → 与 R13 同一条崩溃路径。
`.ship`/`.variant`/`.json` 的替换则静默失败（打印一堆"未命中"，容易被当成无害）。

**强制做法**：写盘前跑断言，**不通过就拒绝注入**并从英文原版恢复：

```powershell
node <skills>\shared\scripts\check_install_source.js <modRoot> <EN原版备份目录>
```

**校验**：`check_install_source.js`（自动从英文备份里挑"最长英文文本列"作探针）。

---

## R16 · 设计类型名有**三个通道**，recipe 只覆盖一个（**静默不上色/显示原值**）

**事故（San-Iris 1.1.0 汉化）**：`tech/manufacturer` 只在 `hull_mods.csv` / `special_items.csv` 被 recipe 提取并译成
「圣艾瑞斯联邦」，而**同一个设计类型名还从另外两处进入引擎**，两处都没进任何清单：

| 通道 | 位置 | 谁覆盖 |
|---|---|---|
| ① 注册表**键** | `data/config/settings.json` 的 `designTypeColors` **键** | ❌ 不是任何 CSV 列 ⇒ 任何 recipe 都抓不到 |
| ② 舰船行 | `data/hulls/ship_data.csv` 的 `tech/manufacturer`（本次 40 行） | ❌ 需要显式写进 recipe |
| ③ 武器行 | `data/weapons/weapon_data.csv` 的 `tech/manufacturer`（本次 36 行） | ❌ 同上 |

结果：键还是英文 `"San-Iris"`、值是中文「圣艾瑞斯联邦」⇒ 引擎**查不到注册项**，
**不报错、不打日志**，直接把值当分类名显示**且不上色**（R10 的静默降级）。
`check_designtype.js` 抓到了它 —— 这就是该闸门存在的理由。

**强制做法**：

1. 提取阶段**必须**用 `check_designtype.js` 反查，而不是"我觉得 recipe 覆盖了"：
   ```powershell
   node <skills>\shared\scripts\check_designtype.js <modRoot>
   ```
   **合格标准 = 0 问题**（键集合与全部 `tech/manufacturer` 取值精确匹配）。
2. 设计类型名有 N 处出现就译 N 处，且**键与值必须逐字一致**；`settings.json` 的键用
   **文本替换**改写（R8），不要序列化回写。
3. 把"改设计类型名"做成注入器的**收尾一遍**（扫描 `settings.json` 键 + 两张 CSV 的
   `tech/manufacturer` 全列），而不是靠人记得补 —— San-Iris 会话里这一步被漏过一次。

> 另一条通道：`.skin`/`.ship` 的 `tech` 字段（本 mod 无 `.skin`，故 0 处）。
> 删除/改名设计类型时键**必须唯一**（重复键 = 启动 fatal）。

**校验**：`check_designtype.js`（0 问题）+ `verify_all_data.js`。

## R17 · 数据层注入：**保持每个文件自己的行尾风格**（别硬编码 CRLF）

**事故（San-Iris 1.1.0 汉化）**：注入器整文件重写 CSV 时硬编码 `\r\n`，而**该 mod 的 data 文件全部是 LF-only**
（与**原版核心 CRLF 相反**）。结果 10 个 CSV 被改成 CRLF，`rules.csv` 更因多行引号单元格变成**混合行尾**
（单元格内 LF + 物理行 CRLF）。
`cmp_csv_struct` 当时**没报警**（它按解析结果比对，行尾被吞掉），是"与英文基线逐字节分类行尾"的
专项审计才发现的 —— 说明"结构一致"不等于"字节风格一致"。

**规范**：

- 写回前**读原文件判断**：`const EOL = text.includes('\r\n') ? '\r\n' : '\n'`；**连带保留"文件是否以换行结尾"**
  （否则每次注入都会多出一个尾行）。
- **不要**照抄 `env.md` 的"写回 CSV 保持原 CRLF"当成无条件规则 —— 那句话的前提是**上游文件本身就是 CRLF**。
  正确表述：**保持原文件风格**（原版核心与多数 mod 是 CRLF；个别 mod 全 LF）。
- 审计手段：逐文件比较 `crlf 数 / 单独 LF 数 / 是否以换行结尾`，与英文基线**必须全等**
  （`_work\mod_work\SanIris\tools\check_eol.js`）。

**校验**：行尾审计脚本（0 变更）+ `cmp_csv_struct.js`。

## R18 · 注入器的"格内子串替换"：needle 只能是**引号内的正文**

**事故（San-Iris 1.1.0 汉化）**：`rules.csv` 的 `script` 列形如 `AddText "正文" marketFlavorTextColor`。
注入器把 needle 取成了 `AddText "正文`（**带上了命令关键字与开引号**），替换后整格变成
`"译文" marketFlavorTextColor` —— **`AddText` 关键字被吃掉**，命令失效。
两轮修正才定位（第一轮误判成"译者漏抄 AddText"，实际是注入器自己吞掉的）。

**规范**：

1. needle **必须只是引号之间的正文**：从 `m[1]` 里用 `/^[\s\S]*?AddText\s+"/` 剥掉前缀，
   先用 `stripped.includes(innerEn)` 断言能命中，再替换。
2. 替换后**必须反向断言关键字仍在**：`if (!replaced.includes('AddText')) → 报错退出`。
   这类"静默吃掉命令"不会抛异常，只会让游戏里少一段文本。
3. 命令参数**禁引号**（R2）：译文里出现 `"` 直接拒绝写盘。
4. 收尾跑 `check_rules_arg_quotes.js`，**判据是"奇数引号行 = 0"**（不是只看"弯引号 = 0"——
   本次弯引号一直是 0，问题出在 ASCII 引号被吃）。

