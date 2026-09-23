---
name: starsector-mod-localization-extract
description: Starsector（远行星号）mod 汉化的第一阶段——把 mod 里所有玩家可见文本提取成"待译清单 worklist"交给人工/AI 翻译。覆盖摸底判定（strings 表 vs 硬编码在 jar/源码）、data 层 recipe 化提取（CSV/伪 JSON/faction/装配变体/LunaLib 设置/tips/舰名/任务文本/**mod_info 与 changelog 元信息**）、jar 层常量池提取与源码字面量对齐（含编译期折叠、注释夹折叠、Kotlin ${} 片段）、易漏区 16 条清单、**交付契约（给译者的文件总数 ≤10 份：shard ≤5 + index + 修正后 glossary.md + 指向 -spec）**。不含翻译、不含注入（那两步见 starsector-mod-localization-apply / wf-localize）。默认用户环境与当前环境一致（游戏根 C:\game\StarSector.v0.9.8a-RC8，中文 Windows）。
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
| `modInfo`（**kinds 已内置**） | `mod_info.json` 的 `name`/`description`；写法 `{"kind":"modInfo"}`。**自动排除** `id`/`version`/`gameVersion`/`author`/`dependencies` 等标识与版本字段（铁律 R12）；**已中文的值自动跳过**（`includeZh:true` 可强制全量） |
| `changelog`（**kinds 已内置**） | `changelog.txt` 条目正文；写法 `{"kind":"changelog"}`。按**空行分段**切块，逐块成条并保留行号（`field` = `changelog@<行号>`，用于唯一定位）；**已中文的块自动跳过** |

> **`modInfo` / `changelog` 是必查两项**（易漏区 15/16），不是"有就查"：启动器列表与 mod 详情里
> 玩家直接看到它们。两者都归到 `05_misc` shard（见 §4.1 分片原则）。
> 两个 kind 已实现在 `build_data_worklist.js` 内，**实测**：`CustomizableStarSystems` → 15 条（含 13 条 changelog 分段）、
> 已中文的 `Templars` → 0 条。

## 1.5 提取完整性闸门（**必跑**；recipe 有盲区，别只靠 recipe）

recipe 是"按已知列写死的抽取规则"，**只能覆盖你想到的列**。实测漏译全部来自"没想到的字段"：

| 容易整列/整字段漏掉的位置 | 字段 | 后果 |
|---|---|---|
| `.skin` / `.ship` | `descriptionPrefix` | 图鉴描述前缀（引擎按 `prefix + "\n\n" + 正文` 渲染 → "英文前缀 + 中文正文"混排） |
| `weapon_data.csv` | `customPrimary` / `customPrimaryHL` / `customAncillary` / `customAncillaryHL` / `primaryRoleStr` / `speedStr` / `trackingStr` / `accuracyStr` | 武器 tooltip 的**覆写文案**（会替换默认文案） |
| `.skin` | `hullDesignation` | 人可读短语（`Light Cruiser`）直接显示 → 需译；ENUM（`frigate`）由引擎本地化 → **不译** |
| 任意 CSV | 列**内嵌**配置块（如 `industries.csv` 的 `data` 列里 `fleetName:Aria Station`） | 列名看似逻辑列 → 整列被跳过 |
| 第三方集成配置（如 `config\exerelin\mercConfig.json`） | `name` / `desc` | 佣兵团名与简介 |

**强制做法**：用"枚举 → 判覆盖"的**反向网**，而不是只写 recipe（铁律 R14）：

```powershell
# 提取阶段：拿**英文原版**当 mod，检查"清单是否覆盖了数据层里全部人可读英文"
node <skills>\shared\scripts\scan_data_stragglers.js <EN原版目录> <EN原版目录> <worklistDir>
```

必须 **0 候选**才算提取完整。有候选 → 补提取（写专用提取脚本或扩 recipe）→ 重跑，**不要**靠目检文件。

**反查设计类型名（铁律 R16，反例实测）**：`settings.json` 的 `designTypeColors` **键**不属于任何 CSV 列，
**任何 recipe 都抓不到**；而同一个设计类型名还出现在 `ship_data.csv` 与 `weapon_data.csv` 的
`tech/manufacturer` **全列**（不只是 `hull_mods.csv`）。只译 `hull_mods.csv` 会得到
"键=英文 / 值=中文" ⇒ 引擎查不到注册项、**不报错**、直接把值当分类名显示且**不上色**。

```powershell
node <skills>\shared\scripts\check_designtype.js <modRoot>   # 必须 0 问题
```

> 配套技巧：`.skin`/`.ship` 这类结构化文件，先"列出全部字符串字段 + 出现次数"摸清有哪些字段，
> 再决定哪些要译；**别只 grep `hullName`**（本项目就是这样漏掉 `descriptionPrefix` 的）。
>
> 完整教训见 `shared\iron-rules.md` R14 与 `workflows\wf-launch-audit.md`。

## 2. 易漏区清单（全部是真实事故，逐条核对）

> 漏一区的后果是"交付后玩家看到英文"。每条都要在 recipe 或人工核对里有交代。

1. **JSON 兜底名**：`config\custom_entities.json`、`config\planets.json` 的 `defaultName`/`nameInText`/`name` 是实体兜底显示名（`addCustomEntity(id, null, …)` 时使用）——事故："Photosphere"/"Sensor Array" 显示英文。
2. **LunaSettings 的 Text/Header 行**：说明文字在 **defaultValue 列**（段落说明、致谢、各 Header 标题）；**Radio 选项值（`Base`/`150%`/`Wide`）是代码逻辑键，严禁翻译**（`when(x){ "Base" -> }`）。
3. **装配变体** `data\variants\*.variant` 的 `displayName`。
4. **faction 舰队名/官职名**：`fleetTypeNames`（patrolSmall/Medium/Large/battlestation…）与 `ranks`/`officerRanks` 的 `name`（Admiral/CEO/Patrol Director…）——按 `"键":"值"` 形态替换值，`#` 注释行跳过。
   recipe 写法：`factionFile` 加 `"ranks":true, "fleetTypeNames":true`（**2026-09-21 起** `fleetTypeNames` 已内置；RYAZ 实测此前内置 kind 不抓、反向网兜出 10 条）。`.faction` 若有**未加引号键**（如 `id:"ryaz"`），`parseJsonLoose` 解析不了，脚本用块级正则兜底（R8）。
5. **`designTypeColors` 键**：`config\settings.json` 的**键**是设计类型名，须译为与 CSV `tech/manufacturer` 中文值**精确一致**（否则不上色）且**键必须唯一**（事故：`Abyss`/`Abyssal` 都译"深渊" → `Duplicate key "深渊"` fatal）。原版没有颜色键的设计类型（如 Anomalous Phase-Tech）保持原样。
6. **`customStarts.json`**：`config\exerelin\customStarts.json` 的 name/difficulty/desc。
7. **rules.csv 行内列错位**：只译 `AddText "…"` 引号内文字，保留 `AddText`/颜色参数/引号（事故：3 行 flavor text 整行丢失）。
8. **全原版副本角色表**：`data\factions\fighter_wings.csv`、`weapon_categories.csv` 可能整表只含原版 id 行（势力"开放使用权"的副本）——**整表跳过不译**（在中文核心下会按 id 覆盖核心译名，属上游问题，别在汉化里"顺手修"）。
9. **伪 JSON 解析**：`#` 注释、尾随逗号、Java float 后缀（`1.2f`）、BOM——一律用 `<skills>\shared\scripts\pseudojson.js`（`parseJsonLoose`），**禁止** `ConvertFrom-Json`/`JSON.parse`（铁律 R8）。
10. **starmap / 代码命名联动**：`data\campaign\starmap.json` 的星系键与代码 `createStarSystem("Archimedes")`/`star.setName` 常量必须**同译**，否则星系不迁移定位；`custom_entities.json` 的 `defaultName` 与代码 `addCustomEntity(id,"显式名",…)` 两处译成一致。
11. **mission 类可能在 jar 里**：先按 §3 实证 jar 类集合——`data\missions\<id>\MissionDefinition.class` 若已在 jar 中则走常量池（**不必**改 `.java`）；仅当该类不在 jar、被运行时 Janino 编译时才改源码。任务舰船名（`addToFleet` 第 4 参）、`setFleetTagline`/`addBriefingItem` 均属可见文本。**⚠️ mission 的 `descriptor.json`/`mission_text.txt` 可能同时存在 mod 目录和 jar 内两份副本**（2026-09-21 RYAZ 实测）——注入时两处都要写，漏一处就是"任务选单英文"。
12. **缺依赖启动弹窗**：`onApplicationLoad` 抛 `ClassNotFoundException` 的 message（"MagicLib is required…"、"You can download … at http://…"）只在缺依赖时弹给安装者——属 UI 文本（正文译、URL 保留），别当开发日志跳过。
13. **舰船显示名/分类的真正来源是 `data\hulls\ship_data.csv`**：0.95a+ 引擎以该表 `name` 列作舰船显示名、`designation` 作舰级分类、`tech/manufacturer` 作制造商行。**只改 `.ship` 的 `hullName` ≠ 舰名已汉化**（事故：全舰 `.ship` 已译但游戏内仍英文）。designation 取值见 `<skills>\shared\glossary.md` §3。
14. **★`hull_mods.csv` 的 `uiTags`（船插分类显示列）**：引擎把该列的值（英文逗号切分）**直接当装配界面/百科的船插分类标签显示，不查任何注册表** ⇒ 英文标签就是英文，**不报错、不打日志**。**该列的权威词表 = 核心中文 `starsector-core\data\hullmods\hull_mods.csv` 同列**（`Weapons→武器`、`Special→特殊`、`Logistics→后勤`、`Requires Dock→需要船坞`、`Defenses→防御`、`Shields→护盾`、`Engines→引擎`、`Fighters→战机`、`Phase→相位`、`Support→支援`）。**留空合法**（= 该船插无分类，别猜）；作者自定的分类（`Unique`/`DEVTOOL`/`Utility`/`基础`…）保留原样，除非确认要汉化。
    **2026-09-18 全库普查**：27 个有 `hull_mods.csv` 的 mod 里 **17 个**存在英文标签、共 **113 处**（Kyeltziv/Epta/Nightcross/RAT/人之领相位研究所…）——多为**迁移/重译时被上游英文原文覆盖**，属"汉化过的 mod 又变回英文"的高频复发点。工具：`<skills>\shared\scripts\survey_uitags.js`（全库普查）、`fix_uitags_zh.js`（定点注入，字节级、保留混合行尾）、`check_uitags_zh.js`（闸门）。
15. **★`mod_info.json`（启动器列表/详情 直接显示，属**玩家可见文本**）**：译 `name` 与 `description`。
    **不译**：`id`（改了会丢存档兼容）、`version`、`gameVersion`、`author`、`dependencies`、
    `modPlugin`/`jars` 等一切标识与版本字段（铁律 R12）。
    - `name` 影响**交付 zip 的文件名与解压后的文件夹名**（`deliver.ps1` 取它，见 `starsector-mod-delivery`）——
      译名要能当文件夹名用：避免 `\/:*?"<>|` 与首尾空白/点。
    - 若 `description` 较长，按 `starsector-mod-localization-content` 的分层（写清定位 + 特色，不逐字直译）。
    - 另有 `*.version`（如 `<ModId>.version`）与 `modFiles` 清单里的元信息，同样只在**有可见文案**时才动。
16. **★`changelog.txt`（mod 列表里可查看，属**玩家可见文本**）**：译**条目正文**，
    **保留原文件结构与分隔符**（版本段落头、`---`/空行/`•` 等项目符号、缩进）。
    - **版本号与日期原样保留**（`1.2.0`、`2026-09-18`）。
    - 上游常中英混排或中途改成英文：**只补/改正文英文**，已中文的条目不要重写。
    - 若 mod 无 `changelog.txt`：不要新建（那不是汉化工作；只有作者改版本时才由 `wf-game-update` 加条目）。
    - 与 `wf-game-update` 第 10 步的"加新版本条目"是两件事：那里**新增**条目，这里**翻译**已有条目。

## 3. jar 层提取（仅当字符串硬编码进 jar）

### 3.0 先验一件事：**上游源码与已装 jar 是不是同一版**

`jars\source.url` / `mod_info.json` 指向的仓库地址**不等于**你手上这个 jar 的源码。
Nomadic Survival 实测：GitHub master 用 `javac --release 17` 重编译 → 42 个 class，
与已装 jar 的**字符串全集差 470 条**（上游源码明显更新的构建），而安装版 jar 与官方发布包 **SHA-256 完全一致**。

- **必做**：`cmp_build.js`（或任何"重编译后比字符串集合"的手段）先比一次；
  差异显著 ⇒ **只把反编译源码当"语境参考"**，一切判定以 **jar 常量池 + `javap -c` 字节码**为准。
- 别让清单里的 `src` 上下文变成"看起来很有把握"的错误依据：它对不上时**不报错**，
  只会让你按错误的调用点去判"这条是不是 UI 文本"。
- 找不到同版源码时**不要**试图重编译（见 `starsector-mod-java-hardcoded-text` §1.1），走常量池补丁。

### 3.1 提取步骤

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

### 4.1 ★交付契约：交给上游的文件总数**至多 10 份**（硬约束）

提取的产出是**给译者的一小包东西**，不是一堆散清单。宁可单文件条目多，也不许多开文件——
每个文件都要译者单独打开、单独理解上下文。

| # | 交付物 | 形式 | 约束 |
|---|---|---|---|
| 1–5 | **待译清单 shard** | `worklist/01_*.json` … | **shard ≤ 5 份** |
| 6 | `worklist_index.json` | 分片索引 + 条目数 + **被排除区域及理由** | 1 份（合并统计与审计，不另建审计文件） |
| 7 | `glossary.md` | **基于本 mod 修正后的术语表** | 1 份（在 `<skills>\shared\glossary.md` 基础上增补/纠正本 mod 专名，沿用其来源标注格式） |
| 8 | `starsector-mod-localization-spec` | skill 目录（`SKILL.md` 一份） | 1 份（**原文路径交付**，不复制内容，避免双份漂移） |

**总计 ≤ 8 份；即使上游坚持要分得更细，也以 10 份为上限。**

分片原则（**按载体类型分，不按小节分**）：

1. `01_data` —— data 层 CSV / 伪 JSON 的可见文本
2. `02_structured` —— `.ship` / `.skin` / `.variant` / `.faction` 等结构化文件
3. `03_rules_missions` —— rules、任务、简报、叙事长文
4. `04_jar` —— jar 常量池（含 `\u0001` recipe 条目）
5. `05_misc` —— 其余（`mod_info` / changelog / 配置注释 / tips…）

> **禁止**因"类别多"就继续加文件。单个 shard 条目多不是问题（几千条也能一次读完结构）；
> 文件数多才是问题。确实超过 10 份时，**先合并小类**，并在 `worklist_index.json` 说明合并了哪些。

### 4.2 `worklist_index.json`（第 6 份）要装什么

- 每个 shard：文件名 / 条目数 / 覆盖的文件或区域；
- **被排除的区域 + 理由**（原独立审计文件的内容并入此处）；
- 各 shard 条目数之和 = 实际条目总数（供任务②算分流比例，见 `conventions.md` §3）。

### 4.3 ★回传约定：交付时必须**建好 `worklist/zh/` 空文件夹**（给译者放成品）

交付包顶上必须有这个子文件夹，**并在交付说明里告诉译者怎么用**（别只建个空目录不解释）：

```
worklist\
├─ 01_data.json          ← 待译清单（原件，译者不要改）
├─ 02_structured.json
├─ 03_rules_missions.json
├─ 04_jar.json
├─ 05_misc.json
├─ worklist_index.json   ← 分片索引 + 条目数 + 被排除区域
├─ glossary.md           ← 基于本 mod 修正后的术语表
└─ zh\                   ← ★译者把**汉化后的产物**放这里（交付前建成空目录）
    └─ README.md         ← 用法说明（模板见 templates\zh\README.md）
```

**回传规则（必须写进交付说明）**：

1. **只填 `zh` 字段，其余字段一律不动**；"有意保留原文" = 让 `zh` 与 `en`/`c` **逐字相同**。
2. 填好后**另存到 `zh\`**，**文件名与上一级清单保持一致**（AI 靠文件名配对"已译产物 ↔ 待译清单"）。
3. **允许只回传完成的那几份**（不必 5 份全齐）；AI 按已到位的最新的处理。
4. **不得增删条目/改顺序**；发现遗漏**告诉 AI 补进上一级清单**，不要在 `zh\` 里自行新增
   （否则条目对不上，注入会失败）。
5. **`zh\` 内的文件不计入"交付文件 ≤10 份"的上限**——那是回传产物，不是交付物。

> 落地模板：`<skills>\skills\starsector-mod-localization-extract\templates\zh\README.md`
> （含 JSON 字段说明与目录示意图，复制进交付包的 `zh\` 即可；也可以用等价的说明替代）。

## 5. 闸门 G1（提取完整）通过标准

- [ ] 每个 section 都有清单文件；`worklist_index.json` 条目数之和 = 各分片实际条目数
- [ ] **交付文件总数 ≤ 10**（正常 ≤ 8）：shard ≤ 5 + index + `glossary.md` + `spec`；超出必须合并并说明
- [ ] **已建好 `worklist\zh\`**（含用法说明，见 §4.3），且交付说明里写了"填完另存到 `zh\`、文件名保持一致"
- [ ] `glossary.md` 已按本 mod 修正（专名/自造译名都在其中），不是直接照搬共享术语表
- [ ] **data 层反向网 0 候选（§1.5，最高优先级）**：
      `node <skills>\shared\scripts\scan_data_stragglers.js <EN原版目录> <EN原版目录> <worklistDir>`
      → 必须 0 候选。**只靠 recipe 不算通过**（recipe 有盲区，实测漏的正是"没想到的字段"）。
- [ ] §2 的 16 个易漏区**逐条**有交代（纳入 recipe 或写明"不存在/故意跳过"）
- [ ] **结构化文件要"看全部字段"而不是 grep 已知字段**：`.ship`/`.skin`/`.variant`/`.faction` 先列出
      所有字符串字段+出现次数，再判哪些是可见文本（本项目因只 grep `hullName` 而漏掉 `descriptionPrefix`）
- [ ] jar 层候选已分类，`skip` 项有 `category` 与理由（留档审计）
- [ ] **排除项自审（必做，别只看"剩多少条"）**：把 jar 候选里**未分类**的条目**按理由分组列出并计数**，
      人工抽查 ≥20 条；"看着像文本但被排除"的一律逐条解释。
      > 血泪：Nomadic Survival 首轮漏 47 条、补漏脚本又因两条写错的排除正则再漏 22 条
      > （把 `"Lose %s "` 当格式片段、把 `"Starsector "` 当键名），两次都是**静默误杀**。
      > 正确写法与两种错法见 `starsector-mod-java-hardcoded-text` §2.5。
- [ ] **jar 常量池的"非 `CONSTANT_String` 引用"也要扫**：显示文本可能只经
      `invokedynamic`（`makeConcatWithConstants` recipe）进入字节码，`asString=false` 但**仍然是可见文本**
      （拼接片段、句尾标点、单位词、单复数分支词）。这类条目占 Nomadic Survival 待译文本的近 1/3。
- [ ] 清单里 `locator` 唯一（无重复回填目标）
- [ ] `excluded_entries.json` 已生成，排除理由可复核
- [ ] 英文原版已备份（`_work\mod_bak\<Mod>_<版本>_EN_backup`）

**交给上游时说明**：每份清单覆盖什么、条目数、哪些区域**故意不译**（理由）、建议翻译顺序（先术语密集区）。
