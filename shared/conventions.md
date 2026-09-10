# 工作区约定 · 条目计数 · 闸门（唯一权威）

## 1. `_work` 目录约定

| 目录 | 用途 | 说明 |
|---|---|---|
| `_work\mod_src\<Mod>` | **上游源码基线** | 保持纯净 = 上游，禁止放分析/汉化产物 |
| `_work\mod_work\<Mod>\` | **本任务工作区** | `out\`（映射/清单）、`tools\`（本次专用脚本）、`verify\`（验证产物） |
| `_work\mod_zh\<Mod>_<版本>_EN_backup` | **英文原版备份** | 汉化/改动前的基线 |
| `_work\mod_bak\<Mod>_<版本>_backup` | 改动前备份（编译/升级场景） | jar 另存 `*.orig` |
| `_work\deliver\` | 交付 zip 输出 | `deliver.ps1` 默认输出目录 |
| `_work\_tools\` | 工具链 | cfr / kotlinc / maven |
| `_work\_tmp\<名字>\` | 反编译/解包等**中间产物** | 绝不落在 mod 目录内 |
| `_work\_archive\` | 归档，**只移动不删除** | 废弃 skill、重复副本 |
| `_work\语料库\` | 全项目语料 | `parallel\core_parallel.plain.jsonl`（核心中英平行语料，术语取证用） |

**原则**：产物留档、可回溯、可回滚；分析中间物一律 `_work\_` 下，避免被打进交付 zip。

## 2. 命名约定

- 工作清单/映射：`<用途>.json`（如 `worklist_data.json`、`old_en_zh_map.json`、`jar_constants.json`）。
- 本任务专用脚本放 `_work\mod_work\<Mod>\tools\`；**跨任务复用**的脚本才进 `<skills>\shared\scripts\`。
- 补丁/映射产物命名带层与作用域：`patch_map_<file>.json`、`skip_audit.json`。

## 3. 条目计数口径（任务2 分流用）

**分母与分子都只计"需要汉化的可见文本条目"。**

计入条目：数据层 UI 文本（`name`/`desc`/`short`/`tech`/rules 的 `text`·`options`·script 参数、variants `displayName`、
faction 显示名/舰队名/官职名、`tips.json`、`descriptions.csv`…）、jar 层 UI 文本、任务/对话/叙事文本、配置注释中面向玩家的部分。

**不计入条目**（长短不论，直接排除）：
- 超短字段：**舰船名、军官名、人名**、单个专有名词、单位/缩写（`CR`/`PPT`）；
- 标识符：mod id、插件 id、script 类名、配置键与枚举值、图标路径、URL；
- 引擎常量：`personality=reckless/…`、`TEN_PERCENT_PPT` 等代码匹配键；
- 纯数字/占位符/符号行；空白与注释行（开发者说明）。

> 排除要**写清单留档**（`excluded_entries.json`：locator + 排除理由），便于复核口径。

**比例 R = 待译新条目数 ÷ 需汉化总条目数**（`需汉化总 = 旧译可复用条目 + 待译新条目`）。
同一 mod 若同时有"新增文件"与"改动词条"，两者都计入分子。

## 4. 待译清单（worklist）标准形态

一份 worklist = 一个 JSON 数组，每项：

```json
{
  "locator": "data/hullmods/hull_mods.csv#row=42&col=desc",
  "file": "data/hullmods/hull_mods.csv",
  "line": 42,
  "field": "desc",
  "en": "Original English text",
  "zh": "",                  // 人工/AI 译文；旧译迁移时预先落位
  "source": "new",           // new | old-migrated | untranslated
  "note": "上下文/来源/风险提示"
}
```

- **`locator` 必须唯一且可回填**（注入脚本只认它）；jar 层条目用 `c` 键存 **jar 常量原文（逐字符）**并替代 `en`。
- `zh` 留空 = 待译；`source` 标明该条是"新增"还是"旧译迁移"。
- 允许**拆成多份**清单（按文件/section/目录分片），但每份都要能被同一注入流程消费；分片索引写在 `worklist_index.json`。

## 5. 闸门（Gate）：每个都要有可复现的命令与通过标准

| 编号 | 闸门 | 工具 | 通过标准 |
|---|---|---|---|
| **G1** | 提取完整 | `build_data_worklist.js` / `build_jar_worklist.js` + 人工核对易漏区 | 每个 section 都有清单；易漏区逐条核对过 |
| **G2** | 译文完整 | 清单自检 + `check_content.js` | 空 `zh` = 0；字段结构变化 = 0；变量/占位符不匹配 = 0 |
| **G3** | 注入字节安全 | `check_csv_quotes.js` / `check_rules_arg_quotes.js` / `check_font_glyphs.js` / `verify_all_data.js` | 全部 0；无 BOM；CSV 列数 = header |
| **G4** | jar 安全 | `verify_identifiers.js` + `check_u0001.js` + `verify_u0001_jar.js` + `patched` 漏译扫描 | 标识符含 CJK = 0；`\u0001` 数量一致；句子级英文残留 = 0 |
| **G5** | 类加载 / 引用完整 | `LoadTest.java` / `check_refs.js` / `check_assets.js` / `check_sprites.js` | 代表类全通过；引用问题 0（已知假阳性除外） |
| **G6** | 装船目检 | 游戏内逐路径 | tooltip / refit / 战斗消息 / 模组列表 文案正常，日志无新增 `at data.scripts` 或 ERROR |

> G1–G3 是**汉化**必经；G4 只在动 jar 时必过；G5 在编译/升级/改引用时必过；G6 交付前必做。
> 崩溃排查入口见 `wf-diagnose.md`。

## 6. 增量复用

- 每次任务结束**必须留档**：EN→ZH 映射 JSON、术语表补充、`excluded_entries.json`、全部本次脚本，
  放 `_work\mod_work\<Mod>\`。
- 下次同 mod 更新（任务2）**直接复用**这些映射：按 `locator`/id 匹配 → `en` 未变则复用旧 `zh`；
  `en` 变了才进"待译新条目"并计入 R。
- 术语表只增不改语义：新词写进 `<skills>\shared\glossary.md`（+ `glossary.json`），标注来源
  （核心 grep / 社区习惯 / 自定）。

## 7. 上下文节约纪律

1. 一次任务**按序**读：`00-索引.md` → 1 个 `workflows\wf-*.md` → 它点名的 2–4 个 skill/shared 文件。
2. **禁止**通读 `skills\` 整个目录；**禁止**把 `shared\env.md` 的内容复制进别的文件。
3. 需要别的 skill 的能力时**引用它**，不要内联它的步骤。
4. 引用语法统一：`<skills>\shared\env.md`、`<skills>\shared\scripts\xxx.js`、
   skill 名直接用其 `name`（如 `starsector-mod-localization-extract`）。
