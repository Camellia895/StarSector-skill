# wf-apply-revision · 译版更新重注入（已汉化 mod 的迭代循环）

> **触发场景**：任务①阶段 3 交付之后，译者又交了一版（或多版）修订清单——`worklist\zh\` 里出现
> 新命名的回传件（如 `01_data_zh_v2_flora.json`）或覆盖了旧件。YRXP 实测：同日 v1→v2→v3 三轮
> （290/527 条改动），每轮步骤完全一致 ⇒ 固化本工作流。
> **不适用**：首次注入（走 `wf-localize.md` 阶段 3）。mod 上游更新本体走 `wf-translate-update.md`，**但其回传译文（用户把 `worklist\zh\` 填完/重制后）同样走本流程注入**——2026-09 armaa 实测：绕开本流程自建管线，漏跑 `check_options_structure`（R13）连续两次启动崩溃。
> **必读**：`shared\env.md`、`shared\conventions.md` §4.1（回传约定）、`starsector-mod-localization-apply`。

## 0. 验收（不写盘）

- 回传**文件名可以变**（译者常加版本/主题后缀）：按 `NN_` 前缀配对，不要求同名。
- 与原件（`worklist\NN_*.json`）逐条核对：**条目数相等 + locator（file/id/field 或 jar 的 c）序列一致**，
  不一致 = 译者增删了条目 → 让 AI 补进上一级清单，禁止直接注入。
- 统计：空 `zh` 数（必须 0）、与 `mods\<Mod>\ai\zh\`（上一已应用版）diff 出**改动规模**（写进留档）。
- **译文质量检测（MT 垃圾）**：`node <skills>\shared\scripts\check_zh_quality.js <zhDir>`
  （armaa 实测一次回传 53% 为机器翻译直翻的中英混杂 salad，人工看不完；命中 exit 1 →
  明细在 `--json` 输出，退回译者或安排重译。**专有名词/脚本字/$变量的英文保留是合法的，不算命中**）。

## 1. 机械规范化（写回 zh 清单本身，再注入）

```powershell
node <skills>\shared\scripts\normalize_zh_entries.js <zhDir>
```

一条命令处理三类"每轮都会回归"的形态（规则细节见脚本头注）：
**R1** CSV 条目弯引号 `“”`→`【】`（引擎把弯引号归一化成直引号再切列；jar/JSON/纯文本保留译者原文）、
**R3** 缺字形字（`舰艏→舰首`、全角`／→/`、`～→~`，含 jar 层）、
**R4** 不含 `%s/%d` 的条目 `%%`→`%`。
⇒ 译者重新发版会**覆盖**上一轮的规范化结果，所以本步**每轮必跑**，且必须在注入前（不是注入后补救）。

## 2. 还原英文基线（R15 路径）

已汉化目录二次注入会把合成字段追加成两行 ⇒ **先还原再注入**：

```powershell
node <skills>\shared\scripts\check_install_source.js <modRoot> <EN备份>   # 预期 FAIL（已是中文）
Copy-Item <EN备份>\* <modRoot>\ -Recurse -Force    # 原地覆盖还原：保住 .git\ 与 ai\，data/jars 回到英文
```

还原后**重打非汉化类改动**（这些不在清单里）：`mod_info.json` 的 `gameVersion`、`YRXP.version` 的
`starsectorVersion` 等版本/元信息字段。jar 会随之回到英文版（`.orig` 备份仍在），第 3 步重补丁。

## 3. 重注入

按上一轮同 mod 的成熟管线执行（脚本在 `_work\mod_work\<Mod>\tools\`；新 mod 的注入器按
`starsector-mod-localization-apply` §-1 模板改写——**YRXP 版 `inject_yrxp.js` 是最全参照**：
含 faction ranks/posts 块锚定、`designTypeColors` 键改名、Nexerelin mercConfig、Janino `.java`
字面量、rules `AddText` 引号段状态机五类扩展处理器）：

1. **非 CSV 层**：跑 mod 注入器（faction/.ship/.variant/JSON/missions/intel .java/rules）。
2. **CSV 层**：先把 14（按 mod 实际清单）个 CSV 从 EN 备份**恢复基线字节**，再
   `node <skills>\shared\scripts\fix_csv_eol.js <modRoot> <EN备份> <zhDir> <文件...>` 做 span 级重放
   （R17：保行尾风格/EOF/单元格内换行）。
3. **uiTags**：`node <skills>\shared\scripts\fix_uitags_zh.js <modRoot>` → `check_uitags_zh.js` 全过。
4. **jar**：从 04 分片重建映射 `{c: zh}` → `patchdir.js`（要求 MISSING: 0）→ 同步 jar 内嵌的任务
   descriptor/mission_text → `rezip.js` → 安装（先 `.orig` 备份，装后 SHA-256 比对）。

## 4. 轮次性对齐检查（译者重发常覆盖上一轮修正，每轮必查）

- **设计类型单元格 ↔ `designTypeColors` 键**（R16；YRXP 的「新花/新花商社」两轮复发）：
  从 05 分片键条目取 `{en: zh}`，逐格核对 `ship_data/weapon_data/hull_mods` 的 `tech/manufacturer`，
  不一致以**键为准**回写单元格并同步 zh 清单。
- **jar 白名单通道**：映射中 `APPROVED_MANUFACTURERS` 同名常量的 zh 必须与键逐字一致。
- **`SetTextHighlights` 高亮词**必须是同格 `AddText` 正文的**子串**（注意解析器读 CSV 才能拿到去转义形态；
  失配就改高亮参数并向正文对齐，两处同步：注入文件 + zh 清单）。
- **`descriptions.csv` 孤立 LF**：EN 单行/译文多行的格会引入 lone LF → 归一到文件主风格（CRLF）。
- **`%%` 残留复核**：R4 规则已管注入前；`hull_mods.csv` desc 这类**经 format** 的列 `%%` 是正确的，勿误伤。

## 5. 闸门复验（正式跑闸门请用 `run_check.js` 包装记账）

- **G3**：`check_encoding` / `check_csv_quotes`（弯引号必须 0）/ `check_eol`（残余 DIFF 逐格归因：
  多行单元格内译文合并段落属内容差异，文件级行尾风格必须与基线一致）/ `check_font_glyphs` /
  `check_designtype`（上游未注册键记为已知项放行）/ `check_uitags_zh` / `check_rules_arg_quotes` /
  `check_options_structure` / `scan_data_stragglers`（注入后目录 vs EN 备份，须 0 候选）
- **G4**：`verify_identifiers` / `check_jar_patch_integrity` / `check_jar_stragglers`（A=0 且 C=0）
- **G5（源码层）**：`check_java_equiv`（全部 .java 骨架等价）
- **烟测（轻烟测，仅打开游戏）**：本流程属**文本层重注入** ⇒ 按 `wf-smoke-first.md` 的档位表
  只跑**轻烟测**（`smoke_run.ps1 -ModIds <id>`，不带 `-NewGame`），**不做建存档烟测**；
  若本次动了 jar / 插件注册 / `settings.json` 的 plugins，则升级为**深烟测（`-NewGame`）**。

## 6. 收尾

1. `git add -A && git commit`（message 带版次与改动规模）。
2. 重打包：`deliver.ps1` → **zip 改名目标必须显式写死**（如 `mv 百合远征队.zip YRXP_<版本>_zh.zip`）。
   ⚠️ 禁用"`grep -v` 排除后 `head -1`"之类的模糊回退目标——实测会把无关包（AI War_0.4.0.zip）改名。
3. `ai\zh\` 同步：删旧版清单/对照表，放入新版 `*_zh_*.json` + 译者对照 xlsx + `jar_zh_map*.json`；
   `ai\README_汉化说明.md` 更新版次与决策记录；术语表若译者更新则替换 `ai\README_术语表.md`。
4. 留档：`_work\mod_work\<Mod>\out\交付留档_*.md` 追加轮次记录（改动规模/规范化计数/闸门结果/跳过项）。
