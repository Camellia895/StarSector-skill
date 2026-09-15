---
name: starsector-mod-game-upgrade
description: 把一个旧版本 Starsector（远行星号）mod（0.7x/0.8x/0.95/0.96/0.97 时代，Java 或 Kotlin、有源码或只有 jar）升级到当前 0.98a-RC8 的通用流程与工具集（任务3 的执行主体）。覆盖：环境取证（日志/存档/依赖版本）、编译探测（用 0.98a API 直接编译源码找断点）、jar↔源码一致性证明（javap 签名逐类 diff + 字符串常量对比，判断"能否整包重编译而不丢汉化/逻辑"）、离线 LoadTest、数据层审计（CSV 按表头名读列的证明、缺列是否致命、BOM/宽松 JSON 语法）、引用完整性校验、语义核查（反汇编 starfarer_obf.jar 单点确认引擎行为）、并行子代理深度审查的正确用法、事故库（26+ 条真实假阳性陷阱）、**0.9 以下旧 mod 专项（§7：wing_data 表头硬读、.faction known*/shipRoles 三层坑、经济模型条件→产业、机翼变体改名，附三个专属闸门）**、版本号/changelog/交付衔接。默认用户环境与当前环境一致（游戏根 C:\game\StarSector.v0.9.8a-RC8，中文 Windows）。
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
先看 mod_info.json 的 gameVersion（目标准入版本）：
├─ ≤ 0.8x（0.9 以下）→ 主体十步 + **必读 §7**（势力文件/wing_data/经济模型/机翼改名四类硬断点
│   + 3 个专属闸门；编译 114 错→0 之后仍连爆 5 轮运行时错误，全部落在 §7 射程内。AI War 实证）
├─ 0.9x 及以后 → 主体十步即可

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
20. **classpath 条目带空格/撇号 → Class.forName 假全灭**（2026-09 Vayra's Sector 实测）：
    `ZipFile(jarPath)` 能数出 jar 内全部条目，但把 `mods/Vayra's Sector/xxx.jar` 这种**带空格/撇号的
    条目**放进 `-cp` 时，系统 classloader 打不开它 → jar 内每个类 `ClassNotFoundException`，
    症状像"jar 全坏"。解法：被测 jar 复制到 `_work\_tmp\` 下无空格路径再进 `-cp`。
    同理 **javac 的 `@argfile` 只认双引号包路径**，`Vayra's Sector` 的撇号会被直接吞掉
    （报"找不到文件: mods\Vayras Sector\..."）——每行路径写成 `"..."` 再喂 `@file`。
21. **编译期常量内联 = 依赖 jar 当前值的快照**（`cmp_strings.js` 差异的新解释维度）：
    `static final String` 跨类引用会被 javac 内联进 mod 的 class。依赖 jar 被汉化后重编译
    （如 lw_Console 的 `CommonStrings.ERROR_CAMPAIGN_ONLY` 现值为中文），新 jar 内联的是**中文**，
    cmp_strings 会报"原 jar 独有英文串"——不是回归，反而与运行时一致；同理新 javac 可能对个别
    `static final` 改用 `getstatic` 字段引用而非内联（`ShippingDisruption.COMMODITY_LOSS_PREFIX`
    实测）。两条都属编译器/依赖产物，逐条解释后放行。
22. **同名 `.faction` 文件 0.98a = 核心+各 mod 按键合并，不是整文件替换**（2026-09 Ifed Legacy 实测 +
    反编译 `LoadingUtils`：非 `fullOverrides` 时以核心为 master，各 mod 深度合并——对象递归、数组追加、
    `"core_clearArray"` 重置数组；0.8 时代"必须整份拷贝"的经验已过时）。`shipRoles` 仍被 `SpecStore` 解析；
    但 `knownShips` **不会**从 shipRoles 自动生成 ⇒ 只写 shipRoles 的 mod，船会进舰队构成却不进市场出售列表
    （0.8a 亦然，属上游设计，别"顺手补" knownShips）。faction 片段文件只需写自己新增的键。
23. **0.8-0.9 时代 mod 的 cp1252 乱码**：Word 弯撇号 `'`（U+2019）以单字节 `0x92` 混进 UTF-8 文本，
    GBK 终端显示成"抯"等假 CJK；`check_encoding.js` 报 invalid-utf8 即此。修复=字节级 `0x92→0x27`
    （与其余 ASCII 撇号一致），别整段重译。
24. **核心音效 id 会被删改**：老 mod `.wpn` 引用的核心音效 id 可能已不存在（实证 0.8a `launch_tube_1`）
    ⇒ 不崩、静默无音效+日志 warning。修复=在 mod 自己的 `sounds.json` 补定义该 id 指向现存核心 ogg
    （比改 .wpn 引用更小）。另：`sounds.json` 扁平写法合法（sylphon 三种写法并存：分区/扁平/`sounds`
    数组对象）；mod 与核心同名音效 id = 覆盖核心定义，需 grep 全部 .wpn 确认无人使用再决定留否。
25. **CSV 尾部全空填充行无害**（Excel 导出残留；空 id 行被跳过；原版 ship_data.csv 表头下也有空行）；
    `ship_data - Copy.csv` 类改名残留不会被读（加载器写死 `data/hulls/ship_data.csv`，
    `ShipHullSpreadsheetLoader` 实证）；`.ship.bak` 是社区标准禁用手法，不被加载。
26. **0.8a 纯数据 mod 升级，真要改的经常只有几字节**（Ifed Legacy：191 文件最终只改 3 处+新增 1 个）——
    CSV 表头列名 0.8→0.98 高度稳定（按表头名取列，缺列=默认值）、id/variant 引用大多健在。
    先跑 check_encoding / check_refs / check_assets / ProjSpecCheck / JsonProbe + 与原版表头 diff 取证，
    别凭"年代久远"预设大改；命名顾虑（如 `peak CR sec`、`variant` 列）一律以核心现行文件对照定夺。
27. **0.9 以下（0.7x）mod ≠ 0.8a 纯数据 mod 的难度**：0.7 时代 mod 命中 §7 的四类硬断点
    （wing_data 表头硬读、.faction known* 三层坑、经济模型条件→产业、机翼变体改名），
    "只改几字节"的经验**不适用**；且错误沿加载顺序逐层暴露（AI War 连爆 5 轮），详见 §7。
28. **变体 id 以「文件内 variantId 字段」为准，不是文件名**：`kite/kite_Interceptor.variant`
    注册 id 是 `kite_hegemony_Interceptor`。建校验池必须解析每个 `.variant` 的内部字段，
    按文件名建的池会给出假 PASS（§7.4）。
29. **faction 数据校验发生在读档/开局期，不在启动期**：`CoreLifecyclePluginImpl.verifyFactionData`
    逐条核对 knownShips/knownHullMods/knownFighters/knownWeapons 对注册表，id 填错（如
    knownHullMods 填类名而非小写 id）= 读档时 RuntimeException ⇒ **冒烟必须读一次档**，只进主菜单不够（§7.2）。

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
- [ ] **（≤0.8x mod，§7）**三个专项闸门 PASS + **读档冒烟**（verifyFactionData 在读档期跑）
- [ ] 若此 mod 有汉化：`-apply` 重打补丁 + `-verify` G4/G5 通过

## 6. 脚本（本 skill 的 `scripts\`）

| 脚本 | 用途 | 用法 |
|---|---|---|
| `build_java_mod.ps1` | 编译 `src` → 打包 → 备份 → 安装 | `-ModDir mods\<Mod> [-SrcDir jars\src] [-JarName X.jar] [-NoInstall] [-ExtraCp <jars;>]` |
| `LoadTest.java` | 离线类加载/实例化/脚本类校验 | `java -noverify -D...logs=<tmp> -cp ... LoadTest <jar> <modDir>` |

> §7 专项闸门（0.9 以下 mod）在 `<skills>\shared\scripts\`：`check_wing_data_schema.js` /
> `check_faction_shiproles.js` / `check_faction_known_lists.js`，用法见 `script-registry.md` D 节。

> 其余校验脚本（`check_refs.js`/`check_assets.js`/`check_sprites.js`/`check_deprecated.js`/`cmp_strings.js`/
> `csvcheck.js`/`jsonkeys.js`/`JsonProbe.java`）已统一到 `<skills>\shared\scripts\`，见 `script-registry.md`。
> 全部校验脚本**只读+打印**；改文件请人工确认后再动手。

## 7. 0.9 以下的 mod（0.7x/0.8x）专项断点（AI War 0.7.2a→0.98a 全量沉淀）

> 适用判定：`mod_info.json` 的 `gameVersion` ≤ 0.8x。除主体十步外**必过本节**。
> 这些断点编译器全查不出、且沿加载顺序**逐层暴露**：启动 spec 加载（wing_data）→ faction shipRoles
> （NPE）→ faction knownShips（schema）→ **读档期** verifyFactionData（knownHullMods id）——
> AI War 实际连爆 5 轮。三个专属闸门（`shared\scripts\`，均已登记 script-registry.md D 节）：
> `check_wing_data_schema.js` / `check_faction_shiproles.js` / `check_faction_known_lists.js`。

### 7.1 wing_data.csv：缺列会崩（"缺列=默认"的**唯一已知例外**）

- `FighterWingSpreadsheetLoader` 对 **16 列** `getString` 硬读：id/variant/tier/tags/role desc/role/
  refit/rarity/range/op cost/num/formation/fleet pts/base value/attackRunRange/attackPositionOffset。
  0.7 时代 23 列表头缺 `role desc` 等 → 启动崩溃 `JSONObject["role desc"] not found`（资源加载线程死亡）。
- 修法：**表头照抄 core 重建**（脚本程序化取 core 表头，别手数逗号——29 列）；原值（id/variant/FP/
  formation/num/role/refit/base value/number）保留；新列按 core 同类机翼估值并留档；
  `role desc` 可写中文（与本地化核心一致，过 `check_font_glyphs.js`）。
- hulls/weapons/hull_mods 的"缺列=默认"**仍然成立**（sylphon/Ifed 实证），只有 wing_data 是例外。

### 7.2 .faction：0.8a 势力重构三连（有的炸在读档期，冒烟必须读档）

1. **known* 四键必需且必须是对象**：`"knownShips":{"tags":["<faction>"],"hulls":[...]}`，
   内键固定 hulls/fighters/weapons/hullMods（SpecStore `getJSONObject` 硬读，**裸数组=启动崩溃**）。
   0.7 无此机制（选船直接走 shipRoles）；缺失 → 势力选不到任何船/机翼。
   id 对照合并注册表：hullmod 填 hull_mods.csv 的 **id（全小写）不是类名**；`CoreLifecyclePluginImpl.
   verifyFactionData` 在**读档/开局期**逐条核对 → 只进主菜单的冒烟测不出来（事故库 29）。
   顺带：player.faction 需有 `"id":"player"` 键。
2. **shipRoles 全条目解析，dead 角色键不忽略**：0.9a 已删的 interceptor/fighter/bomber 角色里的
   `"变体id":权重` 也会逐条 `Misc.getHullIdForVariantId` → id 不存在=NPE（"Loading xxx faction" 之后）。
   修法：改指向现存变体，或删死角色（0.98 机翼由 carrier 角色 + knownFighters autofit 承担）。
   校验注意：`fallback:{...}` 里是**角色名**不是变体，须先剥掉；**变体 id 按「文件内 variantId 字段」**
   （注册 id）建池——`kite_Interceptor.variant` 注册为 `kite_hegemony_Interceptor`（事故库 28）。
3. **`doctrine` 旧块被忽略**：0.98 只认 `factionDoctrine`（warships/carriers/phaseShips/officerQuality/
   shipQuality/numShips/shipSize/aggression/combatFreighterProbability），旧块保留不删、旁边补新块
   （照 hegemony.faction 模板迁移权重）。

### 7.3 经济模型（0.7→0.9a 重写，代码+星系生成都要动）

- 生产条件 → Industries（`market.addIndustry`，必须在 `EconomyAPI.addMarket(market, true)` 之前）：

| 旧条件（0.7） | 0.98 产业 |
|---|---|
| ORE_COMPLEX / VOLATILES_COMPLEX / VOLATILES_DEPOT | `Industries.MINING` |
| ORE_REFINING_COMPLEX | `Industries.REFINING` |
| ORGANICS_COMPLEX / HYDROPONICS_COMPLEX | `Industries.FARMING` |
| LIGHT_INDUSTRIAL_COMPLEX | `Industries.LIGHTINDUSTRY` |
| AUTOFAC_HEAVY_INDUSTRY | `Industries.HEAVYINDUSTRY` |
| ANTIMATTER_FUEL_PRODUCTION | `Industries.FUELPROD` |
| MILITARY_BASE | `Industries.MILITARYBASE` |
| HEADQUARTERS | `Industries.HIGHCOMMAND`（或保留条件 `"headquarters"`，注册表仍在） |
| ORBITAL_STATION | `Industries.ORBITALSTATION` |
| SPACEPORT | `Industries.SPACEPORT`（条件注册表已无它） |
| TRADE_CENTER | 保留条件 `"trade_center"`（注册表仍在，Java 常量被注释用字面量） |

- **population 产业必须显式加**：食物需求与人口增长都在它身上（全部原版市场都有；
  `PopulationAndInfrastructure.demand(FOOD, size)`）。
- 删除 `setBaseSmugglingStabilityValue`（走私稳定机制已移除）；`addMarket` 变两参 `(market, true)`。
- 市场条件插件（如"无机人口"）：`MarketDemandAPI.getNonConsumingDemand()`、
  `BaseMarketConditionPlugin.getPopulation(market)`、`ConditionData.POPULATION_FOOD_MULT` 全删——
  食物需求 = `market.getSize()`（人口产业 demand(FOOD, size) 即 size×1）。
- 负数 `cargo.addCommodity(id, -n)` 是 **no-op**（`CargoData.addItems` 忽略 ≤0）→ 用 `removeCommodity`
  （走独立 removeItems 路径，反汇编证实）。

### 7.4 机翼变体改名（0.6/0.7 的 `*_wing` → `*_Fighter/_Bomber/_Interceptor/_Support`）

- 影响面：mission `addToFleet` 实参、`sim_opponents.csv`、`title_screen_variants.csv`、faction
  shipRoles、代码里的 `endsWith("_wing")` 判据——`_Support` 与舰船变体冲突，判机翼改用
  `Global.getSettings().getAllFighterWingSpecs()` 的 `getVariantId()` 匹配。
- **wing id ≠ 变体 id**：wing_data 的 id 列仍叫 `*_wing`（knownFighters 用它），variant 列才是变体。
- 检查引用时按 §7.2 的注册 id 口径，别用文件名、也别用后缀白名单（`*_wing` 恰是漏网案例）。

### 7.5 任务与舰队 API

- `CargoAPI.CrewXPLevel` 枚举与 `FleetMemberAPI.getCrewXPLevel()` 已删：任务 `addToFleet` 全部去掉
  末位 XP 实参（janino 任务文件同步改，它们不在 jar 里、由游戏运行时编译）。
- `FleetFactoryV2` → `FleetFactoryV3` + `FleetParamsV3`：旧 16 参 ctor 映射——
  qualityOverride→ctor 第 4 参（Float）、officerNumMult→字段 `officerNumberMult`、
  officerLevelBonus→字段、qualityBonus→ctor 末参 qualityMod（0 即默认）。
- `reportBattleFinished` 的 `battle.getPrimary(...)` 可为 null（原版 CoreScript 同样判空），补 null 守卫。
- 可选依赖的守卫模式（`getScriptClassLoader().loadClass(...)` + 静态 boolean）在 0.98 仍有效；
  编译期需要被依赖 jar/桩（桩只进编译 classpath 不进交付 jar，方法描述符用 `javap -c` 从原 jar
  字节码抄，别凭记忆）。XStream 仍在（`xstream-1.4.10.jar`），`configureXStream` 仍被引擎调用。

### 7.6 升级闸门与冒烟纪律（AI War 五轮炸点 ↔ 闸门对应）

| 炸点 | 症状 | 闸门 |
|---|---|---|
| wing_data 表头 | 启动崩 `JSONObject["role desc"] not found` | `check_wing_data_schema.js` |
| shipRoles 变体 id | faction 加载 NPE（getHullIdForVariantId / getFPCost） | `check_faction_shiproles.js` |
| known* 结构/条目 | faction 加载 JSONException；**读档期** verifyFactionData RuntimeException | `check_faction_known_lists.js` + shiproles 闸门 |

- 三个闸门全 PASS **还不够**：`verifyFactionData` 在读档期跑 ⇒ 冒烟必须**读一次存档**；
  能进游戏后再看功能（市场产业、舰队带机翼、战斗特效）。
- 装完发现连爆多轮是**预期形态**：加载器修好第 N 层才会撞第 N+1 层，闸门的意义就是把
  N+1… 层全部在进游戏前拦下。
