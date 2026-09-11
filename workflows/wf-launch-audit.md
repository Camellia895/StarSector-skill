# wf-launch-audit · 汉化后"启动崩溃 / 首屏异常"排查

> **任务分类 ④**（`wf-localize` 的后置救火流程，也用于验收别人的汉化产物）。
> 触发词："游戏启动就崩"、"Fatal: null"、"进不去游戏"、"报错了看看日志"。
> 需要读：`shared\env.md`（§3 日志是 GBK、§4 环境毒点）、`shared\iron-rules.md`（R12/R13/R15）、
> `skills\starsector-engine-diagnose\SKILL.md`（需要引擎级复现时）。

## 0. 铁则：先定位**是哪个 mod、哪一行**，再看别的

**不要**通读日志（40MB 起步）。按下面顺序定向切：

```powershell
# ① 先看有没有 Fatal / ExceptionInInitializerError（汉化崩多半在"资源加载期"）
Select-String -Path starsector-core\starsector.log -Pattern 'FATAL|ExceptionInInitializerError|Caused by' -Encoding Default

# ② 抓最内层的 Caused by 与其下第一行 `at data.scripts...` —— 那就是本 mod 的入口
#    例：Caused by: java.lang.NullPointerException: ... LunaSettings.getBoolean(...) is null
#        at data.scripts.campaign.plugins.NA_SettingsListener.<clinit>
```

> **日志编码**：`starsector.log` 是 **GBK/ANSI**，必须 `-Encoding Default` 才不乱码（`env.md` §3）。
> 中文命中（如 `Could not find mod 夜十字`）只有用 Default 读才看得见——**英文仍可读，中文会乱**，
> 所以别用 `-Encoding UTF8` 下结论说"没有中文"。
>
> 会话切分与 ERROR 聚合可用 `<skills>\shared\scripts\find_crash.js`（多会话大日志）。

## 1. 按"最内层异常"查表

| 日志特征 | 判定 | 处置 |
|---|---|---|
| `Could not find mod <中文名>` + `getBoolean(...) is null` + `ExceptionInInitializerError` | **R12 逻辑键误译**（mod id 被当显示文本译了） | 见 §2 |
| `NumberFormatException: For input string: "<选项id>"` + `at ...campaign.rules.Rules.o00000` | **R13 options 结构损坏** | 见 §3 |
| 一行变两行 / `options` 里 `id:id:标签` | R13 **或 R15**（对已汉化目录二次注入） | 见 §3 + `check_install_source.js` |
| `Duplicate key "<中文>"` | R10 `designTypeColors` 键译重了 | `verify_all_data.js` → 合并同义键 |
| **无任何报错**，但界面某处照旧显示英文（典型：舰船图鉴的**分类/制造商**名还是英文原文） | **R10 补充：`designTypeColors` 未注册** —— 引擎查不到不报错，**把该值原样当分类名显示**（静默降级） | `check_designtype.js <modRoot> <core>`；**务必同时查 CSV 与 `.skin`/`.ship` 的 `tech`**（只改 CSV 会漏第二处） |
| `UnknownFormatConversionException` | R4 字面 `%` 未写 `%%` | 修该 tooltip 字段 |
| `BootstrapMethodError: StringConcatException` | R6 `\u0001` 数量被改 | `check_u0001.js` |
| `JSONObject["options"] not found` | R1 弯引号拆列 | `check_csv_quotes.js` |
| `NoSuchFieldError`/`NoSuchMethodError`（消息乱码） | R7 标识符被改 | `verify_identifiers.js` |
| 文本在引号处截断（无报错） | R2 rules 参数内嵌引号 | `check_rules_arg_quotes.js` |
| 个别字显示 `?` | R3 缺字形 | `check_font_glyphs.js` |

## 2. R12（逻辑键误译）的定位与修复

**定位**：

```powershell
# 目标 mod 的补丁映射 + 英文原版解包目录 + 保留键名单（mod id、引擎常量、spec id…）
node <skills>\shared\scripts\scan_logic_keys.js <patch_map.json> <原classDir> <modId> [其它保留键...]
```

- **A 类**（保留键被译）→ 必错，照单修。
- **B 类**（键查找上下文里"像 id"的常量被译）→ 逐个看源码调用点：是 `getBoolean/getModSpec/
  isModEnabled/addSettingsListener` 的实参就保留原文；是 `addPara/setName` 的显示文本就翻译正确。

**修复**：在**待译清单**里把这些条目的 `zh` 改成**与原文逐字相同**（约定 = 「有意保留原文」），
注入脚本会自动跳过；然后重新打补丁 + 重装。

**顺带必须查**：`getMergedSpreadsheetDataForMod("id", CSV, "<modId>")` 这类调用拿错 modID
**不抛异常**，只静默返回空数组 → 表现为"白名单/配置没生效"。所以同类键要一起排查，别只修崩的那一个。

## 3. R13 / R15（options 结构 / 二次注入）的定位与修复

```powershell
node <skills>\shared\scripts\check_options_structure.js <modRoot> <enBackupRoot>
# 需要在确认"该 id 全项目无引用"后接受改写时：
node <skills>\shared\scripts\check_options_structure.js <modRoot> <enBackupRoot> --renamed=FROM:TO
```

修复要点（**以英文结构为基准重建，不要手工拼**）：

1. 从**英文原版**取该行的 `options`，按真实换行切段，得到 `optionId` 序列与长式外层编号；
2. 从译文里按 `optionId` **回收中文标签**（译文可能写成 `id:标签` 或 `id:id:标签`）；
3. 逐段输出 `optionId:标签`（长式补回 `数字:` 前缀）；**行数/optionId 不符就报错保留原文**；
4. 多行之间用**真实换行**（不是字面 `\n`），由写入器按 RFC4180 加引号。

若是 **R15**（二次注入）导致，先恢复英文原版再重注入，并**加上前置断言**：

```powershell
node <skills>\shared\scripts\check_install_source.js <modRoot> <EN原版备份目录>
```

## 4. 修完必须重跑这一组（缺一层都可能是"修了又崩"）

```powershell
# 结构类
node <skills>\shared\scripts\check_options_structure.js <modRoot> <enBackupRoot>
node <skills>\shared\scripts\scan_logic_keys.js <patch_map.json> <原classDir> <保留键...>
node <skills>\shared\scripts\scan_data_stragglers.js <modRoot> <enBackupRoot> <worklistDir>
# 字节/内容类
node <skills>\shared\scripts\check_encoding.js <modRoot>\data
node <skills>\shared\scripts\check_csv_quotes.js <每个 csv>
node <skills>\shared\scripts\check_rules_arg_quotes.js <modRoot>\data\campaign\rules.csv
node <skills>\shared\scripts\check_font_glyphs.js <modRoot>\data
node <skills>\shared\scripts\verify_all_data.js <modRoot>\data
# jar 类（动过 jar 时）
node <skills>\shared\scripts\verify_identifiers.js <classDir>
node <skills>\shared\scripts\check_u0001.js <patch_map.json>
node <skills>\shared\scripts\verify_u0001_jar.js <原jar> <补丁jar>
```

**引擎级复现（判定"这个文件到底会不会让引擎崩"）**：

```powershell
# 复刻：读 UTF-8 → 归一化弯引号 → 引擎 com.fs.starfarer.loading.G.o00000 解析
javac --release 17 -cp "<core>\starfarer_obf.jar;<core>\starfarer.api.jar;<core>\json.jar" -d <out> TestCsv.java
java -noverify -Dcom.fs.starfarer.settings.paths.logs=<tmp> -cp "<jars>;<out>" TestCsv <file.csv>
# 判据：行数与"缺键数"必须与英文基线**完全相同**
```

> 想**看解析后的字段值**（而不是只听行数），写一个打印 `keys()` 的小探针即可——
> 本项目实测过它能把"引号被吞掉"这类问题变成可见证据（正常 12 个引号 vs 被吞到 1 个）。

## 5. 交回用户时

1. 说清**根因**（哪条铁律、哪个字段、为什么会这样）；
2. 给出**证据**（日志的 2 行 + 校验命令的通过输出）；
3. 说清**防复发**（新增了哪道闸门、下次在哪一步就会拦住）；
4. 提醒**用户亲测的路径**（模组列表 / 改装 tooltip / 图鉴 / 情报对话 / 战斗 HUD）。

## 6. 复盘纪律

每次崩完，问一句：**"这类错误，我原来的闸门为什么没拦住？"**

- 若是"闸门盲区"（如 R12/R13：列数检查看不出结构坏、R7 管不到字符串键）→ **补一道新闸门**并登记
  `shared\script-registry.md` D 节 + `shared\verification-ledger.md`；
- 若是"工具自身 bug"（如引号检查误报、修复脚本把中文覆盖成英文）→ 修工具 + 在脚本头部注释里写清
  **事故形态**，避免下一个人再踩；
- 别把结论只留在项目的 `_work\mod_work\<Mod>\` 里——**会随项目一起被遗忘**，要进 skill 库。
