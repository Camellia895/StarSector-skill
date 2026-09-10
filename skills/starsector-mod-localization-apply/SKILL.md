---
name: starsector-mod-localization-apply
description: Starsector（远行星号）mod 汉化的第三阶段——把填好的待译清单（worklist）注入回 mod：CSV 按 id 列回填、注释 JSON 文本替换式回填、.faction/装配变体/舰名等特殊结构回填、jar 内硬编码字符串的类文件常量池补丁（绝不重编译、绝不改动字段/方法/类名标识符）、zip 正斜杠重打包与安装、out/production 同步。含格式符与引号的落地铁律引用、增量回填与键命中报告、失败回滚。不含翻译（译文质量见 starsector-mod-localization-content）与提取（见 starsector-mod-localization-extract）。默认用户环境与当前环境一致（游戏根 C:\game\StarSector.v0.9.8a-RC8，中文 Windows）。
---

# 注入：把译文写回 mod（数据层 + jar 层）

**职责**：清单 → mod 文件/jar 的可运行产物，且**不破坏任何字节结构**。
**上游**：`starsector-mod-localization-extract`（清单）、`starsector-mod-localization-migrate`（预填旧译）、
译文质量规范 `starsector-mod-localization-content` + `starsector-translation-voice`。
**下游**：`starsector-mod-localization-verify`（全层验证）→ `starsector-mod-delivery`。
**必读**：`<skills>\shared\env.md`、`<skills>\shared\iron-rules.md`（R1/R2/R6/R7/R8/R9 是本 skill 的命脉）、`<skills>\shared\conventions.md`。

## 0. 动手前

1. **确认所有清单 `zh` 已填**（空 `zh` = 0）——空值注入会写出空字符串，比漏译更糟。
2. **一次性备份**：`mods\<Mod>\` → `_work\mod_bak\<Mod>_<版本>_pre_zh_backup`（写入中文之前的状态）；jar 另存 `*.orig`。
3. **本任务脚本放** `_work\mod_work\<Mod>\tools\`；能复用的进 `<skills>\shared\scripts\`（先查 `script-registry.md`）。
4. **游戏必须完全退出**才能替换 jar（Windows 文件锁）。

## 1. 数据层回填（按结构类型选工具）

| 结构 | 做法 | 工具 |
|---|---|---|
| CSV（单行字段） | 按 `id` 列匹配回填指定列；写回**仅当字段含 `",` `\n` `\r` 之一才加引号**并做 `""` 转义 | `<skills>\shared\scripts\csvlib.js`（`parseCsv` + 写回）；迁移场景用 `csvtool.js migrate` |
| CSV（多行单元格） | 必须用完整状态机（原版 `hull_mods.csv` 的 `desc` 含真实换行，295 物理行 vs 152 逻辑行） | 同上，勿逐行 `split(',')` |
| rules.csv | 只回填 `text`/`options` 显示列与 `script` 列 `AddText "…"`/`$var = "…"` 的**引号内文字**，保留 `AddText`/颜色参数/`$变量` | `migrate_rules_script.js` 思路；改完必跑 R2 校验 |
| 伪 JSON | **文本替换**式（`replaceOnce(path, 原片段, 译文片段)`），保持 `#` 注释与缩进原样 | `migrate_json.js`；**严禁** `ConvertTo-Json` 回写（铁律 R8） |
| `.faction` 嵌套 | 按"行前缀 + 引号值"匹配（`"spaceSailor":{"name":"Page"}` → 换引号内值），`#` 注释行跳过 | `migrate_faction2.js` |
| `.ship`/`.skin`/`.variant` | 替换 `hullName` / `displayName` 的值文本 | 直接用 `build_data_worklist.js` 的对应 kind 反查 locator |
| 纯文本（`mission_text.txt` 等） | 整篇写回，保持段落结构 | — |
| 运行时编译源码（不在 jar 的 `.java`） | 只替换**字符串字面量内容**，保持 Java 语法、引号、`\n` | `translate_missions.js` |

**写回后立刻跑**（闸门 G3）：

```powershell
node <skills>\shared\scripts\check_encoding.js <改动目录>            # UTF-8 无 BOM、无乱码
node <skills>\shared\scripts\check_csv_quotes.js <每个 csv>          # R1 弯引号/拆列
node <skills>\shared\scripts\check_rules_arg_quotes.js <rules.csv>   # R2 参数内嵌引号（不崩溃只截断）
node <skills>\shared\scripts\check_font_glyphs.js <data目录>          # R3 缺字形 → 显示 ?
node <skills>\shared\scripts\verify_all_data.js [data根目录]          # 数据层全量易漏区复查
```

## 2. jar 层补丁（常量池替换，**绝不重编译**）

### 2.1 强制规则（铁律 R7）

只替换「**被 `CONSTANT_String` 引用、且不被任何标识符条目（`Class`/`NameAndType`/`MethodType`/`Module`/`Package`）引用**」的 Utf8 常量。
原因：字段/方法/类名在类文件里同样是 Utf8，且编译器对相同文本**复用同一个 Utf8 条目**（字段 `x` 与字符串 `"x"` 共享）。误改 → `NoSuchFieldError`/`NoSuchMethodError` 闪退。
`<skills>\shared\scripts\patcher.js` 已按此实现，**不要回退到全量替换**。

### 2.2 流程

```powershell
# 1) 解包 jar → <classDir>
# 2) 常量池安全替换（映射 = {jar 常量原文: 译文}）
node <skills>\shared\scripts\patchdir.js <mapping.json> <classDir>   # 会输出键命中报告
# 3) 重打包（条目名正斜杠，保留 META-INF/ —— 铁律 R9）
node <skills>\shared\scripts\rezip.js <classDir> <out.jar>
```

**要点**：

- **映射键必须是 jar 常量原文**（逐字符）：弯引号/撇号 U+2018–U+201D、首尾空格都要一致，否则键不命中（`patchdir.js` 的命中报告会显示未命中项）。
- **`\u0001` recipe 的数量与位置不变**（铁律 R6）；数量不一致 → 运行时 `StringConcatException`。
- **混合结构 mod（jar + `data\scripts` 源码 + `out\production` 三份并存）**：
  - `out\production\<Mod>` 的类若与 jar 内同名类**逐字节相同**（SHA-256）→ 同一编译产物，补丁 jar 后**同步补丁 `out\production`**（防兜底路径）。
  - 判定哪一层**真正生效**看日志：`Class [X] already loaded (perhaps from jar file...), skipping compilation` ⇒ **jar 优先**，源码不生效；
    某类不在 jar 但以 `.java` 存在（常见 `data\missions\*\MissionDefinition.java`）⇒ 游戏用 Janino **编译源码**，必须直接改该 `.java` 并验证可编译。
  - 以**当前 jar 实际类集合**为准，日志可能跨旧版本运行。

### 2.3 安装

- 替换 `mods\<Mod>\jars\<Mod>.jar` 前先备份；装好后与工作区补丁 jar 做 **SHA-256 比对**（确认装的是补丁版）。
- 数据文件放回 `mods\<Mod>\data\…`；`src` **不动**（除非明确要求源码级汉化）。

## 3. 闸门

**G2 译文完整**

- [ ] 空 `zh` = 0；字段结构变化 = 0；变量/占位符（`%s`/`%d`/`%%`/`\n`/`\u0001`）不匹配 = 0
- [ ] 同一英文在不同 locator 的译文按要求处理（对话/叙事按人物求异，界面术语求一致）

**G3 注入字节安全**（§1 的五条命令全过）

- [ ] 无 BOM；CSV 列数 = header；无弯引号拆列；rules script 参数内嵌引号 = 0；缺字形 = 0
- [ ] `designTypeColors` 键唯一且与 CSV 中文值精确匹配（R10）

**G4 jar 安全**（只在动了 jar 时）

```powershell
node <skills>\shared\scripts\verify_identifiers.js <classDir>     # 标识符含 CJK = 0
node <skills>\shared\scripts\check_u0001.js <mapping.json>        # \u0001 数量一致
node <skills>\shared\scripts\verify_u0001_jar.js <原jar> <新jar>   # 每个含 \u0001 常量数量一致
node <skills>\shared\scripts\scan_stragglers.js <classDir>        # 英文 UI 残留
node <skills>\shared\scripts\sweep_sentences.js <classDir>        # 句子级复查（注释夹折叠漏译）
```

- [ ] 标识符含 CJK = 0；`\u0001` 一致；句子级英文残留 = 0（仅允许 Intrinsics/SMAP/调试日志）
- [ ] 未命中键清单已逐条解释（改错键 / 该条已不存在 / 故意保留）

## 4. 回滚

| 症状 | 原因 | 处置 |
|---|---|---|
| `NoSuchFieldError`/`NoSuchMethodError`（消息为乱码） | 标识符被误改（共享 Utf8 条目，R7） | `verify_identifiers.js` 复查 → 修复映射后重打 |
| `StringConcatException: Mismatched number of concat arguments` | `\u0001` 数量被改（R6） | `check_u0001.js` 修复译文后重打 |
| 启动崩 `JSONObject["options"] not found` | CSV 被弯引号拆列（R1） | 从备份恢复该文件 → `check_csv_quotes.js` → 重做 |
| 游戏内文本在引号处截断 | rules script 参数内嵌引号（R2） | `check_rules_arg_quotes.js` → 改用 `【】` |
| 个别字显示 `?` | 缺字形（R3） | `check_font_glyphs.js` → 换同义常用字 → 重新合并 |
| `Duplicate key "xxx"`（settings.json） | JSON 键译后重复（R10） | 合并同义键，保持键唯一 |
| 悬停崩溃 `UnknownFormatConversionException` | 字面 `%` 未写成 `%%`（R4） | 修正后重跑 G3 |

回滚手段：把备份的 `jars\`、`data\`、`mod_info.json` 复制回 `mods\<Mod>\`。

## 5. 留档（供下次任务复用）

`_work\mod_work\<Mod>\` 保留：EN→ZH 映射 JSON（数据层 + jar 层）、本任务脚本、键命中报告、
`worklist_*.json`（已填）、`excluded_entries.json`。下次同 mod 更新直接复用（`conventions.md` §6）。
