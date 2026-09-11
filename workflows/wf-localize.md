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
4. 判定翻译机制（strings 表 vs 硬编码）→ `starsector-mod-localization-extract` §0。

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
- 逐条核对**易漏区 13 条**；
- 按 section 拆成**多份** worklist + `worklist_index.json` + `excluded_entries.json`。

**闸门 G1**（定义见 `shared\conventions.md` §5）：提取完整 —— 含上面反向网 **0 候选**。

## 阶段 2 · 交给用户汉化（**本流程的关键交接点**）

向用户交付的**必须包含**（缺一项都会让用户多问一轮）：

1. **清单文件路径**（多份就列全部）+ 每份覆盖范围与**条目数**；
2. **定位方式说明**：每条 = `locator` / `file` / `id` / `field` / `line`(参考) / `en` / `zh`(留空) / `note`(上下文)，
   **只填 `zh`，其余字段不动**（否则注入会失败）；
3. **术语与风格入口**：`shared\glossary.md`（已含核心译名与铁律摘要）；
4. **动笔前必读**：`starsector-mod-localization-spec`（占位符 `%`→`%%`、`\u0001`、CSV 引号、禁 `「」` 用 `【】`）；
5. **长文本特别说明**：对话/人物/叙事类条目按 `starsector-translation-voice` 处理（可脱离原文句式）；
6. **故意不译的区域**及理由（如 LunaSettings Radio 选项值、引擎常量、原版副本角色表）；
7. **建议翻译顺序**：先术语密集区（hullmods / ship_data / faction）建立术语一致性，再 rules/任务/对话。

> 用户身份是**译者**：AI 不得代填正文（`translation-voice` 的"程序使用限制"）。
> AI 在阶段 2 的职责是：答疑、补术语、按需再切片或拆分清单。

## 阶段 3 · 注入（AI 做，用户译完后）

执行 `starsector-mod-localization-apply`：

1. 自检：空 `zh` = 0；字段结构未被改。**「有意保留原文」的约定写法 = `zh` 与 `en`/`c` 逐字相同**（逻辑键、引擎 ENUM 等），注入会自动跳过。
2. **★前置断言**（铁律 R15，**写入前必做**）：
   `node <skills>\shared\scripts\check_install_source.js <modRoot> <EN原版备份>`
   不通过 = 目标目录已汉化过 → **先还原英文原版再注入**（否则合成字段被追加 → 一行变两行 → 启动崩溃）。
3. 数据层按结构类型回填（CSV 状态机 / **rules `options` 结构级重建（R13）** / 伪 JSON 文本替换 / `.faction` / 变体 / 舰名 / 任务源码）。
4. 若 jar 层有条目：`patchdir.js` + `rezip.js`（**铁律 R7 标识符绝不可译**、**R12 逻辑键绝不可译**、R9 正斜杠），必要时同步 `out\production`。
5. 安装到 `mods\<Mod>\`，jar 备份 `*.orig`，装后做 SHA-256 比对。

跑完立刻过一遍闸门（`-apply` §3）：`check_options_structure.js` / `scan_data_stragglers.js` /
`scan_logic_keys.js` / `check_jar_patch_integrity.js` 是本轮新增的四道，**别漏**。

## 阶段 4 · 验证（AI 做）

执行 `starsector-mod-localization-verify`：

- **G2** 内容完整（`check_content.js`）
- **G3** 数据层字节安全（`check_encoding.js` / `check_csv_quotes.js` / **`check_options_structure.js`（R13）** / `check_rules_arg_quotes.js` / `check_font_glyphs.js` / `check_homoglyphs.js` / `verify_all_data.js` / **`scan_data_stragglers.js`（R14）**）
- **G4** jar 安全（`verify_identifiers.js` / **`scan_logic_keys.js`（R12）** / `check_u0001.js` / `verify_u0001_jar.js` / **`check_jar_patch_integrity.js`** / `scan_stragglers.js` / `sweep_sentences.js`）
- **G5** 引用与类加载（`check_refs.js` / `check_assets.js` / `check_sprites.js` / `LoadTest`）
- **G6** 装船目检（游戏内逐路径）

任一层不过 → 回阶段 3 修 → 重跑该层（**不要**跳过）。

> **崩了怎么办**：启动期崩溃（`Fatal` / `ExceptionInInitializerError`）走 `workflows\wf-launch-audit.md`
> 的查表流程（R12/R13/R15 是最常见的三个成因），**别**通读 40MB 日志。

## 阶段 5 · 交付

`starsector-mod-delivery`：结构介绍文件 → `ai\skills`/`ai\脚本` → `ai\en`/`ai\zh` + `README_汉化说明.md` + 术语表 →
git 提交 → `deliver.ps1` 打包。

## 阶段 6 · 留档（供下次复用）

`<game>\_work\mod_work\<Mod>\` 保留：各 worklist（已填）、EN→ZH 映射、术语表补充、本任务脚本、`excluded_entries.json`、
键命中报告、验证输出。**下次 mod 更新（任务②）直接复用这些文件。**

## 完成标准

- [ ] G1–G6 全通过（G4 仅在动过 jar 时要求）
- [ ] 用户已检阅译文（阶段 2 的清单返回）
- [ ] 交付 zip 已生成并自检（解压后顶层只有一个文件夹）
- [ ] 留档齐备
