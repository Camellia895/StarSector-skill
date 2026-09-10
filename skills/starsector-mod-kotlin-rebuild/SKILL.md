---
name: starsector-mod-kotlin-rebuild
description: 为 Starsector 0.98a-RC8 重新编译/适配/汉化"Kotlin 写的 mod"（jar 是 kotlinc 产物、源码在 src/main/kotlin、运行时依赖 LazyLib 自带 Kotlin-Runtime.jar 的 mod，典型如 automatic-orders）。覆盖：判断"能否不重编译只补丁"→ 自包含 Kotlin 工具链（Maven Central 拉取、缓存于 _work\_tools，kotlinc≥2.x 红线）→ 精确编译命令（游戏核心 jar + LazyLib Kotlin-Runtime 作 stdlib，-no-stdlib）→ jar 打包/原位替换 → 安装与 enabled_mods.json → 离线类加载验证 → 游戏内日志验证 → 事故库（BOM、类加载期 JSON 默认值、战斗插件早于 onApplicationLoad 实例化、createAssignment 需配 giveAssignment、hull_mods.csv sModDesc 列、CRC 异常重建等）。供汉化（-apply）与版本升级（game-upgrade）在需要"从源码重编译 jar"时使用。默认用户环境与当前环境一致（游戏根 C:\game\StarSector.v0.9.8a-RC8，中文 Windows）。
---

# Starsector Kotlin mod 重编译（0.98a 适配 / 汉化重编译）

目标：把一个 **Kotlin 源码 + 编译后 jar** 的 Starsector mod（如 automatic-orders，jar 由 kotlinc 产出、类引用 kotlin.* 运行时）在 0.98a-RC8 环境里重新编译、打包、安装并验证——通常用于：①mod 迁移到新游戏版本；②汉化流程需要"改 .kt 源码字符串后重编译整 jar"（相对"常量池补丁"的另一条路，见 §0 决策）。

## 0. 先决策：要不要重编译？（汉化会话必读）

- **jar 层汉化默认走"常量池补丁、绝不重编译"**：见 `starsector-mod-localization-apply`（`analyze_jar_strings.js` / `scan_jar_sources.js` / `patcher.js`）。Kotlin 编译会把相邻字面量折叠、`${}` 拆成片段，补丁法已覆盖。
- **只有以下情况才需要本 skill 重编译**：
  - 需要**改 .kt 源码逻辑**（含把硬编码字符串改到别处、改可见文本而补丁法不可行）；
  - 源码改动后需要整 jar 重建（Kotlin 按模块编译，**无法只重编译单个类**——与 Java 类不同）；
  - 把旧版本 mod 迁移到 0.98a API。
- **重编译会丢失既有汉化/补丁**：若 jar 已被常量池汉化，重编译前先把原 EN jar 备份，重编译后重新走汉化。
- 本机**没有**系统级 kotlinc/JDK/gradle：工具链是自包含的，见 §2。

## 1. 默认环境

路径 / JRE / JDK / JDK 版本红线 / 编码 / 三条环境毒点 → **一律读 `<skills>\shared\env.md`**（不在此重复）。
工作区命名（`mod_src` / `mod_work` / `mod_bak`）→ `<skills>\shared\conventions.md` §1。

本节只记 Kotlin 特有事实：

- **编译目标 API**：`starsector-core\starfarer.api.jar` + `starfarer_obf.jar`。
- **Kotlin 工具链缓存**：`<game>\_work\_tools\kotlinc-2.1.0\`（见 §2；缺失时按 §2 的 Maven Central URL 重新下载）。
- **运行时 kotlin-stdlib 由 LazyLib 提供**：`<game>\mods\LazyLib\jars\internal\Kotlin-Runtime.jar`
  （metadata 2.1.0 ⇒ Kotlin 2.x 编译产物）。Kotlin mod 的 `mod_info.json` 必须声明
  `"dependencies":[{"id":"lw_lazylib","name":"LazyLib"}]`。
- **测试启用开关**：游戏只加载 `mods\enabled_mods.json`（按 **mod id**）里勾选的 mod；
  测试用最小集可临时改该文件，**测后还原**。

## 2. Kotlin 工具链（自包含，不装系统级）

缓存目录：`<游戏根>\_work\_tools\kotlinc-2.1.0\`，需要这些 jar（全部来自 Maven Central `repo1.maven.org`，国内可达；**不要用 github 下载**）：

```
kotlin-compiler-embeddable-2.1.0.jar   # 编译器本体（org.jetbrains.kotlin.cli.jvm.K2JVMCompiler）
kotlin-stdlib-2.1.0.jar                # 编译器自身运行需要（不是编译目标的 stdlib！）
kotlin-script-runtime-2.1.0.jar        # 编译器自身运行需要
trove4j.jar                            # 编译器依赖（org.jetbrains.intellij.deps:trove4j:1.0.20200330）
kotlinx-coroutines-core-jvm-1.9.0.jar  # Kotlin 2.x 编译器启动必需
annotations.jar                        # org.jetbrains:annotations:24.1.0；缺失会致后端 IR codegen 崩溃
```

下载模板：
```powershell
$base='https://repo1.maven.org/maven2/org/jetbrains/kotlin'
curl.exe -L -sS -o "$tc\kotlin-compiler-embeddable-2.1.0.jar" "$base/kotlin-compiler-embeddable/2.1.0/kotlin-compiler-embeddable-2.1.0.jar"
curl.exe -L -sS -o "$tc\kotlin-stdlib-2.1.0.jar"            "$base/kotlin-stdlib/2.1.0/kotlin-stdlib-2.1.0.jar"
curl.exe -L -sS -o "$tc\kotlin-script-runtime-2.1.0.jar"    "$base/kotlin-script-runtime/2.1.0/kotlin-script-runtime-2.1.0.jar"
curl.exe -L -sS -o "$tc\trove4j.jar" "https://repo1.maven.org/maven2/org/jetbrains/intellij/deps/trove4j/1.0.20200330/trove4j-1.0.20200330.jar"
curl.exe -L -sS -o "$tc\kotlinx-coroutines-core-jvm-1.9.0.jar" "https://repo1.maven.org/maven2/org/jetbrains/kotlinx/kotlinx-coroutines-core-jvm/1.9.0/kotlinx-coroutines-core-jvm-1.9.0.jar"
curl.exe -L -sS -o "$tc\annotations.jar" "https://repo1.maven.org/maven2/org/jetbrains/annotations/24.1.0/annotations-24.1.0.jar"
```

版本红线：
- **kotlinc 必须 ≥2.x**：LazyLib Kotlin-Runtime 的 stdlib metadata 是 2.1.0，kotlinc 1.9.24 报 `incompatible version of Kotlin (metadata 2.1.0, expected up to 2.0.0)`。
- 编译器启动命令（自检）：`java -cp "<compiler.jar>;<stdlib>;<script-runtime>;<trove4j>;<coroutines>;<annotations>" org.jetbrains.kotlin.cli.jvm.K2JVMCompiler -version`
  - 缺 coroutines → `NoClassDefFoundError: kotlinx/coroutines/CoroutineScope`
  - 缺 annotations → 后端 IR `Backend Internal error` / `NoClassDefFoundError: org/jetbrains/annotations/Nullable`

## 3. 流程（按顺序）

### 第 1 步 · 准备源码与载荷（工作目录）

把 fork/上游源码拷到 `_work\mod_work\<Mod>\`，保持结构：
```
_work\mod_work\<Mod>\src\main\kotlin\...   # Kotlin 源码
_work\mod_work\<Mod>\mod\                  # mod 载荷（mod_info.json/data/graphics/*.version/settings 等）
_work\mod_work\<Mod>\build.ps1             # 可复现构建脚本（模板见 scripts\）
```
先备份已安装版到 `_work\mod_bak\<Mod>_<版本>_EN_backup`。

### 第 2 步 · 检查 0.98a 兼容点（迁移必做，参考 §6 事故库）

- **hull_mods.csv**：0.98a 在 `sprite` 前多了 `sModDesc` 列（老文件 19 列 → 应为 20 列，缺列会错位）。用 CSV 感知脚本（尊重引号）在 header 与每行 `short` 与 `sprite` 之间插空列。
- **JSON 无 BOM**：凡游戏要严格解析的 json（mod_info.json、*.version、settings）**禁止 UTF-8 BOM**（PowerShell `Set-Content -Encoding UTF8` 在 Windows PowerShell 5.1 会写 BOM！用 `[System.IO.File]::WriteAllText(path, text, (New-Object System.Text.UTF8Encoding($false)))`）。BOM 症状：LunaLib 版本检查 FATAL `JSONObject text must begin with '{' at 1 [character 2 line 1]`。
- **mod_info.json**：`gameVersion` 写 `0.98a-RC8`；`version` 与 `*.version` 的 `modVersion` 一致；Kotlin mod 加 `dependencies:[{"id":"lw_lazylib","name":"LazyLib"}]`。
- **类加载期不要抛异常**（§6 事故 3/4）：伴生对象默认值、插件构造函数/字段初始化在 0.98a 可能发生在 `onApplicationLoad()` 之前。
- API 签名核对用 javap：`<jbr>\bin\javap.exe -classpath "<core>\starfarer.api.jar;<core>\starfarer_obf.jar" <类名>`；如 `getHullLevel()` 在 0.98a 移到了父接口 `CombatEntityAPI`（ShipAPI extends CombatEntityAPI），代码照旧可编译。

### 第 3 步 · 编译（核心命令）

```powershell
$java = '<游戏根>\jre\bin\java.exe'
$tc   = '<游戏根>\_work\_tools\kotlinc-2.1.0'
$core = '<游戏根>\starsector-core'
# 编译器自身运行 classpath（不是编译目标的）
$cprt = "$tc\kotlin-stdlib-2.1.0.jar;$tc\kotlin-script-runtime-2.1.0.jar;$tc\trove4j.jar;$tc\kotlinx-coroutines-core-jvm-1.9.0.jar;$tc\annotations.jar"
# 编译目标 classpath：游戏核心 jar + LazyLib Kotlin-Runtime 当 kotlin-stdlib（别加下载的 stdlib 2.1.0，运行时以 LazyLib 的为准）
$gamecp = "$core\starfarer.api.jar;$core\starfarer_obf.jar;$core\json.jar;$core\log4j-1.2.9.jar;<游戏根>\mods\LazyLib\jars\internal\Kotlin-Runtime.jar"

& $java -cp "$tc\kotlin-compiler-embeddable-2.1.0.jar;$cprt" org.jetbrains.kotlin.cli.jvm.K2JVMCompiler `
    -no-stdlib -no-reflect -jvm-target 1.8 -module-name <ModId> `
    -cp $gamecp -d <out_classes> (Get-ChildItem <src>\main\kotlin -Recurse -Filter *.kt | % FullName)
```

要点：
- `-no-stdlib -no-reflect`：不要自动加编译器自带 stdlib，用 `-cp` 里 LazyLib 的 Kotlin-Runtime.jar 做编译期 stdlib ⇒ 产出的引用与运行时完全一致。
- `-jvm-target 1.8` ⇒ class major 52，游戏 JDK 17 正常加载。
- 类加载期/编译 tip：`org.json` 数字 `get()` 返回 `Double` 不是 `Float`，写解析分支判 `is Number -> toFloat()`。
- 完整可复现实例见 `scripts\build_kotlin_mod.ps1`（参数化模板）与 automatic-orders 实战记录（§5）。

### 第 4 步 · 打包 jar + 原位替换

```powershell
# out_classes 目录里直接打包（含 META-INF\<ModId>.kotlin_module）
Push-Location <out_classes>; & '<jbr>\bin\jar.exe' cf '<mod_work>\<ModId>.jar' .; Pop-Location
Copy-Item '<mod_work>\<ModId>.jar' '<mods>\<Mod文件夹>\<ModId>.jar' -Force
```
- 遇到 `jar uf` 报 `ZipException: invalid entry CRC`（源 jar 含流式条目）：**解包→替换类→`jar cf` 重建**（全条目保留，dir 条目/MANIFEST 多出无害）。重建前备份原 jar，重建后与备份 `jar tf` 对比条目确保无文件丢失。
- `src.zip`（若 mod 根带源码包）同步重打为最新源码，便于留档。
- 游戏目录版本文件夹名不必等于 mod version（automatic-orders 曾 0.3.3 放 `mods\automatic-orders-0.3.2\`），但 mod id 必须不变（存档/依赖）。

### 第 5 步 · 离线验证（类加载 + 实例化，不开游戏）

写一个 LoadTest（模板 `scripts\LoadTestTemplate.java`）：对 jar 里每个类 `Class.forName`（会跑 static init），并对 hullmod 类 `newInstance()`（镜像游戏 hull_mods.csv script 列加载路径），插件类 newInstance。classpath = 游戏核心 jar + Kotlin-Runtime.jar + 目标 jar。
- 运行需设 `-Dcom.fs.starfarer.settings.paths.logs=<临时目录>`（否则 log4j 尝试写 `\starsector.log` 于盘根失败导致 Global.getLogger 抛错，掩盖真实问题）。
- 用 JBR javac `--release 17` 编译测试类，游戏 JRE 运行。
- 语义核对：可额外构造与 mod 配置同形状的 JSONObject 直接 `new Settings(...)` 验证解析分支（含 hullsize map / 标量 Double）。

### 第 6 步 · 游戏内验证

- 把 mod id 加入 `mods\enabled_mods.json`（要隔离测试就只留 `lw_lazylib` + 该 mod，测后还原原清单）。
- 玩家用启动器勾选运行；看 `starsector-core\starsector.log`（**每次运行重置/轮转该文件**，整文件即最新一次运行；`发现 Mod：{id}` 在文件开头，mod 版本行形如 `Automatic Orders [id: automatic-orders] [version 0.3.3]`）。
- 关键里程碑按序确认：
  1. mod 被发现、`Loading hullmod [...]` 逐条出现（CSV OK，无红色 ERROR）；
  2. `onApplicationLoad` 日志（mod 自己打的 settings 行）出现 ⇒ 类初始化/配置 OK；
  3. 无 `Error loading [...]`/FATAL（version 检查、LunaLib 等不报错）；
  4. 战斗内：插件 init/scan 日志（若已按本 skill 加了诊断日志）证明战斗插件在跑；性格/指令效果按各自日志行确认。
- 注意区分三层日志：
  - `AutomaticOrders`（modPlugin）：`onApplicationLoad`/`pickShipAI`（性格覆盖走这里，**模拟战也生效**）；
  - `AutomaticOrdersCombatPlugin`（战斗插件，settings.json "plugins" 注册，**模拟战被 isSimulation 跳过**）：init/advance/指令日志；
  - 数据/版本：hullmods 加载、*.version 解析。

## 4. 与汉化 / 升级流程的衔接

- 汉化通常走 `starsector-mod-localization-apply`（jar 常量池补丁）**不需要本 skill**；只有当 `-extract` 判定必须改 .kt 源码并整 jar 重编译时才用本 skill。
- 若采用"改 .kt 字符串 → 重编译"：本 skill §3 的 build 脚本即为全部步骤；**重编译后**：① 用离线 LoadTest 复测；② 若 jar 此前被补丁汉化过，重编译会还原成 EN——需重跑汉化；③ 数据层可见文本（hull_mods.csv 的 name/desc/short、settings、*.version 文案）直接改 CSV/JSON，与 jar 无关，重编译不触碰。
- 常见可见文本分布：hullmod 名称/描述在 `data\hullmods\hull_mods.csv`（数据层）；日志/战斗提示（"assigned to search and destroy" 等）硬编码在 .kt → 在 jar 常量池。汉化前用 `-extract` 的摸底脚本确认文本在哪层。
- **版本升级场景**（任务3）→ `starsector-mod-game-upgrade`：Kotlin mod 走本 skill 的编译链，编译探测与 jar↔源码一致性证明仍按它第 2/3 步做。
- 工作目录交接：源码与产物在 `_work\mod_work\<Mod>\`（含 build.ps1、verify\），EN 备份在 `_work\mod_bak\`。

## 5. 实战记录（automatic-orders 0.3.3，0.98a 移植）

- 源码：github isturdy/automatic-orders（Kotlin，master）；fork 到 Camellia895，落地 `_work\mod_src\automatic-orders`（github.com 直连被断，走 codeload tarball，见 `starsector-repo-source`）。
- 构建产物：`_work\mod_work\automatic-orders\`（build.ps1 实测可用；jar ≈52KB，41 个 class，major 52）。
- 安装：原位替换 `mods\automatic-orders-0.3.2\`（mod id automatic-orders，version 0.3.3，gameVersion 0.98a-RC8，依赖 lw_lazylib）。
- 途中修的三类问题即 §6 事故 1/3/6 + vri 附带 NPE（改其它 mod 需用户确认并备份）。
- 诊断日志（战斗插件）：`Automatic Orders: combat plugin initialized (simulation=...)`、`scan - N deployed player ships checked, M with automatic-orders hullmods`、`Assigning X a light escort of Y.` 等——改 Kotlin mod 时建议保留这类日志便于回读。

## 6. 事故库（每一条都踩过）

1. **JSON BOM 致命**：`automatic_orders.version` 被 `Set-Content -Encoding UTF8` 写入 BOM → LunaLib 版本检查器 FATAL `Failed to parse version file ... must begin with '{' at 1`（整游戏崩）。修：无 BOM 重写，字节须以 `{` 开头（0x7B）。凡 json/csv/version 一律复查 BOM。
2. **hull_mods.csv 列**：0.98a 新增 `sModDesc`（在 `sprite` 前）。⚠️ 注意：引擎 CSV 加载器**按表头名取列**，缺列只是该字段用默认值、不错位（见 `starsector-mod-game-upgrade` §5）；但**自己用状态机插入新列时必须插在正确位置**，否则自造错位。
3. **类加载期 JSON 默认值爆炸**：伴生对象 `var SETTINGS = Settings(JSONObject())` + Settings 构造用严格 `json.get(...)` → 类加载即 `JSONException: JSONObject["..."] not found` → 整个 mod `Could not initialize class`。0.3.2 原版 Settings 用宽松 `optString/optDouble` 所以没事；master WIP 改严格后才爆。解法：解析宽松（opt+默认值），或把默认初始化改 lateinit 且**保证没有任何路径在 onApplicationLoad 前读取**。
4. **战斗插件早于 onApplicationLoad 实例化**：0.98a 在数据加载期（CombatMain/ResourceLoaderState 阶段）就会实例化 settings.json "plugins" 里的类；插件构造函数/字段初始化若读 `AutomaticOrders.SETTINGS`（lateinit 或依赖 onApplicationLoad 赋值）→ `UninitializedPropertyAccessException` / 旧值缓存。解法：插件每次使用现读 `AutomaticOrders.SETTINGS`（`private val settings get() = ...`），不要构造时缓存；根状态给安全默认。
5. **kotlinc 版本/依赖链**：metadata 2.1.0 ⇒ kotlinc≥2.x；编译器运行缺 coroutines/annotations/trove 各自报错形态见 §2（注解缺失会让 K2 后端 IR codegen 崩，报错藏在 `Backend Internal error` 下）。
6. **createAssignment 必须配 giveAssignment**：`taskManager.createAssignment(type,target,...)` 只创建 AssignmentInfo；要给**指定船**下护航/指令必须再 `taskManager.giveAssignment(该船DFM, info, false)`。上游 automatic-orders 漏了 giveAssignment ⇒ 护航静默无效（遗留上游 bug，移植时已修）。舰队级目标指令（ASSAULT/CAPTURE 打点）不需要 give。
7. **jar 原位替换 CRC 异常**：`jar uf` 报 `invalid entry CRC (expected 0x0 ...)` ⇒ 源 jar 含流式(zip64/data descriptor)条目；改走 解包→替换→`jar cf` 重建，条目对比验证。
8. **`isSimulation` 跳过**：automatic-orders 战斗插件在模拟战里直接 return（作者设计）；性格覆盖走 modPlugin 层不受影响 ⇒ "模拟战里只有性格生效" 是预期，不是 bug。验证指令功能用实战。
9. **org.json 数值类型**：`get()` 返回 `Double`/`Integer` 而非 `Float`；写 `when(value){ is Number -> ... }`。
10. **日志轮转**：starsector.log 每次启动重置（整文件=最新一次运行）；游戏内测完直接发日志即可，不用翻旧段。

## 7. 验证清单

- [ ] `_work\_tools\kotlinc-2.1.0\` 五个依赖齐（或已按 §2 下载）；`K2JVMCompiler -version` 正常
- [ ] 编译通过（exit 0），产出 class major 52；`-no-stdlib` 且编译 cp 含 LazyLib Kotlin-Runtime.jar
- [ ] jar 打包含 `META-INF\<ModId>.kotlin_module`；原位替换到 mods 目录；mod_info 版本/gameVersion/依赖正确
- [ ] 数据文件：hull_mods.csv 20 列（0.98a）、全目录无 BOM、json 无尾逗号
- [ ] 离线 LoadTest：全类 forName + hullmod newInstance ALL PASS（设了 logs 路径属性）
- [ ] 游戏内：发现 mod → hullmod 逐条加载 → onApplicationLoad 日志 → 无 ERROR/FATAL → 战斗内指令/性格日志按预期
- [ ] 若改了被汉化过的 jar：重编译后重新汉化；EN 备份留存 `_work\mod_bak\`

## 8. 常见问题（FAQ）

- **为什么编译 cp 用 LazyLib 的 Kotlin-Runtime 而不是下载的 stdlib 2.1.0？** 运行时游戏只加载 LazyLib 的 Kotlin-Runtime（metadata 2.1.0）；用它做编译期 stdlib 可保证字节码引用的每个 kotlin.* 类运行时都存在，版本零漂移。
- **编译通过但游戏报 `Could not initialize class X` / `ExceptionInInitializerError`？** 查类 static init（伴生对象字段）是否抛异常（§6 事故 3）；日志 Caused by 会直接给出 org.json 行号。
- **改一个 .kt 能不能只替换 jar 里一个 class？** 不能。Kotlin 按模块编译，内部类/WhenMappings/Companion 相互引用，必须整模块重编。这与 Java mod（可单类替换，见 `starsector-mod-render-fix` §5）不同。
- **汉化会话什么时候需要本 skill？** 只有当 `-apply` 判定"必须改源码重编译"时；默认先试常量池补丁。
- **游戏一直开着我替换不了 jar？** Windows 锁文件：先让游戏完全退出再 Copy-Item/重建。
- **mod 在模拟战里指令不生效？** 作者在 `engine.isSimulation` 处 return（automatic-orders）；用实战验证。
