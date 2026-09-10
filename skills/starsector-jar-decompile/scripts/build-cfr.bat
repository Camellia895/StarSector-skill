@echo off
setlocal enableextensions

REM ============================================================
REM  Build CFR from source. Expected location: <game>\_work\_tools\
REM  Upstream: https://github.com/leibnitz27/cfr
REM
REM  Paths are derived from %~dp0, so this file works wherever the
REM  _tools directory lives.
REM
REM  WHY THE MAVEN ARGUMENTS BELOW ARE HARD-CODED AND NOT PASSED IN:
REM  when PowerShell invokes a .bat/.cmd, cmd splits "-Dfoo=bar" at the
REM  "=" sign, so "-Dmaven.javadoc.skip=true" arrives as "-Dmaven" plus
REM  ".javadoc.skip=true" and Maven aborts with
REM  "Unknown lifecycle phase '.javadoc.skip=true'".
REM  Keeping the arguments literal inside this file avoids that; the
REM  caller configures the build through environment variables instead:
REM
REM    CFR_JAVA_HOME   JDK root (must contain bin\javac.exe)
REM
REM  Verified: Maven 3.9.16 + JBR javac 25 + "-DjavaVersion=8" => BUILD SUCCESS
REM ============================================================

set "TOOLS=%~dp0"
if "%TOOLS:~-1%"=="\" set "TOOLS=%TOOLS:~0,-1%"
set "SRC=%TOOLS%\cfr-src"
set "MVN=%TOOLS%\apache-maven-3.9.16\bin\mvn.cmd"

if not defined CFR_JAVA_HOME set "CFR_JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "JAVA_HOME=%CFR_JAVA_HOME%"
set "PATH=%JAVA_HOME%\bin;%PATH%"

if not exist "%SRC%\pom.xml" (
    echo [cfr-build] ERROR: no CFR source tree at "%SRC%" 1>&2
    exit /b 1
)
if not exist "%MVN%" (
    echo [cfr-build] ERROR: Maven not found at "%MVN%" 1>&2
    exit /b 1
)
if not exist "%JAVA_HOME%\bin\javac.exe" (
    echo [cfr-build] ERROR: no javac under JAVA_HOME "%JAVA_HOME%" 1>&2
    echo [cfr-build] The game's bundled jre has no javac; point CFR_JAVA_HOME at a JDK. 1>&2
    exit /b 1
)

REM pom.xml targets Java 1.6, which JDK 20+ refuses; raise it to 8.
REM Tests need the decompilation-test git submodule, so skip them.
call "%MVN%" -B -f "%SRC%\pom.xml" -DjavaVersion=8 -DskipTests -Dmaven.javadoc.skip=true -Dgpg.skip=true package
exit /b %ERRORLEVEL%
