---
name: starsector-mod-game-upgrade
description: 把一个旧版本 Starsector（远行星号）mod（0.95/0.96/0.97 时代，Java 或 Kotlin、有源码或只有 jar）升级到当前 0.98a-RC8 的通用流程与工具集（任务3 的执行主体）。覆盖：环境取证（日志/存档/依赖版本）、编译探测（用 0.98a API 直接编译源码找断点）、jar↔源码一致性证明（javap 签名逐类 diff + 字符串常量对比，判断"能否整包重编译而不丢汉化/逻辑"）、离线 LoadTest、数据层审计（CSV 按表头名读列的证明、缺列是否致命、BOM/宽松 JSON 语法）、引用完整性校验、语义核查（反汇编 starfarer_obf.jar 单点确认引擎行为）、并行子代理深度审查的正确用法、事故库（10+ 条真实假阳性陷阱）、版本号/changelog/交付衔接。默认用户环境与当前环境一致（游戏根 C:\game\StarSector.v0.9.8a-RC8，中文 Windows）。
---

# mod 版本升级（旧版 → 0.98a-RC8）

**目标**：做到"**该改的都改了、不该改的一个都没动、每一步都有实证**"。
**实战来源**：`mods\sylphon`（Sylphon RnD 1.0→1.1）完整适配——覆盖 126 个 Java 源文件 + 346 个数据文件，
最终**真正需要改的只有 8 处**，"看起来是问题"的假阳性有 30+ 条。
**本 skill 的一半价值在于告诉你在哪些地方不要浪费时间、也不要乱改。**

> 分工：渲染坐标专项 → `starsector-mod-render-fix`（第 7 步先判定是否命中）；
> jar 已汉化要改字符串 → `starsector-mod-localization-apply`（常量池补丁，不重编译）；
> Kotlin 编译链 → `starsector-mod-kotlin-rebuild`；打包交付 → `starsector-mod-delivery`；
> 引擎行为存疑 → `starsector-engine-diagnose`。
> **必读**：`<skills>\shared\env.md`（路径/JDK/三条环境毒点）、`<skills>\shared\iron-rules.md`、`<skills>\shared\conventions.md`。

## 1. 判定树：先给 mod 分类（决定走哪条路）

```
有 jars\src（或 mod 目录内任意层级 src）?
├─ 有 → 检查 jar 是否可整包重编译（第 3 步）；能重编译就别做常量池补丁
└─ 无 → 见 §1.1「只有 jar 的 mod」

jar 内是否含 CJK 字符串?
├─ 含 → jar 被汉化过，整包重编译会丢汉化 → 先备份 EN jar 再重编译+重汉化，或只重编译改动的类原位替换
└─ 不含 → 汉化只在数据层，整包重编译安全（sylphon 属此类）

源码是 Kotlin? → starsector-mod-kotlin-rebuild 的编译链
源码是 Java?   → 本 skill 第 2、3 步
```

### 1.1 只有 jar 的 mod（无源码）怎么升级

**不要**一上来就反编译整包重编译（易引入偏差、也丢汉化）。按性价比从高到低：

1. **先做只读审计**：第 0/4/5/6 步都不需要源码，能定位"哪些数据/类出问题"。
2. **确认 API 是否真断**：对 jar 内每个 class `javap -p -c`，把调用的外部方法名与 0.98a `starfarer.api.jar` 对一遍
   （脚本比较 `invokevirtual/invokestatic` 的目标 + 描述符）。典型断点：接口新增抽象方法（老 class 没实现 →
   `AbstractMethodError`）、方法签名变了（参数加了 `MutableShipStatsAPI` 之类）。
3. **能只替换少数类就只替换少数类**（方法见 `starsector-mod-render-fix` §6）：取出目标 class → 反编译改 →
   用 0.98a API 编译 → 原位替换 zip 条目 → **逐条目比对剩余条目与原 jar 是否逐字节一致**（证明没碰汉化）。
4. **确需整包重编译**：先备份 EN jar（`*.orig`），反编译 → 修正编译错误 → 重编译 → **重跑汉化**
   （`starsector-mod-localization-apply` 的常量池补丁流程）。
5. 纯数据层问题（缺列/废弃键/引用断链）与源码无关，照第 5、6 步处理——**多数老 mod 在 0.98a 的"问题"其实都在数据层**。

### 1.2 起步清单（前 30 分钟）

```powershell
# 1. 备份
Copy-Item -Recurse mods\<Mod> _work\mod_bak\<Mod>_<版本>_backup
Copy-Item mods\<Mod>\jars\<X>.jar mods\<Mod>\jars\<X>.jar.orig
# 2. 结构概览
Get-ChildItem mods\<Mod> -Recurse -File | Group-Object Extension | Sort-Object Count -Descending
# 3. 日志里有没有 mod 自己的栈帧（决定是"崩"还是"静默失效"）
Select-String -Path starsector-core\starsector.log -Pattern 'at data\.scripts|at <mod 包名>' -Encoding Default | Select-Object -First 10
# 4. 存档里 mod 内容是否真的生成过
Select-String -Path saves\<最新存档>\campaign.xml -Pattern '<mod 关键 id>' | Measure-Object
# 5. 依赖 mod 真实版本
Get-Content mods\MagicLib\mod_info.json -Encoding UTF8   # 别以为是 0.34
```

## 2. 十步流程

### 第 0 步 · 环境取证（**先读，别先改**，30 分钟省一天）

1. **日志**：按 `ERROR|FATAL` 归并去重，再按 mod 前缀过滤。关键判定：**有没有 `at data.scripts...` 之类的
   mod 自身栈帧**？没有 → mod 运行时没崩过，问题多半是"功能静默失效"而非"报错"。
   ⚠️ 区分**别人的噪音**：本机日志里 `Weapon spec [...] not found in weapon_data.csv`、`Ship hull spec [...] not found`、
   `Error while initializing plugin` 大量来自 **assortment_of_things / vol_ / fds_ / stormwall_** 等别的 mod，
   **不要算到目标 mod 头上**（正则把 `[id]` 一起匹配出来再判归属）。
2. **存档**：`saves\*\campaign.xml`（最新那个，十几 MB），grep mod 的 id/hullmod id/市场 id/子市场 id
   → 直接回答"**哪些内容真的在新档里生成了**"（sylphon 那次：市场、自建工业、子市场都在 ⇒ 世界生成没坏）。
3. **依赖版本**：读每个前置 mod 的 `mod_info.json` 取真实版本（**MagicLib 从 0.34 跳到 1.5.6 是大坑**，
   旧包名 `data.scripts.*` 还在但已 `@Deprecated`）。
4. **备份**：`_work\mod_bak\<Mod>_<版本>_backup`；jar 单独再存 `*.orig`。

### 第 1 步 · 摸清结构

关注：`jars\src`（源码）、`data\scripts\**\*.java`（**janino 运行时脚本，也要一起编译验证**）、
`data\config\settings.json`（插件注册表）、`.version` 文件。

### 第 2 步 · 编译探测（最省时间的"兼容性体检"）

用 0.98a API **直接编译全部源码**——编译器会把"签名级不兼容"一次性全找出来：

```powershell
$cp = @(
 "$core\starfarer.api.jar","$core\starfarer_obf.jar","$core\lwjgl.jar","$core\lwjgl_util.jar",
 "$core\json.jar","$core\log4j-1.2.9.jar",
 "$mods\LazyLib\jars\LazyLib.jar","$mods\MagicLib\jars\MagicLib.jar",
 "$mods\GraphicsLib\jars\Graphics.jar","$mods\Nexerelin\jars\ExerelinCore.jar"
) -join ';'
& $javac -encoding UTF-8 --release 8 -nowarn -Xlint:-options -cp $cp -d <out> (Get-ChildItem <src> -Recurse -Filter *.java).FullName
```

- **能干净编译** = 所有抽象方法都实现了、所有引用的常量/方法都存在 ⇒ **不会有 `AbstractMethodError`/`NoSuchMethodError`**。这是最强的单点证据。
- 老 mod 常见残留：IDE 误自动导入的 `com.sun.org.apache.xalan...`、`com.sun.prism.shader...`、`com.sun.org.apache.xpath...`
  （JDK8 内部类，JDK9+ 不存在）→ 直接删（它们从未被使用）。
- 编译不过的每一条都要去 `_api_src` 里查替代签名，**别猜**。

### 第 3 步 · jar ↔ 源码一致性（决定"能不能整包重编译"）

**必须先证明 jar 就是这份源码编出来的**，否则重编译会带上/丢掉未知改动（尤其是别人加的常量池汉化）。

```powershell
# (a) 类清单 diff（注意：jar 里可能有源码中"同一个 .java 里的包私有顶层类/匿名类"）
# (b) 签名 diff：两边各跑一次 javap -p 落到文件再 Compare-Object
& $javap -p -cp "<jar>;<api jar>" @(names) > sigs_jar.txt
& $javap -p -cp "<out>;<api jar>" @(names) > sigs_out.txt
Compare-Object (Get-Content sigs_jar.txt) (Get-Content sigs_out.txt)
# (c) 字符串常量对比（比 (b) 更能反映"逻辑是否一致"）
node <skills>\shared\scripts\cmp_strings.js <原jar解包目录> <新jar解包目录>
```

**允许出现的差异只有编译器产物**：

- `$values()`（枚举，Java7 vs 8+）；
- `$$$reportNull$$$0` + `"Argument for @NotNull parameter '%s' of %s.%s must not be null"`
  （旧编译器给 `@NotNull` 参数插的空值检查；新 javac 不生成 → **只是少了个诊断性 NPE 消息，无行为差异**）；
- `Xxx$1` 之类 switch-map 合成类；
- 字符串常量的**分组方式**不同（`"a"+"b"` 折叠成长串还是两段）⇒ 所以 `cmp_strings.js` 用的是
  "**原 jar 的每条常量是否作为子串出现在新 jar 的常量集合里**"，而不是精确相等。

**结论判定**：签名一致 + 无 CJK 缺失 + 字符串常量全包含 ⇒ **可安全整包重编译**。

### 第 4 步 · 离线 LoadTest（不开游戏验证类加载）

`<skills>\skills\starsector-mod-game-upgrade\scripts\LoadTest.java`（参数：jar 路径 + mod 目录）：

1. jar 内每个 class `Class.forName`（会跑 static 初始化）；
2. 对**游戏会实例化**的类 `newInstance`（hullmod / 舰船系统 / 武器脚本 / 战斗插件 / modPlugin / 星域生成器 / 规则命令）；
3. 校验 `hull_mods.csv` 的 `script` 列、`data/shipsystems/*.system` 的 `statsScript`/`aiScript` 指向的类都存在。

```powershell
& $javac -encoding UTF-8 --release 17 -nowarn -cp $gameCp -d verify\out <skill>\scripts\LoadTest.java
& "<game>\jre\bin\java.exe" -noverify "-Dcom.fs.starfarer.settings.paths.logs=<tmp>" `
    -cp "$gameCp;<jar>;verify\out" LoadTest <jar> mods\<Mod>
```

**已知的正常失败**（不要当 bug）：构造函数里 `Global.getSettings().getSprite(...)` 的插件在离线环境会 NPE
（`Global` 未初始化）——sylphon 有 3 个这样的插件，游戏内日志证明它们其实正常加载了。

**janino 脚本不在 jar 里**（`data/**` 下的 `.java` 由游戏运行时编译）⇒ LoadTest 第 3 步对它们报
`ClassNotFoundException` 是预期现象。想跑出全绿：把第 2 步编译探测的输出目录加进 `-cp` 复跑一遍
（实测 Hiigaran：首跑 4 条缺失 → 加 `-cp` 后 ALL PASS）。

### 第 5 步 · 数据层审计（**最容易白忙一场的地方**）

**核心事实：Starsector 的 CSV 加载器按表头名取列。**
证明（sylphon 实证）：mod 的 `hull_mods.csv` 是 19 列（缺 0.98a 新增的 `sModDesc`），但日志里
`Loading image [graphics/sylphon/hullmods/...]` **照常出现**——若按位置解析，`sprite` 会被读成 `sModDesc`、图标根本不会加载。
⇒ **缺列 = 该字段用默认值，不崩、不错位、不需要补。**（"缺列会错位"在 0.98a 不成立。）

| 新列 | 该怎么处理 |
|---|---|
| `hull_mods.csv` 的 `sModDesc` | **只有实现了 S-mod 效果的 hullmod 才该填**。判定：源码里有没有 `isSMod()`/`getSModDescriptionParam()`/`getSModEffectFormat()`。没有还硬填 ⇒ **谎报不存在的加成** ⇒ 留空才对 |
| `ship_data.csv` 的 `c/s,c/f,…,travel drive` | 原版绝大多数也为空（`travel drive` 全空）；缺列=默认，不影响 |
| `weapon_data.csv` 的 `autofireAccBonus,extraArcForAI` | 同上（留空=默认） |
| `ship_systems.csv` 的 `isPhaseCloak,tags` | **`isPhaseCloak` 被读入但全游戏无调用方**（第 7 步），别乱填；`tags` 留空可 |
| `industries.csv` 的 `disruptDanger` | 原版 19/35 行也为空 → 空值有安全默认，不会 NPE。想对齐原版可补（会改变被突袭风险） |

同时检查：

- **BOM**：所有 `.json`/`.csv`/`.version` 必须无 BOM（`[System.IO.File]::ReadAllBytes` 看前 3 字节）。
  **别用 `Set-Content -Encoding UTF8`**（PS 5.1 会加 BOM）；用
  `[System.IO.File]::WriteAllText($p, $t, (New-Object System.Text.UTF8Encoding($false)))`。
- **宽松 JSON 语法**：`#` 注释、尾随逗号、裸键、`;` 结尾、`025`、`.0f`、`.5`、`[STATIONS]` 都不是错误——
  **必须用游戏自己的 `org.json`（`starsector-core\json.jar`）验证**（先剥 `#` 注释再 parse），
  别用 node 严格 `JSON.parse` 判死刑（铁律 R8）。见 `JsonProbe.java`。
- **CSV 引号内换行**：原版 `hull_mods.csv` 的 `desc` 含真实换行（295 物理行 vs 152 逻辑行）⇒
  **逐行 `split(',')` 的脚本必然误报**，要用完整 CSV 状态机（`csvcheck.js` 已实现）。

### 第 6 步 · 引用完整性（脚本化，别靠眼睛）

```powershell
node <skills>\shared\scripts\check_refs.js <modDir> <游戏根>        # variant/.ship/.skin/default_ship_roles → hull/武器/hullmod/wing
node <skills>\shared\scripts\check_assets.js <modDir> <游戏根>      # graphics 引用是否存在（mod + core + 其它已装 mod，跳过注释行）
node <skills>\shared\scripts\check_sprites.js <modDir> <游戏根>     # 源码 getSprite("分类","键") 是否有定义
node <skills>\shared\scripts\check_deprecated.js <apiSrcDir> <srcDir>  # 是否用了 @Deprecated 成员
```

**已知假阳性（别改）**：`.skin` 的 `skinHullId` 是皮肤自己新建的 hull id，不在 `ship_data.csv` 里 → 不是断链；
`default_ship_roles.json` 里空对象 `"combatFreighterSmall":{}` 是正常写法（多 mod 级联合并）；
`getSprite("SRD_fx","SRD_generic_fighter_phantom_")` 是动态拼接前缀；
`data\trails\trail_data.csv`、`data\config\modFiles\magicTrail_data.csv` 是 MagicLib 的约定，不是缺失。

### 第 7 步 · 语义核查：**用反汇编终结猜测**（最重要的一条经验）

"签名相同但语义变了"无法靠读源码判断 ⇒ **直接反汇编 `starfarer_obf.jar` 找那段逻辑**。
方法、两个实战判例与"某方法/字段有没有被调用"的扫描法 → `starsector-engine-diagnose` §4。

顺带先判定**是否命中渲染坐标专项**（症状：锚定舰船的自绘特效整体偏移且随镜头变化）→ `starsector-mod-render-fix`。

### 第 8 步 · 并行深度审查（子代理）+ **逐条复核**

按代码职责切 3–4 份，每份一个子代理（背景运行，互不依赖）。**必须给它们的上下文**：

- 游戏根 / mod 路径 / `_api_src` 路径（权威文档）/ `javap` 路径 / 日志路径；
- **"源码已能干净编译，不要报编译错误"**（否则它们会浪费大量篇幅报"方法不存在"）；
- "宁少报不臆测；每条必须能指到 `_api_src` 文件行号或原版数据"；
- 产出：一个 md 报告 + ≤40 行摘要；**只写自己的报告文件，不许改 mod**。

> **最重要的一条纪律：子代理的每条"必须修"都要自己复核。**
> sylphon 那次 4 份报告共 12 条"必须修/建议改"，复核后真问题 **3 条**，**假阳性 9 条**
> （严格 JSON parser 误判 `.proj`；只查 mod 目录就断言贴图/音乐缺失；把"引擎按表头读列"误判为"新列缺失导致功能失效"；
> 建议给 `isPhaseCloak` 填 TRUE；把惰性残留数据当 bug）。**复核成本远低于"照着改坏"的代价。**

### 第 9 步 · 修复 + 重建 + 全量校验

1. 逐条改源码/数据（改前 git/备份）。
2. `<skill>\scripts\build_java_mod.ps1 -ModDir mods\<Mod> -SrcDir jars\src -JarName <X>.jar`
   （编译 → 打包 → 备份原 jar 为 `*.orig` → 安装）。
3. 重跑第 3/4/6 步全部校验：class 数一致、全部加载成功；字符串常量对比只剩"你故意改的那几处"；引用问题 0 条（假阳性除外）。
4. **游戏必须先完全退出**才能替换 jar（Windows 文件锁）。

### 第 10 步 · 版本号 / changelog / 交付

- `mod_info.json` 的 `version` 与 `*.version` 的 `modVersion` **必须同步**（1.0→1.1 与 1.0.0→1.1.0）。
- `mod_info.json` 补 `gameVersion`（写 `0.98a-RC8`，不是 `0.98`）与 `dependencies`（硬依赖前置 mod）。
- `changelog.txt` 顶部加新版本条目（沿用原文件结构）。
- 交付走 `starsector-mod-delivery`。
- 若此 mod 有汉化 → 改字符串后按 `starsector-mod-localization-apply` 重打补丁，再走 `-verify` 的 G4/G5。

## 3. 事故库（全部实战踩过，含**假阳性**）

1. **`VerifyError: StackMapTable error` 不是 mod 的问题**：本机 `starfarer.api.jar` 被汉化补丁改过；加 `-noverify` 即可（游戏本来就带）。
2. **javac 25 默认 class major 69**，游戏 JRE 17 不认 → mod 用 `--release 8`、验证程序用 `--release 17`。
3. **PowerShell 5.1 的 `.ps1` 按 ANSI/GBK 读**：含中文必须存 **UTF-8 带 BOM**，否则报"字符串缺少终止符"之类怪错。
4. **`javac` 告警走 stderr**，`$ErrorActionPreference='Stop'` 会把脚本掐死 → 用 `'Continue'` + 显式查 `$LASTEXITCODE`。
5. **严格 JSON parser 会误判游戏数据**（`.proj` 的 `[255,025,135,55]`、`.0f`、`.5`、`settings.json` 尾随逗号与 `#` 注释）。
6. **CSV 引号内有换行**：逐行 split 的脚本会把 152 行读成 295 行并产生几十条假断链。
7. **"缺列=错位"是错的**：加载器按表头名读列（第 5 步有实证）。
8. **`skinHullId` 不在 `ship_data.csv` 里**——皮肤自建 id。
9. **贴图/音乐"缺失"**：检查脚本必须同时搜 **core 与其它已装 mod**，并**跳过注释行**。
10. **`data\scripts\**\*.java` 是 janino 运行时脚本**，也要一起编译验证。
11. **`default_ship_roles.json` 空对象占位是正常的**，不要删。
12. **`isPhaseCloak` 只存不用**（0.98a 实测），相位披风看 `shield type=PHASE` + `defense id`（第 7 步）。
13. **`sModDesc` 留空才对**——没实现 S-mod 效果的 hullmod 填了就是谎报加成。
14. **区分"0.98 回归"和"上游一直就坏"**：报告里要写清性质，别让用户以为升级把东西搞坏了。
15. **日志轮转**：`starsector.log` 每次启动重置；看历史要 `.log.1/.2/.3`。
16. **插件早期实例化**：`data\config\settings.json` 的 `plugins` 在数据加载期就会被实例化（可能早于 `onApplicationLoad`，
    `Global.getSector()` 可能为 null）。构造函数里**只能**碰 `Global.getSettings()`；碰 `getSector()` 会报
    `... because the return value of "Global.getSector()" is null`。
17. **写 JSON/CSV 后复查 BOM**（第 5 步）。
18. **`deliver.ps1` 会排除任意层级 `src`、`*.orig`、`.git`、`desktop.ini`**——所以 `jars\src` 与 `*.jar.orig`
    不进交付包是预期；想带源码加 `-IncludeSrc`。
19. **编译探测的 classpath 必须配齐源码实际 import 的所有 mod 库**（2026-09 Hiigaran 实测：漏了
    `MagicLib.jar` ⇒ `data.scripts.util.MagicRender` 报"程序包不存在"，差点误判成 0.98a 断裂）。
    动手前先 `grep ^import` 汇总非 `com.fs`/`java`/`org.lwjgl` 的包，逐个找到归属 jar 再编译；
    报"程序包/符号不存在"时**先怀疑 cp，再怀疑 API 断**。
    注：MagicLib 1.5.6 仍保留 `data.scripts.util.*` 旧包名的 @Deprecated 垫片（真类、可用），
    老 mod 引用旧包名**不是**断裂，`check_deprecated.js` 扫的是游戏 API，盖不到这层。

## 4. 反模式

- ❌ **不要联网搜"0.98a 改动"**（本机 `starfarer.api.zip` 是权威文档，`starfarer_obf.jar` 是权威行为）。
- ❌ **不要为了"和别的 mod 对齐"改数据** —— 先反汇编确认引擎是否读它。
- ❌ **不要凭"看起来多余"删数据/文件**：上游残留最多是日志噪音，删了可能破坏作者意图。写成"可选清理"交给用户。
- ❌ **不要用严格解析器给游戏数据判死刑**。
- ❌ **不要在没证明 jar == 源码 之前整包重编译**（会丢汉化或未知改动）。
- ❌ **不要完全信任子代理的"必须修"**（第 8 步，实测 75% 是假阳性）。
- ❌ **不要在游戏运行时替换 jar**。

## 5. 验证清单（升级完成）

- [ ] 源码能干净编译（`--release 8`，exit 0）
- [ ] javap 签名 diff 只剩编译器产物；`cmp_strings.js` 只剩故意改动
- [ ] LoadTest：全类加载成功、脚本类 0 缺失
- [ ] 引用校验 0 真问题（装配/贴图/精灵/武器）
- [ ] 修复前后的 jar 都有备份（`*.orig`）与 git 提交
- [ ] `mod_info.json`：`version` 与 `*.version` 一致、`gameVersion=0.98a-RC8`、`dependencies` 齐
- [ ] `changelog.txt` 有新版本条目
- [ ] 交付走 `starsector-mod-delivery`（结构说明 + `ai\` + git + zip 自检）
- [ ] **游戏内**：新档能生成内容 → 目标功能可用 → 日志无新增 `at data.scripts.` 栈帧
- [ ] 若此 mod 有汉化：`-apply` 重打补丁 + `-verify` G4/G5 通过

## 6. 脚本（本 skill 的 `scripts\`）

| 脚本 | 用途 | 用法 |
|---|---|---|
| `build_java_mod.ps1` | 编译 `src` → 打包 → 备份 → 安装 | `-ModDir mods\<Mod> [-SrcDir jars\src] [-JarName X.jar] [-NoInstall] [-ExtraCp <jars;>]` |
| `LoadTest.java` | 离线类加载/实例化/脚本类校验 | `java -noverify -D...logs=<tmp> -cp ... LoadTest <jar> <modDir>` |

> 其余校验脚本（`check_refs.js`/`check_assets.js`/`check_sprites.js`/`check_deprecated.js`/`cmp_strings.js`/
> `csvcheck.js`/`jsonkeys.js`/`JsonProbe.java`）已统一到 `<skills>\shared\scripts\`，见 `script-registry.md`。
> 全部校验脚本**只读+打印**；改文件请人工确认后再动手。
