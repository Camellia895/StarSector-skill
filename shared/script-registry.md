# 脚本登记表（唯一权威）

> 所有共享脚本位于 `<skills>\shared\scripts\`（`<skills>` = `C:\game\StarSector.v0.9.8a-RC8\_work\skills`）。
> **新增脚本前先查本表**：已有能力就引用，不要再写一份。
> 全部脚本**只读 + 打印**；改文件请人工确认后再动手（例外：`patcher.js`/`patchdir.js`/`rezip.js`/`migrate_*.js`/`translate_missions.js` 是写操作，用法中已注明）。
> 只支持 Node v24 与游戏 JRE / JBR 17，见 `env.md`。
>
> **校验类脚本另带两个属性**（机制见 `verification-ledger.md`）：
> `severity`（red/yellow/green = 违反后果等级）× `tier`（base/cond/sample/dormant = 加载策略）。
> **跑校验请用 `run_check.js` 包装以自动记账**，别直接 `node xxx.js`，否则账本收不到票。

## A. 摸底 · 提取 · 清单生成

| 脚本 | 用途 | 用法 |
|---|---|---|
| `analyze_jar_strings.js` | 解包 jar 常量池分析，给出**补丁安全分类**（`asString` = 被 `CONSTANT_String` 引用 ⇒ 真实字面量候选；`asId` = 被标识符条目引用 ⇒ 禁改） | `node analyze_jar_strings.js <jarDir> <jar_constants.json>` |
| `extract_jar_constants.js` | 提取 jar 内全部 Utf8 常量（去重） | `node extract_jar_constants.js <jarDir>` → `jar_constants.json` |
| `scan_jar_sources.js` | jar 常量 ↔ 源码字面量对齐，产出**带上下文**的候选（含 Java/Kotlin、编译期折叠、注释夹折叠、`${}` 片段） | `node scan_jar_sources.js <srcDir> <jar_constants.json> <candidates.json>` |
| `build_worklist2.js` | 由 jar 常量 + 源码字面量生成工作清单（旧版；注释夹折叠处理不如 `scan_jar_sources.js`） | `node build_worklist2.js …` → `worklist2.json` |
| `build_jar_worklist.js` | 汇总 LLM/人工分类结果 → `translate` 清单 + `skip` 审计（校验键存在且唯一） | `node build_jar_worklist.js <candidates.json> <outTranslate.json> <outAudit.json> <classify1.json> [...]` |
| `build_data_worklist.js` | **data 层 recipe 化待译清单**（核心工具）：CSV/伪 JSON/纯文本按 recipe 抽可见文本，输出统一 schema | `node build_data_worklist.js <modRoot> <recipe.json> <outDir>`；kind 文档见脚本头部（`csv`/`hullNames`/`variantDisplayNames`/`rulesCsv`/`lunaSettings`/`tips`/`shipNames`/`jsonObjects`/`jsonScalars`/`factionFile`/`jsonDirObjects`/`missionDir`/`wholeText`） |
| `csvlib.js` | RFC4180 公共库：parse + 写回（含引号内逗号/换行、记录起始物理行号） | `require('./csvlib.js')` |
| `pseudojson.js` | **伪 JSON 宽松解析**公共库（`#` 注释/尾随逗号/`1.2f`/BOM）；只读，回写用文本替换 | `require('./pseudojson.js')` → `parseJsonLoose` |

## B. 汉化迁移（旧译复用）

| 脚本 | 用途 | 用法 |
|---|---|---|
| `extract_old_map.js` | 旧 jar 对 **LCS 对齐**提取 EN→ZH 映射（重编译 jar 必须用 LCS，禁用索引/等长匹配） | `node extract_old_map.js …` → `old_en_zh_map.json` |
| `align_newjar_oldzh.js` | **新 jar 类 vs 旧译 jar 类**按类名对齐，产出对新 jar 有效的 EN→ZH | `node align_newjar_oldzh.js …` |
| `csvtool.js` | RFC4180 CSV parse/migrate（按 id 列迁移） | `node csvtool.js parse <file>` / `migrate <old> <new> <idCol> [cols] [out]` / `migrateAll <config.json>` |
| `migrate_rules_script.js` | rules.csv **script 列**迁移（`AddText "…"`、`$marketLeaveTooltip = "…"`），保留规则语法与 `$变量` | `node migrate_rules_script.js …` |
| `migrate_faction2.js` | `.faction` 嵌套对象（`ranks`/`posts`/`fleetTypeNames`）按"行前缀 + 引号值"迁移 | `node migrate_faction2.js …` |
| `migrate_json.js` | 注释 JSON 的**文本替换**式迁移（`replaceOnce`，保持注释与缩进） | `node migrate_json.js …` |
| `translate_missions.js` | 翻译 `data/missions/*/MissionDefinition.java` 字面量（运行时编译源码），保持 Java 语法 | `node translate_missions.js …` |
| `check_encoding.js` | 检查改动文件为合法 UTF-8 无 BOM、无乱码 | `node check_encoding.js …` |

## C. 注入 · 补丁 · 重打包

| 脚本 | 用途 | 用法 |
|---|---|---|
| `classparser.js` | 解析 `.class` 常量池（感知 modified UTF-8）：提取 Utf8、供校验与补丁 | `require('./classparser.js')` |
| `patcher.js` | **常量池安全替换**（只替换被 `CONSTANT_String` 引用且不被标识符条目引用的 Utf8，铁律 R7）+ 最小 zip 读写（正斜杠条目名） | `require('./patcher.js')` |
| `patchdir.js` | 对目录树内全部 `.class` 按映射**原位补丁** + 键命中报告 | `node patchdir.js <mapping.json> <classDir>` |
| `rezip.js` | 目录树重打包为 jar（条目名**正斜杠**，铁律 R9，保留 `META-INF/`） | `node rezip.js <dir> <out.jar>` |

## D. 验证 · 闸门

| 脚本 | severity | tier | 用途 | 闸门 |
|---|---|---|---|---|
| `verify_identifiers.js` | red | base | 全量 class 的 `NameAndType`/`Class` 名称不得含 CJK | G4 |
| `check_u0001.js` | red | base | 映射层：含 `\u0001` 的键与其译文数量一致 | G4 |
| `verify_u0001_jar.js` | red | cond | 补丁后 jar 中每个含 `\u0001` 常量与原始 jar 数量一致 | G4 |
| `check_encoding.js` | red | base | UTF-8 无 BOM、无乱码 | G3 |
| `check_csv_quotes.js` | red | base | 弯引号计数 + 归一化后行列数预检（铁律 R1） | G3 |
| `check_rules_arg_quotes.js` | red | cond | rules script 列命令参数内嵌引号（铁律 R2，**不崩溃只截断**） | G3 |
| `verify_all_data.js` | red | base | **数据层全量复查**：LunaSettings Text/Header/Radio、variants `displayName`、faction 舰队/官职名、`designTypeColors` 键唯一且与 CSV 匹配、`custom_entities`、`customStarts` | G3 |
| `check_refs.js` | red | cond | 引用完整性：variant/`.ship`/`.skin`/`default_ship_roles.json` → hull/武器/hullmod/wing；`weapon_data.csv` ↔ `.wpn` ↔ `.proj` | G5 |
| `LoadTest.java` | red | cond | 离线类加载/实例化 + `hull_mods.csv`/`*.system` 脚本类存在性（**需 `-noverify` 与 logs 路径属性**，见 `env.md` §4） | G5 |
| `check_content.js` | yellow | base | 译文内容自检（占位符/`%%`/`${}`/长度/空译文）；位于 `-content` 的 `scripts\` | G2 |
| `check_font_glyphs.js` | yellow | base | 中文字库字形覆盖（铁律 R3）；零宽字符单列提示、不计命中 | G3 |
| `check_assets.js` | yellow | cond | 全部 `graphics/…` 字面量是否存在（**必须同时搜 mod + core + 其它已装 mod**，跳过注释行） | G5 |
| `check_sprites.js` | yellow | cond | 源码 `getSprite("分类","键")` 是否在 mod 或 core 的 `settings.json` 有定义 | G5 |
| `check_deprecated.js` | yellow | cond | mod 是否用了 0.98a API 的 `@Deprecated` 成员 | G5 |
| `JsonProbe.java` | yellow | cond | 用**游戏自带 `org.json`** 验证数据宽松语法（铁律 R8 的权威工具） | G3/排查 |
| `cmp_strings.js` | yellow | cond | 新旧 jar 字符串常量对比（判源码/jar 漂移；用"原 jar 每条常量是否作为子串出现在新 jar 常量集合里"，不要求精确相等） | G5 |
| `scan_stragglers.js` | green | sample | 补丁后英文 UI 残留扫描（排除 Intrinsics/SMAP/调试日志） | G4 |
| `sweep_sentences.js` | green | sample | **句子级**复查：专治注释夹折叠漏译、弯引号键不匹配 | G4 |
| `verify_patched.js` | green | sample | 补丁目录综合：`\u0001` + 英文句子残留（迁移场景） | G4 |
| `csvcheck.js` | green | sample | CSV 表头/列数/指定列取值（**完整状态机**，处理引号内换行） | 排查 |
| `jsonkeys.js` | green | sample | 容错 JSON 顶层键对比 | 排查 |
| `build_worklist2.js` | green | dormant | 旧版 jar 清单生成器，已被 `scan_jar_sources.js` 取代 | — |
| `validate_star_system.ps1` | yellow | cond | 自定义星系数据校验（skill 自带脚本，见 F 节） | — |

### D2. 记账工具（跑校验的入口，本身不参与计票）

| 脚本 | 用途 | 用法 |
|---|---|---|
| `run_check.js` | **包装执行校验并自动记账**（退出码 → ledger；默认不透传子命令输出以省上下文） | `node run_check.js --check=<名> [--target=<标签>] [--note=] [--probe] [--out] -- <命令...>` |
| `ledger_report.js` | 聚合账本 → 升降档/退役候选/需探针/需修复 报告 | `node ledger_report.js [--json] [--check=<名>]` |

## E. 诊断（引擎行为复现）

| 脚本 | 用途 | 用法 |
|---|---|---|
| `find_crash.js` | 大日志（GBK、多会话）切分会话 + 定位 ERROR/Exception 与最后会话上下文 | `node find_crash.js <starsector.log> [--all]` |
| `TestCsv.java` | **离线复刻游戏 CSV 管线**（读 UTF-8 → 归一化弯引号 → 引擎 `G.o00000` 解析），判定该文件是否会让引擎崩溃 | `java TestCsv <rules.csv>` |

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
| `fork_src.ps1` | `starsector-repo-source` | fork + codeload tarball 下载 + 本地 git 化（未传 `-Branch` 自动探测默认分支） |
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
