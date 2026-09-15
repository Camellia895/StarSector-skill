# 环境事实（唯一权威）

> 本文件是本技能库**唯一**的环境事实来源。任何 skill / workflow 都**不要**再重复这些内容，只写
> `读 <skills>\shared\env.md`。用户环境与本文一致时无需逐项验证；只有**报错**时才回头复核。

## 1. 路径

| 项 | 值 |
|---|---|
| 技能库根 `<skills>` | `C:\game\StarSector.v0.9.8a-RC8\_work\skills` |
| 游戏根 `<game>` | `C:\game\StarSector.v0.9.8a-RC8`（**实际游戏版本是 0.98a-RC8**，目录名是旧命名，别被误导） |
| mod 目录 | `<game>\mods\<Mod>\` |
| 游戏核心 | `<game>\starsector-core\` |
| 日志 | `<game>\starsector-core\starsector.log`（每次启动重置/轮转，另有 `.log.1/.2/.3`） |
| 存档 | `<game>\saves\<最新>\campaign.xml` |
| 启动参数 | `<game>\vmparams`（classpath / `-Dcom.fs.starfarer.settings.paths.*` / `-noverify` 都在里面） |
| 启用清单 | `<game>\mods\enabled_mods.json`（按 **mod id** 勾选） |
| 工作区 | `<game>\_work\`（见 `conventions.md` 的目录约定） |

## 2. 运行时与工具链

| 用途 | 路径 / 版本 | 关键限制 |
|---|---|---|
| 游戏 JRE（**仅运行**） | `<game>\jre\bin\java.exe`（Zulu OpenJDK 17） | **无 javac**，不能编译 |
| JDK / javac / javap / jar | `C:\Program Files\Android\Android Studio\jbr\bin\`（JBR 17） | `-source/-target` **最低 8**，不支持 7；验证程序用 `--release 17` |
| Node.js | v24（PATH 上可用） | 校验/补丁脚本一律写**独立 `.js` 文件**，勿用 `node -e "…"` 内联（PowerShell 会吞 `$` `\` 引号） |
| kotlinc（自包含） | `<game>\_work\_tools\kotlinc-2.1.0\` | 必须 ≥2.x（见 `starsector-mod-kotlin-rebuild`） |
| CFR 反编译器 | `<game>\_work\_tools\cfr\`（0.153-SNAPSHOT 自建） | 见 `starsector-jar-decompile` |
| 解压 | `C:\Program Files\NVIDIA Corporation\NVIDIA App\7z.exe` | 系统 PATH 上**没有** 7z/unrar 命令 |
| gh / git | 已登录 `Camellia895` | `github.com:443` 直连不稳定（见 `starsector-repo-source`） |
| Maven（便携） | `<game>\_work\_tools\apache-maven-3.9.16\` | PATH 上无 `mvn` |

## 3. 编码铁律

- **游戏按 UTF-8 读数据文件**，但系统默认编码 GBK ⇒ **所有产出文件一律 UTF-8 无 BOM**（`.json`/`.csv`/`.version`/`.faction`）。
- 写文件**禁用** `Set-Content -Encoding UTF8`（Windows PowerShell 5.1 会加 BOM）。用：
  `[System.IO.File]::WriteAllText($p, $t, (New-Object System.Text.UTF8Encoding($false)))`
- 写回 CSV 保持原 **CRLF**。
- **含中文的 `.ps1` 必须 UTF-8 带 BOM**；`.bat`/`.cmd` 纯 ASCII + CRLF。
- `starsector.log` 是 **GBK/ANSI**：`Select-String -Encoding Default` 才不乱码（`-Encoding UTF8` 中文成乱码，英文仍可读）。
- PowerShell 5.1 的 `.ps1` 按 ANSI/GBK 读 ⇒ 无 BOM 的中文脚本报"字符串缺少终止符"之类怪错。

## 4. 五条"环境毒点"（踩过，别重复验证）

1. **`starfarer.api.jar` 被汉化工程替换过**（旁边有 `.bak`）：某些类 StackMapTable 是坏的（实测 `BaseIndustry.getMaxDeficit` 报 `VerifyError: bad offset @65536`）。游戏 `vmparams` 自带 `-noverify -XX:-BytecodeVerificationLocal -XX:-BytecodeVerificationRemote` 所以无感；**自己写的离线验证程序必须也加 `-noverify`**，否则看到一堆假崩溃。
2. **离线程序必须设 `-Dcom.fs.starfarer.settings.paths.logs=<临时目录>`**：否则 `Global.getLogger` 会尝试往盘根写日志而抛错，掩盖真实问题。可照抄 `vmparams`。
3. **javac 25 / JBR 17 的 class 版本差异**：游戏 JRE 17 不认 major 69 ⇒ **mod 本体用 `--release 8`（major 52），验证程序用 `--release 17`**。
4. **PowerShell 变量名大小写不敏感**：`foreach ($s in ...)` 会把外层的 `$S`（脚本目录）**就地覆盖**，
   于是 `Join-Path $S $s` 退化成相对文件名、`node` 报 `cjs/loader:1503` 之类莫名的模块解析错。
   症状极具迷惑性：**同一条命令写在循环外完全正常，写进循环就失败**。
   ⇒ 禁用的短名清单：`$S` / `$W` / `$P` / `$O`（`$W` 在 pwsh 里还是自动变量）；循环变量一律用 `$name`/`$f`/`$item`。
6. **交付目录里的 zip 可能被外部程序（编辑器/压缩工具/预览）锁住**：`deliver.ps1` 会报
   `Remove-Item : Cannot remove item ... because it is being used by another process`，
   而**旧 zip 仍在原地**——此时若只看"已打包"字样会误以为成功，实际交付的还是上一版。
   ⇒ 打包后**必须核对 zip 内的关键文件哈希/版本号**（`mod_info.json` 的 version、jar 大小），
   并先把新包写到 `_work\deliver\<版本>\` 再尝试覆盖正式路径。5. **含中文的 `.ps1` 必须 UTF-8 带 BOM**（§3 已述）；**临时验证脚本一律写纯 ASCII** 最省事 ——
   否则 PS 5.1 按 GBK 读会把中文串读坏，报出 "Unexpected token"/"missing closing ')'" 等与真实原因无关的错。


7. **Git Bash 里给 `java -cp` 传多段路径会被 MSYS 路径转换搅坏**（症状：主类都
   "找不到或无法加载主类"，或类加载全灭）。解法：把整段命令写进 **纯 ASCII + CRLF 的
   `.cmd` 批处理**再 `cmd /c` 执行（实测 Vayra's Sector LoadTest；PowerShell 对
   `-Dkey=value` 的拆分同样有毒，别用）。


## 5. 核心 jar

`<game>\starsector-core\`：`starfarer.api.jar`、`starfarer_obf.jar`（混淆本体）、`lwjgl.jar`、`lwjgl_util.jar`、`json.jar`（游戏自带 `org.json`）、`log4j-1.2.9.jar`、`janino.jar`、`fs.common_obf.jar`。

**API 源码（权威文档）**：`<game>\starsector-core\starfarer.api.zip`（1947 个 `.java`，含 `impl`）→ 解包后当文档查，**比任何网页文档都准**。

## 6. 本机已装依赖（0.98a 版本）

LazyLib 3.0.0（`mods\LazyLib\jars\internal\Kotlin-Runtime.jar` 提供 kotlin-stdlib，metadata 2.1.0）、**MagicLib 1.5.6**（不是 0.3x）、GraphicsLib 1.12.1（`shaderLib`，**自带源码** `org\dark\shaders\**\*.java`）、Nexerelin 0.12.1e、IndEvo 4.1.b、LunaLib。

> 读真实版本：`Get-Content mods\<X>\mod_info.json -Encoding UTF8`，别按印象。

## 7. 反模式

- ❌ **不要联网搜"0.98a 改了什么"**：本机 `starfarer.api.zip` 是权威文档，`starfarer_obf.jar` 是权威行为；网页信息常过期且不可验证（本机对 forum 返回 403）。
- ❌ 不要为了"和别的 mod 对齐"改数据 —— 先用反汇编确认引擎是否读它（`starsector-engine-diagnose`）。
- ❌ 不要在游戏运行时替换 jar（Windows 文件锁）。
