@echo off
setlocal enableextensions

REM ============================================================
REM  CFR decompiler launcher
REM
REM  Usage:  cfr.cmd <cfr arguments...>
REM  Java:   %CFR_JAVA%  >  java.exe on PATH  >  game bundled JRE
REM  Heap:   %CFR_JAVA_OPTS%  (default -Xmx2g)
REM
REM  Note: %* is forwarded verbatim, so "-Dfoo=bar" style arguments
REM  survive intact (unlike %1/%2 which cmd splits at "=").
REM ============================================================

set "HERE=%~dp0"
set "JAR=%HERE%cfr.jar"

if not exist "%JAR%" (
    echo [cfr] ERROR: cfr.jar not found at "%JAR%" 1>&2
    echo [cfr] Build it first with: _work\_tools\cfr-build.bat 1>&2
    exit /b 1
)

set "JAVA_EXE="
if defined CFR_JAVA set "JAVA_EXE=%CFR_JAVA%"
if not defined JAVA_EXE for %%I in (java.exe) do if not defined JAVA_EXE set "JAVA_EXE=%%~$PATH:I"
if not defined JAVA_EXE if exist "%HERE%..\..\..\jre\bin\java.exe" set "JAVA_EXE=%HERE%..\..\..\jre\bin\java.exe"
if not defined JAVA_EXE (
    echo [cfr] ERROR: no java found. Set CFR_JAVA to a java.exe path. 1>&2
    exit /b 1
)

set "OPTS=-Xmx2g"
if defined CFR_JAVA_OPTS set "OPTS=%CFR_JAVA_OPTS%"

"%JAVA_EXE%" %OPTS% -jar "%JAR%" %*
exit /b %ERRORLEVEL%
