# 提示词 · 单独解决「mod 汉化了但船插类型（分类）还是英文」

> **用途**：直接复制下面「提示词正文」给 AI（或作为 skill 的入口提示）。只处理**一个问题**：
> `data\hullmods\hull_mods.csv` 的 **`uiTags`（船插分类显示列）** 没汉化。
> 机理、工具、坑、验收标准全都写在里面，不需要 AI 再摸索。
> 相关：`workflows\wf-localize.md`（阶段 3 闸门）、`skills\starsector-mod-localization-extract\SKILL.md` §2 第 14 条、
> `shared\script-registry.md` D 节、`shared\glossary.md` 核心词表。

---

## 提示词正文（复制以下全部）

你是远行星号（Starsector）mod 汉化工程师。本任务**只做一件事**：把 mod 的**船插类型（分类）**汉化掉。

### 0. 环境（本机事实，别改）

- 游戏根：`C:\game\StarSector.v0.9.8a-RC8`（核心在 `starsector-core\`，mod 在 `mods\`）
- 技能库：`C:\game\StarSector.v0.9.8a-RC8\_work\skills`（先读 `00-索引.md`、`shared\env.md`、`shared\conventions.md`）
- 备份区：`C:\game\StarSector.v0.9.8a-RC8\_work\mod_bak\`（**禁止**把备份放进 mod 目录）
- 工作区：`C:\game\StarSector.v0.9.8a-RC8\_work\mod_work\<Mod>\{out,tools,verify}\`

### 1. 机理（**先理解，否则必改错**）

- 船插的分类标签来自 `data\hullmods\hull_mods.csv` 的 **`uiTags`** 列。
- **该列是"显示列"：引擎把它的值（英文逗号切分为多个标签）直接显示在装配界面/百科的船插分类里，
  不查任何注册表、不报错、不打日志。** 写英文就是英文。
- **因为它是显示列，它的"正确译文"只有唯一权威来源：核心中文
  `starsector-core\data\hullmods\hull_mods.csv` 同列用词**（EN→ZH 一一对应，见 §3 映射表）。
  不要自行发明新词，不要跟其它 mod 对齐。
- 空 `uiTags` 是**合法**的（= 该船插没有分类标签），**不要**猜译填空。

### 2. 先普查（取证，不猜）

```powershell
cd C:\game\StarSector.v0.9.8a-RC8\_work\skills\shared\scripts
# 全库普查：哪些 mod 有英文/未知标签，按标签聚合 + 按 mod 汇总
node survey_uitags.js "C:\game\StarSector.v0.9.8a-RC8\mods"
# 单个 mod 体检（有英文标签则 exit 1）
node check_uitags_zh.js "C:\game\StarSector.v0.9.8a-RC8\mods\<Mod>" --json="C:\game\StarSector.v0.9.8a-RC8\_work\mod_work\<Mod>\out\uitags_before.json"
```

同时确认"这个 mod 是否真的汉化过"（避免去改英文原版 mod 的分类）：

```powershell
node survey_mods_lang.js "C:\game\StarSector.v0.9.8a-RC8\mods"   # CJK 占比 < ~60% 的多半是英文 mod，先问用户
```

### 3. 映射表（**核心权威词表，逐字照抄**）

| 英文标签（uiTags 原值） | 中文 | 备注 |
|---|---|---|
| `Weapons` | 武器 | |
| `Special` | 特殊 | |
| `Logistics` | 后勤 | |
| `Requires Dock` | 需要船坞 | |
| `Defenses` | 防御 | |
| `Shields` | 护盾 | |
| `Engines` | 引擎 | |
| `Fighters` | 战机 | |
| `Phase` | 相位 | |
| `Support` | 支援 | |
| `Require Dock` | 需要船坞 | 上游拼写变体（漏 s），语义同 `Requires Dock` |
| `Logistic` | 后勤 | 上游拼写变体（漏 s） |

**不在表里的英文标签**属两种情况，**默认都不改**：
1. 作者自定分类：`Unique` / `DEVTOOL` / `Utility` / `Test` … ⇒ 保留原文，**列给用户定夺**
   （`DEVTOOL` 这类是功能分组，汉化反而破坏作者的归类；`Utility`≠`Support`，不要合并）。
2. 拼写变体（确认语义等于表中某项）⇒ 用 `--ext-map` 显式追加，不要偷偷改。

### 4. 注入（**用定点替换，不要整体重建文件**）

```powershell
cd C:\game\StarSector.v0.9.8a-RC8\_work\skills\shared\scripts
# ① 预演（必做）
node fix_uitags_zh.js "C:\game\StarSector.v0.9.8a-RC8\mods\<Mod>" --dry

# ② 写盘 + 逐 mod 备份（备份到 _work\mod_bak\uitags_fix\<Mod>\hull_mods.csv，已存在则不覆盖）
node fix_uitags_zh.js "C:\game\StarSector.v0.9.8a-RC8\mods\<Mod>" --backup

# ③ 自定义标签确认要汉化时（例）
#    写 ext_map.json: {"Unique":"独特","Utility":"通用辅助"}
node fix_uitags_zh.js "...\mods\<Mod>" --backup --ext-map=...\ext_map.json
```

**为什么必须用这个脚本、不能自己 parse→序列化整个 CSV**：
多个 mod 的 `hull_mods.csv` 是**混合行尾**（实测 Kayse Phase Ships：7×CRLF + 20×LF，引号内多行字段是 LF）。
整体重建会把行尾统一 ⇒ 违反铁律 R17，`check_eol.js` 红灯。本脚本做**字节级定点替换**
（状态机定位目标单元格的 `[start,end)`，只改那一段），行尾风格、字段引号风格、注释行全部原样保留。

### 5. 验收（全部必须过；不通过就回滚重来）

```powershell
$sk  = "C:\game\StarSector.v0.9.8a-RC8\_work\skills\shared\scripts"
$mod = "C:\game\StarSector.v0.9.8a-RC8\mods\<Mod>"
$bk  = "C:\game\StarSector.v0.9.8a-RC8\_work\mod_bak\uitags_fix"

# ① 目标格 / 结构 / 行尾 三合一复核（备份目录 vs 当前）
node "$sk\verify_uitags_fix.js" $bk $mod
# ② 闸门复扫：该 mod 应"全部通过"；若仍有命中，只允许是作者自定标签
node "$sk\check_uitags_zh.js" $mod
# ③ 编码 / 结构 / 行尾（共享闸门）
node "$sk\check_encoding.js" "$mod\data"
node "$sk\check_eol.js" (Join-Path $bk (Split-Path $mod -Leaf)) "$mod\data\hullmods"
```

通过标准：
- `check_uitags_zh.js` = **0 可疑**（或剩余项全都是"已向用户报备的自定标签"）
- `verify_uitags_fix.js` = **差异格 > 0、EOL 一致、结构一致、非词表标签 0**
- `check_encoding.js` = BOM 0 / 非法 UTF-8 0
- 若 mod 目录有 `.csv.json` 探针副本，脚本会自动同步；没有就不要新建

### 6. 交付与留档

1. 有 `git` 的 mod：`git add -A && git commit -m "汉化修复：船插分类(uiTags)英→中 N 处"`（工作树保持干净）。
2. 把变更清单（`--json` 产出的 `changes`）落 `_work\mod_work\<Mod>\out\uitags_fix.json`，
   并在该 mod 的 `ai\` 下追加一条修复记录（如 `ai\README_汉化说明.md` 的修复表 + `ai\zh\` 语料）。
3. 需要交付 zip 时走 `skills\starsector-mod-delivery\scripts\deliver.ps1`（包名带版本号，见 `conventions.md` §1.5）。
4. **不要**顺手改别的东西（分类显示列之外的字段一律不碰）。

### 7. 红线（违反即返工）

1. ❌ 不查核心词表就自创中文分类名。
2. ❌ 填/猜空的 `uiTags`。
3. ❌ 汉化作者自定标签（`DEVTOOL`/`Unique`/`Utility`…）而不先问用户。
4. ❌ 整体 parse→写回 CSV（混合行尾会被抹平，R17）。
5. ❌ 动 `.csv.json` 之外的开发残留、动 jar、动 `settings.json`（那是 R16 的 `designTypeColors`，另一个问题）。
6. ❌ 把备份放进 mod 目录（`_work\mod_bak\` 才是备份区）。

### 8. 汇报格式（完成后按此回话）

- 受检 mod 数 / 改动 mod 数 / 替换标签数 / 变更行数
- 逐 mod 一行：`<Mod>：<N> 处（<标签 EN→ZH 列表>）`
- 未改动但仍有英文标签的 mod 及原因（作者自定 / 英文原版 mod 未汉化）
- 验收四条的实测数字 + 备份路径

---

## 附：一次真实战役的数据（2026-09-18，作为量级参照）

- 全库 27 个含 `hull_mods.csv` 的 mod，**17 个有英文标签、共 113 处**；
- 实际写盘 **16 个 mod / 98 行 / 113 个标签**（1 个 mod 的标签是作者自定中文，无需改）；
- 典型中招：`EptaConsortium`（15 行）、`Random-Assortment-of-Things`（30 行）、`Nightcross`（18 行）、
  `人之领相位研究所`（9 行）、`Kayse Phase Ships`（6 行）、`Roider Union`（6 行）；
- 全部 16 个 mod 复核结果：差异格 > 0、**EOL 一致**、结构一致、非词表标签 0；
- 未改的 23 处全部是作者自定标签（`DEVTOOL`×10、`Unique`×9、`Utility`×4）。
