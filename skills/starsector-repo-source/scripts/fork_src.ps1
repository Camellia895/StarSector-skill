# End-to-end: fork upstream repo (if needed) and bring the fork source locally under
# _work\mod_src\<Repo> via the official codeload tarball channel (github.com:443 often
# blocked while codeload/api work), then git-ize it (import commit + origin remote).
#
# Usage (run gh auth'd session):
#   powershell -ExecutionPolicy Bypass -File fork_src.ps1 -Owner hamzah-hayat -Repo ChickenTechShop
#
# Params:
#   -Owner       upstream owner
#   -Repo        repo name
#   -Branch      branch/tag to fetch          (default: upstream default branch, auto-detected)
#   -OutDir      destination parent           (default: C:\game\StarSector.v0.9.8a-RC8\_work\mod_src)
#   -SkipFork    skip creating the fork       (default: false; use when fork already exists)
#   -SkipInit    skip local git init/commit   (default: false)
#   -Identity    gh/git identity for commits  (default: from git config; fallback Camellia895)
param(
    [Parameter(Mandatory=$true)][string]$Owner,
    [Parameter(Mandatory=$true)][string]$Repo,
    [string]$Branch = '',
    [string]$OutDir = 'C:\game\StarSector.v0.9.8a-RC8\_work\mod_src',
    [switch]$SkipFork,
    [switch]$SkipInit,
    [string]$Identity = ''
)
$ErrorActionPreference = 'Stop'

function Say($m) { Write-Host "[fork_src] $m" }

# Run a native command capturing stdout, WITHOUT its stderr becoming a terminating
# error. REQUIRED: with $ErrorActionPreference='Stop', PowerShell 5.1 turns any native
# stderr line into a terminating NativeCommandError, so the expected "not yet forked"
# GraphQL error from `gh repo view <you>/<repo>` aborts the script before the fork is
# even attempted (observed 2026-09 on Camellia895/SanIris).
function Invoke-Capture {
    param([scriptblock]$Cmd)
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $out = & $Cmd 2>$null
        $code = $LASTEXITCODE
        $text = ($out | Out-String).Trim()
        return [pscustomobject]@{ Output = $text; ExitCode = $code; Ok = ($code -eq 0 -and $text) }
    } finally {
        $ErrorActionPreference = $prev
    }
}

# --- 1. identity / auth ---
$me = (Invoke-Capture { gh api user --jq '.login' }).Output
if (-not $me) { throw 'gh not authenticated - run: gh auth login (needs repo scope)' }
Say "account: $me"
if (-not $Identity) {
    $n = git config --global user.name
    $e = git config --global user.email
    if ($n -and $e) { $Identity = "$n <$e>" } else { $Identity = "$me <$me@users.noreply.github.com>" }
}
$you = $me

# --- 1.5 resolve branch (auto-detect upstream default branch; do NOT hardcode master) ---
if (-not $Branch) {
    $Branch = (Invoke-Capture { gh repo view "$Owner/$Repo" --json defaultBranchRef --jq '.defaultBranchRef.name' }).Output
    if (-not $Branch) { $Branch = 'master' }
    Say "auto-detected branch: $Branch"
}

# --- 2. ensure fork ---
if (-not $SkipFork) {
    # NOTE: `gh repo view <you>/<repo>` fails with a GraphQL error while the fork does not
    # exist yet - that failure IS the "not yet forked" signal, so it must not be fatal.
    $exists = (Invoke-Capture { gh repo view "$you/$Repo" --json nameWithOwner }).Output
    if (-not $exists) {
        Say "creating fork $you/$Repo ..."
        gh repo fork "$Owner/$Repo" --clone=false
    } else {
        Say "fork $you/$Repo already exists"
    }
} else {
    Say "SkipFork - assuming $you/$Repo exists"
}

# --- 3. destination dir ---
$dst = Join-Path $OutDir $Repo
if (Test-Path $dst) { throw "destination exists: $dst (remove it or choose another OutDir)" }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

# --- 4. download tarball via codeload (heads first; fall back to tags if -Branch is a tag) ---
$tgz = Join-Path $OutDir "$Repo.tar.gz"
$url = "https://codeload.github.com/$you/$Repo/tar.gz/refs/heads/$Branch"
Say "downloading $url ..."
curl.exe -L -sS -o $tgz $url 2>$null
if (-not (Test-Path $tgz) -or (Get-Item $tgz).Length -eq 0) {
    $url2 = "https://codeload.github.com/$you/$Repo/tar.gz/refs/tags/$Branch"
    Say "heads ref not found (or download empty); trying tags: $url2"
    curl.exe -L -sS -o $tgz $url2 2>$null
}
if (-not (Test-Path $tgz) -or (Get-Item $tgz).Length -eq 0) { throw 'download failed (empty file)' }
tar -xzf $tgz -C $OutDir 2>$null
$extracted = Join-Path $OutDir "$Repo-$Branch"
if (-not (Test-Path $extracted)) { throw "unexpected extract name; expected $extracted" }
Rename-Item $extracted $dst
Remove-Item $tgz -Force
Say "source ready at $dst"

# --- 5. local git ---
if (-not $SkipInit) {
    # resolve identity into plain name/email first (avoid inline method calls in git -c args)
    $gName = $Identity
    $gEmail = ''
    if ($Identity -match '<(.+)>') {
        $gEmail = $Matches[1]
        $gName = ($Identity -split '<')[0].Trim()
    }
    if (-not $gEmail) { throw 'identity must look like "Name <email>"' }
    # git writes progress to stderr; suppress it so $ErrorActionPreference='Stop' does not
    # abort on a perfectly successful command.
    git init $dst 2>$null | Out-Null
    git -C $dst add -A 2>$null
    git -C $dst -c "user.name=$gName" -c "user.email=$gEmail" commit -m "Import $Repo $Branch (fork of $Owner/$Repo)" 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "git commit failed (exit $LASTEXITCODE)" }
    git -C $dst remote add origin "https://github.com/$you/$Repo.git" 2>$null
    Say "gitized: import commit + origin -> $you/$Repo"
}
Say "done. log:"
git -C $dst log --oneline -1 2>$null
