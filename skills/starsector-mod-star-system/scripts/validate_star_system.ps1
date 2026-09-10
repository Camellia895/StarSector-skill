# ============================================================
#  星系 mod 通用校验脚本（基于 CustomizableStarSystems）
#  用法:
#    powershell -ExecutionPolicy Bypass -File validate_star_system.ps1 -ModPath .
#  检查项:
#    * mod_info.json 与 data\config\*.json 可解析（状态机剥离 # 注释与尾随逗号，不误伤字符串）
#    * customStarSystems.json: entities[0] 为 star/empty_location、focus 索引合法
#    * 描述接线: 每个 customDescriptionId 在 descriptions.csv 中有行且 type=CUSTOM
#    * CSV 数据行列数与各自表头一致
#    * 文本文件均为严格 UTF-8
# ============================================================
param(
    [string]$ModPath = (Get-Location)
)
$ErrorActionPreference = 'Stop'
$mod = [System.IO.Path]::GetFullPath($ModPath)
if (-not (Test-Path (Join-Path $mod 'mod_info.json'))) { throw "mod_info.json 不存在: $mod" }

# ---- 清洗 JSON（去 # 注释、去尾随逗号；状态机保证字符串内 #/逗号不受影响） ----
function Get-CleanJson([string]$text) {
    $sb = New-Object System.Text.StringBuilder
    $inStr = $false
    $i = 0
    while ($i -lt $text.Length) {
        $ch = $text[$i]
        if ($inStr) {
            [void]$sb.Append($ch)
            if ($ch -eq '"') { $inStr = $false }
            $i++; continue
        }
        if ($ch -eq '"') { $inStr = $true; [void]$sb.Append($ch); $i++; continue }
        if ($ch -eq '#') { while ($i -lt $text.Length -and $text[$i] -ne "`n") { $i++ }; continue }
        if ($ch -eq ',') {
            $j = $i + 1
            while ($j -lt $text.Length -and ($text[$j] -eq ' ' -or $text[$j] -eq "`t" -or $text[$j] -eq "`r" -or $text[$j] -eq "`n")) { $j++ }
            if ($j -lt $text.Length -and ($text[$j] -eq '}' -or $text[$j] -eq ']')) { $i++; continue }
            [void]$sb.Append($ch); $i++; continue
        }
        [void]$sb.Append($ch); $i++
    }
    return $sb.ToString()
}

$pass = 0; $fail = 0
function Check([string]$name, [bool]$ok, [string]$detail = '') {
    if ($ok) { $script:pass++; Write-Output ("  OK   " + $name + $(if ($detail) { "  -> " + $detail } else { '' })) }
    else { $script:fail++; Write-Output ("  FAIL " + $name + $(if ($detail) { "  -> " + $detail } else { '' })) }
}

Write-Output '=== JSON 解析 ==='
$jsonFiles = @('mod_info.json') + (Get-ChildItem (Join-Path $mod 'data\config') -Filter '*.json' -File -ErrorAction SilentlyContinue | ForEach-Object { 'data\config\' + $_.Name })
foreach ($jf in $jsonFiles) {
    $p = Join-Path $mod $jf
    if (-not (Test-Path -LiteralPath $p)) { continue }
    try { $null = (Get-CleanJson ([System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)) | ConvertFrom-Json); Check $jf $true } catch { Check $jf $false $_.Exception.Message }
}

Write-Output '=== 星系结构 ==='
$cssPath = Join-Path $mod 'data\config\customStarSystems.json'
if (Test-Path -LiteralPath $cssPath) {
    try {
        $css = Get-CleanJson ([System.IO.File]::ReadAllText($cssPath, [System.Text.Encoding]::UTF8)) | ConvertFrom-Json
        foreach ($sysProp in $css.PSObject.Properties) {
            $sys = $sysProp.Value
            if ($null -eq $sys.entities) { continue }
            $e = $sys.entities
            Write-Output ("  星系: " + $sysProp.Name + "  (entities=" + $e.Count + ")")
            Check 'entities[0] 为 empty_location 或 star' ($e[0].entity -eq 'empty_location' -or $e[0].entity -eq 'star')
            if ($e[0].entity -eq 'empty_location') { Check 'empty_location 声明了 numOfCenterStars 颗恒星' ($e[0].numOfCenterStars -ge 1) }
            $bad = @()
            for ($i = 0; $i -lt $e.Count; $i++) { $f = $e[$i].focus; if ($null -ne $f -and $f -isnot [array] -and $f -ge $i) { $bad += "$i" } }
            Check 'focus 索引均小于自身下标' ($bad.Count -eq 0) $(if ($bad.Count) { $bad -join ',' } else { '' })
        }
    } catch { Check '星系结构' $false $_.Exception.Message }
}

Write-Output '=== 描述接线（customDescriptionId -> descriptions.csv type=CUSTOM）==='
$descPath = Join-Path $mod 'data\strings\descriptions.csv'
if ((Test-Path -LiteralPath $cssPath) -and (Test-Path -LiteralPath $descPath)) {
    try {
        $css = Get-CleanJson ([System.IO.File]::ReadAllText($cssPath, [System.Text.Encoding]::UTF8)) | ConvertFrom-Json
        $customIds = New-Object 'System.Collections.Generic.HashSet[string]'
        foreach ($sysProp in $css.PSObject.Properties) {
            $sys = $sysProp.Value
            if ($null -eq $sys.entities) { continue }
            foreach ($ent in $sys.entities) { if ($ent.customDescriptionId) { [void]$customIds.Add([string]$ent.customDescriptionId) } }
        }
        $descMap = @{}
        foreach ($line in ([System.IO.File]::ReadAllLines($descPath) | Select-Object -Skip 1)) {
            if ($line.Trim() -eq '' -or $line.Trim().StartsWith('#')) { continue }
            $f = $line -split ','
            $descMap[$f[0]] = $f[1]
        }
        $missing = @(); $wrongType = @()
        foreach ($id in $customIds) {
            if (-not $descMap.ContainsKey($id)) { $missing += $id }
            elseif ($descMap[$id] -ne 'CUSTOM') { $wrongType += "$id($($descMap[$id]))" }
        }
        Check 'customDescriptionId 均有对应行' ($missing.Count -eq 0) $(if ($missing.Count) { $missing -join ',' } else { '' })
        Check '对应行 type 均为 CUSTOM' ($wrongType.Count -eq 0) $(if ($wrongType.Count) { $wrongType -join ',' } else { '' })
    } catch { Check '描述接线' $false $_.Exception.Message }
}

Write-Output '=== CSV 列数（与各自表头比对）==='
foreach ($csv in @('data\campaign\procgen\planet_gen_data.csv','data\campaign\procgen\star_gen_data.csv','data\strings\descriptions.csv')) {
    $p = Join-Path $mod $csv
    if (-not (Test-Path -LiteralPath $p)) { continue }
    $lines = [System.IO.File]::ReadAllLines($p)
    $hdr = ($lines[0].ToCharArray() | Where-Object { $_ -eq ',' }).Count + 1
    $badRow = @()
    foreach ($line in $lines | Select-Object -Skip 1) {
        if ($line.Trim() -eq '' -or $line.Trim().StartsWith('#')) { continue }
        $n = ($line.ToCharArray() | Where-Object { $_ -eq ',' }).Count + 1
        if ($n -ne $hdr) { $badRow += "$($line.Split(',')[0]):$n" }
    }
    Check $csv ($badRow.Count -eq 0) $(if ($badRow.Count) { "列数不符: $($badRow -join ',')" } else { "表头 $hdr 列" })
}

Write-Output '=== 编码（严格 UTF-8，仅文本文件）==='
Get-ChildItem -LiteralPath $mod -Recurse -File | Where-Object { $_.Extension -in @('.json', '.csv') } | ForEach-Object {
    $b = [System.IO.File]::ReadAllBytes($_.FullName)
    $utf8 = $true
    try { $null = [System.Text.UTF8Encoding]::new($false,$true).GetString($b) } catch { $utf8 = $false }
    if (-not $utf8) { Check $_.FullName.Substring($mod.Length + 1) $false '非严格 UTF-8' }
}
Write-Output ("==== 结果: 通过 $pass / 失败 $fail ====")
if ($fail -gt 0) { exit 1 }
