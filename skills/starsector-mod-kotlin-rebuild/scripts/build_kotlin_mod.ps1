# Rebuild a Kotlin Starsector mod jar for game 0.98a-RC8 (kotlinc 2.1.0 embeddable, self-contained toolchain).
# Runtime kotlin-stdlib is provided by LazyLib's jars/internal/Kotlin-Runtime.jar (metadata 2.1.0 => Kotlin 2.x).
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File build_kotlin_mod.ps1 `
#       -ModName automatic-orders -SrcDir <mod_work>\automatic-orders\src\main\kotlin `
#       -OutClasses <mod_work>\automatic-orders\out\classes -OutJar <mod_work>\automatic-orders\automaticorders.jar `
#       -InstallTo <game>\mods\automatic-orders-0.3.2\automaticorders.jar
param(
    [Parameter(Mandatory=$true)][string]$ModName,     # module name (used for -module-name / kotlin_module)
    [Parameter(Mandatory=$true)][string]$SrcDir,      # .../src/main/kotlin
    [string]$OutClasses = '',                          # default: <SrcDir>\..\..\..\out\classes (auto)
    [string]$OutJar = '',                              # default: <SrcDir>\..\..\..\<ModName>.jar (auto)
    [string]$InstallTo = '',                           # optional: copy final jar here (must be writable, game closed)
    [string]$Game = 'C:\game\StarSector.v0.9.8a-RC8'
)
$ErrorActionPreference = 'Stop'
$java = "$Game\jre\bin\java.exe"
$jbr  = 'C:\Program Files\Android\Android Studio\jbr\bin'
$tc   = "$Game\_work\_tools\kotlinc-2.1.0"
$core = "$Game\starsector-core"

# --- resolve defaults ---
$srcParent = Split-Path (Split-Path (Split-Path $SrcDir -Parent) -Parent) -Parent   # up from kotlin/ to project root
if (-not $OutClasses) { $OutClasses = Join-Path $srcParent 'out\classes' }
if (-not $OutJar)     { $OutJar = Join-Path $srcParent "$ModName.jar" }

if (-not (Test-Path "$tc\kotlin-compiler-embeddable-2.1.0.jar")) {
    throw "toolchain missing at $tc - download jars per SKILL.md section 2 (Maven Central)"
}

$kc   = "$tc\kotlin-compiler-embeddable-2.1.0.jar"
$cprt = "$tc\kotlin-stdlib-2.1.0.jar;$tc\kotlin-script-runtime-2.1.0.jar;$tc\trove4j.jar;$tc\kotlinx-coroutines-core-jvm-1.9.0.jar;$tc\annotations.jar"
# compile classpath: game core jars + LazyLib Kotlin-Runtime as kotlin stdlib (do NOT add kotlin-stdlib 2.1.0 here)
$gamecp = "$core\starfarer.api.jar;$core\starfarer_obf.jar;$core\json.jar;$core\log4j-1.2.9.jar;$Game\mods\LazyLib\jars\internal\Kotlin-Runtime.jar"

if (Test-Path $OutClasses) { Remove-Item $OutClasses -Recurse -Force }
New-Item -ItemType Directory -Force $OutClasses | Out-Null

$files = Get-ChildItem $SrcDir -Recurse -Filter *.kt | ForEach-Object { $_.FullName }
& $java -cp "$kc;$cprt" org.jetbrains.kotlin.cli.jvm.K2JVMCompiler -no-stdlib -no-reflect -jvm-target 1.8 `
    -module-name $ModName -cp $gamecp -d $OutClasses $files
if ($LASTEXITCODE -ne 0) { throw "kotlinc failed ($LASTEXITCODE)" }
Write-Host "compile OK -> $OutClasses"

Push-Location $OutClasses
& "$jbr\jar.exe" cf $OutJar .
Pop-Location
Write-Host "jar built: $OutJar ($((Get-Item $OutJar).Length) bytes)"

if ($InstallTo) {
    Copy-Item $OutJar $InstallTo -Force
    Write-Host "installed -> $InstallTo"
}
