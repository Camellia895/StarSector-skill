# Probe reachability of GitHub endpoints to choose a download channel.
# Usage: powershell -ExecutionPolicy Bypass -File probe_github.ps1
$hosts = @('api.github.com','codeload.github.com','raw.githubusercontent.com','github.com','objects.githubusercontent.com')
$res = @{}
foreach ($h in $hosts) {
    $ok = Test-NetConnection -ComputerName $h -Port 443 -WarningAction SilentlyContinue -InformationLevel Quiet
    $res[$h] = $ok
    Write-Host ("{0,-30} :443 -> {1}" -f $h, $ok)
}
# optional local proxy probe
try {
    $p = Test-NetConnection -ComputerName 127.0.0.1 -Port 8788 -WarningAction SilentlyContinue -InformationLevel Quiet
    Write-Host ("local proxy 127.0.0.1:8788 -> {0}" -f $p)
} catch { Write-Host "local proxy probe skipped" }
Write-Host ""
if ($res['github.com']) {
    Write-Host "conclusion: github.com TCP 可达 -> 可先试 git clone；注意 TCP 通 != git 智能协议一定可用"
    Write-Host "           （实测曾出现探针通过但 clone 报 'Empty reply from server'），clone 失败即转 codeload tarball 通道。"
} elseif ($res['codeload.github.com'] -and $res['api.github.com']) {
    Write-Host "conclusion: github.com blocked but codeload/api reachable -> use codeload tarball channel."
} else {
    Write-Host "conclusion: github.com blocked and mirrors unreliable -> wait for connectivity or configure a working proxy."
}
