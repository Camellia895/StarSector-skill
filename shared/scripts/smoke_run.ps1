<#
smoke_run.ps1 — 启动烟测的统一入口（包装 modcheck 自动化项目）

目的：一种命令跑完"启动→判定→极简输出"，把判据写进文件，**不回显大段内容**。

它包装 `<game>\_work\explore\modcheck\` 的两套自动化：
  1) ModCheck.ps1  ：只启用目标 mod，加载到**主菜单**，识别报错弹窗/致命日志后自动关闭并恢复配置
  2) drive.ps1 boot + NewGame.ps1 ：继续走完角色创建，生成 `save_autotest_*` 存档（**更深一层**，能暴露战役期错误）

用法：
  # 只验证能加载到主菜单
  powershell -NoProfile -ExecutionPolicy Bypass -File smoke_run.ps1 -ModIds rotcesrats

  # 加载 + 自动建存档（推荐的完整烟测；约 1 分钟）
  powershell -NoProfile -ExecutionPolicy Bypass -File smoke_run.ps1 -ModIds rotcesrats -NewGame

  # 冒烟后不还原 mod 列表（调试用）
  powershell -NoProfile -ExecutionPolicy Bypass -File smoke_run.ps1 -ModIds rotcesrats -KeepEnabled

参数：
  -ModIds <id[,id]>  目标 mod id（逗号或空格分隔）；默认 rotcesrats（modcheck 自带的测试值）
  -NewGame           加载成功后继续自动创建存档
  -KeepEnabled       不还原用户的 enabled_mods.json
  -TimeoutSec <n>    单段超时（默认 420）
  -LogPath <path>    指定日志；默认 <game>\starsector-core\starsector.log
  -NoScan            跳过日志指纹扫描

退出码（**与 run_check.js 约定一致**，便于记账）：
  0 = PASS（加载成功；-NewGame 时存档也建成）
  1 = FAIL（命中致命错误 / 存档未建成 / 日志有致命指纹）
  2 = 用法错误或环境不满足（找不到 modcheck、找不到日志）
  3 = 超时（未在限定时间内到主菜单/建成存档）
  4 = 崩溃/进程异常退出

输出约定（**故意极简**）：只打印 6–10 行摘要 + **判定文件路径**。
详细证据在 `<game>\_work\explore\modcheck\results\<时间戳>_*\` 与 `verdict.json` 里，需要时再去读。
#>
[CmdletBinding()]
param(
  [string[]]$ModIds = @('rotcesrats'),
  [switch]$NewGame,
  [switch]$KeepEnabled,
  [int]$TimeoutSec = 420,
  [string]$LogPath = '',
  [switch]$NoScan
)

$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# ---------------- 定位 ----------------
# 不硬编码层级：自脚本所在目录向上找 `starsector.exe`（技能库目录层级变过，硬编码上溯级数会静默取错游戏根）
function Find-GameRoot([string]$start) {
  $d = $start
  for ($i = 0; $i -lt 8 -and $d; $i++) {
    if (Test-Path -LiteralPath (Join-Path $d 'starsector.exe')) { return $d }
    $parent = Split-Path -Parent $d
    if (-not $parent -or $parent -eq $d) { break }
    $d = $parent
  }
  return $null
}
$game = Find-GameRoot $PSScriptRoot
if (-not $game) { Write-Output "SMOKE-ENV-FAIL: 自 $PSScriptRoot 向上未找到 starsector.exe（请用 -GameRoot 指定）"; exit 2 }
$mc   = Join-Path $game '_work\explore\modcheck'
if (-not (Test-Path -LiteralPath $mc)) { Write-Output "SMOKE-ENV-FAIL: 找不到 modcheck 项目: $mc"; exit 2 }
$modCheck = Join-Path $mc 'ModCheck.ps1'
$drivePs1 = Join-Path $mc 'drive.ps1'
$newGamePs1 = Join-Path $mc 'NewGame.ps1'   # ⚠️ 不能叫 $newGame —— 会与 [switch]$NewGame 参数冲突（实测报"无法把 String 转成 SwitchParameter"）
if (-not $LogPath) { $LogPath = Join-Path $game 'starsector-core\starsector.log' }
$scanJs = Join-Path $PSScriptRoot 'smoke_scan.js'

if (-not (Test-Path -LiteralPath $modCheck)) { Write-Output "SMOKE-ENV-FAIL: 缺少 $modCheck"; exit 2 }

$ids = ($ModIds -join ',')
Write-Output "== 烟测开始 ==  mod=$ids  newGame=$([bool]$NewGame)  timeout=${TimeoutSec}s"

# 刷新"用户原始列表"快照为【当前】enabled_mods.json（实测教训：快照只写一次会陈旧，
# ModCheck 结束时用陈旧快照恢复 → 建档阶段 -KeepMods 拿到的是几十个旧 mod 甚至不含目标 mod）
$canon = Join-Path $mc 'results\enabled_mods.user_original.json'
$emNow = Join-Path $game 'mods\enabled_mods.json'
if ((Test-Path -LiteralPath $emNow) -and -not $KeepEnabled) {
  New-Item -ItemType Directory -Force -Path (Split-Path $canon) | Out-Null
  Copy-Item -LiteralPath $emNow -Destination $canon -Force
  Write-Output '  已刷新 user_original 快照 = 当前 enabled_mods.json'
}

# ---------------- 第 1 段：加载到主菜单 ----------------
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$mcArgs = @('-NoProfile','-ExecutionPolicy','Bypass','-File',$modCheck,'-ModIds',$ids,'-TimeoutSec',$TimeoutSec,'-Quiet')
if ($KeepEnabled) { $mcArgs += '-KeepEnabled' }
& powershell @mcArgs | Out-Null            # 不回显：ModCheck 自己写 verdict.json
$rc1 = $LASTEXITCODE
$sw.Stop()
Write-Output ("[1/2] 加载到主菜单: rc={0}  用时 {1:N0}s" -f $rc1, $sw.Elapsed.TotalSeconds)

if ($rc1 -ne 0) {
  if ($rc1 -eq 2) { Write-Output '  → 加载期报错（弹窗或致命日志）' }
  elseif ($rc1 -eq 3) { Write-Output '  → 超时未到主菜单' }
  elseif ($rc1 -eq 4) { Write-Output '  → 进程崩溃/异常退出' }
  else { Write-Output "  → 未知返回码 $rc1" }
} 
# 加载失败就不必再建存档（实测：否则会拿完整 mod 列表去跑 NewGame，崩在别的 mod 上，污染指纹归属）
if ($rc1 -eq 0 -and $NewGame) {
  # ---------------- 第 2 段：自动创建存档（更深一层）----------------
  $sw2 = [System.Diagnostics.Stopwatch]::StartNew()
  & powershell -NoProfile -ExecutionPolicy Bypass -File $drivePs1 boot -KeepMods | Out-Null
  $rcb = $LASTEXITCODE
  if ($rcb -eq 0) { & powershell -NoProfile -ExecutionPolicy Bypass -File $newGamePs1 | Out-Null; $rcn = $LASTEXITCODE }
  else { $rcn = $rcb }
  $sw2.Stop()
  Write-Output ("[2/2] 自动建存档: boot={0} newgame={1}  用时 {2:N0}s" -f $rcb, $rcn, $sw2.Elapsed.TotalSeconds)
}

# ---------------- 恢复配置（除 -KeepEnabled）----------------
if (-not $KeepEnabled) {
  $restore = Join-Path $mc 'restore-mods.ps1'
  if (Test-Path -LiteralPath $restore) { & powershell -NoProfile -ExecutionPolicy Bypass -File $restore | Out-Null }
}

# ---------------- 日志指纹（默认扫；-NoScan 跳过）----------------
$scanRc = 0
if (-not $NoScan -and (Test-Path -LiteralPath $scanJs) -and (Test-Path -LiteralPath $LogPath)) {
  Write-Output '-- 日志指纹 --'
  & node $scanJs $LogPath
  $scanRc = $LASTEXITCODE
} elseif (-not (Test-Path -LiteralPath $LogPath)) {
  Write-Output "-- 日志指纹 -- 跳过（找不到 $LogPath）"
}

# ---------------- 判定 ----------------
$verdict = 'PASS'; $why = '加载成功'
if ($rc1 -ne 0) {
  $verdict = 'FAIL'
  if ($rc1 -eq 2) { $why = '加载期报错' }
  elseif ($rc1 -eq 3) { $why = '超时' }
  elseif ($rc1 -eq 4) { $why = '进程崩溃' }
  else { $why = "返回码 $rc1" }
} elseif ($NewGame -and ($rcn -ne 0)) {
  $verdict = 'FAIL'; $why = "加载成功但存档未建成（newgame rc=$rcn）"
} elseif ($scanRc -eq 1) {
  $verdict = 'FAIL'; $why = '日志命中致命指纹（见上）'
}

$latest = Get-ChildItem (Join-Path $mc 'results') -Directory -EA SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
Write-Output ''
Write-Output "== 烟测结果: $verdict ==  原因: $why"
if ($latest) { Write-Output "证据目录: $($latest.FullName)  （verdict.json / log_tail.txt / ng_frames\）" }
if ($verdict -eq 'FAIL') {
  Write-Output '下一步: 按上面的 [R#] 到 <skills>\workflows\wf-launch-audit.md §1 查表；**不要**整篇打开 starsector.log。'
  Write-Output '       跑通后再做全量校验（wf-smoke-first.md 阶段 3）。'
}
if ($verdict -eq 'PASS') { exit 0 }
if ($rc1 -eq 3) { exit 3 }
if ($rc1 -eq 4) { exit 4 }
exit 1
