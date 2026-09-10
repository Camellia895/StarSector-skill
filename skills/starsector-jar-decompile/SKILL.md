---
name: starsector-jar-decompile
description: 为 Starsector（远行星号）项目安装/重建 CFR 反编译器并反编译 jar 与 class 看实现：从上游 GitHub 源码自建（Maven Central 最后发布版只到 0.152/2021，上游 master 已领先上百提交，上游 README 明确建议 clone 仓库自行构建）→ 装到 _work\_tools\cfr\（cfr.jar + cfr.ps1/cfr.cmd 启动器，用游戏自带 JRE 17 运行）→ 整包反编译 mod jar、用 --jarfilter 只解单个类、用 --extraclasspath 解混淆版 starfarer_obf.jar。含构建侧与使用侧各三个实测坑。默认用户环境与当前环境一致（游戏根 C:\game\StarSector.v0.9.8a-RC8，中文 Windows，PowerShell 5.1/pwsh，Node v24，PATH 上无 mvn/java/javac，JDK 在 Android Studio JBR，repo1.maven.org 可用而 github.com 直连时好时坏）。
---

# Starsector jar / class 反编译（CFR）

目标：把 CFR 装好并能反编译本项目的任何 jar / class，用来读实现、找硬编码字符串、核实 API 行为。

**为什么是「源码自建」**：Maven Central 上 CFR 最后发布版是 **0.152（2021）**，上游 `master` 已领先上百提交；上游 README 明确说 *"your best bet is to clone the github repo if you want a modern version"*。所以本项目装的不是下载的发布版，而是自建版。

## 0. 默认环境

路径 / 工具链 / 网络 / 编码 → **读 `<skills>\shared\env.md`**（不在此重复）。本节只记 CFR 特有事实：

- CFR：`<game>\_work\_tools\cfr\`（`cfr.jar` + `cfr.ps1` / `cfr.cmd`），当前 **0.153-SNAPSHOT**（自建）。
- 源码与工具链：`<game>\_work\_tools\cfr-src\`（上游克隆，含 `.git`）、
  `<game>\_work\_tools\apache-maven-3.9.16\`、`<game>\_work\_tools\cfr-build.bat`。
- 反编译产物放 `<game>\_work\_tmp\<名字>\`，**别污染 mod 目录**（否则会被打进交付 zip，见 `starsector-mod-delivery`）。

## 1. 安装 / 重建（一条命令，幂等）

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File `
  C:\game\StarSector.v0.9.8a-RC8\_work\skills\skills\starsector-jar-decompile\scripts\install-cfr.ps1
```

脚本按序做 6 件事：①定位 JDK ②准备便携版 Maven（缺则下载）③准备源码（有 `.git` 就 `pull`，没有就 `clone`，git 不通回退 codeload tarball 并补建 `.git`）④调 `cfr-build.bat` 构建 ⑤安装 `cfr.jar` + 启动器 ⑥实跑 `--version` 验证。任一步失败都会打印日志末尾并抛出。

| 参数 | 默认 | 说明 |
|---|---|---|
| `-JdkHome` | 自动探测 | JDK 根（须含 `bin\javac.exe`）；探测顺序：本参数 → `CFR_JAVA_HOME` → `JAVA_HOME` → PATH 上的 javac → Android Studio JBR |
| `-MavenVersion` | `3.9.16` | 便携版 Maven 版本（已实测可用） |
| `-RepoUrl` | `https://github.com/leibnitz27/cfr.git` | 上游仓库 |
| `-Branch` | `master` | codeload 回退通道用的分支 |
| `-NoPull` | 关 | 源码已存在时不刷新（离线 / 锁版本） |
| `-SkipBuild` | 关 | 跳过构建，只重铺 `cfr.jar` 与启动器 |

**只想升级到上游最新**：直接再跑一次脚本（第 3 步会 `git pull`，第 4 步重编译，第 5 步覆盖安装）。

## 2. 日常使用（配方）

启动器：`_work\_tools\cfr\cfr.ps1`（cmd 里用 `cfr.cmd`）。**参数原样透传给 CFR。**

```powershell
$CFR = 'C:\game\StarSector.v0.9.8a-RC8\_work\_tools\cfr\cfr.ps1'

# 版本（会输出 CFR 0.153-SNAPSHOT (c414525)）
& $CFR --version

# ① 整个 jar 反编译到目录（最常用）
& $CFR 'mods\AITweaks\jars\AITweaks.jar' --outputdir '_work\_tmp\aitweaks'

# ② 只反编译一个类（务必用 --jarfilter；点号 FQN 正则，子串匹配）
& $CFR 'starsector-core\starfarer_obf.jar' --jarfilter 'CombatMain$' `
      --extraclasspath 'starfarer.api.jar' --outputdir '_work\_tmp\combatmain' --silent true

# ③ 解混淆版游戏本体：带上 API 与其它核心 jar，减少 "Could not load the following classes"
& $CFR 'starsector-core\starfarer_obf.jar' `
      --extraclasspath 'starfarer.api.jar;starsector-core\fs.common_obf.jar' `
      --jarfilter 'PersonNameStore$' --outputdir '_work\_tmp\pns' --silent true

# ④ 全部选项
& $CFR --help
```

排序对路径生效：脚本从任意 cwd 调用都可以，但 CFR 的相对路径按**当前目录**解析，建议统一用游戏根相对路径或绝对路径。

**典型工作流**：整包解到 `_work\_tmp\<mod>`（或 `--jarfilter` 只解关心的几个类）→ 用编辑器/grep 搜字符串与调用点 → 与 `starfarer.api.jar` / 官方源码 `starfarer-core\starfarer.api.zip` 交叉核对。

> **读游戏 API 优先看源码**：`starsector-core\starfarer.api.zip` 是官方反编译源码，比 CFR 输出可读；
> CFR 的价值在 **mod 的 jar**（多数 mod 不发布源码）与**混淆版本体**。

## 3. 本项目常用选项

| 选项 | 说明 |
|---|---|
| `--outputdir <目录>` | 输出目录（不加就打到 stdout） |
| `--jarfilter "<正则>"` | 解 jar 时只处理 FQN 匹配的类，**点号 FQN 子串正则** |
| `--extraclasspath "<a.jar;b.jar>"` | 补类路径（Windows 用 `;` 分隔） |
| `--silent true` | 关掉逐类 `Processing ...` 输出（**布尔选项必须显式给 `true`**） |
| `--outputencoding UTF-8` | 指定输出编码（中文源码/字符串时用） |
| `--methodname <名字>` | 只解某个方法 |
| `--renameillegalidents true` | 重命名非法标识符（混淆类里常见 `if`/`int`/`null` 类名时更可读） |

## 4. 行为细节

1. **版本号是注入的**：`src-templates\...\CfrVersionInfo.java` 由 `templating-maven-plugin` + `git-commit-id-plugin` 在构建时替换 `${project.version}` / `${git.commit.id.abbrev}`，所以**构建必须有 `.git`**（源码目录别删 `.git`；安装脚本在没有时会补建并提交一次）。
2. **构建参数写死在 `cfr-build.bat` 内**，调用方只通过环境变量传配置（`CFR_JAVA_HOME`）。原因见坑 5。
3. **构建命令**（bat 内容）：`mvn -B -f <src>\pom.xml -DjavaVersion=8 -DskipTests -Dmaven.javadoc.skip=true -Dgpg.skip=true package`。产物 `cfr-src\target\cfr-0.153-SNAPSHOT.jar`。
4. **启动器 Java 解析顺序**：`%CFR_JAVA%` → PATH 上的 `java.exe` → 游戏自带 `<游戏根>\jre\bin\java.exe`；堆默认 `-Xmx2g`，可用 `CFR_JAVA_OPTS` 覆盖。
5. **脚本编码约定**：`.bat`/`.cmd` 纯 ASCII + CRLF；含中文的 `.ps1` **必须 UTF-8 带 BOM**（Windows PowerShell 5.1 会把无 BOM 的 `.ps1` 按 ANSI 读，中文注释/字符串乱码）。本 skill 的 `scripts\launcher\*.ps1`、`build-cfr.bat` 故意保持纯 ASCII。

## 5. 坑（全部本机实测）

1. **传 jar 时附带的类名参数不生效**：`cfr x.jar com.foo.Bar` **不会**只解 `Bar`，照样解整包（实测 `starfarer.api.jar` → 1947 个文件，`starfarer_obf.jar` → 1300 个文件）。只解单类必须用 `--jarfilter`。
2. **`--jarfilter` 静默失败**：它匹配的是**点号 FQN**（`com.fs.starfarer.combat.CombatMain`）。写斜杠（`com/fs/...`）一个都匹配不到，**退出码却是 0、无任何输出**——很容易误判成"类不存在"。正确写法 `--jarfilter "CombatMain$"`。
3. **布尔选项要显式给值**：`--silent` 单独写**不生效**（仍刷满 `Processing ...`），要写 `--silent true`（实测：给了值才是 0 行输出）。
4. **CFR 的进度信息走 stderr**：不加 `--silent true` 时每个类打一行 `Processing ...` 到 stderr。在 PowerShell 里这是原生 stderr，用管道接会被包成 `NativeCommandError` 红字（**不影响结果**）；`cfr.ps1` 已把调用处的 `$ErrorActionPreference` 放宽，避免严格模式下被当终止错误。
5. **PowerShell 调 `.cmd`/`.bat` 时 cmd 会在 `=` 处拆参数**（实测 `-Dmaven.javadoc.skip=true` 变成 `-Dmaven` + `.javadoc.skip=true`，Maven 直接 `Unknown lifecycle phase '.javadoc.skip=true'` 失败）。注意 `%*` 透传是**原样**的，被拆的是 `%~1` 这类位置参数，所以：构建把参数写死在 bat 内部；`cfr.cmd` 用 `%*` 转发是安全的；给 CFR 传含 `=` 的参数若出怪问题，改用 `cfr.ps1`。
6. **`pom.xml` 的编译目标是 Java 1.6**，JDK 20+ 报 `Source option 6 is no longer supported`，必须 `-DjavaVersion=8` 覆盖。
7. **游戏自带 `jre\` 没有 `javac`**：只能运行 CFR，不能构建（构建报找不到 javac/编译器）。
8. **Kotlin mod 反编译噪音**：Kotlin 编译的类会带大量 `Intrinsics.checkNotNullParameter` 等样板，且 `*Kt` 类成对出现，属正常现象，阅读时按 `*Kt` 找顶层函数即可。
9. **类名碰撞会被改名**：CFR 对同名类会加 `_cfr_N` 后缀（如 `OoOO..._cfr_62.java`），混淆 jar 里大量出现，不代表解析失败。
10. **反编译产物不要留在 mod 目录**：统一 `_work\_tmp\`，避免被打包进交付 zip（见 `starsector-mod-delivery`）。

## 6. 验证清单

- [ ] `cfr.ps1 --version` 输出版本号，且**不只是** `0.152`（0.152 = 误用了 Maven Central 旧发布版，不是自建的最新版）
- [ ] 版本行带提交号（形如 `CFR 0.153-SNAPSHOT (c414525)`）——没有提交号说明构建时缺 `.git`，版本注入没生效
- [ ] 任取一个 mod jar 整包反编译成功，`*.java` 数量与 jar 内 class 数量同量级
- [ ] `--jarfilter "类名$"` 只产出 1 个（或预期的几个）`.java` 文件
- [ ] 解 `starfarer_obf.jar` 时输出顶部残留的 `Could not load the following classes` 已通过 `--extraclasspath` 尽量消除
- [ ] 用 `cfr.cmd`（cmd 环境）与 `cfr.ps1`（PowerShell 环境）各跑通一次
- [ ] 重建一次（重跑 `install-cfr.ps1`）能成功，且 `_work\_tools\cfr-build.log` 内含 `BUILD SUCCESS`

## 7. 常见问题

- **`install-cfr.ps1` 报「找不到带 javac 的 JDK」**：用 `-JdkHome` 指定，或设 `CFR_JAVA_HOME`。游戏自带 `jre\` 永远不行（无 javac）。
- **`git clone` 报 `Failed to connect to github.com port 443` / `Empty reply from server`**：`github.com` 直连被阻断（本机常态）。脚本会自动回退 codeload tarball；tarball 无历史，脚本会补建 `.git` 并提交一次，保证版本号仍能注入。不要反复重试 clone。
- **构建报 `Unknown lifecycle phase '.javadoc.skip=true'`**：说明参数被 cmd 在 `=` 处拆了——别从 PowerShell 直接给 `mvn.cmd` 传 `-D` 参数，用 `cfr-build.bat`（内部写死）。
- **`--version` 显示 `${project.version}` 之类的占位符**：源码缺 `.git`（或 `git pull` 后未重新构建）。重跑 `install-cfr.ps1` 即可。
- **`--jarfilter` 没有任何输出、退出码 0**：正则没匹配上（常见原因是写了斜杠路径或大小写/后缀不对）。先用整包或 `--jarfilter "关键词"` 试探，确认 FQN 拼写。
- **大 jar 报 `OutOfMemoryError`**：`$env:CFR_JAVA_OPTS = '-Xmx6g'` 后再跑。
- **想装到别处 / 别的机器**：整个 `<skills>\skills\starsector-jar-decompile\` 拷过去即可
  （`install-cfr.ps1` 由 `$PSScriptRoot` 上溯 5 级推断游戏根：`scripts` → skill → `skills\` → `<skills 根>` → `_work` → 游戏根；
  **若改变层级深度，必须同步改脚本第 57–66 行的路径推断段**）。

## 8. 关联 skill

- `starsector-repo-source`：`github.com` 不通时的 codeload tarball 通道与网络诊断（本 skill 的源码获取复用了它）。
- `starsector-mod-delivery`：反编译产物属分析中间物，交付前确保落在 `_work\_` 下、不进 zip。
- `starsector-engine-diagnose`：需要判定"某 API 的真实语义"时，用 CFR 读完实现后按它的方法做单点确认。
- `starsector-mod-game-upgrade`：老 mod 无源码时，用 CFR 读出实现再做 API 断点比对。
