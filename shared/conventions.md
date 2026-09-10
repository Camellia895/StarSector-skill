# 工作区约定 · 条目计数 · 闸门（唯一权威）

## 1. `_work` 目录约定

| 目录 | 用途 | 说明 |
|---|---|---|
| `_work\mod_src\<Mod>` | **上游源码基线** | 保持纯净 = 上游，禁止放分析/汉化产物 |
| `_work\mod_work\<Mod>\` | **本任务工作区** | 见 §1.1 最小约定 |
| `_work\mod_zh\` | **外部中文版仓库** | 见 §1.3；**只放"从外部拿到的中文版"** |
| `_work\mod_bak\` | **mod 备份区** | 见 §1.2；改动前的快照 |
| `_work\deliver\` | 交付 zip 输出 | `deliver.ps1` 默认输出目录 |
| `_work\_tools\` | 工具链 | cfr / kotlinc / maven |
| `_work\_tmp\<名字>\` | 反编译/解包/探针等**中间产物** | 绝不落在 mod 目录内 |
| `_work\_archive\` | 归档，**只移动不删除** | 废弃 skill、重复副本 |
| `_work\语料库\` | 全项目语料 | `parallel\core_parallel.plain.jsonl`（术语取证用） |

**原则**：产物留档、可回溯、可回滚；分析中间物一律 `_work\_` 下，避免被打进交付 zip。

### 1.1 `mod_work\<Mod>\` — 本任务工作区（最小约定）

**必须**有这两个子目录（其余子目录自由，按 mod 实际流程加）：

| 子目录 | 放什么 |
|---|---|
| `out\` | **所有产物**：待译清单、EN→ZH 映射、跳过的条目审计、验证输出、中间 JSON |
| `tools\` | **本次专用脚本**（跨任务复用的才进 `<skills>\shared\scripts\`） |

**自由附加**（现有项目里的实际用法，按需取用）：
`worklist\`/`recipe\`（清单与 recipe 的单列）、`verify\`（验证产物）、`jarwork\`/`jarcheck*\`（jar 解包与补丁工作区）、
`stage\`/`jars_new`/`jars_old`（分阶段产物）、`logs\`、`review\`、`analysis\`、`_api_src`（解包的 API 源码副本）。

> 存量项目（15 个）结构各异，**不强制迁移**；新任务按本节落地。
> 命名：`<mod名>` 用 mod 的目录名或 id；旧项目里 `_xxx_work` 这种下划线前缀是历史写法。

### 1.2 `mod_bak\` — mod 备份区

**放"改动前的快照"**，命名后缀表明备份时机：

| 后缀 | 含义 |
|---|---|
| `_<版本>_EN_backup` / `_<版本>_EN` | **英文原版**（汉化前的干净基线，最常用） |
| `_premerge_backup` | 合并/注入**之前**的状态 |
| `_pre_zh_backup` | 写入中文**之前**的状态 |
| `_backup_<版本>` / `_<版本>_backup` | 通用改动前备份（升级、重建 jar 等） |
| `*.jar.orig` / `_<mod>_<版本>_jar_backup` | 单个 jar 的原件（重编译/打补丁前必存） |

### 1.3 `mod_zh\` — 外部中文版仓库（**注意边界**）

**只放"从外部拿到的中文版"**，用于参考、迁移与对照：

- 社区/汉化组发布的中文版；
- 旧版汉化存档（本项目迁移时的参照物，如"某 mod 旧汉化存档版"）；
- 外部中文版原始压缩包（`.rar`/`.zip` 原样留存）。

**明确不放**（这是最容易搞错的地方）：

- ❌ **我们自己合并好的中文成品** → 只在 `_work\deliver\` 打包为 zip（+ `mods\<Mod>\` 活副本）。
  `mod_zh` 是**参照物仓库，不是产出仓库**：产出自带出处（deliver zip + git），混淆两者就分不清
  "哪个是社区版、哪个是我们做的"。
- ❌ **英文原版备份** → 归 `mod_bak`（见 §1.2）。
  现状里有 5 个 `*_EN_backup` 与 3 个 `*_backup` 落在 `mod_zh` 下，属**历史污染**；
  **不强制迁移**，但新任务不要再往 `mod_zh` 放英文备份。

### 1.4 `mod_src\<Mod>\` — 源码基线

**放源代码**，两个来源都用它：

| 来源 | 说明 |
|---|---|
| GitHub 上游仓库（fork / codeload tarball） | 走 `starsector-repo-source`；落地后 `git init` + "Import …" 根提交 + `origin` 指向 fork |
| 反编译产物 | 无源码的 mod（只有 jar）反编译得到的 `.java`；走 `starsector-jar-decompile`（CFR） |

**铁律**：`mod_src` 是**只读基线**。

- ✅ 只做：摸底、grep、diff、与安装版比对哈希、编译探测（输出到别处）。
- ❌ 不做：改文件、放汉化产物、放分析中间物、装生成物。
- 需要改动源码时 → 复制到 `mod_work\<Mod>\` 再改（保持基线可 diff 出"我们改了什么"）。

> 现状备注：`mod_src\_jar_inst`、`mod_src\_jar_repo` 是 jar 相关目录（非源码仓库），
> `Kyeltziv_Technocracy_1.9` 未 `git init`；新任务按本节落地即可。

## 2. 命名约定

- 工作清单/映射：`<用途>.json`（如 `worklist_data.json`、`old_en_zh_map.json`、`jar_constants.json`）。
- 本任务专用脚本放 `_work\mod_work\<Mod>\tools\`；**跨任务复用**的脚本才进 `<skills>\shared\scripts\`。
- 补丁/映射产物命名带层与作用域：`patch_map_<file>.json`、`skip_audit.json`。
- 备份后缀见 §1.2（`_EN_backup` / `_premerge_backup` / `_pre_zh_backup` / `*.orig`）。

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
