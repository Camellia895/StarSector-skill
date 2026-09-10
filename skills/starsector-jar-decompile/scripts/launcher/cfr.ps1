#Requires -Version 5.1
<#
.SYNOPSIS
    CFR decompiler launcher for the Starsector work directory.

.DESCRIPTION
    Runs the locally built cfr.jar with the given CFR arguments.
    Java is resolved in this order:
      1. $env:CFR_JAVA
      2. java.exe on PATH
      3. the game's bundled JRE (..\..\..\jre\bin\java.exe)

.PARAMETER CfrArgs
    Any arguments to pass through to CFR.

.EXAMPLE
    .\cfr.ps1 --version

.EXAMPLE
    .\cfr.ps1 ..\..\..\starfarer.api.jar --outputdir out

.NOTES
    Heap size can be overridden with $env:CFR_JAVA_OPTS (default -Xmx2g).
#>
[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]] $CfrArgs
)

$ErrorActionPreference = 'Stop'

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$jar = Join-Path $here 'cfr.jar'

if (-not (Test-Path -LiteralPath $jar)) {
    Write-Error "[cfr] cfr.jar not found at '$jar'. Build it first with: _work\_tools\cfr-build.bat"
    exit 1
}

$javaExe = $null
if ($env:CFR_JAVA) {
    $javaExe = $env:CFR_JAVA
}
elseif (Get-Command java.exe -ErrorAction SilentlyContinue) {
    $javaExe = (Get-Command java.exe).Source
}
else {
    $bundled = Join-Path $here '..\..\..\jre\bin\java.exe'
    if (Test-Path -LiteralPath $bundled) {
        $javaExe = (Resolve-Path -LiteralPath $bundled).Path
    }
}

if (-not $javaExe) {
    Write-Error '[cfr] No java found. Set $env:CFR_JAVA to a java.exe path.'
    exit 1
}

$opts = @('-Xmx2g')
if ($env:CFR_JAVA_OPTS) {
    $opts = $env:CFR_JAVA_OPTS -split '\s+' | Where-Object { $_ }
}

# CFR prints a "Processing ..." note per class on stderr. That is normal
# output, not a failure, so make sure a caller running with a strict
# $ErrorActionPreference ('Stop') does not turn it into a terminating error.
$ErrorActionPreference = 'Continue'
& $javaExe @opts -jar $jar @CfrArgs
exit $LASTEXITCODE
