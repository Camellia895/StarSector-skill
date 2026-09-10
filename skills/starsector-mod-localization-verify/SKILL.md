---
name: starsector-mod-localization-verify
description: Starsector（远行星号）mod 汉化的验证环节——把"看起来译完了"变成"逐层证明没坏"。统一执行闸门 G2/G3/G4/G5：内容自检（空译文/占位符不匹配/字段结构变化）、数据层字节安全（BOM/CSV 引号/rules 参数内嵌引号/字库字形/designTypeColors 键）、jar 安全（标识符含 CJK/\u0001 一致/漏译句子级扫描）、引用与类加载（LoadTest/装配/贴图/精灵/废弃成员）、装船目检与崩溃速查表。可作为独立复审 skill 用于验收别人的汉化产物。默认用户环境与当前环境一致（游戏根 C:\game\StarSector.v0.9.8a-RC8，中文 Windows）。
---

# 验证：逐层证明汉化没坏

**职责**：独立复审。输入是**已注入的产物**（data + jar），输出是"每层通过/不通过 + 证据"。
**调用方**：`wf-localize.md`、`wf-translate-update.md` 的收尾；也用于验收他人的汉化包。
**必读**：`<skills>\shared\conventions.md`（闸门定义）、`<skills>\shared\script-registry.md`（D 节）、
`<skills>\shared\iron-rules.md`（每条校验对应哪条铁律）。

## 0. 原则

- **每一层都要有可复现命令与通过标准**，不接受"我看了一遍没问题"。
- 已知**假阳性**要预先排除（列在 §4），否则会为了"修假 bug"改坏真东西。
- 校验只读：发现问题 → 回到 `starsector-mod-localization-apply` 修 → 重跑本流程。
- **跑校验一律用 `run_check.js` 包装**（退出码自动记账；默认不透传子命令输出，省上下文）。
  **别直接 `node xxx.js`**，否则这条校验的历史票会丢：

  ```powershell
  node <skills>\shared\scripts\run_check.js --check=<校验名> --expect-args=<N> --target=<Mod> -- <原命令...>
  ```

  退出码约定：`0` = clean（减票）/ `1` = hit（加票）/ `2+` = 调用错误（**不计票**）。
  **`--expect-args=<N>` 要填**（只数脚本自身参数）：部分脚本在参数不足时也返回 1
  （实测 `verify_identifiers.js`），不声明的话一次错误调用会被记成"命中"，
  把这条校验的价值虚高——详见 `shared\verification-ledger.md` §7.1。
- 档位（每次跑 / 抽样 / 休眠）见 `<skills>\shared\verification-ledger.md`：`base` 必跑、
  `cond` 在对应场景存在时跑、`sample`/`dormant` 本次可以不跑。

## 1. G2 内容完整

```powershell
node <skills>\shared\scripts\run_check.js --check=check_content.js --target=<Mod> -- `
     node <skills>\skills\starsector-mod-localization-content\scripts\check_content.js <worklist.json...>
```

- [ ] 空 `zh` = 0
- [ ] 字段结构变化 = 0（除 `zh` 外不改任何字段：`file`/`id`/`field`/`line`/`locator`/`c`/元数据）
- [ ] 占位符与变量不匹配 = 0：`%s`/`%d`/`%%`/`\n`/`\u0001`/`%PLAYER_NAME`/`%LORD_NAME`/`%c0`
- [ ] `%s`/`%d` 有对应传参（没有传参就不要写占位符）；字面 `%` 写成 `%%`（铁律 R4）
- [ ] 应同步的重复项一致（同 EN 按约定求同或求异，见 `content` §1）
- [ ] 与旧版汉化的差异已记录（有意不沿用/有意修正）

## 2. G3 数据层字节安全

```powershell
node <skills>\shared\scripts\check_encoding.js <改动目录>             # UTF-8 无 BOM、无乱码（铁律：env.md §3）
node <skills>\shared\scripts\check_csv_quotes.js <每个 csv>           # R1 弯引号 → 拆列崩溃
node <skills>\shared\scripts\check_rules_arg_quotes.js <rules.csv>    # R2 命令参数内嵌引号 → 静默截断
node <skills>\shared\scripts\check_font_glyphs.js <data目录>           # R3 缺字形 → 显示 ?
node <skills>\shared\scripts\verify_all_data.js [data根目录]           # 易漏区全量复查
```

- [ ] 无 BOM（`.json`/`.csv`/`.version`/`.faction` 逐个抽查前 3 字节）
- [ ] CSV 列数 = header；无 `""` 拆列；多行单元格解析正确（完整状态机）
- [ ] rules script 列：弯引号 = 0、严格结构问题 = 0、疑似内嵌引号行 = 0
- [ ] 缺字形字符种类 = 0 / 总出现 = 0
- [ ] `verify_all_data.js` 全部通过（LunaSettings Text/Header/Radio、variants `displayName`、
      faction 舰队/官职名、`designTypeColors` 键唯一且与 CSV 匹配、`custom_entities`、`customStarts`）
- [ ] 伪 JSON 用宽松解析验证过（`JsonProbe.java`），**没有**用严格解析器判死刑（铁律 R8）

## 3. G4 jar 安全（动过 jar 才做）

```powershell
node <skills>\shared\scripts\verify_identifiers.js <classDir>          # 标识符含 CJK = 0（铁律 R7）
node <skills>\shared\scripts\check_u0001.js <mapping.json>             # \u0001 数量一致（R6）
node <skills>\shared\scripts\verify_u0001_jar.js <原jar> <补丁jar>      # 每个含 \u0001 常量数量一致
node <skills>\shared\scripts\scan_stragglers.js <classDir>             # 英文 UI 残留
node <skills>\shared\scripts\sweep_sentences.js <classDir>             # 句子级复查（注释夹折叠漏译/键不匹配）
```

- [ ] 标识符（`NameAndType`/`Class` 名称）含 CJK = 0
- [ ] `\u0001` 数量与位置一致
- [ ] 句子级英文残留 = 0（仅允许 Intrinsics/SMAP/调试日志/`Ljava/…` 签名）
- [ ] 重打包后 zip 条目名全为**正斜杠**、`META-INF/` 保留（铁律 R9）
- [ ] 混合结构：补丁后 jar 与 `out\production\<Mod>` 已同步（若原为逐字节相同）

## 4. G5 引用与类加载

```powershell
node <skills>\shared\scripts\check_refs.js <modDir> <游戏根>
node <skills>\shared\scripts\check_assets.js <modDir> <游戏根>
node <skills>\shared\scripts\check_sprites.js <modDir> <游戏根>
node <skills>\shared\scripts\check_deprecated.js <apiSrcDir> <modSrcDir>
# LoadTest（需 -noverify 与 logs 路径属性，见 env.md §4）
```

- [ ] 引用问题 0 条（**下列假阳性除外**）
- [ ] 代表类 `Class.forName` 全通过；`hull_mods.csv` 的 `script` 列与 `*.system` 的类存在

**已知假阳性（别改）**：`.skin` 的 `skinHullId` 是皮肤自建 id（不在 `ship_data.csv`）；
`default_ship_roles.json` 空对象 `"combatFreighterSmall":{}` 是正常写法；
`getSprite("SRD_fx","…_phantom_")` 是动态拼接前缀；`data\trails\*`、`config\modFiles\magicTrail_data.csv` 是 MagicLib 约定；
原版 `hull_mods.csv` 的 `desc` 含真实换行；缺列 ≠ 错位（加载器**按表头名**读列，缺列只是没数据）。

## 5. G6 装船目检（交付前必做）

- [ ] 模组列表显示中文名与简介
- [ ] 改装界面：船插名称/描述 tooltip（悬停不崩）、`short` 一行、`desc` 条件+效果+例外完整
- [ ] 图鉴：舰船名/舰级（来自 `ship_data.csv` 的 `designation`）/制造商行
- [ ] 战役：任务标题/简报/对话；rules 触发的提示与选项
- [ ] 战斗：武器/舰船系统/消息文本
- [ ] 日志（`starsector.log`，`-Encoding Default` 读）无新增 `at data.scripts.` 栈帧、无 ERROR/FATAL

## 6. 崩溃速查（发现问题的入口）

| 报错 / 症状 | 原因 | 处置 |
|---|---|---|
| `NoSuchFieldError`/`NoSuchMethodError`（消息乱码） | 标识符被误改（铁律 R7） | `verify_identifiers.js` → 回 `apply` 修映射 |
| `BootstrapMethodError: StringConcatException` | `\u0001` 数量被改（R6） | `check_u0001.js` 修译文 |
| 启动崩 `JSONObject["options"] not found` | CSV 被弯引号拆列（R1） | `check_csv_quotes.js` → `TestCsv` 复现 |
| 文本在引号处截断、无报错 | rules script 参数内嵌引号（R2） | `check_rules_arg_quotes.js` → 换 `【】` |
| 个别字显示 `?`、无报错 | 缺字形（R3） | `check_font_glyphs.js` → 换同义常用字 |
| `Duplicate key "xxx"` | JSON 键译后重复（R10） | 合并同义键 |
| 悬停即崩 `UnknownFormatConversionException` | 字面 `%` 未写 `%%`（R4） | 修正后重跑 G2/G3 |
| 症状无法归因 | 需引擎级复现 | → `starsector-engine-diagnose` |

## 7. 校验记账（让校验集合自我修剪）

每次跑校验都会经 `run_check.js` 落一条记录到 `<skills>\shared\verification-ledger.jsonl`——
**只记"检查项 + 退出码 + 目标"，不记原始输出**（账本自己不能变成吃上下文的东西）。

累积后的处置原则（完整机制见 `shared\verification-ledger.md`）：

- **升档**（抽样 → 每次跑）：该条有过真实命中即可。
- **降档/休眠**：必须同时满足「命中频率低 **+** 后果等级允许 **+** **探针通过**」。
  关键：**"长期通过"不等于"多余"**——也可能是它根本没在工作（正则失效、路径变了），
  所以降档前必须用**注入缺陷的探针**验证它确实能报警（`wf-audit-checks.md` 阶段 2）。
  红级（崩服/静默失效）校验**永不退役**，最多转抽样；**未探针过的校验禁止退役**。

**触发词**：用户说"校验一直没问题" / "这次校验发现 X" / "校验审计" → 按 `workflows\wf-audit-checks.md` 处理，
不要凭感觉手写账本。

