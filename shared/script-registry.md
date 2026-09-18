# 脚本登记表（唯一权威）

> 所有共享脚本位于 `<skills>\shared\scripts\`（`<skills>` = `C:\game\StarSector.v0.9.8a-RC8\_work\skills`）。
> **新增脚本前先查本表**：已有能力就引用，不要再写一份。
> 全部脚本**只读 + 打印**；改文件请人工确认后再动手（例外：`patcher.js`/`patchdir.js`/`rezip.js`/`migrate_*.js`/`translate_missions.js`/`fix_uitags_zh.js` 是写操作，用法中已注明）。
> 只支持 Node v24 与游戏 JRE / JBR 17，见 `env.md`。
>
> **校验类脚本另带两个属性**（机制见 `verification-ledger.md`）：
> `severity`（red/yellow/green = 违反后果等级）× `tier`（base/cond/sample/dormant = 加载策略）。
> **跑校验请用 `run_check.js` 包装以自动记账**，别直接 `node xxx.js`，否则账本收不到票。
>
> **CLI 统一约定**（2026-09 修复：此前有 13 个脚本把路径硬编码到 `mods\_rat_work\` / `mods\_jarcheck` /
> `mods\Templars[-old]\` / `mods\Random-Assortment-of-Things\`，换 mod 即 ENOENT 或**静默查错对象**）：
> - 输入路径一律走 `process.argv`；**不再有任何工程专有默认值**（`verify_all_data.js` 现在必须显式给 data 目录）。
> - 输出路径参数可选：省略时写到"输入同级目录"（**别落在 mod 目录里**，见 `conventions.md` §1）；
>   传 `-` 表示只打印不写文件（`sweep_sentences.js` / `check_u0001.js` / `scan_stragglers.js`）。
> - 所有脚本支持 `--help`（打印用法，exit 0）；无参数时打印用法并 exit 2。
> - 有候选/有问题的脚本**用退出码表意**（0 = 干净，1 = 有命中），便于 `run_check.js` 记账。
> - **写操作脚本**（`patchdir`/`migrate_*`/`translate_missions`）都支持 `--dry`（只报告不写盘）；
>   其中 `migrate_json.js` 需要 `<plan.json>`（替换对**外置**，不再写死在脚本里）。

## A. 摸底 · 提取 · 清单生成

| 脚本 | 用途 | 用法 |
|---|---|---|
| `analyze_jar_strings.js` | 解包 jar 常量池分析，给出**补丁安全分类**（`asString` = 被 `CONSTANT_String` 引用 ⇒ 真实字面量候选；`asId` = 被标识符条目引用 ⇒ 禁改） | `node analyze_jar_strings.js <jarDir> <jar_constants.json>` |
| `extract_jar_constants.js` | 提取 jar 内全部 Utf8 常量（去重）→ `{ "常量": ["相对/类.class", ...] }` | `node extract_jar_constants.js <jarDir> [outJson]`（默认 `<jarDir>/../jar_constants.json`） |
| `scan_jar_sources.js` | jar 常量 ↔ 源码字面量对齐，产出**带上下文**的候选（含 Java/Kotlin、编译期折叠、注释夹折叠、`${}` 片段） | `node scan_jar_sources.js <srcDir> <jar_constants.json> <candidates.json>` |
| `scan_jar_cjk.js` | ★**旧汉化 jar 复用面取证 / 新 jar 硬编码残留取证**（汉化迁移第 0 步）：过滤出「被 `CONSTANT_String` 引用且含 CJK」的真实字面量 = **真被译过的串**（不是常量总数）。旧 jar 用来看"到底有多少旧译可复用"；新 jar 用来证明「**CJK=0 ⇒ 文案已外置、本次不需要常量池补丁**」（写进交付说明）。附单类模式（`--class=` 列出一个类的全部常量并标 `[str]/[id]`）与 `--grep=` 速查。2026-09-17 RetroLib 实证：旧 **21** 条 / 新 **0** 条 | `node scan_jar_cjk.js <解包class目录> [--class=<rel>] [--grep=<子串>] [--json=<out>]`（**有 CJK 字面量则 exit 1**，可直接喂 `run_check.js`） |
| `build_worklist2.js` | 由 jar 常量 + 源码字面量生成工作清单（**旧版 dormant**；注释夹折叠处理不如 `scan_jar_sources.js`，新任务别用） | `node build_worklist2.js <srcDir> <jarConstants.json> [outJson]` |
| `build_jar_worklist.js` | 汇总 LLM/人工分类结果 → `translate` 清单 + `skip` 审计（校验键存在且唯一） | `node build_jar_worklist.js <candidates.json> <outTranslate.json> <outAudit.json> <classify1.json> [...]` |
| `build_data_worklist.js` | **data 层 recipe 化待译清单**（核心工具）：CSV/伪 JSON/纯文本按 recipe 抽可见文本，输出统一 schema | `node build_data_worklist.js <modRoot> <recipe.json> <outDir>`；kind 文档见脚本头部（`csv`/`hullNames`/`variantDisplayNames`/`rulesCsv`/`lunaSettings`/`tips`/`shipNames`/`jsonObjects`/`jsonScalars`/`factionFile`/`jsonDirObjects`/`missionDir`/`wholeText`） |
| `scan_data_stragglers.js` | ★**data 层"字段级"残留扫描**（recipe 的反向网）：先把数据文件里**所有**人可读英文枚举出来，再判其是否被清单覆盖；未覆盖的即"提取遗漏候选"。**专治 recipe 只覆盖"你想到的列"这一盲区**。**已知盲区（2026-09-16 Kayse 实测）：不扫 JSON 数组内的短语**（exerelinFactionConfig 的 vengeanceFleetNames/NamesSingle 整组漏网）⇒ 交付前对 exerelin/faction/settings 类配置补一条 `"[A-Z][a-z]+ [A-Za-z]+"` 专项 grep 复查 | `node scan_data_stragglers.js <modRoot> <enBackupRoot> <worklistDir> [outJson\|-]` |
| `extract_java_strings.js` | **Janino 源码 mod 的 .java 字符串字面量提取**（无 jars、`data/plugins|scripts/*.java` 运行时编译的 mod）：词法状态机抓全部 `"..."` 字面量（跳过注释、保留原始转义），附所在行语句上下文与 EOL 风格 | `node extract_java_strings.js <modRoot> <outJson>`（用后必跑 `check_java_residue.js` 复核，见 D 节） |
| `fix_csv_eol.js` | **混合行尾 CSV 的字节级注入修复**：从基线恢复原字节后，按 worklist (id,field) 用 span 精确替换单元格；单元格内换行沿用原风格（2026-09-16 Vayra 新增；`inject_data` 整体重建会把 mixed-EOL 文件统一成 CRLF，R17 红灯后用它修复） | `node fix_csv_eol.js <modRoot> <enBackupRoot> <worklistDir> <file...>` |
| `extract_skins.js`（示例，见 §H） | `.ship/.skin` 里**除 hullName 之外**的可见文本（`descriptionPrefix`、`hullDesignation`）提取范例 | 见项目 `_work\mod_work\<Mod>\tools\` |
| `csvlib.js` | RFC4180 公共库：parse + 写回（含引号内逗号/换行、记录起始物理行号） | `require('./csvlib.js')` |
| `pseudojson.js` | **伪 JSON 宽松解析**公共库（`#` 注释/尾随逗号/`1.2f`/裸枚举值 `[STATIONS]`/BOM）；只读，回写用文本替换。2026-09-15 增补：OMM 的 `custom_entities.json` 用了引擎允许的**裸枚举值**（`"layers":[STATIONS]`），严格/原宽松解析均抛错 ⇒ `parseJsonLoose` 现把冒号/逗号/左括号后的裸标识符按字符串值处理（`true/false/null` 除外） | `require('./pseudojson.js')` → `parseJsonLoose`。**2026-09-16 修复**：裸枚举替换已带字符串感知（insideString），此前 tips.json 里 `, 词,` 形态会被误加引号搅成非法 JSON |

## B. 汉化迁移（旧译复用）

| 脚本 | 用途 | 用法 |
|---|---|---|
| `extract_old_map.js` | 旧 jar 对 **LCS 对齐**提取 EN→ZH 映射（重编译 jar 必须用 LCS，禁用索引/等长匹配） | `node extract_old_map.js …` → `old_en_zh_map.json` |
| `align_newjar_oldzh.js` | **新 jar 类 vs 旧译 jar 类**按类名对齐，产出对新 jar 有效的 EN→ZH | `node align_newjar_oldzh.js …` |
| `csvtool.js` | RFC4180 CSV parse/migrate（按 id 列迁移） | `node csvtool.js parse <file>` / `migrate <old> <new> <idCol> [cols] [out]` / `migrateAll <config.json>` |
| `migrate_rules_script.js` | rules.csv **script 列**迁移（`AddText "…"`、`$marketLeaveTooltip = "…"`），保留规则语法与 `$变量` | `node migrate_rules_script.js <oldRules.csv> <newRules.csv> [outCsv\|--inplace] [--dry]` |
| `migrate_faction2.js` | `.faction` 嵌套对象（`ranks`/`posts`/`fleetTypeNames`）按"行前缀 + 引号值"迁移 | `node migrate_faction2.js <oldFaction> <newFaction> [--dry]` |
| `migrate_json.js` | 注释 JSON 的**文本替换**式迁移（保持注释与缩进，铁律 R8）；替换对**外置**在 `<plan.json>` | `node migrate_json.js <plan.json> [--dry]` |
| `translate_missions.js` | 翻译 `data/missions/*/MissionDefinition.java` 字面量（运行时编译源码），保持 Java 语法；映射**外置**在 JSON | `node translate_missions.js <missionsDir> <mapping.json> [--dry]` |
| `check_encoding.js` | 检查改动文件为合法 UTF-8 无 BOM、无乱码 | `node check_encoding.js <modRoot\|目录\|文件> [...] [--all]`（`--all` 连非文本文件一起查；`--list` 看默认清单） |

## C. 注入 · 补丁 · 重打包

| 脚本 | 用途 | 用法 |
|---|---|---|
| `classparser.js` | 解析 `.class` 常量池（感知 modified UTF-8）：提取 Utf8、供校验与补丁 | `require('./classparser.js')` |
| `patcher.js` | **常量池安全替换**（只替换被 `CONSTANT_String` 引用且不被标识符条目引用的 Utf8，铁律 R7）+ 最小 zip 读写（正斜杠条目名） | `require('./patcher.js')` |
| `patchdir.js` | 对目录树内全部 `.class` 按映射**原位补丁**（**写操作**，先备份）+ 键命中报告 | `node patchdir.js <mapping.json> <classDir> [outDir]`（`outDir` 存 `missing_keys.json`） |
| `rezip.js` | 目录树重打包为 jar（条目名**正斜杠**，铁律 R9，保留 `META-INF/`） | `node rezip.js <dir> <out.jar>` |

## D. 验证 · 闸门

| 脚本 | severity | tier | 用途 | 闸门 |
|---|---|---|---|---|
| `check_java_residue.js` | red | cond | **Janino 源码 mod 提取完整性**（与 `extract_java_strings.js` 不同的解析路径）：未被清单覆盖的含英文字面量 = 0。2026-09 实测：提取器行注释状态机不随换行退出 → 每文件首个 `//` 之后全漏，独立复查网抓回 79 条真实 UI 文本 | G1/G4 |
| `check_java_equiv.js` | red | cond | **Janino 源码注入等价性证明**：把每个 .java 的字面量内容替换为占位符后骨架逐字节对比（只许字面量内容变）+ 字面量数一致 + 词法完整性（无未闭合字面量/注释）。G4/G5 在源码层的替代闸门（无 jar 可 LoadTest） | G4 |
| `verify_identifiers.js` | red | base | 全量 class 的 `NameAndType`/`Class` 名称不得含 CJK | G4 |
| `check_u0001.js` | red | base | 映射层：含 `\u0001` 的键与其译文数量一致 | G4 |
| `verify_u0001_jar.js` | red | cond | 补丁后 jar 中每个含 `\u0001` 常量与原始 jar 数量一致 | G4 |
| `check_encoding.js` | red | base | UTF-8 无 BOM、无乱码 | G3 |
| `check_csv_quotes.js` | red | base | 弯引号计数 + 归一化后行列数预检（铁律 R1） | G3 |
| `check_rules_arg_quotes.js` | red | cond | rules script 列命令参数内嵌引号（铁律 R2，**不崩溃只截断**） | G3 |
| `verify_all_data.js` | red | base | **数据层全量复查**：LunaSettings Text/Header/Radio、variants `displayName`、faction 舰队/官职名、`designTypeColors` 键唯一且与 CSV 匹配、`custom_entities`、`customStarts` | G3（**必须显式给 data 目录**，无默认值） |
| `verify_strings_json.js` | red | base | ★**JSON 字符串表汉化专项闸门**（界面文本外置型 mod，如 1.1+ 的 `data/strings/strings.json`）：一次查完三类风险 —— G1 键集/键序与英文基线一致 + 清单逐键覆盖；G2 空译文 0、**占位符集合逐键一致**（`$变量`/`%s`/`%%`/`\n`/`\u0001`/`[TOKEN]`/`{brace}`）、剥占位符后无连续英文词；G3 无 BOM、**CRLF/单独 LF 计数与基线一致**、无弯引号、**其它命名空间未被动过**。**动笔前先跑一次**：把英文基线自己当"汉化版"喂进去，必须报满屏英文残留（exit 1）——否则说明闸门是摆设（2026-09-17 RetroLib 实测） | **G1/G2/G3**（`node verify_strings_json.js <enJson> <zhJson> <命名空间> [worklist.json]`） |
| `check_refs.js` | red | cond | 引用完整性：variant/`.ship`/`.skin`/`default_ship_roles.json` → hull/武器/hullmod/wing；`weapon_data.csv` ↔ `.wpn` ↔ `.proj`。**2026-09-15 Ifed 实测修正**：.wpn/.proj 搜索范围扩到 `data/shipsystems/`（原版系统武器在 `shipsystems/wpn/`，如 flarelauncher1）+ core 递归 walk（Vayra ② 的 core `data\weapons\proj\` 子目录随之覆盖，`tpc_shot.proj` 类不再误报）；.proj 改按**内部 `id`** 匹配（引擎语义，文件名可不同，实测 ifed_citadelpd.proj 内部 id=ifed_citadelpd_shot）；补退出码 0/1（此前命中也 exit 0，账本误记 clean）。**残留已知假阳性**：variant 引用 `.skin` 的 `skinHullId` 自建 id（脚本已跳过） | G5 |
| `LoadTest.java` | red | cond | 离线类加载/实例化 + `hull_mods.csv`/`*.system` 脚本类存在性（**需 `-noverify` 与 logs 路径属性**，见 `env.md` §4）。⚠️ **被测 jar 必须放在无空格/无撇号路径**再进 `-cp`：`ZipFile` 能数出条目，但带 `mods/Vayra's Sector/...` 这种条目的系统 classloader 打不开 jar → **全部 `ClassNotFoundException`**（假全灭；复制到 `_work\_tmp\...` 再测即可） | G5 |
| `check_content.js` | yellow | base | 译文内容自检（占位符/`%%`/`${}`/长度/空译文）；位于 `-content` 的 `scripts\` | G2 |
| `check_font_glyphs.js` | yellow | base | 中文字库字形覆盖（铁律 R3）；零宽字符单列提示、不计命中 | G3 |
| `check_assets.js` | yellow | cond | 全部 `graphics/…` 字面量是否存在（**必须同时搜 mod + core + 其它已装 mod**，跳过注释行） | G5 |
| `check_sounds.js` | yellow | cond | `data/config/sounds.json` 引用的音频文件是否存在（宽松 JSON：剥 `#` 注释与尾逗号；元素可为 `{file:…}` 或字符串；用法 `node check_sounds.js <modDir>`）。**2026-09-15 Ifed 实测修正**：搜索范围从"仅 mod 目录"扩为 mod+core+其余已装 mod（引擎 VFS 语义；此前引用核心 ogg 的 mod 全部假 MISS）；带 `source` 的打包音频条目（music.bin）磁盘无独立文件，跳过；补退出码 0/1 | G5 |
| `check_sprites.js` | yellow | cond | 源码 `getSprite("分类","键")` 是否在 mod 或 core 的 `settings.json` 有定义 | G5 |
| `check_deprecated.js` | yellow | cond | mod 是否用了 0.98a API 的 `@Deprecated` 成员。**已知假阳性（2026-09 Vayra 实测，6 处命中 4 处错）**：行号取的是"成员名首次出现处"，`@Deprecated` 常标在**相邻成员**上 → 逐条看 API 源码 javadoc 定性，别按脚本报的行号直接下结论；只有 javadoc 写 "Does nothing. Replaced with X" 才是真失效（`@Deprecated` 但仍存在的常量如 `Skills.PLANETARY_OPERATIONS` 在 0.98 核心仍带 `.skill` 数据，照样生效） | G5 |
| `JsonProbe.java` | yellow | cond | 用**游戏自带 `org.json`** 验证数据宽松语法（铁律 R8 的权威工具） | G3/排查 |
| `cmp_strings.js` | yellow | cond | 新旧 jar 字符串常量对比（判源码/jar 漂移；用"原 jar 每条常量是否作为子串出现在新 jar 常量集合里"，不要求精确相等） | G5 |
| `cmp_csv_struct.js` | red | base | **注入结构等价性**（CSV 结构级重建法必备）：基线 vs 注入后的物理行数 / 解析数据行数 / 每行单元格数 / id 序列 | G3（`node cmp_csv_struct.js <基线目录> <注入后目录> <文件相对路径>...`） |
| `cmp_csv_cells.js` | red | base | **差异格核对**（CSV 结构级重建法必备）：逐格对比基线 vs 注入后，差异格必须全在待译清单内 → 未登记差异 = 0 | G3（`node cmp_csv_cells.js <基线目录> <注入后目录> <worklistDir> <文件相对路径>...`） |
| `scan_data_stragglers.js` | red | base | ★**data 层提取完整性**（recipe 的反向网）：未被清单覆盖的英文自然语言字段 = 0。提取阶段（拿英文原版当 mod）+ 交付前（拿注入后目录）各跑一次 | **G1/G3**（`node scan_data_stragglers.js <modRoot> <enBackupRoot> <worklistDir>`）；**2026-09-16 增补**：支持 `<worklistDir>/excluded_entries.json`（en 精确 > file#id&field > 整个 file），按口径故意不译的条目不再永久报候选 |
| `scan_refs.js` | red | base | ★**标识符引用点全扫**：列出某字面量出现在哪些 class、以什么形态被引用（`String` / `Fieldref` / `Methodref`）。两个必用场景：① 枚举改名**白名单必须覆盖全部引用点**（枚举类 + 合成 `$SwitchMap` 类 + 使用方，漏一个就 `NoSuchFieldError`，真实事故崩了两次）；② 补丁后作**硬门槛**扫"旧名是否还作为 `Fieldref` 出现"（译文等于原文者如 `CR→CR` 可豁免） | **G4**（`node scan_refs.js <已解包class目录> <字面量...> [--strict]`） |
| `check_options_structure.js` | red | base | ★**options 单元格结构**（rules.csv / zgrstuff.csv）：段数与 optionId 序列必须与英文原版等价、不得出现字面 `\n`。坏了会启动崩溃（`NumberFormatException`）而列数检查看不出来 | **G3**（`node check_options_structure.js <modRoot> <enBackupRoot> [--renamed=FROM:TO]`） |
| `scan_logic_keys.js` | red | base | ★**逻辑键误译**（启动 Fatal 的头号成因）：class 常量池里"显示文本"与"查找键"字面相同，本工具用"键查找调用上下文 + 保留键名单"识别。A 类（保留键被译）= 必错；B 类 = 待人工确认 | **G4**（`node scan_logic_keys.js <patch_map.json> <原classDir> [reservedKey...]`） |
| `check_install_source.js` | red | base | ★**安装前置断言**：确认目标 mod 目录仍是英文原版。对**已汉化目录**二次注入会把合成字段追加成"一行变两行 + optionId 重复" → 启动崩溃 | **注入前**（`node check_install_source.js <modRoot> <enBackupRoot>`） |
| `check_jar_patch_integrity.js` | red | cond | ★**jar 补丁洁净性**：逐类做常量池多重集差异，要求「类集合一致 + 每一处差异都落在声明的映射键/译文上」。把"我只改了文本"从自述变成证据；补丁脚本若退化成全量替换会立刻炸出来 | **G4**（`node check_jar_patch_integrity.js <原jar\|原classDir> <补丁jar\|补丁classDir> <patch_map.json>`） |
| `ProjSpecCheck.java` + `run_projspeccheck.ps1` | red | cond | ★**弹道/导弹 spec 的引擎语义级校验**：用游戏自带 `org.json` + 逐字复刻的 `LoadingUtils` 注释剥离算法读全部 `.proj`/`.wpn`/`.system`，报"解析失败 / 缺 WeaponSpecLoader 的 `getDouble` 必备键 / `behavior:"PROXIMITY_FUSE"` 缺 `range`（= 近炸引信导弹一造成伤害就 `JSONException: JSONObject["range"] not found`）"。**专治"引擎侧严格读法 + 数据漏键"这类只在战斗中才炸的崩溃** | `powershell -File run_projspeccheck.ps1 -DataDir <mod data 目录>` 或 `-AllMods`（编译产物落 `_work\_tmp\projspeccheck`） |
| `check_homoglyphs.js` | yellow | base | ★**同形异义字符**：西里尔/希腊字母伪装成拉丁（`е`U+0435 vs `e`）。后果是字库缺字形显示 `?` + 英文检索静默失败；上游原文自带时易被照抄进译文 | **G1/G3**（`node check_homoglyphs.js <data目录或文件...> [outJson]`） |
| `check_designtype.js` | red | base | ★**设计类型/制造商注册表**（静默降级，不报错不打日志）：`tech`/`manufacturer` 的值必须**逐字命中** `settings.json` 的 `designTypeColors` 键集合，否则引擎**把该值原样当分类名显示** → 症状就是"分类名还是英文"。同时查两处：① 含 `tech/manufacturer` 列的 CSV；② `data/hulls/**` 的 `.skin`/`.ship` 文件级 `tech`（**CSV 检查看不见**，只改 CSV 会漏）。**已知假阳性（2026-09 Vayra 实测）**：引擎实际用的是 **core + 全部已装 mod 合并后**的 `designTypeColors`，而脚本只查 mod 自己的 settings.json（给了 core 参数也只消 core 的键）→ 报警的值先 grep 核心与其它已启用 mod 的 settings.json 再定性 | **G3**（`node check_designtype.js <modRoot> [游戏core目录]`） |
| `check_uitags_zh.js` | red | base | ★**船插分类显示列**（`hull_mods.csv` 的 `uiTags`，2026-09-18 新增，与上一行是**两个不同的问题**）：该列是**显示列**，引擎直接把值（英文逗号切分）当船插分类标签显示、**不查任何注册表**，英文标签 ⇒ 分类名变英文且**不报错不打日志**。词表**动态取核心中文 `starsector-core\data\hullmods\hull_mods.csv` 同列**（只收含 CJK 的标签，故核心自身未译的 `Weapons`/`Defenses` 不会进白名单）；核心文件缺失时回落内置实测表。**事故**：Kyeltziv 1.10.7 迁移把旧 1.9 的中文 uiTags 覆盖回 `Special, Defenses, Engines`，而 `check_designtype`/`verify_all_data`/`scan_data_stragglers` 三个既有闸门**全漏检**（后者的句子判据不认 `Special`/`Defenses` 这类单词）。空白格合法（= 该船插无分类，不要猜）。**全库普查 17/27 个 mod 中招、共 113 处** | **G2/G3**（`node check_uitags_zh.js <modRoot> [--core=<核心data目录>] [--json=<out>]`，有英文标签则 exit 1） |
| `survey_uitags.js` | — | — | **全库 uiTags 普查**（取证用，不判生死）：扫 `<modsDir>` 下所有 `data\hullmods\hull_mods.csv`，按**标签值**聚合（格数 / 出现 mod 数 / 核心英文是否有该词），再按 mod 汇总。用来回答"哪些 mod 的船插分类还没汉化、共多少处"。2026-09-18 实测：27 个 mod、17 个中招、113 处 | `node survey_uitags.js <modsDir> [--core=<核心data目录>] [--json=<out>]` |
| `survey_mods_lang.js` | — | — | **判"这个 mod 是否已汉化"**（抽样 hull_mods 的 name/desc + descriptions.csv 的 text*，算 CJK 占比）。用于排除**英文原版 mod**（改它的 uiTags 无意义）。经验阈值：占比 <60% 多半是英文 mod，先问用户 | `node survey_mods_lang.js <modsDir>` |
| `fix_uitags_zh.js` | — | — | ★**uiTags 汉化注入器（写操作）**：按核心权威词表把 `hull_mods.csv` 的英文分类标签换成中文。**字节级定点替换**（状态机求单元格 `[start,end)`，只改那一段）⇒ **保留混合行尾/引号风格/注释行**（实测 Kayse 的该文件是 7×CRLF+20×LF，整体重建必违 R17）。整格切分后**必须完全相等**才替换（不子串替换、不猜译）；作者自定标签（`Unique`/`DEVTOOL`/`Utility`）默认保留；空值不填。`--dry` 预演 / `--backup` 逐 mod 备份到 `_work\mod_bak\uitags_fix\<Mod>\` / `--ext-map` 追加已确认的自定义标签映射；有未覆盖英文标签则 exit 1（提示人工定性）。顺带同步同目录 `.csv.json` 探针 | `node fix_uitags_zh.js <modRoot...> [--dry] [--backup] [--backupDir=<d>] [--ext-map=<json>] [--json=<out>]` |
| `verify_uitags_fix.js` | red | base | ★**批量 uiTags 改动的三合一复核**：对每个 mod 比对"备份快照 vs 当前"——**目标格差异数 > 0**、**EOL 字节级一致**、**结构一致**（列数/行数），并检查所有新标签都在核心中文词表内；最后对全库复扫 `check_uitags_zh.js`，列出剩余命中（应只剩作者自定标签与未汉化的英文 mod）。2026-09-18 实测 16 个 mod 全 OK | `node verify_uitags_fix.js <backupDir> <modRoot...>` |
| `check_wing_data_schema.js` | red | base | ★**wing_data 表头硬需求**（2026-09-15 AI War 事故沉淀）：`FighterWingSpreadsheetLoader` 对 `role desc` 等 **16 列**用 `getString` 硬读，缺列=启动崩溃（`JSONException: JSONObject["role desc"] not found`）——**"引擎按表头名读列、缺列=默认"对 wing_data 不成立**（hulls/weapons/hullmods 仍成立）。旧版（≤0.7）mod 升级必跑；表头建议直接照抄 core | **G3/G5**（`node check_wing_data_schema.js <modDir 或 csv路径>`） |
| `check_faction_shiproles.js` | red | base | ★**faction shipRoles 变体可解析**（2026-09-15 AI War 事故沉淀）：0.98 SpecStore 加载 faction 时对 shipRoles 每条 `"变体id":权重` 调 `Misc.getHullIdForVariantId`，id 不存在=NPE 启动崩溃（发生在 "Loading xxx faction" 之后）；**dead 角色键（interceptor/fighter/bomber 等）也会被解析，不会被忽略**。校验时注意：fallback 对象里的值是角色名不是变体，须先剥掉；机翼 id（knownFighters）与变体 id（shipRoles）是两个命名空间，别混；**变体 id 用「文件内 variantId 字段」（注册 id），不是文件名**（kite_Interceptor 注册为 kite_hegemony_Interceptor） | **G3/G5**（`node check_faction_shiproles.js <modDir>`） |
| `check_faction_known_lists.js` | red | base | ★**faction known\* 条目对照注册表**（2026-09-15 AI War 事故⑤沉淀）：复刻 `CoreLifecyclePluginImpl.verifyFactionData`——knownShips/knownHullMods/knownFighters/knownWeapons 逐条对 core+已启用 mod+被测 mod 的 ship_data/hull_mods/wing_data/weapon_data（.skin 的 skinHullId 也算 hull），任一不存在=**读档/开局时** RuntimeException（不在启动期，冒烟要读档才暴露）。真实事故：knownHullMods 填类名（AIW_Forcefield）而非 id（aiw_forcefield） | **G3/G5**（`node check_faction_known_lists.js <modDir>`） |
| `check_faction_file.js` | red | cond | ★**.faction 必填键/资产/登记**（2026-09-16 IFR 派系启动崩沉淀，与前两个脚本互补）：**缺 `names` = 启动崩**（SpecStore `JSONObject["names"] not found`，实证于 "Loading xxx faction" 之后）；原版惯例 7 键缺失降级警告（Kadur 实证 `personNamePrefixAOrAn` 等可省）；宽松解析覆盖 `1f` 浮点后缀、**文档末尾的 `,`**（原版 hegemony.faction 实测有，标准 JSON.parse 会炸但启动器/引擎能读）；logo/crest/portraits 贴图存在（mod→core 回退）；known\* 显式 id 存在性（fighters 用联队 id）；shipRoles 变体 id；factions.csv 登记。**同名覆盖原版派系的文件**（如 mod 内 pirates.faction）=深度合并语义，跳过必填键检查 | 派系专项（G5 前置；`node check_faction_file.js <modDir>`） |
| `check_eol.js` | red | base | ★**行尾风格审计**（铁律 R17）：按**原始字节**比较基线 vs 注入后的 `CRLF 数 / 单独 LF 数 / 是否以换行结尾`，必须全等。**`cmp_csv_struct.js` 查不出行尾变化**（它按解析结果比对，行尾被吞掉照样"结构一致"）；实测事故：注入器硬编码 CRLF 把 LF-only 的 10 个 CSV 改了风格、`rules.csv` 变成混合行尾 | **G3**（`node check_eol.js <基线目录> <注入后目录> [扩展名...]`，默认 `.csv`） |
| `scan_stragglers.js` | green | sample | 补丁后英文 UI 残留扫描（排除 Intrinsics/SMAP/调试日志）；**有残留则 exit 1** | G4（`node scan_stragglers.js <classDir> [outJson] [--quiet]`） |
| `check_jar_stragglers.js` | red | base | ★**交付 jar 的英文残留闸门（可判定版）**：`scan_stragglers.js` 是纯启发式且只吃 `.class` 目录 —— 对着**补丁前的解包副本**跑会得到原始 jar 的 383 条假警报（实测）。本脚本直接吃 **jar 文件**，并用两份账把结果判定成三类：A 声明要译却仍是英文（**必错**）/ B 已记账的跳过（允许）/ C 未记账（须人工判定）。**A 与 C 必须都为 0** | **G4**（`node check_jar_stragglers.js <jar文件> <patch_map.json> [jar_skip_audit.json] [--show-b]`） |
| `sweep_sentences.js` | green | sample | **句子级**复查：专治注释夹折叠漏译、弯引号键不匹配；**有候选则 exit 1** | G4（`node sweep_sentences.js <jarConstants.json> <translations.json> [outJson\|-]`） |
| `verify_patched.js` | green | sample | 补丁目录综合：`\u0001` + 英文句子残留（迁移场景） | G4（`node verify_patched.js <classDir>`） |
| `csvcheck.js` | green | sample | CSV 表头/列数/指定列取值（**完整状态机**，处理引号内换行） | 排查 |
| `jsonkeys.js` | green | sample | 容错 JSON 顶层键对比 | 排查 |
| `build_worklist2.js` | green | dormant | 旧版 jar 清单生成器，已被 `scan_jar_sources.js` 取代 | — |
| `validate_star_system.ps1` | yellow | cond | 自定义星系数据校验（skill 自带脚本，见 F 节） | — |

### D2. 记账工具（跑校验的入口，本身不参与计票）

| 脚本 | 用途 | 用法 |
|---|---|---|
| `run_check.js` | **包装执行校验并自动记账**（退出码 → ledger；默认不透传子命令输出以省上下文） | `node run_check.js --check=<名> [--target=<标签>] [--note=] [--probe] [--out] -- <命令...>` |
| `ledger_report.js` | 聚合账本 → 升降档/退役候选/需探针/需修复 报告 | `node ledger_report.js [--json] [--check=<名>]` |
| `sync_to_mod.js` | **把 skills 库的当前状态快照进交付 mod 的 `ai\`**（各 skill 的 SKILL.md/自带脚本、shared 文档含 `glossary.md`→`core-glossary.md` 改名、`workflows\*`、共享脚本 → `ai\脚本\`）。**只增改不删**，以免误删 `ai\脚本` 中不属于 skills 库的一次性诊断脚本。交付前跑一次，否则包里是旧文档旧脚本 | `node sync_to_mod.js <skillsDir> <modAiDir> [--dry]` |

## E. 诊断（引擎行为复现）

| 脚本 | 用途 | 用法 |
|---|---|---|
| `find_crash.js` | 大日志（GBK、多会话）切分会话 + 定位 ERROR/Exception 与最后会话上下文 | `node find_crash.js <starsector.log> [--all]` |
| `TestCsv.java` | **离线复刻游戏 CSV 管线**（读 UTF-8 → 归一化弯引号 → 引擎 `G.o00000` 解析），判定该文件是否会让引擎崩溃 | `java TestCsv <rules.csv>` |
| `ProjSpecCheck.java` | **离线复刻游戏 proj/wpn JSON 管线**（`LoadingUtils` 剥注释 + `org.json`）+ 复刻 `WeaponSpecLoader` 必备键检查；含 `PROXIMITY_FUSE` 缺 `range` 专项（`ProximityFuseAI` 崩溃根因） | `powershell -File run_projspeccheck.ps1 -DataDir <目录>` / `-AllMods` |

## F. 各 skill 自带脚本（不共享）

| 脚本 | 归属 skill | 用途 |
|---|---|---|
| `build_java_mod.ps1` | `starsector-mod-game-upgrade` | Java mod：编译 `src` → 打包 → 备份 `*.orig` → 安装 |
| `LoadTest.java`（9.3KB 版） | `starsector-mod-game-upgrade` | 升级场景专用 LoadTest（参数：jar 路径 + mod 目录） |
| `build_kotlin_mod.ps1` | `starsector-mod-kotlin-rebuild` | Kotlin mod：kotlinc 编译 → 打包 → 安装（可复现构建模板） |
| `LoadTestTemplate.java` | `starsector-mod-kotlin-rebuild` | Kotlin 场景类加载/实例化测试模板 |
| `install-cfr.ps1` | `starsector-jar-decompile` | 安装/重建 CFR（自建，幂等，6 步） |
| `build-cfr.bat` | `starsector-jar-decompile` | CFR 构建命令（参数写死在内部，避免 cmd 在 `=` 处拆参） |
| `launcher\cfr.ps1` / `cfr.cmd` | `starsector-jar-decompile` | CFR 启动器（参数原样透传） |
| `deliver.ps1` | `starsector-mod-delivery` | 交付打包（zip 名 = mod 中文名，内嵌 mod 文件夹，自动排除开发残留） |
| `fork_src.ps1` | `starsector-repo-source` | fork + codeload tarball 下载 + 本地 git 化（未传 `-Branch` 自动探测默认分支）。⚠️ 2026-09 修复：脚本首行 `$ErrorActionPreference='Stop'` 会让 PS 5.1 把 `gh repo view <you>/<repo>`（fork 尚不存在时）的 GraphQL 报错**升级为终止错误**，于是在"查是否已 fork"那一步就中断（SanIris 实测）。已改为 `Invoke-Capture`（局部降级 EAP + 回传退出码），并给 `curl`/`tar`/`git` 的 stderr 加 `2>$null`。 |
| `probe_github.ps1` | `starsector-repo-source` | GitHub 各域名 `:443` 可达性探针 |
| `validate_star_system.ps1` | `starsector-mod-star-system` | 自定义星系数据校验 |

## G. 资源

| 文件 | 用途 |
|---|---|
| `<skills>\shared\glossary.json` | 术语表（机器可读，供 `build_worklist2.js` 等消费） |
| `<skills>\shared\glossary.md` | 术语表（人读，带来源标注） |
| `<skills>\shared\verification-ledger.md` | **校验记账本机制 + 档位表**（人读；`ledger_report.js` 的档位来源） |
| `<skills>\shared\verification-ledger.jsonl` | 校验运行记账（append-only，一行一次运行） |
| `<skills>\skills\starsector-mod-delivery\templates\项目说明.md` | mod 结构介绍文件模板 |
| `<skills>\reference\SSTLib_API文档\*.html` | SSTLib API 文档（层级树/速查表/指南） |
| `<game>\_work\语料库\parallel\core_parallel.plain.jsonl` | 核心中英平行语料 15,033 对（术语取证） |
