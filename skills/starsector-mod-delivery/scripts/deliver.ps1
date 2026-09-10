param(
    [string]$ModPath = (Get-Location),
    [string]$OutDir = "",
    [string]$Name = "",
    [string]$InnerName = "",
    [switch]$IncludeSrc,
    [switch]$NoExclude
)
# ============================================================
#  Starsector mod 交付打包脚本（本项目自用，非游戏官方工具）
#  用法示例:
#    powershell -ExecutionPolicy Bypass -File deliver.ps1 `
#        -ModPath C:\game\StarSector.v0.9.8a-RC8\mods\<Mod>
#
#  行为:
#    * 压缩包文件名 = mod_info.json 的 name（中文名），清洗 Windows 非法字符
#    * zip 内部嵌套一个同名文件夹（默认），解压后直接是一个干净的 mod 目录
#    * 自动排除开发残留: .git/.idea/out/cache/任意层级 src/*.iml/*.bak* 等
#      （data\scripts 是运行时代码，不在排除之列）
#    * 空目录（如 ai\skills、ai\脚本 占位）写入目录条目，解压后结构不丢失
#    * 条目名 UTF-8（中文路径在 Windows 10+ 资源管理器可正常解压）
#  参数:
#    -ModPath      mod 目录（默认当前目录）
#    -OutDir       输出目录（默认 <游戏根>\_work\deliver\；自动识别游戏根）
#    -Name         覆盖压缩包名（默认取 mod_info.json 的 name）
#    -InnerName    覆盖内部文件夹名（默认 = 压缩包名；可设为 mod id 如 "Templars"）
#    -IncludeSrc   包含任意层级 src 源码（默认排除）
#    -NoExclude    完全不过滤任何文件（含 .git 等）
# ============================================================
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$modPath = [System.IO.Path]::GetFullPath($ModPath)
if (-not (Test-Path (Join-Path $modPath 'mod_info.json'))) {
    throw "mod_info.json 不存在: $modPath"
}

# ---- 读取 mod_info.json（必须显式 UTF-8，避免系统 ANSI 读成乱码） ----
# 注: Starsector 的 mod_info.json 允许 # 行注释；用状态机清洗：
#     * # 注释（整行或行内，字符串外）剔除到行尾
#     * 尾随逗号（,} / ,]）剔除（仅字符串外，不会误伤字符串内容）
$rawJson = [System.IO.File]::ReadAllText((Join-Path $modPath 'mod_info.json'), [System.Text.Encoding]::UTF8)
$jsonClean = & {
    $t = $rawJson
    $sb = New-Object System.Text.StringBuilder
    $inStr = $false
    $i = 0
    $n = $t.Length
    while ($i -lt $n) {
        $c = $t[$i]
        if ($inStr) {
            [void]$sb.Append($c)
            if ($c -eq '"') {
                if ($i + 1 -lt $n -and $t[$i + 1] -eq '"') { [void]$sb.Append('"'); $i++ }
                else { $inStr = $false }
            }
            $i++
            continue
        }
        if ($c -eq '"') { $inStr = $true; [void]$sb.Append($c); $i++; continue }
        if ($c -eq '#') {
            while ($i -lt $n -and $t[$i] -ne "`n") { $i++ }
            continue
        }
        if ($c -eq ',') {
            $j = $i + 1
            while ($j -lt $n -and ($t[$j] -eq ' ' -or $t[$j] -eq "`t" -or $t[$j] -eq "`r" -or $t[$j] -eq "`n")) { $j++ }
            if ($j -lt $n -and ($t[$j] -eq '}' -or $t[$j] -eq ']')) { $i++; continue }
            [void]$sb.Append($c)
            $i++
            continue
        }
        [void]$sb.Append($c)
        $i++
    }
    return $sb.ToString()
}
$info = ($jsonClean -replace ',\s*([}\]])', '$1').Trim() | ConvertFrom-Json
$modName = if ($Name) { $Name } else { [string]$info.name }
$modId = [string]$info.id

# ---- 清洗为合法文件名 ----
function Get-CleanName([string]$s) {
    $invalid = -join [System.IO.Path]::GetInvalidFileNameChars()
    $s = $s -replace ('[' + [regex]::Escape($invalid) + ']'), ''
    $s = $s.Trim().TrimEnd('.')
    if ([string]::IsNullOrWhiteSpace($s)) { $s = $modId }
    return $s
}
$zipBase = Get-CleanName $modName
$innerName = if ($InnerName) { Get-CleanName $InnerName } else { $zipBase }

# ---- 输出目录：默认 <游戏根>\_work\deliver\ ----
if (-not $OutDir) {
    $gameRoot = $null
    $idx = $modPath.IndexOf('\mods\', [System.StringComparison]::OrdinalIgnoreCase)
    if ($idx -gt 0) { $gameRoot = $modPath.Substring(0, $idx) }
    $OutDir = if ($gameRoot) { Join-Path $gameRoot '_work\deliver' } else { Join-Path (Split-Path $modPath) '_deliver' }
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

# ---- 排除判断 ----
$excludeDirNames = @('.git', '.idea', 'out', 'cache', 'build', 'dist')
$excludeWildcards = @('*.iml', '*.bak', '*.bak_*', '*.orig', '*.rej', 'Thumbs.db', 'desktop.ini',
    '~$*', '*.tmp', '*.lck', '.DS_Store')   # ~$* = Office/Excel 打开文件时生成的锁文件（被占用会导致读取失败）
function Test-Excluded([string]$rel, [bool]$isDir) {
    if ($NoExclude) { return $false }
    $parts = $rel -split '[\\/]'
    foreach ($d in $excludeDirNames) { if ($parts -contains $d) { return $true } }
    if (-not $IncludeSrc -and $parts -contains 'src') { return $true }   # 任意层级 src 源码目录
    if ($isDir) { return $false }
    $leaf = Split-Path $rel -Leaf
    foreach ($w in $excludeWildcards) { if ($leaf -like $w) { return $true } }
    return $false
}

# ---- 收集文件 ----
$all = Get-ChildItem $modPath -Recurse -File -Force
$files = @()
$skipped = 0
foreach ($f in $all) {
    $rel = $f.FullName.Substring($modPath.Length).TrimStart('\', '/')
    if (Test-Excluded $rel $false) { $skipped++; continue }
    $files += $f
}

# ---- 创建 zip（内部嵌套 <innerName>/ 文件夹；空目录写目录条目保结构） ----
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zipPath = Join-Path $OutDir ($zipBase + '.zip')
# 注意: 文件名可能含 [ ] 等字符, PowerShell -Path 会当通配符, 必须用字面方式判断/删除
if ([System.IO.File]::Exists($zipPath)) { Remove-Item -LiteralPath $zipPath -Force }
$zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    # 文件条目
    $locked = @()
    foreach ($f in $files) {
        $rel = $f.FullName.Substring($modPath.Length).TrimStart('\', '/') -replace '\\', '/'
        # 先以共享方式打开（被 Excel/编辑器占用的 xlsx 等可降级处理，而非整体失败）
        $fs = $null
        try {
            $fs = New-Object System.IO.FileStream($f.FullName, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
        } catch {
            try { $fs = [System.IO.File]::OpenRead($f.FullName) } catch { $locked += $rel; continue }
        }
        $entry = $zip.CreateEntry(($innerName + '/' + $rel), [System.IO.Compression.CompressionLevel]::Optimal)
        $es = $entry.Open()
        try { $fs.CopyTo($es) } finally { $fs.Close(); $es.Close() }
    }
    # 空目录条目：仅写入"未包含任何文件"的目录，保留 ai\skills、ai\脚本 等占位结构
    $allDirs = Get-ChildItem $modPath -Recurse -Directory -Force
    foreach ($d in $allDirs) {
        $relDir = $d.FullName.Substring($modPath.Length).TrimStart('\', '/')
        if (Test-Excluded $relDir $true) { continue }
        $prefix = $d.FullName + '\'
        $hasFile = $false
        foreach ($f in $files) { if ($f.FullName.StartsWith($prefix)) { $hasFile = $true; break } }
        if (-not $hasFile) {
            $entry = $zip.CreateEntry(($innerName + '/' + ($relDir -replace '\\', '/') + '/'))
            $entry.Open().Close()
        }
    }
} finally {
    $zip.Dispose()
}

# ---- 摘要 ----
$size = (Get-Item -LiteralPath $zipPath).Length
Write-Output ('已打包: ' + $zipPath)
Write-Output ('  mod 名: ' + $modName + '   (id: ' + $modId + ')')
Write-Output ('  内部文件夹: ' + $innerName + '/')
Write-Output ('  条目数: ' + $files.Count + '   排除: ' + $skipped + '   大小: ' + [math]::Round([double]$size / 1MB, 2) + ' MB')
if ($locked -and $locked.Count -gt 0) {
    Write-Output ('  [WARN] 被其它进程占用而跳过 ' + $locked.Count + ' 个文件（关闭 Excel/编辑器后重新打包即可纳入）:')
    $locked | Select-Object -First 10 | ForEach-Object { Write-Output ('         ' + $_) }
}
