# wf-smoke-first · 烟测（真跑一遍游戏）

> **任务分类 ⓪**。适用：**① 汉化 / ② 汉化迁移（只做轻烟测）**、**③ 版本升级 / ⑦ 修 mod（深烟测）**，
> 以及**任何动了 jar/插件/模组注册**的改动。
> 输出：一次**真跑一遍游戏**的判定（PASS / FAIL），**6–10 行摘要**。
> 需要读：`shared\env.md`（内存 / 环境毒点）；失败时读 `wf-launch-audit.md`（特征 → 根因 → 闸门）。

## 烟测分两档（允许只跑轻的）

| 档位 | 命令 | 验证什么 | 耗时 |
|---|---|---|---|
| **轻烟测 = 仅打开游戏** | `smoke_run.ps1 -ModIds <modId>` | mod 能加载到主菜单，无致命报错/弹窗 | ~40s |
| **深烟测 = 加载 + 建存档** | `smoke_run.ps1 -ModIds <modId> -NewGame` | 再走完角色创建、生成 `save_autotest_*`，暴露战役期错误 | ~1min |

**允许只跑轻烟测，而不跑建存档烟测**——选哪档看改动类型，不必为了"测得全"一律建存档：

| 任务 | 跑哪种 | 为什么 |
|---|---|---|
| **① 汉化**（改数据文本：CSV / JSON / 描述 / 对话） | **仅轻烟测**（不做建存档） | 改的是**文本内容**，不碰结构与注册；全量校验（G1–G6）负责文本层，收尾用轻烟测确认"加载没被弄坏" |
| **② 汉化迁移** | **仅轻烟测**（不做建存档） | 同上：复用旧译 + 补新译，仍是文本层 |
| **③ 版本升级**（改编译产物/API 适配） | **深烟测**（`-NewGame`） | 类加载、插件注册、数据表头都可能变 ⇒ 只有真跑能证明 |
| **⑦ 修跑不通的 mod** | **深烟测**（本流程即其核心） | 目标就是"跑起来"，建存档是验收标准 |
| 动了 `jars\*.jar` / `modPlugin` / `settings.json` 的 plugins / `mod_info.json` 的 `jars` | **深烟测**（`-NewGame`） | 这几处坏了都是"启动才崩"或"开档才崩"，闸门看不出来 |
| 只改 `ai\`（交付说明、语料）或不改 mod 内容 | 不需要 | 与游戏加载无关 |

> 判据一句话：**改动是否可能影响"游戏能不能启动 / 能不能开档"？**
> 只动**文本内容** → 轻烟测即可；动了**结构、注册、字节码** → 深烟测（含建存档）。

## 两种用法

**用法 A · 升级/修复的关口（③⑦）**：改动 → **深烟测（`-NewGame`）** → PASS 才进全量校验。
全量放在烟测之后，才不会在"根本起不来"的东西上白忙。
建存档段因脚手架失配失败且判定非 mod 问题时（见已知限制），退回轻烟测 + 手动建档补验。

**用法 B · 汉化/迁移的收尾（①②）**：全量校验（G2–G6）做完后，跑一次**轻烟测（仅打开游戏，
不带 `-NewGame`）**作为交付前最后一层确认。**①② 的烟测到这一档为止**：不做建存档烟测
（文本层改动不需要战役期验证，建存档是 ③⑦ 关口的事）。

## 为什么烟测值得跑

| | 全量校验（几十个闸门） | 烟测（真跑游戏） |
|---|---|---|
| 反映的事实 | "我**抽样**的地方没坏" | "**游戏真的**能把内容加载起来、能开档" |
| 耗时 | 逐脚本，且容易漏跑 | 加载到主菜单 ~40s；+建存档 ~1min |
| 盲区 | 列数检查看不出结构坏；recipe 有盲区 | 覆盖不到"点进某个界面才崩"（如悬停 tooltip） |
| 上下文开销 | 每个脚本都要读输出 | **6–10 行**摘要 |

⇒ 改动可能导致"起不来"时，**先花 1 分钟真跑一遍**，能一次性排掉绝大多数硬故障。

## 阶段 0 · 前置（30 秒）

1. **★必须显式传 `-ModIds <目标mod id>`**——这是"烟测没挂上正确 mod"的头号原因：
   脚本缺省值 `rotcesrats` 是 modcheck 自带的**测试值**，忘传就等于"在测别的 mod"。
   id 是 `mod_info.json` 的 `id`（**不是文件夹名**）。启动后输出首行 `mod=<ids>`
   与"挂载 mod"行**必须含目标 id**；不一致立即中止，改对参数重跑，**不要**解读那次结果。
2. **游戏必须完全退出**：烟测会自己关游戏，但**不同时跑两个实例**——`drive.ps1` 的 JVM 固定 `-Xmx16g`，
   启动即提交 16GB，双实例会互相拖死。
   ```powershell
   powershell -File <game>\_work\explore\modcheck\drive.ps1 close   # 需要时先关
   ```
3. 想带别的 mod 一起测：把它们的 id 一起写进 `-ModIds`（逗号分隔）；`ModCheck.ps1` 会自动补上声明的依赖。

## 阶段 1 · 跑烟测（**唯一需要的命令**）

```powershell
# 轻烟测：只验证"能加载到主菜单"（约 40 秒）—— ①汉化 / ②迁移 到这一档为止
powershell -NoProfile -ExecutionPolicy Bypass -File <skills>\shared\scripts\smoke_run.ps1 -ModIds <modId>

# 深烟测：加载 + 自动创建生涯存档（约 1 分钟，能暴露战役期错误）—— ③升级 / ⑦修 mod 用这档
powershell -NoProfile -ExecutionPolicy Bypass -File <skills>\shared\scripts\smoke_run.ps1 -ModIds <modId> -NewGame
```

它内部做四件事（不用分别调用）：改写 `enabled_mods.json` 只启用目标 mod 及其声明依赖 →
启动游戏并等到主菜单（`-NewGame` 则由 `drive.ps1 boot -KeepMods` + `NewGame.ps1`
继续走完角色创建建出 `save_autotest_*`；此时 ModCheck 以 `-KeepEnabled` 结束、
**把测试集保留给建存档段**，全部结束后统一恢复）→ 关闭游戏并**恢复你的 mod 列表** → 打印摘要。

**输出里的"挂载 mod"行列出实际启用的 id**（含自动补的依赖）——先核对目标 id 在列，
再谈 PASS/FAIL：不在列说明根本没测到目标 mod，结论作废。

**判定只看退出码**：`0`=PASS / `1`=FAIL / `2`=环境不满足 / `3`=超时 / `4`=崩溃。

**输出只有 6–10 行**，形如：

```
== 烟测开始 ==  mod=flowergod  newGame=True  timeout=420s
  已刷新 user_original 快照 = 当前 enabled_mods.json
[1/2] 加载到主菜单: rc=2  用时 21s
  挂载 mod (3): flowergod, lw_lazylib, MagicLib   ← 先核对目标 id 在列
  → 加载期报错（弹窗或致命日志）
== 烟测结果: FAIL ==  原因: 加载期报错
证据目录: ...\modcheck\results\20260920_210553_shortcut_flowergod  （verdict.json / log_tail.txt / ng_frames\）
```

> **不要去通读 `starsector.log`**（几万行）。先看**证据目录**里的 `verdict.json` ——
> 运行方已经把**失败原因与摘出的错误行**写好了。需要自己搜时只做**定向**搜索，
> 且**必须 `-Encoding Default`**（GBK）；查表见 `wf-launch-audit.md` §0/§1。

## 阶段 2 · FAIL 时：先判归属，再动手

1. 看证据目录的 `verdict.json`（`reason` / `errorLogLines`），得到**失败特征**。
2. 到 `wf-launch-audit.md` §1 按**同一特征**那一行 → 拿到"根因 + 该跑的闸门"。
3. 跑那个闸门**定位**（只跑这一个，不要全量）→ 按 §2 修。
4. **回到阶段 1 重跑烟测**（不要用"重跑一堆闸门"代替）。

循环直到 PASS。**每修一处就重跑一次**，不要攒着一起测 —— 攒着会分不清是哪条修好的、哪条又引入的新问题。

> **先判归属再动手**：如果失败涉及的东西**不是我们这次改的**（文件 mtime 是原作者时间戳、
> 数据自洽闸门 0 问题），那这不是"收尾关口"的事，而是**修 mod 本身** ⇒ 转
> `workflows\wf-mod-fix.md`（烟测驱动的修复循环，含归属判定与最小修复手法）。
> 反过来，若 `mod_info.json` 的 `gameVersion` 与 0.98a 有代差 ⇒ 转 `workflows\wf-game-update.md`。

### 常见分支

| 情况 | 处理 |
|---|---|
| `rc=3` 超时，日志无致命错误 | 可能是**首次加载慢**（mod 多/贴图大）→ 加 `-TimeoutSec 900` 重跑；仍超时再查"卡在哪个加载阶段"（看日志尾部 INFO 行） |
| `rc=4` 崩溃且无线索 | 看 `results\<时间戳>*\boot_capture.log`；仍无线索 → `starsector-engine-diagnose` |
| `rc=2` 环境不满足 | 看输出里的 `SMOKE-ENV-FAIL:` 行（找不到 modcheck / 游戏根）；**别改脚本硬编码路径**，脚本用"向上找 `starsector.exe`"推断 |
| `-NewGame` 建不出存档（`boot=0 newgame≠0`） | 加载没问题、**战役期**出问题：看 `results\...\ng_frames\` 的失败帧；常见是某个界面的 tooltip/描述崩、或规则脚本报错 |
| 只有"插件初始化报错"这类噪音 | **PASS**。这些在原版与别的 mod 上也会出现，先判归属再决定是否追 |

### 已知限制（2026-09-30 MagicMaster 实测沉淀；命中先怀疑脚手架，别急着改 mod）

| 症状 | 原因 | 绕行 |
|---|---|---|
| `-ModIds a,b` 报 `A positional parameter cannot be found` | PowerShell 具名参数只绑一个 token；smoke_run→ModCheck 的 `-File` 传参链断 | **标准用法＝单 id** + 在 mod 的 `mod_info.json` 声明 `dependencies`（smoke 会自动补全启用） |
| 建存档段 mod 清单"不对"（历史 bug，2026-09-30 已修） | 旧版 ModCheck 结束即把用户完整列表还原，`drive.ps1 boot -KeepMods`"保留"到的是完整列表 ⇒ 建存档段没挂目标 mod | 现版 `-NewGame` 时 smoke_run 让 ModCheck 以 `-KeepEnabled` 结束、测试集保留给建存档段；若"挂载 mod"行仍不含目标 id，先查 `-ModIds` 是否忘传/写错（缺省 `rotcesrats` 是测试值） |
| `newgame rc=3` 而 `fail_name.png`（`modcheck\results\ng_frames\`，**共享目录**不在 per-run 目录）里游戏停在**主菜单** | NewGame.ps1 UI 坐标按 **1366×768** 标定；主菜单面板右侧像素锚定 ⇒ 分辨率不同（实测 2000×1125 / 2560×1440）相对坐标漂移，点不中"生涯模式" | **脚手架失配，非 mod 问题**：转手动建档测试；注意失败帧不在 per-run 结果目录里 |
| mod 明明没引用 LunaLib 却启动 Fatal `NoClassDefFoundError: lunalib/...` | GraphicsLib 1.12.1 硬引用 LunaSettingsListener（env.md §6） | 启用清单带上 lunalib（或在 mod_info 声明依赖） |

## 阶段 3 · PASS 后：进全量校验（适用用法 A 时）

烟测通过（**建议同一配置跑通 2 次**，避免偶发），再进
`starsector-mod-localization-verify` 走 G2–G6。

- G2/G3 内容与字节安全、G4 jar 安全、G5 引用与类加载、G6 装船目检。
- 闸门里凡是**已被烟测覆盖**的（如"能不能加载"），全量时按档位表（`shared\verification-ledger.md` §8）
  该跳就跳；**base 档仍要跑**，因为烟测覆盖不到"点进去才崩"的路径（悬停 tooltip、refit、图鉴详情）。
- 全量发现的问题若**玩家能看见但烟测看不见**（如显示 `?`、分类名英文）→ 记一笔
  "烟测盲区"，考虑是否要补进 `wf-launch-audit.md` §1 的特征表。

> **用法 B（① / ② 汉化）**：跳过本阶段——全量校验已经在轻烟测之前做完了。

## 阶段 4 · 交付

`starsector-mod-delivery`（结构介绍 + `ai\` + git + zip）。
**交付说明里报告烟测结论**：档位（轻=仅打开游戏 / 深=含建存档）与 PASS、挂载的 mod 清单、
用时、有无噪音类提示。

## 触发词

- "烟测" / "冒烟" / "先跑一遍游戏" / "自动开游戏测一下" → 阶段 0–2。
- "修完重测" → 阶段 1。
- "跑通了" → 阶段 3。
