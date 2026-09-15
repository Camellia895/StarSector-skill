# run_projspeccheck.ps1 -- compile (once, cached) and run the engine-faithful projectile/missile
# spec checker (ProjSpecCheck.java) with the game's own org.json.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File run_projspeccheck.ps1 -DataDir <mod data dir> [<more...>]
#   powershell -ExecutionPolicy Bypass -File run_projspeccheck.ps1 -AllMods
#
# Exit code: 0 = clean, 1 = hits, 2 = usage/environment problem.
# Pure ASCII on purpose (Windows PowerShell 5.1 reads BOM-less .ps1 as ANSI).
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$DataDir,
    [switch]$AllMods
)

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Src = Join-Path $ScriptDir 'ProjSpecCheck.java'

# Game root = four levels up from <skills>\shared\scripts:
# scripts -> shared -> <skills> -> _work -> <game root>
$GameRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $ScriptDir)))
$Core = Join-Path $GameRoot 'starsector-core'
$JsonJar = Join-Path $Core 'json.jar'
$OutDir = Join-Path $GameRoot '_work\_tmp\projspeccheck'

if (-not (Test-Path -LiteralPath $JsonJar)) { Write-Error "json.jar not found: $JsonJar"; exit 2 }
if (-not (Test-Path -LiteralPath $Src)) { Write-Error "ProjSpecCheck.java not found: $Src"; exit 2 }

if ($AllMods) {
    $DataDir = @()
    $ModsDir = Join-Path $GameRoot 'mods'
    foreach ($d in (Get-ChildItem -LiteralPath $ModsDir -Directory)) {
        $cand = Join-Path $d.FullName 'data'
        if (Test-Path -LiteralPath $cand) { $DataDir += $cand }
    }
    $coreData = Join-Path $Core 'data'
    if (Test-Path -LiteralPath $coreData) { $DataDir += $coreData }
}
if (-not $DataDir -or $DataDir.Count -eq 0) {
    Write-Host 'Usage: run_projspeccheck.ps1 -DataDir <mod data dir> [more...] | -AllMods'
    exit 2
}

# --- java runtime (game JRE is enough: we only need json.jar) ---
$Java = $null
foreach ($cand in @((Join-Path $GameRoot 'jre\bin\java.exe'), $env:JAVA_HOME)) {
    if ($cand -and (Test-Path -LiteralPath $cand)) { $Java = $cand; break }
}
foreach ($cand in @((Join-Path $GameRoot 'jre\bin\java.exe'),
                    'C:\Program Files\Android\Android Studio\jbr\bin\javac.exe')) {
    if (-not $Java -and $cand -and (Test-Path -LiteralPath $cand)) { $Java = Join-Path (Split-Path -Parent $cand) 'java.exe' }
}
if (-not $Java) { $Java = 'java' }

# --- compile if needed ---
$Class = Join-Path $OutDir 'ProjSpecCheck.class'
$Javac = 'C:\Program Files\Android\Android Studio\jbr\bin\javac.exe'
$Javac = if (Test-Path -LiteralPath $Javac) { $Javac } else { 'javac' }
$needBuild = -not (Test-Path -LiteralPath $Class)
if (-not $needBuild) { $needBuild = (Get-Item -LiteralPath $Src).LastWriteTime -gt (Get-Item -LiteralPath $Class).LastWriteTime }
if ($needBuild) {
    New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
    & $Javac -encoding UTF-8 --release 17 -cp $JsonJar -d $OutDir $Src
    if ($LASTEXITCODE -ne 0) { Write-Error 'javac failed (need a JDK 17+ with javac on the machine)'; exit 2 }
}

& $Java -cp "$OutDir;$JsonJar" ProjSpecCheck @DataDir
exit $LASTEXITCODE
