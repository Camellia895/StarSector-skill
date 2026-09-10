#Requires -Version 5.1
<#
.SYNOPSIS
    安装 / 重建 CFR 反编译器（从上游源码构建）到 <游戏根>\_work\_tools\cfr\。

.DESCRIPTION
    Maven Central 上 CFR 的最后发布版是 0.152（2021），上游 master 已领先上百个
    提交，上游 README 明确建议「想要现代版本就 clone 仓库自行构建」。本脚本把这条
    链路自动化，幂等可重复执行：

      1. 定位 JDK（构建需要 javac；游戏自带 jre 没有）
      2. 准备便携版 Maven（缺失则从 Maven Central 下载解压到 _work\_tools\）
      3. 准备源码（有 .git 就 pull；没有则 git clone，git 不通时回退 codeload
         tarball 并补建 .git —— cfr 的版本号靠 git-commit-id 插件注入，必须有 .git）
      4. 调 _work\_tools\cfr-build.bat 构建（参数写死在 bat 内，见该文件注释）
      5. 把 target\cfr-*.jar 安装为 _work\_tools\cfr\cfr.jar，并铺好启动器
      6. 实跑 cfr --version 验证

.PARAMETER JdkHome
    JDK 根目录（须含 bin\javac.exe）。默认自动探测。

.PARAMETER MavenVersion
    便携版 Maven 版本，默认 3.9.16（已实测可用）。

.PARAMETER RepoUrl
    上游仓库地址，默认 https://github.com/leibnitz27/cfr.git

.PARAMETER Branch
    codeload 回退通道使用的分支名，默认 master。

.PARAMETER NoPull
    源码已存在时不做 git pull（离线 / 想锁版本时用）。

.PARAMETER SkipBuild
    只做安装步骤 5、6（假设已构建过），用于重新铺设启动器。

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File <本 skill>\scripts\install-cfr.ps1

.EXAMPLE
    # 指定 JDK、不联网刷新
    .\install-cfr.ps1 -JdkHome 'C:\Program Files\Java\jdk-17' -NoPull
#>
[CmdletBinding()]
param(
    [string] $JdkHome,
    [string] $MavenVersion = '3.9.16',
    [string] $RepoUrl      = 'https://github.com/leibnitz27/cfr.git',
    [string] $Branch       = 'master',
    [switch] $NoPull,
    [switch] $SkipBuild
)

$ErrorActionPreference = 'Stop'
$ProgressPreference    = 'SilentlyContinue'

# ---------------------------------------------------------------- 路径
# 本脚本位于 <游戏根>\_work\skills\skills\<本 skill>\scripts\
# 注意：技能库分层后 skill 位于 <skills 根>\skills\ 之下（多了一层），
#       故自 $PSScriptRoot 需上溯 5 级才到游戏根（重构前为 4 级）。
$scriptDir   = $PSScriptRoot
$skillDir    = Split-Path -Parent $scriptDir                           # <skills 根>\skills\<skill>
$skillsSub   = Split-Path -Parent $skillDir                            # <skills 根>\skills
$skillsRoot  = Split-Path -Parent $skillsSub                           # <skills 根>
$workDir     = Split-Path -Parent $skillsRoot                          # _work
$gameRoot    = Split-Path -Parent $workDir                             # 游戏根

$toolsDir    = Join-Path $workDir  '_tools'
$srcDir      = Join-Path $toolsDir 'cfr-src'
$mavenDir    = Join-Path $toolsDir "apache-maven-$MavenVersion"
$mavenCmd    = Join-Path $mavenDir 'bin\mvn.cmd'
$cfrDir      = Join-Path $toolsDir 'cfr'
$cfrJar      = Join-Path $cfrDir   'cfr.jar'
$cfrCmd      = Join-Path $cfrDir   'cfr.cmd'
$cfrPs1      = Join-Path $cfrDir   'cfr.ps1'
$buildBat    = Join-Path $toolsDir 'cfr-build.bat'
$buildLog    = Join-Path $toolsDir 'cfr-build.log'
$launcherDir = Join-Path $scriptDir 'launcher'

Write-Host "游戏根目录: $gameRoot"
if (-not (Test-Path -LiteralPath (Join-Path $gameRoot 'starsector-core'))) {
    Write-Warning "该目录下没有 starsector-core\，路径推断可能不对，请确认脚本位置。"
}

# ---------------------------------------------------------------- 工具函数
function Resolve-Jdk {
    param([string] $Explicit)

    $cands = New-Object System.Collections.Generic.List[string]
    if ($Explicit)          { $cands.Add($Explicit) }
    if ($env:CFR_JAVA_HOME) { $cands.Add($env:CFR_JAVA_HOME) }
    if ($env:JAVA_HOME)     { $cands.Add($env:JAVA_HOME) }

    $javacCmd = Get-Command javac.exe -ErrorAction SilentlyContinue
    if ($javacCmd) {
        $cands.Add((Split-Path -Parent (Split-Path -Parent $javacCmd.Source)))
    }
    # 本项目已验证可用的 JDK（Android Studio 自带 JBR）
    $cands.Add('C:\Program Files\Android\Android Studio\jbr')

    foreach ($c in $cands) {
        if ([string]::IsNullOrWhiteSpace($c)) { continue }
        if (Test-Path -LiteralPath (Join-Path $c 'bin\javac.exe')) {
            return (Resolve-Path -LiteralPath $c).Path
        }
    }
    return $null
}

function Ensure-Maven {
    if (Test-Path -LiteralPath $mavenCmd) {
        Write-Host "  Maven 已存在: $mavenDir"
        return
    }
    $url = "https://repo1.maven.org/maven2/org/apache/maven/apache-maven/$MavenVersion/apache-maven-$MavenVersion-bin.zip"
    $zip = Join-Path $env:TEMP "apache-maven-$MavenVersion-bin.zip"
    Write-Host "  下载便携版 Maven: $url"
    Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
    Expand-Archive -Path $zip -DestinationPath $toolsDir -Force
    Remove-Item -LiteralPath $zip -Force
    if (-not (Test-Path -LiteralPath $mavenCmd)) {
        throw "Maven 解压后仍未找到 $mavenCmd"
    }
    Write-Host "  已解压到: $mavenDir"
}

function Ensure-Source {
    $pom = Join-Path $srcDir 'pom.xml'

    if (-not (Test-Path -LiteralPath $pom)) {
        $cloned = $false
        if (Get-Command git -ErrorAction SilentlyContinue) {
            Write-Host "  git clone $RepoUrl"
            & git clone --progress $RepoUrl $srcDir
            $cloned = ($LASTEXITCODE -eq 0) -and (Test-Path -LiteralPath $pom)
            if (-not $cloned) {
                Write-Warning "git clone 失败（github.com 直连常被阻断），回退 codeload tarball"
                if (Test-Path -LiteralPath $srcDir) { Remove-Item -LiteralPath $srcDir -Recurse -Force }
            }
        }
        else {
            Write-Warning "未找到 git，回退 codeload tarball（无历史，但可构建）"
        }

        if (-not $cloned) {
            $url = "https://codeload.github.com/leibnitz27/cfr/tar.gz/refs/heads/$Branch"
            $tar = Join-Path $env:TEMP "cfr-$Branch.tar.gz"
            Write-Host "  下载源码快照: $url"
            Invoke-WebRequest -Uri $url -OutFile $tar -UseBasicParsing
            $tmp = Join-Path $env:TEMP ("cfr-extract-" + [guid]::NewGuid().ToString('N'))
            New-Item -ItemType Directory -Force -Path $tmp | Out-Null
            & tar -xzf $tar -C $tmp
            if ($LASTEXITCODE -ne 0) { throw "tarball 解压失败: $tar" }
            $inner = Get-ChildItem -LiteralPath $tmp -Directory | Select-Object -First 1
            if (-not $inner) { throw "tarball 解压后没有目录" }
            Move-Item -LiteralPath $inner.FullName -Destination $srcDir
            Remove-Item -LiteralPath $tmp -Recurse -Force
            Remove-Item -LiteralPath $tar -Force
            Write-Host "  已解压到: $srcDir"
        }
    }

    $gitDir = Join-Path $srcDir '.git'
    if (-not (Test-Path -LiteralPath $gitDir)) {
        # cfr 的版本号/提交号由 git-commit-id 插件注入到 CfrVersionInfo.java，
        # 没有 .git 就注入不了（仍能编译，但 --version 会出现未替换的占位符）。
        if (Get-Command git -ErrorAction SilentlyContinue) {
            Write-Host "  补建本地 git 仓库（cfr 版本号注入需要 .git）"
            & git -C $srcDir init -q
            & git -C $srcDir add -A
            & git -C $srcDir -c user.name="cfr-build" -c user.email="cfr-build@localhost" commit -q -m "Import CFR $Branch snapshot"
        }
        else {
            Write-Warning "既无 git 也无 .git：cfr 版本号将无法注入"
        }
    }
    elseif (-not $NoPull) {
        Write-Host "  git pull（刷新到上游最新提交）"
        & git -C $srcDir pull --ff-only
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "git pull 失败（网络或存在本地改动），沿用当前工作树"
        }
    }
}

# ---------------------------------------------------------------- 1. JDK
Write-Host "[1/6] 定位 JDK"
$jdk = Resolve-Jdk -Explicit $JdkHome
if (-not $jdk) {
    throw @"
找不到带 javac 的 JDK（游戏自带的 jre 没有 javac，不能用来构建）。
请用 -JdkHome 指定，或设置 CFR_JAVA_HOME / JAVA_HOME。
本项目已验证可用：C:\Program Files\Android\Android Studio\jbr
"@
}
$javacVersion = (& (Join-Path $jdk 'bin\javac.exe') -version 2>&1 | Out-String).Trim()
Write-Host "  JDK: $jdk  ($javacVersion)"

# ---------------------------------------------------------------- 2. Maven
Write-Host "[2/6] 准备 Maven"
Ensure-Maven

# ---------------------------------------------------------------- 3. 源码
Write-Host "[3/6] 准备源码"
Ensure-Source

# ---------------------------------------------------------------- 4. 构建
if ($SkipBuild) {
    Write-Host "[4/6] 跳过构建（-SkipBuild）"
}
else {
    Write-Host "[4/6] 构建"
    Copy-Item -LiteralPath (Join-Path $scriptDir 'build-cfr.bat') -Destination $buildBat -Force
    $env:CFR_JAVA_HOME = $jdk
    Write-Host "  执行 $buildBat（首次会下载 Maven 插件，约 1~5 分钟）"
    & cmd.exe /c "`"$buildBat`" > `"$buildLog`" 2>&1"
    $code = $LASTEXITCODE
    $logText = if (Test-Path -LiteralPath $buildLog) { Get-Content -LiteralPath $buildLog -Raw } else { '' }
    if ($code -ne 0 -or $logText -notmatch 'BUILD SUCCESS') {
        Write-Host "----- 构建日志末尾 -----"
        Write-Host (($logText -split "`r?`n" | Select-Object -Last 25) -join [Environment]::NewLine)
        Write-Host "-----------------------"
        throw "构建失败（退出码 $code）。完整日志: $buildLog"
    }
    Write-Host "  BUILD SUCCESS"
}

# ---------------------------------------------------------------- 5. 安装
Write-Host "[5/6] 安装到 $cfrDir"
$built = Get-ChildItem -LiteralPath (Join-Path $srcDir 'target') -Filter 'cfr-*.jar' -ErrorAction SilentlyContinue |
         Where-Object { $_.Name -notlike '*-sources.jar' } |
         Sort-Object LastWriteTime -Descending |
         Select-Object -First 1
if (-not $built) { throw "未找到构建产物 $srcDir\target\cfr-*.jar" }

New-Item -ItemType Directory -Force -Path $cfrDir | Out-Null
Copy-Item -LiteralPath $built.FullName -Destination $cfrJar -Force
Copy-Item -Path (Join-Path $launcherDir '*') -Destination $cfrDir -Force
Write-Host "  cfr.jar  <- $($built.Name)  ($($built.Length) 字节)"
Write-Host "  启动器   -> cfr.ps1 / cfr.cmd"

# ---------------------------------------------------------------- 6. 验证
Write-Host "[6/6] 验证"
$out = & cmd.exe /c "`"$cfrCmd`" --version 2>&1"
$outText = ($out | Out-String).Trim()
$versionLine = ($out -split "`r?`n" | Where-Object { $_ -match 'CFR\s' } | Select-Object -First 1)
if (-not $versionLine) { $versionLine = $outText }
Write-Host "  cfr --version -> $versionLine"
if ($outText -notmatch 'CFR\s') {
    throw "cfr --version 没有输出版本信息，安装可能不完整：$outText"
}

$commit = ''
if (Test-Path -LiteralPath (Join-Path $srcDir '.git')) {
    $commit = (& git -C $srcDir rev-parse --short HEAD 2>$null | Out-String).Trim()
}

Write-Host ''
Write-Host '================ 安装完成 ================'
Write-Host "启动器      : $cfrPs1   （cmd 用 cfr.cmd）"
Write-Host "jar         : $cfrJar"
Write-Host "版本        : $versionLine"
if ($commit) { Write-Host "上游提交    : $commit" }
Write-Host "源码        : $srcDir"
Write-Host "构建脚本    : $buildBat"
Write-Host "构建日志    : $buildLog"
Write-Host ''
Write-Host '常用命令（详见 SKILL.md）：'
Write-Host "  $cfrPs1 <jar> --outputdir <目录>"
Write-Host "  $cfrPs1 <jar> --jarfilter `"类名`$`" --outputdir <目录> --silent true"
