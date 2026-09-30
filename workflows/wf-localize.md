# wf-localize · 汉化一个 mod（提取 → 用户汉化 → 注入）

> **任务分类 ①**。输出：可直接放进 `mods\<Mod>\` 的中文版（数据文件 + 必要时补丁后的 jar）。
> 需要读：`shared\env.md`、`shared\conventions.md`、`skills\starsector-mod-localization-extract\SKILL.md`；
> 后续按需读 `-spec` / `-content` / `-voice` / `-apply` / `-verify`。

## 适用 / 不适用

- **适用**：给某个 mod 做**首次**汉化（无旧汉化可复用）。
- **不适用**：存在旧版汉化、且本次是 mod 更新 → 走 `wf-translate-update.md`（任务②）。
- 例外：任务② 若比例 ≥ 20%（需人工全量汉化），会**移交**本流程。

## 阶段 0 · 立项（10 分钟）

1. 备份英文原版：`mods\<Mod>\` → `<game>\_work\mod_bak\<Mod>_<版本>_EN_backup`。
2. 建工作区：`<game>\_work\mod_work\<Mod>\out\`（产物）+ `tools\`（本次脚本）——最小约定见 `conventions.md` §1.1。
3. 需要源码 → `starsector-repo-source`。
4. 判定翻译机制（strings 表 vs 硬编码）→ `starsector-mod-localization-extract` §0；
   **无 `jars/` 且 `data/plugins|scripts` 直接放 `.java`** → 加读 `starsector-mod-janino-source-localization`（源码即载体，不走 jar 补丁）。

> **目录分工**（别放错，详见 `shared\conventions.md` §1）：
> `mod_src` = 源码**只读基线**；`mod_bak` = **改动前备份**（含英文原版）；`mod_work` = 本次产物与脚本；
> `mod_zh` = **从外部拿到的中文版**（社区版 / 旧汉化存档，只读参照物）。
> **我们自己合并好的中文成品只在 `_work\deliver\` 打包**，不进 `mod_zh`。

## 阶段 1 · 提取（AI 做）

执行 `starsector-mod-localization-extract` 全文：

- data 层 `recipe.json` → `build_data_worklist.js`；jar 层 `extract_jar_constants.js` → `analyze_jar_strings.js` → `scan_jar_sources.js` → `build_jar_worklist.js`；
- **★反向网必跑**（recipe 只能覆盖"你想到的列"，实测漏译几乎全来自盲区，铁律 R14）：
  `node <skills>\shared\scripts\scan_data_stragglers.js <EN原版目录> <EN原版目录> <worklistDir>` → **必须 0 候选**；
- 结构化文件（`.ship`/`.skin`/`.variant`/`.faction`）**先列出全部字符串字段**再判哪些要译，别只 grep 已知字段
  （实测：只 grep `hullName` 会漏掉 `.skin` 的 `descriptionPrefix`——图鉴描述前缀）；
- 逐条核对**易漏区 16 条**；
- 按 §4.1 的**交付契约**收敛产出：**待译清单 shard ≤ 5 份** + `worklist_index.json`（含条目数与**被排除区域及理由**）。

**闸门 G1**（定义见 `shared\conventions.md` §5）：提取完整 —— 含上面反向网 **0 候选**。

## 阶段 2 · 交给用户汉化（**本流程的关键交接点**）

### 2.1 交付包：**文件总数至多 10 份**（正常 8 份，硬约束）

| # | 交付物 | 说明 |
|---|---|---|
| 1–5 | `worklist/01_data.json` … `05_misc.json` | **待译清单 shard，上限 5 份**（按载体类型分：data / structured / rules_missions / jar / misc） |
| 6 | `worklist_index.json` | 分片索引 + 各片条目数 + **被排除区域及理由** |
| 7 | `glossary.md` | **核心术语参考表**（`shared\glossary.md` **原样交付**；只收核心术语，**不含本 mod 专名、不提供建议译名**） |
| 8 | `starsector-mod-localization-spec` | **写作规范 skill，给原文路径即可**（`<skills>\skills\starsector-mod-localization-spec\SKILL.md`），不要复制内容 |

交付包顶上还要**建好 `worklist\zh\` 空文件夹**（+ 用法说明）——译者把**汉化后的产物**放进其中。
目录形态、回传规则与落地模板见 `starsector-mod-localization-extract` §4.3；要点：

- **只填 `zh`，其余字段不动**；"有意保留原文" = `zh` 与 `en`/`c` **逐字相同**；
- 填好后**另存到 `zh\`**，**文件名与上一级清单保持一致**（AI 靠文件名配对"已译产物 ↔ 待译清单"）；
- 允许只回传完成的那几份；**不得增删条目或改顺序**（发现遗漏让 AI 补进上一级清单）；
- `zh\` 内的文件**不计入** ≤10 份的上限。

> **宁可单个文件条目多，也不许多开文件**：每多一个文件，译者就多一次"这个文件是干嘛的"开销。
> 严禁因"类别多"就加文件；确实超过 10 份时先合并小类，并在 `worklist_index.json` 里说明合并了什么。

### 2.2 交付时必须说明的事（缺一项都会让用户多问一轮）

1. **清单文件路径**（≤5 份）+ 每份覆盖范围与**条目数**，并给出**总条目数**；
2. **定位方式说明**：每条 = `locator` / `file` / `id` / `field` / `line`(参考) / `en` / `zh`(留空) / `note`(上下文)，
   **只填 `zh`，其余字段不动**（否则注入会失败）；**「有意保留原文」= `zh` 与 `en`/`c` 逐字相同**；
3. **术语以第 7 份 `glossary.md` 为准**（核心术语统一用词）。它**不包含本 mod 专名的建议译名**——
   mod 专名由译者按其表头"取证优先顺序"自行定名，并在全 mod 保持一致；AI 不预设译名；
4. **动笔前必读第 8 份 `starsector-mod-localization-spec`**：占位符 `%`→`%%`、`\u0001` 数量与位置、
   CSV 引号、禁 `「」` 用 `【】`、`${}` 后接汉字等格式铁律；
5. **长文本特别说明**：对话/人物/叙事类条目按 `starsector-translation-voice` 处理（可脱离原文句式）；
6. **元信息与 changelog 也在范围内**（易漏区 15/16，都归 `05_misc`）：
   - `mod_info.json` 的 **`name` / `description`** 要译（启动器列表与详情直接显示）；
     `id`/`version`/`gameVersion`/`author`/`dependencies` 等**不译**；
     `name` 会被 `deliver.ps1` 用作**交付 zip 名与解压文件夹名**，故避免 `\/:*?"<>|` 与首尾空白/点。
   - `changelog.txt` 的**条目正文**要译，**保留版本号、日期与原有分段/项目符号结构**；已中文的条目不要重写。
7. **故意不译的区域**及理由（如 LunaSettings Radio 选项值、逻辑键与引擎 ENUM、原版副本角色表）；
8. **建议翻译顺序**：先术语密集区（hullmods / ship_data / faction）建立术语一致性，再 rules/任务/对话。

> 用户身份是**译者**：AI 不得代填正文（`translation-voice` 的"程序使用限制"）。

### 2.3 译者选择：人工译 or 派发 AI 翻译（提取完成后必问）

交付包就绪后，**先问用户一句**："要我派 AI 翻译吗？优先用闲时任务：自动整包译一轮，完成后我在本会话
校验并汇报译名对照，你直接在这里改稿；也可以开一个独立的可对话翻译会话。"
- 用户同意派发 → 执行 `skills\zcode-dispatch-translate\SKILL.md`：**优先闲时任务**（闲时独立
  配额池、完成后自动唤醒主会话做结构核对；审改直接在主会话进行；**实测默认模型 = 闲时计划
  GLM-5.3-Flash，给不了 GLM-5.3 本尊**——点名 GLM-5.3 须桌面 App 手动建会话）；仅当用户明确要
  "独立可对话的译者会话"且接受宿主默认模型时才走 CLI 子会话路线（**模型不可选**，详见该 skill 坑表）。
  **未经用户确认不得派发**；
- 用户自己译 → 按本阶段交付说明等待回传。
两条路的产出形态完全一致（`zh\` 内同名文件、只填 `zh`），阶段 3 之后的流程不分支。
> AI 在阶段 2 的职责是：答疑、补术语（更新第 7 份）、按需**在已交付的分片内**补条目——
> **补条目不要新建第 6 个 shard**，加进最接近的那一片并同步 `worklist_index.json`。

## 阶段 3 · 注入（AI 做，用户译完后）

**0. 先收产物**：从 `worklist\zh\` 取译者回传的已填清单（文件名与上一级待译清单一致）。
**以 `zh\` 里的版本为准**；下一级同名文件只是待译原件。
若 `zh\` 里只有部分分片 → **只处理已到位的那几份**，其余明确告知"还没收到，本次不注入"
（不要拿空 `zh` 去注入——空值会写出空字符串，比漏译更糟）。

执行 `starsector-mod-localization-apply`：

1. 自检：空 `zh` = 0；字段结构未被改。**「有意保留原文」的约定写法 = `zh` 与 `en`/`c` 逐字相同**（逻辑键、引擎 ENUM 等），注入会自动跳过。
2. **★前置断言**（铁律 R15，**写入前必做**）：
   `node <skills>\shared\scripts\check_install_source.js <modRoot> <EN原版备份>`
   不通过 = 目标目录已汉化过 → **先还原英文原版再注入**（否则合成字段被追加 → 一行变两行 → 启动崩溃）。
3. 数据层按结构类型回填（CSV 状态机 / **rules `options` 结构级重建（R13）** / 伪 JSON 文本替换 / `.faction` / 变体 / 舰名 / 任务源码 / **`mod_info` 的 name·description** / **changelog 的 `changelog@<行号>` 分段块**）。
4. 若 jar 层有条目：`patchdir.js` + `rezip.js`（**铁律 R7 标识符绝不可译**、**R12 逻辑键绝不可译**、R9 正斜杠），必要时同步 `out\production`。
5. 安装到 `mods\<Mod>\`，jar 备份 `*.orig`，装后做 SHA-256 比对。

跑完立刻过一遍闸门（`-apply` §3）：`check_options_structure.js` / `scan_data_stragglers.js` /
`scan_logic_keys.js` / `check_jar_patch_integrity.js` 是四道常跑的，**别漏**。
另两道**极易漏但代价高**：
`check_designtype.js`（R16：设计类型名有**三通道** —— `settings.json` 的 `designTypeColors` **键** +
`ship_data.csv`/`weapon_data.csv` 的 `tech/manufacturer` **全列**，三者都不是 recipe 列，漏一处就**静默不上色**）；
`check_eol.js`（R17：整文件重写 CSV 必须**保持该文件自己的行尾风格**，硬编码 CRLF 会改风格且
`cmp_csv_struct.js` 查不出来）。
再加一道**专治"船插分类显示列"**的闸门：
`check_uitags_zh.js`（`hull_mods.csv` 的 `uiTags` 是**显示列**，引擎不查任何注册表 ⇒ 英文标签就是分类名英文；
**迁移/重译时极易被上游英文原文覆盖**，2026-09-18 全库普查 17/27 个 mod 中招，共 113 处。
只处理这一个问题的**独立提示词**见 `workflows\prompt-船插分类汉化.md`）。

> **译者后续修订**（交付后译者又发新版清单，v2/v3 迭代）：不要重走本文件阶段 3，
> 直接走 `workflows\wf-apply-revision.md`（含验收/规范化/EN 基线还原/轮次对齐检查的固化循环）。。

## 阶段 4 · 验证（AI 做）

执行 `starsector-mod-localization-verify`：

- **G2** 内容完整（`check_content.js`）
- **G3** 数据层字节安全（`check_encoding.js` / `check_csv_quotes.js` / **`check_eol.js`（R17 行尾风格）** / **`check_options_structure.js`（R13）** / `check_rules_arg_quotes.js` / `check_font_glyphs.js` / `check_homoglyphs.js` / **`check_designtype.js`（R16/R10：分类名静默降级）** / `verify_all_data.js` / **`scan_data_stragglers.js`（R14）** / **`cmp_csv_struct.js` + `cmp_csv_cells.js`（结构等价 + 差异格全登记）**）
- **G4** jar 安全（`verify_identifiers.js` / **`scan_logic_keys.js`（R12）** / `check_u0001.js` / `verify_u0001_jar.js` / **`check_jar_patch_integrity.js`** / **`check_jar_stragglers.js`（对着交付 jar 跑；`scan_stragglers.js` 只吃 .class 目录，易扫到补丁前副本 → 假警报）** / `sweep_sentences.js`）
- **G5** 引用与类加载（`check_refs.js` / `check_assets.js` / `check_sprites.js` / `LoadTest`）
- **G6** 装船目检（游戏内逐路径）

任一层不过 → 回阶段 3 修 → 重跑该层（**不要**跳过）。

> **崩了怎么办**：启动期崩溃（`Fatal` / `ExceptionInInitializerError`）走 `workflows\wf-launch-audit.md`
> 的查表流程（R12/R13/R15 是最常见的三个成因），**别**通读 40MB 日志。

## 阶段 5 · 交付

**先跑一次轻烟测**（仅打开游戏，`smoke_run.ps1 -ModIds <modId>`，不带 `-NewGame`；
①②的烟测到这一档为止，**不做建存档烟测**），PASS 后进
`starsector-mod-delivery`：结构介绍文件 → `ai\skills\`（**只放一份「征兵广告」告示 + 技能库/论坛链接，不复制任何 skill**）
→ `ai\脚本\` → `ai\en`/`ai\zh` + **`ai\zh\` 里的中英对照 Excel（从 `worklist\zh\` 原样搬运，有就搬）** +
`README_汉化说明.md` + 术语表 → git 提交 → `deliver.ps1` 打包。

## 阶段 6 · 留档（供下次复用）

`<game>\_work\mod_work\<Mod>\` 保留：各 worklist（已填）、EN→ZH 映射、术语表补充、本任务脚本、`excluded_entries.json`、
键命中报告、验证输出。**下次 mod 更新（任务②）直接复用这些文件。**

## 完成标准

- [ ] G1–G6 全通过（G4 仅在动过 jar 时要求）
- [ ] 用户已检阅译文（阶段 2 的清单返回）
- [ ] 交付 zip 已生成并自检（解压后顶层只有一个文件夹）
- [ ] 留档齐备
