# wf-launch-audit · 启动异常查表（少读日志，按特征对表）

> **定位**：**不是**流程入口，而是**查表手册**（公共依赖）。调用它的有三处：
> - `wf-smoke-first.md` 阶段 2（**我们自己刚改过**的东西崩了）；
> - `wf-mod-fix.md` 阶段 B1（**修一个跑不通的 mod**，含归属判定与最小修复手法）；
> - `wf-diagnose.md`（症状索引里的启动崩溃分支）。
> 需要读：`shared\env.md`（日志 GBK、环境毒点）、`shared\iron-rules.md`。
>
> **本文件只做两件事**：① 把日志特征翻译成"根因 + 该跑哪个闸门"；② 给该闸门的定位/修复命令。
> **不做全量校验**（全量在烟测跑通之后，由 `wf-smoke-first.md` 阶段 3 调 `verify`）；
> **也不管归属与修复循环**（"这是谁的锅、要不要替作者补数据、修到什么时候停"见 `wf-mod-fix.md`）。

## 0. 铁则：**不要通读 `starsector.log`**（几万行）

它起步几十 MB、几万行，**整篇读既慢又爆上下文**，且其中绝大多数是良性的加载 INFO。
按下面三步走，**每步都只看几行**：

**第 1 步 · 先看运行方给的结论**（最省事，通常到这一步就够了）

```powershell
# 烟测/加载验证的运行方已把"失败原因 + 摘出的错误行"写在这里：
Get-Content <game>\_work\explore\modcheck\results\<最新时间戳>_*\verdict.json -Raw
#   verdict / reason / errorLogLines / errorWindows / durationSec 都在里面
# 建存档失败时的现场帧：同目录 ng_frames\
```

**第 2 步 · 需要自己搜时，只做定向搜索**（**别** `Get-Content` 整个文件）

```powershell
$log = '<game>\starsector-core\starsector.log'

# 只看致命信号（一次抓全，输出通常几十行）
Select-String -Path $log -Pattern 'FATAL|ExceptionInInitializerError|Caused by|RuntimeException|NoSuchFieldError|NoSuchMethodError' -Encoding Default

# 只看某类异常的头（异常头在栈帧之上，别只看 at ...）
Select-String -Path $log -Pattern '^\S.*(Error|Exception): ' -Encoding Default | Select-Object -Last 20

# 只最后一次会话（日志可能含多次启动；只看尾部若干行即可）
Get-Content $log -Tail 300 -Encoding Default | Select-String -Pattern 'ERROR|FATAL|Exception'
```

> **必须 `-Encoding Default`**（日志是 GBK）：用 `-Encoding UTF8` 会把中文读成乱码，
> 于是你会误判"没有中文报错"——而中文报错往往正是线索（如 `Could not find mod 夜十字`）。
>
> 多会话大日志的会话切分可用 `<skills>\shared\scripts\find_crash.js <log>`（它只打印会话边界与 ERROR 聚合）。

**第 3 步 · 拿到特征后到 §1 对表**。表里没有该特征 → 走 `starsector-engine-diagnose`（反汇编定论，别猜）。

## 1. 特征 → 根因 → 闸门

> 左列的"特征"是你用 `Select-String` 抓到的**那一行内容**。

| 日志特征（抓到的行） | 判定（铁律） | 处置 |
|---|---|---|
| `ExceptionInInitializerError` / `Could not find mod …` / `getBoolean(…) is null` | **R12 逻辑键误译**（显示文本与查找键在常量池里字面相同） | `scan_logic_keys.js <patch_map.json> <原classDir> <modId>`；在清单里把这些条的 `zh` 改成**与原文逐字相同**后重注入 |
| `NumberFormatException: For input string: "<选项id>"` | **R13 options 结构损坏** | `check_options_structure.js <modRoot> <enBackupRoot>`；按英文结构重建（见 §2） |
| `JSONObject["options"] not found`（或 `"id"`/`"trigger"` 缺键） | **R1**（CSV 被弯引号拆列）或 **R15**（对已汉化目录二次注入） | 先 `check_install_source.js <modRoot> <EN备份>` 判 R15；再 `check_csv_quotes.js` + `TestCsv.java` 判 R1 |
| `RuntimeException: Weapon spec [X] not found!` / `(Ship hull\|Hull) spec [X] not found!` | **引用断链**（`.variant`/`.wpn`/`.skin` 指向不存在的 id；汉化误改 csv 的 id 列或漏行也会造成） | `check_refs.js <modDir> <游戏根>` + `check_assets.js`。**注意**：同名信息平时是 WARN 级噪音，**只有以 `RuntimeException` 冒上来才是致命**；若 `check_refs` 报 0 问题，说明是"引擎解析路径"差异 → 转 `wf-mod-fix.md` §B4 |
| `NoSuchFieldError` / `NoSuchMethodError`（消息乱码） | **R7 标识符被译** | `verify_identifiers.js <classDir>` |
| `StringConcatException` / `BootstrapMethodError` | **R6 `\u0001` 数量漂移** | `check_u0001.js <mapping.json>` |
| `UnknownFormatConversionException` | **R4 字面 `%` 未写 `%%`** | 修该 tooltip 字段；`check_content.js` |
| `Duplicate key "…"` | **R10 `designTypeColors` 键重复** | `verify_all_data.js` → 合并同义键 |
| `JSONObject text must begin with …` / `Expected … at character …` | **R19 伪 JSON 未转义引号或 BOM** | `JsonProbe.java`（用游戏 `org.json` 复核，别用严格解析器判死刑 —— R8） |
| **无任何报错**，但界面某处照旧英文（典型：图鉴的**分类/制造商**名） | **R16/R10 补充：`designTypeColors` 未注册**（引擎查不到不报错，把原值当分类名显示） | `check_designtype.js <modRoot> <core>`；**务必同时查 CSV 与 `.skin`/`.ship` 的 `tech`** |
| **无任何报错**，船插**分类标签**是英文 | **`uiTags` 是显示列**，引擎不查表 | 见 `workflows\prompt-船插分类汉化.md` + `check_uitags_zh.js` |
| 文本在引号处截断（无报错） | **R2 rules 参数内嵌引号** | `check_rules_arg_quotes.js <rules.csv>` |
| **无任何报错，mod 整个没加载**（日志无该 mod 的任何 Loading 行；launcher 日志有 `发现 Mod：{id}` 但 `保存已启用的 Mod 清单 [...]` 里**没有它**） | **启动器静默拒载 gameVersion 不匹配的 mod**（2026-10-02 Hyperion 实测：0.97a 声明在 0.98a 运行版上被 ModManager 从启用清单剔除，无弹窗无报错，英文原版同样中招） | 对照 `mod_info.json` 的 `gameVersion` 与运行版 → 改成一致（最小版本适配，非汉化内容，留档）；烟测后用 verdict.json 的 `enabledIds` 复核目标 id 在列 |
| 个别字显示 `?` | **R3 缺字形** | `check_font_glyphs.js <data目录>` |
| `NullPointerException` 且栈顶在 `data.scripts.*`（mod 自己的 jar 代码，战斗/战役期触发） | **mod 自身代码缺陷**（判空缺失，与汉化无关；归属按 `wf-mod-fix.md` §B2） | 走 `wf-mod-fix.md` §3 手法表首行：代码修复重编译 + 保汉化回填（`starsector-mod-java-hardcoded-text` §5）。实例：RYAZ `ryaz_SpellcastMarine.findTarget`（射程内置 null 后立刻 `target.isAlive()`）、Nightcross `NAFulldiveOfficer` |
| `NullPointerException: …ShipAPI.getCaptain() is null`（典型触发：**旗舰未上场/阵亡后切换座舰**；栈在 mod 的 `getShips()` 遍历循环里，RTSAssist 0.2.15exp `RTS_ModeManager.playerSwitchesToDifferentShip:270` 实证，2026-10-06 已修） | **`getCaptain()` 对无舰长的舰船（未分配舰长的船/无人机/接驳舱）返回 null**，`ship.getCaptain().isPlayer()` 这种全舰遍历写法必炸；同根因潜点常不止一处，重编译时一并判空（先例：0.2.04exp mapfix 的 6 处舰名判断） | 循环内判空 `ship.getCaptain() != null && …`；重编译改动类替换 jar 条目（`-implicit:none` 防隐式编译漂移）+ 离线加载测试。RTSAssist 同批修了 `RTS_TaskManager.handleNeuralLinkAtDeployment` 的 2 处潜点 |
| 新建/读档时 `NullPointerException`，消息形如 `Cannot invoke '…Spec.getXxx()' because … is null`，栈在 `addPlanet`/`addCondition` 或 mod `generate` | **R12 补充：引擎 id（星球类型/条件/商品等注册表 id）被 jar 补丁翻译** | `check_jar_registry_keys.js <patch_map.json> <coreDir> <modDir>` 找出被译的 id → 回退英文重打（crabshack 实测：`barren-bombarded`→「荒芜-轰击」致新游戏必崩） |
| `LunaSettings: Value <key> of type … not found in JSONObject (ModID: X)`（ERROR 级，载入期成批出现） | **LunaSettings.csv 键名与代码读取名不一致，或行缺失**（2026-10-08 RealisticCombat 实证：代码 `getFloat(id, prefix+"Missile")` 拼出 `…FactorMissile`，补的行却写成 `…FactorLAUNCHER_MISSILE`；且这些 null 一旦参与规格计算——如 `modifyEngineSpec` 的自动拆箱——对应开关开启时**必 NPE**。上游 2.16.0 本就缺全部 `wsLauncher*` 行，属作者 bug；ERROR 本身不崩，崩的是下游拆箱） | 按读取代码的**键名拼接式**（getter 前缀+后缀）逐一核对 csv 行名，行首+逗号边界改名；注意 `saves\common\LunaSettings\<Mod>.json.data` 里旧键变孤儿、新键回落 csv 默认值（须在修复日志写明）；验收＝烟测 log_tail 里该 ERROR 计数归零 |
| 结算时 `NullPointerException: Cannot invoke "…CommoditySpecAPI.hasTag(String)" because "spec" is null`，栈顶 `FleetEncounterContext.lootWeapons`（0.98a 2733 行 AI 核心掉落段）→ `MagicBountyFleetEncounterContext.generatePlayerLoot`；**只炸 magiclib 赏金、且不打捞（旗舰）才炸**（打捞置 REPAIRED 被循环跳过） | **`magicBounty_data.json` 的 `target_aiCoreId` 写了 `""` 空串**：MagicLib 的守卫 `setIsAI(x != null && !x.equals("null"))` 只挡字符串 `"null"` 不挡空串 → `person.setAICoreId("")`，而引擎 `Person.isAICore()` 判 `aiCoreId != null`（空串非 null）→ 原版对 `getCommoditySpec("")`=null 直接 `.hasTag` → NPE（2026-10-08 alice cesCC 0.9C-4-4 实证） | **数据修复**：空串改裸 `null`（MagicLib 自带模板的合法值；loader 会把 JSON null 读成字符串 `"null"`，恰被 coordinator 的 `equals("null")` 守卫挡下 → 不设 AI 核心；掉落侧 `core != null` 本就判空）。**注意**：已接受赏金的在场舰队，舰长随存档序列化，修复只对之后接受的赏金生效——旧赏金临时绕过＝把旗舰打捞走 |
| 战斗中 `NullPointerException`，栈顶 `com.genir.aitweaks.core.shipai.ExtendedShipAI.controlFacing(ExtendedShipAI.kt:99)` ← `advance(:46)`（**行号即版本指纹**，实测：AITweaks v2.2.10=46/99，v2.1.0–v2.2.1=45/98，v2.0.0/v1.12.7=39/90，v1.12.6=39/88） | **AITweaks 自身缺陷 × 命令型 mod 触发**：其 99 行 `stats.weaponGroups.minWithOrNull(compareBy{…})!!` 在武器分组列表为空时必炸（字节码实证：`Intrinsics.checkNotNull` 判 NPE）。空列表唯一来源＝舰船任一**非导弹武器 DPS 为 NaN**（`Float.compareTo` 里 NaN 最大 → `bestDPS=NaN` → `filter{v >= bestDPS*0.93}` 全空；NaN 来自坏档武器规格的 `derivedStats.dps`，spec 级恒定）；纯无武器舰船在其 1.12.7 占位分组修复下安全。automatic-orders 的护航/搜索歼灭命令把舰船**永久钉进** EscortTarget/Approach 机动使该行每帧执行，故与命令强相关（2026-10-10 automatic-orders 汇报，已修） | 崩在对方 jar ≠ 只能报告：automatic-orders 侧已加 `combatOrderSafe` 守卫（无可用武器或任一非导弹武器 `derivedStats.dps` 为 NaN 的舰船跳过护航/搜索歼灭；撤退不受影响——Retreat 机动不进该代码路径）。Kotlin mod 须整模块重编译（`starsector-mod-kotlin-rebuild`），改后跑 G4 + LoadTest。彻底修复在 AITweaks（99 行去掉 `!!` 判空），可引导用户等上游/反馈 |
| **读档必崩** `IllegalArgumentException: 不存在 ID 为 <某 id> 的 OperationType`（栈经过 `OperationIntel.getIntelTags → getType`；常见引爆者是别的 mod 的 `onGameLoad` 情报遍历，如 Wide Horizons `WHMissionTimeScaling`；**建新档没事**） | **静态内存注册表不随存档序列化**：NS 的 `OperationType.INSTANCE_REGISTRY` 只在本 mod `onGameLoad`→`readSettingsIfNecessary` 时才从 CSV 重建；加载顺序排在本 mod 之前的 mod 先遍历情报时注册表还是空的（具体炸在哪个 id 上取决于情报列表顺序，同根因可报 `sun_ns_ore`/`sun_ns_free_refit` 等；Nomadic Survival 1.5.0 实证，2026-09-29 已修） | 已修版在 `OperationType.get` 头部懒加载（`ModPlugin.loadDataRegistriesIfNecessary()`），重编译替换 `OperationType`+`ModPlugin` 两个类（保汉化回填，见 `starsector-mod-java-hardcoded-text` §5；热修脚本在 `_work\mod_work\Nomadic_Survival\tools\hotfix_20260929_读档崩溃\`）。未修的同类 mod：临时绕过＝在启动器把该数据 mod 的**加载顺序调到遍历情报的 mod 之前** |
| 点开事件详情必崩 `Cannot invoke "…FactionAPI.getBaseUIColor()" because …SectorAPI.getFaction(String) is null`，栈 `mod 的 CrisisIntel.addStageDesc(行号) ← addStageDescriptionText ← BaseEventIntel.createLargeDescription ← EventsPanel.new`（**加载/建档都正常，只有打开该情报面板才炸**） | **mod 自身缺陷（判空缺失）× 硬编码派系 id**：mod 对 `Factions.PIRATES/LUDDIC_PATH/REMNANTS` 等写死 id `getFaction(id)` 后直接 `.baseUIColor`/`.crest`；玩家环境里该派系不存在（其他 mod 移除/覆盖/解析失败派系文件，或总转换不带该派系）即必炸。Kotlin 行号可对 `javap -c -l` 的 LineNumberTable 指认行（2026-10-15 Sol Renewed 0.3.7 实证，已修） | 走 `wf-mod-fix.md` §3 首行代码修复重编译（Kotlin 整模块，见 `starsector-mod-kotlin-rebuild`）：取色/纹章改 `getFaction(id)?.baseUIColor ?: 兜底`（色兜底用 `Misc.getNegativeHighlightColor()`，crest 兜底 `stage_unknown_bad` 精灵）+ 同类潜点一并修（本例 348–350 与 `crest()`）；编译后保汉化 G4 + LoadTest + 深烟测 |
| **无任何报错、不崩溃**，但"玩家自己设置的武器分组"在切换舰船后丢失/串台（选中武器组跳到别的组、自动开火状态错乱；RTSAssist 用户报告，2026-10-22 已修） | **mod 自身缺陷（状态未按舰船隔离）**：`RTS_ModeManager` 把"进入 RTS 模式时的武器分组快照"存进**单槽全局字段**，转移指挥换船后快照仍是旧船的——切回直接控制时把旧船的组号 `SELECT_GROUP` 到新船头上；再次进 RTS 模式 `clear()` 又把旧船快照覆盖掉 ⇒ 每艘船自己的设置互相冲掉。特征是**零日志**，只能靠用户报告 + 读源码定因 | 代码修复重编译（`wf-mod-fix.md` §3 首行）：快照改**按 ShipAPI 分别存取**（保存=put 当前舰，还原=只取当前舰自己的快照，没有就跳过），替换该类 5 个 class + jar 内嵌同名 .java 条目；验证走条目比对 + 保汉化 G4 + 离线 LoadTest（修复日志：`_work\mod_work\RTSAssist\fixlog_2026-10-22_切换舰船后武器分组丢失.md`） |
| `VerifyError` / `StackMapTable`（**离线程序**报的） | **环境**：本机 `starfarer.api.jar` 被改过；游戏自带 `-noverify` 无感 | 自己的验证程序加 `-noverify`（`env.md` §4）——**不是 mod 的问题** |
| `UnsupportedClassVersionError` | **环境**：编译目标 class 版本高于游戏 JRE | mod 用 `--release 8`、验证程序 `--release 17` |
| `Error while initializing plugin` / WARN 级 `spec … not found` | **噪音**（原版与别的 mod 也有，加载成功时也会出现） | 先判**归属**（把 `[id]` 一起匹配）再决定，别算到目标 mod 头上 |
| 残留扫描报几十~几百条英文（**假警报**） | 扫的是**补丁前**的解包副本（`scan_stragglers.js` 只吃 `.class` 目录） | 改用 `check_jar_stragglers.js` 直接对**交付 jar** 跑 |

> 表里没有的特征：**先把这次的特征与结论补进本表**（左列写"抓到的行"，右列写根因与闸门），
> 再继续修 —— 下次就不用从零判断。

## 2. R13 / R15 修复要点（最常见的两个启动崩）

1. 从**英文原版**取该行的 `options`，按真实换行切段 → 得到 `optionId` 序列与长式外层编号；
2. 从译文里按 `optionId` **回收中文标签**（译文可能写成 `id:标签` 或 `id:id:标签`）；
3. 逐段输出 `optionId:标签`（长式补回 `数字:` 前缀）；**行数/optionId 不符就报错保留原文，绝不猜**；
4. 段间用**真实换行**（不是字面 `\n`），由写入器按 RFC4180 加引号。

若是 **R15**（对已汉化目录二次注入）：先还原英文原版再重注入，并**加上前置断言**
`check_install_source.js <modRoot> <EN原版备份>`。

## 3. 修完只跑**与该特征相关**的闸门（不要在这里做全量）

改完立刻回到调用方**重跑烟测**（`wf-smoke-first.md` 阶段 1 或 `wf-mod-fix.md` 阶段 A）——
烟测比重跑一堆闸门更快也更可信（闸门是"抽样检查"，烟测是"真跑一遍游戏"）。

只有当**烟测连续通过**后，才进 `wf-smoke-first.md` 阶段 3 做全量校验。

## 4. 交回用户时

1. 说清**根因**（哪条铁律、哪个字段、为什么）；
2. 给出**证据**：抓到的**日志行**（1–2 行）+ 相关闸门的通过输出；
3. 说清**防复发**：新增/复用了哪道闸门，下次在哪一步会被拦住；
4. 提醒**用户亲测路径**（模组列表 / 改装 tooltip / 图鉴 / 情报对话 / 战斗 HUD）。

## 5. 复盘纪律

每次崩完问一句：**"这类错误，我原来的闸门为什么没拦住？"**

- 闸门盲区（如 R12/R13：列数检查看不出结构坏）→ **补一道新闸门**，登记 `script-registry.md` D 节 + `verification-ledger.md` §8（两处必须一致）；
- 工具自身 bug → 修工具，并在脚本头部注释写清**事故形态**；
- **只把结论留在 `_work\mod_work\<Mod>\` 会随项目被遗忘** → 要进 skill 库；
- **新特征 → 补进本文件 §1 的表**。
