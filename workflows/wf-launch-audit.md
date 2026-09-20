# wf-launch-audit · 按日志指纹查表定位与修复（窄版）

> **定位**：**不是**流程入口，而是**查表手册**（公共依赖）。调用它的有三处：
> - `wf-smoke-first.md` 阶段 2（**我们自己刚改过**的东西崩了）；
> - `wf-mod-fix.md` 阶段 B1（**修一个跑不通的 mod**，含归属判定与最小修复手法）；
> - `wf-diagnose.md`（症状索引里的启动崩溃分支）。
> 需要读：`shared\env.md`（日志 GBK、环境毒点）、`shared\iron-rules.md`、必要时 `skills\starsector-engine-diagnose\SKILL.md`。
>
> **本文件只做两件事**：① 把指纹翻译成"根因 + 该跑哪个闸门"；② 给该闸门的定位/修复命令。
> **不做全量校验**——全量在烟测跑通之后，由 `wf-smoke-first.md` 阶段 3 调 `starsector-mod-localization-verify`。
> **也不管归属与修复循环**——"这是谁的锅、要不要替作者补数据、修到什么时候停"见 `wf-mod-fix.md`。

## 0. 铁则：**不要把日志读进上下文**

`starsector.log` 起步几十 MB，**整篇读既慢又爆上下文**。正确做法：

```powershell
# ① 先出指纹（一屏以内，自动指回 R# 与闸门）
node <skills>\shared\scripts\smoke_scan.js <game>\starsector-core\starsector.log

# ② 只有需要"上下文几行"时才定向取（脚本给出行号，用行号区间读）
node <skills>\shared\scripts\smoke_scan.js <log> --json      # 机读，含 samples 的行号
# 读日志必须 -Encoding Default（GBK；用 UTF8 会把中文读成乱码 ⇒ 误判"没有中文报错"）
Select-String -Path <log> -Pattern 'FATAL|ExceptionInInitializerError|Caused by' -Encoding Default
```

多会话大日志的会话切分：`node <skills>\shared\scripts\find_crash.js <log>`。

## 1. 指纹 → 根因 → 闸门（与 `smoke_scan.js` 的 PATTERNS 一一对应）

| 日志特征（`smoke_scan.js` 的指纹名） | 判定（铁律） | 处置 |
|---|---|---|
| `ExceptionInInitializerError` / `Could not find mod …` / `getBoolean(…) is null` | **R12 逻辑键误译**（显示文本与查找键在常量池里字面相同） | `scan_logic_keys.js <patch_map.json> <原classDir> <modId>`；在清单里把这些条的 `zh` 改成**与原文逐字相同**后重注入 |
| `NumberFormatException: For input string: "<选项id>"` | **R13 options 结构损坏** | `check_options_structure.js <modRoot> <enBackupRoot>`；按英文结构重建（见 §2） |
| `JSONObject["options"] not found`（或 `"id"`/`"trigger"` 缺键） | **R1**（CSV 被弯引号拆列）或 **R15**（对已汉化目录二次注入） | 先 `check_install_source.js <modRoot> <EN备份>` 判 R15；再 `check_csv_quotes.js` + `TestCsv.java` 判 R1 |
| `RuntimeException: Weapon spec [X] not found!` / `(Ship hull\|Hull) spec [X] not found!` | **引用断链**（`.variant`/`.wpn`/`.skin` 指向不存在的 id；汉化误改 csv 的 id 列或漏行也会造成） | `check_refs.js <modDir> <游戏根>` + `check_assets.js`；**注意**：同名信息平时是 WARN 级噪音，**只有以 `RuntimeException` 冒上来才是致命** |
| `NoSuchFieldError` / `NoSuchMethodError`（消息乱码） | **R7 标识符被译** | `verify_identifiers.js <classDir>` |
| `NoSuchMethodError`（消息**清晰可读**、参数列表完整；多见于旧版 mod 升级） | **API 签名漂移**：方法还在但**返回类型/参数变了**（描述符含返回类型！FlowerGod 实测：`spawnEmpArc` 返回 `CombatEntityAPI`→`EmpArcEntityAPI`） | 先判归属：本次**改过游戏版本** → 走 API 断裂审计（`extract_api_refs.js` + `ApiRefCheck.java`，见 game-upgrade §1.1）；没动过版本才走 R7 |
| `RuntimeException: Slot id [X] not found on hull [Y]` | **变体武器槽位在船体上不存在**（原版船重做改了槽位 id/数量；`check_refs` 查不到——它只对 id 引用不对槽位。FlowerGod 实测：hyperion 0.8→0.98 从 6 槽变 3 槽） | `check_variant_slots.js <modDir> <游戏根>`；修法=删变体里的幽灵槽位条目与空组 |
| `NullPointerException: … because "member" is null`，栈里 `skills.*.apply` → `CharacterStats.applyPersonalToStats` → `Ship.setCaptain` | **mod 自身代码缺陷**（战斗部署期其他 mod 调 `setCaptain`，对无 fleet member 的舰船应用军官技能；与汉化无关） | 重编译：技能 `apply`/`unapply` 里对 `stats.getFleetMember()` 判空后早退；保汉化重编译流程见 `starsector-mod-java-hardcoded-text` §5（Nightcross 2026-09-20 实测） |
| `StringConcatException` / `BootstrapMethodError` | **R6 `\u0001` 数量漂移** | `check_u0001.js <mapping.json>` |
| `UnknownFormatConversionException` | **R4 字面 `%` 未写 `%%`** | 修该 tooltip 字段；`check_content.js` |
| `Duplicate key "…"` | **R10 `designTypeColors` 键重复** | `verify_all_data.js` → 合并同义键 |
| `JSONObject text must begin with …` / `Expected … at character …` | **R19 伪 JSON 未转义引号或 BOM** | `JsonProbe.java`（用游戏 `org.json` 复核，别用严格解析器判死刑 —— R8） |
| **无任何报错**，但界面某处照旧英文（典型：图鉴的**分类/制造商**名） | **R16/R10 补充：`designTypeColors` 未注册**（引擎查不到不报错，把原值当分类名显示） | `check_designtype.js <modRoot> <core>`；**务必同时查 CSV 与 `.skin`/`.ship` 的 `tech`** |
| **无任何报错**，船插**分类标签**是英文 | **`uiTags` 是显示列**，引擎不查表 | 见 `workflows\prompt-船插分类汉化.md` + `check_uitags_zh.js` |
| 文本在引号处截断（无报错） | **R2 rules 参数内嵌引号** | `check_rules_arg_quotes.js <rules.csv>` |
| 个别字显示 `?` | **R3 缺字形** | `check_font_glyphs.js <data目录>` |
| `VerifyError` / `StackMapTable`（**离线程序**报的） | **环境**：本机 `starfarer.api.jar` 被改过；游戏自带 `-noverify` 无感 | 自己的验证程序加 `-noverify`（`env.md` §4）——**不是 mod 的问题** |
| `UnsupportedClassVersionError` | **环境**：编译目标 class 版本高于游戏 JRE | mod 用 `--release 8`、验证程序 `--release 17` |
| `Error while initializing plugin` / WARN 级 `spec … not found` | **噪音**（原版与别的 mod 也有，`verdict=PASS` 时也会出现） | 先判**归属**（把 `[id]` 一起匹配）再决定，别算到目标 mod 头上 |
| 残留扫描报几十~几百条英文（**假警报**） | 扫的是**补丁前**的解包副本（`scan_stragglers.js` 只吃 `.class` 目录） | 改用 `check_jar_stragglers.js` 直接对**交付 jar** 跑 |

> 表里没有的指纹：往 `smoke_scan.js` 的 `PATTERNS` 加一行（`rule` 指回铁律编号、`gate` 指回脚本），
> 并在此表补一行 —— **两处同步**，否则下次还是会靠猜。

## 2. R13 / R15 修复要点（最常见的两个启动崩）

1. 从**英文原版**取该行的 `options`，按真实换行切段 → 得到 `optionId` 序列与长式外层编号；
2. 从译文里按 `optionId` **回收中文标签**（译文可能写成 `id:标签` 或 `id:id:标签`）；
3. 逐段输出 `optionId:标签`（长式补回 `数字:` 前缀）；**行数/optionId 不符就报错保留原文，绝不猜**；
4. 段间用**真实换行**（不是字面 `\n`），由写入器按 RFC4180 加引号。

若是 **R15**（对已汉化目录二次注入）：先还原英文原版再重注入，并**加上前置断言**
`check_install_source.js <modRoot> <EN原版备份>`。

## 3. 修完只跑**与该指纹相关**的闸门（不要在这里做全量）

改完立刻回到 `wf-smoke-first.md` 阶段 1 **重跑烟测**——烟测比重跑一堆闸门更快也更可信
（闸门是"抽样检查"，烟测是"真跑一遍游戏"）。

只有当**烟测连续通过**后，才进 `wf-smoke-first.md` 阶段 3 做全量校验。

## 4. 交回用户时

1. 说清**根因**（哪条铁律、哪个字段、为什么）；
2. 给出**证据**：`smoke_scan.js` 那两行输出（指纹名 + 日志行号）+ 相关闸门的通过输出；
3. 说清**防复发**：新增/复用了哪道闸门，下次在哪一步会被拦住；
4. 提醒**用户亲测路径**（模组列表 / 改装 tooltip / 图鉴 / 情报对话 / 战斗 HUD）。

## 5. 复盘纪律

每次崩完问一句：**"这类错误，我原来的闸门为什么没拦住？"**

- 闸门盲区（如 R12/R13：列数检查看不出结构坏）→ **补一道新闸门**，登记 `script-registry.md` D 节 + `verification-ledger.md` §8（两处必须一致）；
- 工具自身 bug → 修工具，并在脚本头部注释写清**事故形态**；
- **只把结论留在 `_work\mod_work\<Mod>\` 会随项目被遗忘** → 要进 skill 库；
- 新指纹 → 同步加进 `smoke_scan.js` 的 `PATTERNS` 与本文 §1 表。
