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
   > 例外约定：**「有意保留原文」= `zh` 与 `en`（jar 层与 `c`）逐字相同**。注入脚本会跳过。
   > 用于逻辑键（R12）、引擎 ENUM、纯数字高亮片段等"不该译"的条目。
2. **★前置断言：目标 mod 目录必须是英文原版**（铁律 R15）：
   ```powershell
   node <skills>\shared\scripts\check_install_source.js <modRoot> <EN原版备份目录>
   ```
   对**已汉化**目录二次注入 → 替换全部失配；`options` 之类**合成字段**会把"上一次的中文"当成
   "原文"保留并**追加** → 一行变两行、optionId 重复 → **启动崩溃**（与 R13 同一路径）。
   不通过就**先还原英文原版**再注入。
3. **一次性备份**：`mods\<Mod>\` → `_work\mod_bak\<Mod>_<版本>_pre_zh_backup`（写入中文之前的状态）；jar 另存 `*.orig`。
4. **本任务脚本放** `_work\mod_work\<Mod>\tools\`；能复用的进 `<skills>\shared\scripts\`（先查 `script-registry.md`）。
5. **游戏必须完全退出**才能替换 jar（Windows 文件锁）。

## 1. 数据层回填（按结构类型选工具）

| 结构 | 做法 | 工具 |
|---|---|---|
| CSV（单行字段） | 按 `id` 列匹配回填指定列；写回**仅当字段含 `",` `\n` `\r` 之一才加引号**并做 `""` 转义 | `<skills>\shared\scripts\csvlib.js`（`parseCsv` + 写回）；迁移场景用 `csvtool.js migrate` |
| CSV（多行单元格） | 必须用完整状态机（原版 `hull_mods.csv` 的 `desc` 含真实换行，295 物理行 vs 152 逻辑行） | 同上，勿逐行 `split(',')` |
| CSV（行尾/末尾换行） | **保持每个文件自己的风格**（铁律 R17）：读原文件判断 `\r\n` 还是 `\n`，并保留"是否以换行结尾"。**别硬编码 CRLF** —— 原版核心是 CRLF，但个别 mod（San-Iris）全 LF，硬编码会把 10 个 CSV 改风格、多行单元格变混合行尾 | 自写（`const EOL = text.includes('\r\n') ? '\r\n' : '\n'`） |
| rules.csv `text`/`script` | 只回填 `text` 列整格与 `script` 列 `AddText "…"`/`$var = "…"` 的**引号内文字**，保留 `AddText`/颜色参数/`$变量`。⚠️ **needle 必须只是引号内的正文**（铁律 R18）：取成 `AddText "正文` 会把命令关键字一起替换掉，整格只剩 `"译文" 颜色参数`，**命令失效且不报错**；替换后必须断言 `AddText` 仍在 | `migrate_rules_script.js` 思路；改完必跑 R2 校验 |
| 设计类型名（收尾一遍） | 注入最后**再扫一遍** `settings.json` 的 `designTypeColors` 键 + `ship_data.csv`/`weapon_data.csv` 的 `tech/manufacturer` 全列（铁律 R16：这三处 recipe 覆盖不到，键值不一致 = 静默不上色） | 自写；改完必跑 `check_designtype.js` |
| rules.csv `text`/`script` | 只回填 `text` 列整格与 `script` 列 `AddText "…"`/`$var = "…"` 的**引号内文字**，保留 `AddText`/颜色参数/`$变量` | `migrate_rules_script.js` 思路；改完必跑 R2 校验 |
| rules.csv `options` | **合成字段，必须结构级重建**（铁律 R13）：以英文原版的**行数 + 每行 optionId**为准，只替换标签；长式（`数字:optionId:标签`）保留数字前缀；多行之间用**真实换行**（不是字面 `\n`），由写入器按 RFC4180 加引号。**行数/optionId 不符就报错并保留原文，绝不猜** | 自写（本项目 `apply_data.js` 的 `translateOptions`）；改完必跑 `check_options_structure.js` |
| 伪 JSON | **文本替换**式（`replaceOnce(path, 原片段, 译文片段)`），保持 `#` 注释与缩进原样 | `migrate_json.js`；**严禁** `ConvertTo-Json` 回写（铁律 R8） |
| `.faction` 嵌套 | 按"行前缀 + 引号值"匹配（`"spaceSailor":{"name":"Page"}` → 换引号内值），`#` 注释行跳过 | `migrate_faction2.js` |
| `.ship`/`.skin`/`.variant` | 替换 `hullName` / `displayName` 的值文本；**`.skin` 还有 `descriptionPrefix`（图鉴描述前缀，铁律 R14）与 `hullDesignation`（人可读短语才译）** | 直接用 `build_data_worklist.js` 的对应 kind 反查 locator |
| 纯文本（`mission_text.txt` 等） | 整篇写回，保持段落结构 | — |
| 运行时编译源码（不在 jar 的 `.java`） | 只替换**字符串字面量内容**，保持 Java 语法、引号、`\n` | `translate_missions.js` |

**写回后立刻跑**（闸门 G3）：

```powershell
node <skills>\shared\scripts\check_encoding.js <改动目录>            # UTF-8 无 BOM、无乱码
node <skills>\shared\scripts\check_csv_quotes.js <每个 csv>          # R1 弯引号/拆列
node <skills>\shared\scripts\check_options_structure.js <modRoot> <EN原版备份>  # ★R13 options 结构等价
node <skills>\shared\scripts\check_rules_arg_quotes.js <rules.csv>   # R2 参数内嵌引号（不崩溃只截断）
node <skills>\shared\scripts\check_font_glyphs.js <data目录>          # R3 缺字形 → 显示 ?
node <skills>\shared\scripts\verify_all_data.js <data根目录>          # 数据层全量易漏区复查
node <skills>\shared\scripts\scan_data_stragglers.js <modRoot> <EN原版备份> <worklistDir>  # ★R14 无未覆盖英文
```

## 2. jar 层补丁（常量池替换，**绝不重编译**）

### 2.0 先说结论：**优先"结构级重建"，不要自己算字节偏移**
> 本节是 Nomadic Survival 会话用两次真实事故换来的（下表），**新任务一律照此做**。

| 做法 | 结果 |
|---|---|
| ❌ 自写"字节偏移 + `indexOf` 定位"的 CSV 原地替换 | ① 多行引号单元格的段尾 `\r\n` 被算进替换范围 → **下一条记录被并进来**（整表塌成一行）；② 字段内含 `""` 转义时**闭合引号定位错位**（`SetTooltip x ""O""` 一段内引号数为奇数）→ 该行之后字段全部串行 |
| ✅ **结构级重建**：`csvlib.parseCsv` 解析 → 只改目标单元格的**值** → 用同一套规则**整文件重写**（含 `, " \r \n` 才加引号、内部 `"`→`""`、行尾统一 CRLF、**按 header 补足空单元格**） | 解析结果与英文基线**逐格等价**，这条是可用脚本证明的硬保证 |

**理由**：字节偏移方案要同时正确实现"引号开关 / `""` 转义 / 行内换行 / 行尾 CRLF / 引号边界"五件事，任何一件算错都**静默**破坏结构（引擎侧表现为启动崩 `JSONObject["options"] not found`，但脚本不报错）。
结构级重建把"正确性"降到只有一条规则（解析器自己的一致口径），且**重写结果可被解析器验证**。

**配套两条验证（缺一不可，§3 G3 里列了命令）**：
1. `cmp_csv_struct.js`：基线 vs 注入后的**物理行数、解析数据行数、每行单元格数、id 序列**必须全同；
2. `cmp_csv_cells.js`：差异格清单必须与待译清单**逐条对得上**（未登记差异 = 0）。

**例外**：`rules.csv` 的 `script`/`options` 列是"格内子串替换"（格内还有命令、`$变量`、颜色参数），
重建时只改格内那段文本，其余字节不动 —— 但**仍在结构级重建的框架内**（值改了，整文件仍由同一套规则重写）。
`script` 列里 needle 若含 `"`，在**显式带引号的格**里原文写作 `""`（`SetTooltip x ""文字""`），
needle 要按 `""` 形态匹配（先试原样、再试引号加倍），译文里也按同样规则转义。

### 2.1 强制规则（铁律 R7）

只替换「**被 `CONSTANT_String` 引用、且不被任何标识符条目（`Class`/`NameAndType`/`MethodType`/`Module`/`Package`）引用**」的 Utf8 常量。
原因：字段/方法/类名在类文件里同样是 Utf8，且编译器对相同文本**复用同一个 Utf8 条目**（字段 `x` 与字符串 `"x"` 共享）。误改 → `NoSuchFieldError`/`NoSuchMethodError` 闪退。
`<skills>\shared\scripts\patcher.js` 已按此实现，**不要回退到全量替换**。

> **两种 R7 的"必须例外"与"必须拒绝"**（实测，详见 `starsector-mod-java-hardcoded-text` §2.4）：
> - **枚举常量名同时被当界面文字显示**（`Enum.name()` / 构造参数与常量名同字面量，如 `TabID.Fuel`、`VulnerabilityLevel.Protected`）
>   → 需要"枚举名整体重命名"的**白名单例外**，否则整片界面留英文；判定与安全前提见该 skill。
> - **显示文本与局部变量/字段同名** → 只能改源码，补丁器会（正确地）跳过，别硬改。
>
> **"文本写死在 Java 源码里"的 mod（纯 Java 工具向 mod，如 RTSAssist）走专章**：
> `starsector-mod-java-hardcoded-text`。那里有"有源码也不该贸然重编译"的实测证据（javac 21+ 改变 enum switch
> 编译方式 ⇒ 31 个类结构漂移）、**流式条目 jar 必须走中央目录解析**的坑、`patchClass` 值必须是
> `encodeModifiedUtf8` 字节、以及"字面量与局部变量同名会被静默跳过（`modID` 实例）"的边界与处置。
> 本节只讲通用流程，别把"有源码就重编译"当默认路线。

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
- [ ] **结构等价（重建法必跑）**：`cmp_csv_struct.js` 基线 vs 注入后 → 物理行数 / 解析数据行数 / 每行单元格数 / id 序列**全同**
- [ ] **差异格核对**：`cmp_csv_cells.js` → 未登记差异 = 0（差异格清单与待译清单逐条对得上）
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
