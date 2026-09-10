# build_java_mod.ps1 —— Java 写的 Starsector mod：从源码编译 → 打包 jar → 备份原 jar → 安装
#
# 用法示例:
#   powershell -ExecutionPolicy Bypass -File build_java_mod.ps1 -ModDir mods\sylphon
#   powershell -File build_java_mod.ps1 -ModDir mods\MyMod -SrcDir jars\src -JarName MyMod.jar -NoInstall
#
# 行为:
#   * 自动推导游戏根（从 -ModDir 里的 \mods\ 片段），或显式 -GameRoot
#   * classpath = 游戏核心 6 个 jar + LazyLib + MagicLib + GraphicsLib + Nexerelin（存在才加）+ -ExtraCp
#   * 编译目标 --release 8（class major 52，游戏 JRE 17 可加载）；用 JBR 的 javac 25
#   * 顺带编译校验 mod 里的 janino 运行时脚本（data\**\*.java），只验证语法不打包
#   * 产物留在 <游戏根>\_work\mod_work\<Mod>\_build\，再备份/安装到 mod
#
# 注意（踩过的坑）:
#   * 本脚本含中文，必须存为 UTF-8 带 BOM，否则 Windows PowerShell 5.1 会按 GBK 读成乱码并报语法错
#   * javac 的告警走 stderr，PowerShell 会当成 ErrorRecord → 用 Continue + 显式查 $LASTEXITCODE
#   * 替换 jar 前请**完全退出游戏**（Windows 文件锁）
param(
    [Parameter(Mandatory = $true)][string]$ModDir,
    [string]$SrcDir = 'jars\src',
    [string]$JarName = '',
    [string]$GameRoot = 'C:\game\StarSector.v0.9.8a-RC8',
    [string]$ExtraCp = '',
    [string]$JdkHome = 'C:\Program Files\Android\Android Studio\jbr',
    [switch]$NoInstall,
    [switch]$SkipJaninoCheck
)

$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# ---- 解析 mod 目录 / 游戏根 ----
if (-not [System.IO.Path]::IsPathRooted($ModDir)) {
    $cand = Join-Path (Get-Location) $ModDir
    if (-not (Test-Path $cand)) { $cand = Join-Path (Join-Path $GameRoot 'mods') $ModDir }
    $ModDir = $cand
}
$ModDir = [System.IO.Path]::GetFullPath($ModDir)
if (-not (Test-Path (Join-Path $ModDir 'mod_info.json'))) { throw "mod_info.json 不存在: $ModDir" }
$idx = $ModDir.IndexOf('\mods\', [System.StringComparison]::OrdinalIgnoreCase)
if ($idx -gt 0) { $GameRoot = $ModDir.Substring(0, $idx) }

$core = Join-Path $GameRoot 'starsector-core'
$mods = Join-Path $GameRoot 'mods'
$modName = Split-Path $ModDir -Leaf
$srcPath = Join-Path $ModDir $SrcDir
if (-not (Test-Path $srcPath)) { throw "源码目录不存在: $srcPath（用 -SrcDir 指定）" }

$javac = Join-Path $JdkHome 'bin\javac.exe'
$jarExe = Join-Path $JdkHome 'bin\jar.exe'
if (-not (Test-Path $javac)) { throw "javac 不存在: $javac（用 -JdkHome 指定 JDK）" }

# ---- jar 名：优先参数，其次 mod_info.json 的 jars[0]，最后 <Mod>.jar ----
if (-not $JarName) {
    $infoRaw = [System.IO.File]::ReadAllText((Join-Path $ModDir 'mod_info.json'), [System.Text.Encoding]::UTF8)
    $m = [regex]::Match($infoRaw, '"jars"\s*:\s*\[\s*"([^"]+)"')
    if ($m.Success) { $JarName = Split-Path $m.Groups[1].Value -Leaf } else { $JarName = "$modName.jar" }
}
$targetJar = Join-Path $ModDir ("jars\" + $JarName)

$work = Join-Path $GameRoot ("_work\mod_work\" + $modName)
$out = Join-Path $work '_build\out'
$logDir = Join-Path $work '_build\logs'
New-Item -ItemType Directory -Force -Path $out, $logDir | Out-Null

# ---- classpath ----
$cpItems = @(
    "$core\starfarer.api.jar", "$core\starfarer_obf.jar", "$core\lwjgl.jar", "$core\lwjgl_util.jar",
    "$core\json.jar", "$core\log4j-1.2.9.jar",
    "$mods\LazyLib\jars\LazyLib.jar", "$mods\MagicLib\jars\MagicLib.jar",
    "$mods\GraphicsLib\jars\Graphics.jar", "$mods\Nexerelin\jars\ExerelinCore.jar"
)
if ($ExtraCp) { $cpItems += ($ExtraCp -split ';' | Where-Object { $_ }) }
$missingCp = @($cpItems | Where-Object { -not (Test-Path $_) -and $_ -like "*\mods\*" })
$cp = (($cpItems | Where-Object { Test-Path $_ }) -join ';')
if ($missingCp.Count) { Write-Host ("警告：以下依赖 jar 不存在，已跳过（若源码需要它们会编译失败）：" + ($missingCp -join ', ')) }

# ---- 1) 编译主源码 ----
Remove-Item $out -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $out | Out-Null
$files = Get-ChildItem $srcPath -Recurse -Filter *.java | ForEach-Object { $_.FullName }
Write-Host "编译 $($files.Count) 个源文件 → $JarName"
$jout = & $javac -encoding UTF-8 --release 8 -nowarn -Xlint:-options -cp $cp -d $out @($files) 2>&1
$jout | Out-File (Join-Path $logDir 'build-javac.txt') -Encoding UTF8
if ($LASTEXITCODE -ne 0) {
    Write-Host "编译失败（完整日志：$(Join-Path $logDir 'build-javac.txt')）："
    $jout | Select-Object -First 60
    exit 1
}
Write-Host "编译成功：$((Get-ChildItem $out -Recurse -Filter *.class).Count) 个 class"

# ---- 2) 顺带校验 janino 运行时脚本（data\**\*.java，不打包） ----
if (-not $SkipJaninoCheck) {
    $extra = Get-ChildItem (Join-Path $ModDir 'data') -Recurse -Filter *.java -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName }
    if ($extra.Count) {
        $outX = Join-Path $work '_build\out_janino'
        Remove-Item $outX -Recurse -Force -ErrorAction SilentlyContinue
        New-Item -ItemType Directory -Force -Path $outX | Out-Null
        $xout = & $javac -encoding UTF-8 --release 8 -nowarn -Xlint:-options -cp $cp -d $outX @($extra) 2>&1
        $xout | Out-File (Join-Path $logDir 'build-janino.txt') -Encoding UTF8
        if ($LASTEXITCODE -ne 0) { Write-Host "警告：janino 脚本编译失败（$(Join-Path $logDir 'build-janino.txt')）："; $xout | Select-Object -First 30 }
        else { Write-Host "janino 脚本校验通过：$($extra.Count) 个文件" }
    }
}

# ---- 3) 打包 ----
$newJar = Join-Path $work ("_build\" + $JarName)
Remove-Item $newJar -Force -ErrorAction SilentlyContinue
Push-Location $out
& $jarExe cf $newJar .
Pop-Location
Write-Host "打包完成：$newJar ($([math]::Round((Get-Item $newJar).Length / 1KB, 1)) KB)"

# ---- 4) 备份 + 安装 ----
if (-not $NoInstall) {
    if (-not (Test-Path $targetJar)) { throw "目标 jar 不存在（mod 目录结构不符？）: $targetJar" }
    if (-not (Test-Path "$targetJar.orig")) { Copy-Item $targetJar "$targetJar.orig"; Write-Host "已备份原 jar -> $JarName.orig" }
    Copy-Item $newJar $targetJar -Force
    Write-Host "已安装到 $targetJar"
    Write-Host "建议接着跑：LoadTest.java（-noverify）+ cmp_strings.js（与原 jar 比对字符串常量）"
}
