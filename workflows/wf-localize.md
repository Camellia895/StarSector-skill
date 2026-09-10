# wf-localize · 汉化一个 mod（提取 → 用户汉化 → 注入）

> **任务分类 ①**。输出：可直接放进 `mods\<Mod>\` 的中文版（数据文件 + 必要时补丁后的 jar）。
> 需要读：`shared\env.md`、`shared\conventions.md`、`skills\starsector-mod-localization-extract\SKILL.md`；
> 后续按需读 `-spec` / `-content` / `-voice` / `-apply` / `-verify`。

## 适用 / 不适用

- **适用**：给某个 mod 做**首次**汉化（无旧汉化可复用）。
- **不适用**：存在旧版汉化、且本次是 mod 更新 → 走 `wf-translate-update.md`（任务②）。
- 例外：任务② 若比例 ≥ 20%（需人工全量汉化），会**移交**本流程。

## 阶段 0 · 立项（10 分钟）

1. 备份英文原版：`mods\<Mod>\` → `<game>\_work\mod_zh\<Mod>_<版本>_EN_backup`。
2. 建工作区：`<game>\_work\mod_work\<Mod>\{out, tools, verify}`。
3. 需要源码 → `starsector-repo-source`。
4. 判定翻译机制（strings 表 vs 硬编码）→ `starsector-mod-localization-extract` §0。

## 阶段 1 · 提取（AI 做）

执行 `starsector-mod-localization-extract` 全文：

- data 层 `recipe.json` → `build_data_worklist.js`；jar 层 `extract_jar_constants.js` → `analyze_jar_strings.js` → `scan_jar_sources.js` → `build_jar_worklist.js`；
- 逐条核对**易漏区 13 条**；
- 按 section 拆成**多份** worklist + `worklist_index.json` + `excluded_entries.json`。

**闸门 G1**（定义见 `shared\conventions.md` §5）：提取完整。

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

1. 自检：空 `zh` = 0；字段结构未被改。
2. 数据层按结构类型回填（CSV 状态机 / rules script 列 / 伪 JSON 文本替换 / `.faction` / 变体 / 舰名 / 任务源码）。
3. 若 jar 层有条目：`patchdir.js` + `rezip.js`（**铁律 R7 标识符绝不可译**、R9 正斜杠），必要时同步 `out\production`。
4. 安装到 `mods\<Mod>\`，jar 备份 `*.orig`，装后做 SHA-256 比对。

## 阶段 4 · 验证（AI 做）

执行 `starsector-mod-localization-verify`：

- **G2** 内容完整（`check_content.js`）
- **G3** 数据层字节安全（`check_encoding.js` / `check_csv_quotes.js` / `check_rules_arg_quotes.js` / `check_font_glyphs.js` / `verify_all_data.js`）
- **G4** jar 安全（`verify_identifiers.js` / `check_u0001.js` / `verify_u0001_jar.js` / `scan_stragglers.js` / `sweep_sentences.js`）
- **G5** 引用与类加载（`check_refs.js` / `check_assets.js` / `check_sprites.js` / `LoadTest`）
- **G6** 装船目检（游戏内逐路径）

任一层不过 → 回阶段 3 修 → 重跑该层（**不要**跳过）。

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
