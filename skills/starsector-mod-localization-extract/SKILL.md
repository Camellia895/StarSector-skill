---
name: starsector-mod-localization-extract
description: Starsector（远行星号）mod 汉化的第一阶段——把 mod 里所有玩家可见文本提取成"待译清单 worklist"交给人工/AI 翻译。覆盖摸底判定（strings 表 vs 硬编码在 jar/源码）、data 层 recipe 化提取（CSV/伪 JSON/faction/装配变体/LunaLib 设置/tips/舰名/任务文本）、jar 层常量池提取与源码字面量对齐（含编译期折叠、注释夹折叠、Kotlin ${} 片段）、易漏区 13 条清单、按 section 拆多份清单与 worklist_index.json。不含翻译、不含注入（那两步见 starsector-mod-localization-apply / wf-localize）。默认用户环境与当前环境一致（游戏根 C:\game\StarSector.v0.9.8a-RC8，中文 Windows）。
---

# 提取：生成待译清单（worklist）

**职责**：只做"把该译的东西一条不漏地摘出来"，产出**多份**待译清单交给上游（人）。
**不做**：翻译、注入、验证（→ `starsector-mod-localization-apply`、`starsector-mod-localization-verify`）。
**上游**：`wf-localize.md`（任务1）、`wf-translate-update.md`（任务2 的超量分流）。
**必读**：`<skills>\shared\env.md`、`<skills>\shared\conventions.md`（条目计数 §3、清单形态 §4）。

## 0. 三十分钟摸底：先判定翻译机制（最重要的一步）

```
data\strings\strings.json 存在 且 代码用 getString(category,key)?
├─ 是 → 汉化 = 翻译该 JSON + 各 CSV，jar 基本不动
└─ 否 → 字符串硬编码在源码（src\*.kt/*.java）或已编进 jars\<Mod>.jar → 必须处理 jar 层（§3）

存在旧版汉化（外部中文版：`_work\mod_zh\` 或旧版发布 zip）?
└─ 有 → 先走 starsector-mod-localization-migrate 抽旧译，本次只提"新内容"
```

同时做：

1. 备份英文原版基线：`Copy-Item -Recurse mods\<Mod> _work\mod_bak\<Mod>_<版本>_EN_backup`（汉化前必做）。
2. 工作区：`_work\mod_work\<Mod>\out\`（产物）+ `tools\`（本次脚本）（约定见 `conventions.md` §1.1）。
3. 编码抽查：字节级确认参考文件编码（`<skills>\shared\scripts\check_encoding.js`）；产出**一律 UTF-8 无 BOM**。
4. 源码不在手上 → `starsector-repo-source`（fork / codeload tarball）。

## 1. data 层提取（recipe 化，不要手抄文件）

写 `recipe.json`（结构见脚本头部注释），然后：

```powershell
node <skills>\shared\scripts\build_data_worklist.js <modRoot> <recipe.json> <outDir>
```

产出每 section 一个待译 JSON，条目形如
`{ file, id, field, line, en, zh:"", note }`（`line` 仅供上下文参考；**合并回填以 `id`+`field` 为准**，避免多行单元格导致行号漂移）。

**recipe 的 13 种 kind**（逐项考虑是否需要）：

| kind | 抓什么 |
|---|---|
| `csv` | 任意 CSV：`idCol` + `fields[{col,label,note}]`，可选 `idFilter`（正则，只译本 mod 前缀行） |
| `hullNames` | `data\hulls` + `data\hulls\skins` 里 `.ship`/`.skin` 的 `hullName` |
| `variantDisplayNames` | `data\variants\*.variant` 的 `displayName` |
| `rulesCsv` | rules.csv：**按行语义探测显示单元**（部分行省略空 script 列，按 header 固定列会整行漏译） |
| `lunaSettings` | `LunaSettings.csv`：说明文字在 **defaultValue 列**、Header 行标题；**Radio 选项值不译** |
| `tips` | `tips.json` |
| `shipNames` | `ship_names.json`（**重复词是加权设计**，逐条保留） |
| `jsonObjects` | 伪 JSON 按 `valueKeys` 抓对象值（如 `custom_entities.json` 的 `defaultName`） |
| `jsonScalars` | 伪 JSON 按 `paths` 抓标量（如 `mod_info.json` 的 `name`/`description`） |
| `factionFile` | `.faction`：`displayKeys`（4 个 displayName 系 + description）+ `ranks:true` 抓军衔/职务名 |
| `jsonDirObjects` | 目录内多份 JSON（`glob`）按 `keys` 抓（如通缉令 `description`/`dialog`） |
| `missionDir` | `data\missions\*`：`descriptor.json` 的 title/description + `mission_text.txt` |
| `wholeText` | 任意纯文本整篇（如 `mission_text.txt`） |

## 2. 易漏区清单（全部是真实事故，逐条核对）

> 漏一区的后果是"交付后玩家看到英文"。每条都要在 recipe 或人工核对里有交代。

1. **JSON 兜底名**：`config\custom_entities.json`、`config\planets.json` 的 `defaultName`/`nameInText`/`name` 是实体兜底显示名（`addCustomEntity(id, null, …)` 时使用）——事故："Photosphere"/"Sensor Array" 显示英文。
2. **LunaSettings 的 Text/Header 行**：说明文字在 **defaultValue 列**（段落说明、致谢、各 Header 标题）；**Radio 选项值（`Base`/`150%`/`Wide`）是代码逻辑键，严禁翻译**（`when(x){ "Base" -> }`）。
3. **装配变体** `data\variants\*.variant` 的 `displayName`。
4. **faction 舰队名/官职名**：`fleetTypeNames`（patrolSmall/Medium/Large/battlestation…）与 `ranks`/`officerRanks` 的 `name`（Admiral/CEO/Patrol Director…）——按 `"键":"值"` 形态替换值，`#` 注释行跳过。
5. **`designTypeColors` 键**：`config\settings.json` 的**键**是设计类型名，须译为与 CSV `tech/manufacturer` 中文值**精确一致**（否则不上色）且**键必须唯一**（事故：`Abyss`/`Abyssal` 都译"深渊" → `Duplicate key "深渊"` fatal）。原版没有颜色键的设计类型（如 Anomalous Phase-Tech）保持原样。
6. **`customStarts.json`**：`config\exerelin\customStarts.json` 的 name/difficulty/desc。
7. **rules.csv 行内列错位**：只译 `AddText "…"` 引号内文字，保留 `AddText`/颜色参数/引号（事故：3 行 flavor text 整行丢失）。
8. **全原版副本角色表**：`data\factions\fighter_wings.csv`、`weapon_categories.csv` 可能整表只含原版 id 行（势力"开放使用权"的副本）——**整表跳过不译**（在中文核心下会按 id 覆盖核心译名，属上游问题，别在汉化里"顺手修"）。
9. **伪 JSON 解析**：`#` 注释、尾随逗号、Java float 后缀（`1.2f`）、BOM——一律用 `<skills>\shared\scripts\pseudojson.js`（`parseJsonLoose`），**禁止** `ConvertFrom-Json`/`JSON.parse`（铁律 R8）。
10. **starmap / 代码命名联动**：`data\campaign\starmap.json` 的星系键与代码 `createStarSystem("Archimedes")`/`star.setName` 常量必须**同译**，否则星系不迁移定位；`custom_entities.json` 的 `defaultName` 与代码 `addCustomEntity(id,"显式名",…)` 两处译成一致。
11. **mission 类可能在 jar 里**：先按 §3 实证 jar 类集合——`data\missions\<id>\MissionDefinition.class` 若已在 jar 中则走常量池（**不必**改 `.java`）；仅当该类不在 jar、被运行时 Janino 编译时才改源码。任务舰船名（`addToFleet` 第 4 参）、`setFleetTagline`/`addBriefingItem` 均属可见文本。
12. **缺依赖启动弹窗**：`onApplicationLoad` 抛 `ClassNotFoundException` 的 message（"MagicLib is required…"、"You can download … at http://…"）只在缺依赖时弹给安装者——属 UI 文本（正文译、URL 保留），别当开发日志跳过。
13. **舰船显示名/分类的真正来源是 `data\hulls\ship_data.csv`**：0.95a+ 引擎以该表 `name` 列作舰船显示名、`designation` 作舰级分类、`tech/manufacturer` 作制造商行。**只改 `.ship` 的 `hullName` ≠ 舰名已汉化**（事故：全舰 `.ship` 已译但游戏内仍英文）。designation 取值见 `<skills>\shared\glossary.md` §3。

## 3. jar 层提取（仅当字符串硬编码进 jar）

```powershell
# 1) 解包 jar（.NET ZipFile::ExtractToDirectory）
# 2) 全量 Utf8 常量
node <skills>\shared\scripts\extract_jar_constants.js <jarDir>            # → jar_constants.json
# 3) 常量池分类（asString 可译 / asId 禁改）
node <skills>\shared\scripts\analyze_jar_strings.js <jarDir> <jar_constants.json>
# 4) 与源码字面量对齐，产出带上下文的候选（推荐）
node <skills>\shared\scripts\scan_jar_sources.js <srcDir> <jar_constants.json> <candidates.json>
# 5) 逐条分类（LLM/人工）后汇总
node <skills>\shared\scripts\build_jar_worklist.js <candidates.json> <outTranslate.json> <outAudit.json> <classify1.json> [...]
```

**必须知道的三种编译产物形态**：

- **Kotlin 模板片段**：`"a${x}b"` 编译为两个常量 `"a"`、`"b"` —— 按片段翻译，保证拼接通顺且顺序不变。
- **编译期折叠**：相邻字面量 `"a" + "b"` 折叠为 `"ab"`；**中间夹 `//` 或 `/* */` 注释也会折叠** —— 匹配逻辑须放行注释，否则整句漏译（事故：AlterationRefitButton 舰体改造说明）。`scan_jar_sources.js` 已处理；`build_worklist2.js` 未处理（仅旧版参考）。
- **`\u0001` recipe**：Kotlin 2.x indy 拼接把字面文本与 `\u0001` 占位符合在同一常量 —— 翻译保留 `\u0001` 的**数量与位置**（铁律 R6）。

**UI 筛选排除项**：路径、`rat_`/`$` 开头 id、全大写单词（多为选项 ID）、着色器参数、调试输出、数据类 `toString`、`Ljava/…` 签名、`SMAP`、`Intrinsics`。

**分类契约**（每项）：
`{ "c": <jar 常量原文，逐字符一致>, "decision": "translate"|"skip", "category": "ui"|"log"|"id"|"path"|"sig"|"fmt"|"markup"|"other", "cls": "...", "note": "..." }`
`build_jar_worklist.js` 会校验键存在且唯一。

> 翻译键一律取 **jar 常量原文**：弯引号/撇号（U+2018–U+201D）与首尾空格要逐字符保留，否则键不命中。

## 4. 输出：拆成多份 worklist

- 量小时一份；量大时**按 section / 目录 / 文本类型拆多份**（如 `01_data_hullmods.json`、`02_rules_text.json`、`03_jar_ui.json`、`04_missions.json`），每份都能被同一注入流程消费。
- 生成 `worklist_index.json`：列出全部分片、各自条目数、覆盖范围，便于上游逐片推进与**统计条目数**（任务2 分流要用，见 `conventions.md` §3）。
- 生成 `excluded_entries.json`：被排除的 locator + 理由，口径可复核。
- 每条含 `zh:""` 待填、`source:"new"`；已从旧版迁移的条目则 `zh` 预填、`source:"old-migrated"`。

## 5. 闸门 G1（提取完整）通过标准

- [ ] 每个 section 都有清单文件；`worklist_index.json` 条目数之和 = 各分片实际条目数
- [ ] §2 的 13 个易漏区**逐条**有交代（纳入 recipe 或写明"不存在/故意跳过"）
- [ ] jar 层候选已分类，`skip` 项有 `category` 与理由（留档审计）
- [ ] 清单里 `locator` 唯一（无重复回填目标）
- [ ] `excluded_entries.json` 已生成，排除理由可复核
- [ ] 英文原版已备份（`_work\mod_bak\<Mod>_<版本>_EN_backup`）

**交给上游时说明**：每份清单覆盖什么、条目数、哪些区域**故意不译**（理由）、建议翻译顺序（先术语密集区）。
