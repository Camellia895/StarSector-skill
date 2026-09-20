# wf-smoke-first · 烟测先行（不先做全量校验）

> **任务分类 ⓪（所有改动的收尾关口）**：任何"改了 mod 文件"的任务（①汉化 ②迁移 ③升级）**都先走这里**。
> 输出：一次**真跑一遍游戏**的判定 —— PASS 才进全量校验；FAIL 则带着指纹去查表修，修完重跑烟测。
> 需要读：`shared\env.md`（日志 GBK / 内存 / 环境毒点）；
> 失败时读 `wf-launch-audit.md`（指纹 → 根因 → 闸门）；通过后读 `starsector-mod-localization-verify`（全量）。

## 为什么先烟测

| | 全量校验（几十个闸门） | 烟测（真跑游戏） |
|---|---|---|
| 反映的事实 | "我**抽样**的地方没坏" | "**游戏真的**能把内容加载起来、能开档" |
| 耗时 | 逐脚本，且容易漏跑 | 加载到主菜单 ~40s；+建存档 ~1min |
| 盲区 | 列数检查看不出结构坏；recipe 有盲区 | 覆盖不到"点进某个界面才崩"（如悬停 tooltip） |
| 上下文开销 | 每个脚本都要读输出 | **6–10 行**摘要（指纹脚本自动指回 R#） |

⇒ **先花 1 分钟真跑一遍**：能一次性排除绝大多数"跑都跑不起来"的问题，
剩下的细节再交给全量校验。全量校验放在**烟测通过之后**，才不会在"根本起不来"的东西上白忙。

## 阶段 0 · 前置（30 秒）

1. **游戏必须完全退出**：烟测会自己关游戏，但**不同时跑两个实例**——`drive.ps1` 的 JVM 固定 `-Xmx16g`，
   启动即提交 16GB，双实例会互相拖死。
   ```powershell
   powershell -File <game>\_work\explore\modcheck\drive.ps1 close   # 需要时先关
   ```
2. 确认要测的 **mod id**（不是文件夹名，是 `mod_info.json` 的 `id`）。
3. 想带上别的 mod 一起测：把它们的 id 一起写进 `-ModIds`（逗号分隔）；`ModCheck.ps1` 会自动补上声明的依赖。

## 阶段 1 · 跑烟测（**唯一需要的命令**）

```powershell
# 只验证"能加载到主菜单"（约 40 秒）
powershell -NoProfile -ExecutionPolicy Bypass -File <skills>\shared\scripts\smoke_run.ps1 -ModIds <modId>

# 推荐：加载 + 自动创建生涯存档（约 1 分钟，能暴露战役期错误）
powershell -NoProfile -ExecutionPolicy Bypass -File <skills>\shared\scripts\smoke_run.ps1 -ModIds <modId> -NewGame
```

它内部做四件事（你不用分别调用）：改写 `enabled_mods.json` 只启用目标 mod →
启动游戏并等到主菜单（`-NewGame` 则继续自动走完角色创建建出 `save_autotest_*`）→
关闭游戏并**恢复你的 mod 列表** → 跑日志指纹扫描。

**退出码**（与 `run_check.js` 约定一致，便于记账）：`0`=PASS / `1`=FAIL / `2`=环境不满足 / `3`=超时 / `4`=崩溃。

**输出只有 6–10 行**，形如：

```
== 烟测开始 ==  mod=fds_rots  newGame=True  timeout=420s
[1/2] 加载到主菜单: rc=0  用时 39s
[2/2] 自动建存档: boot=0 newgame=0  用时 58s
-- 日志指纹 --
判定: PASS   FATAL=0  ERROR=26  (文件 41.2 MB，未整篇读入)
未命中任何致命指纹。
== 烟测结果: PASS ==  原因: 加载成功
证据目录: ...\modcheck\results\20260919_231449_shortcut_rotcesrats
```

> **不要去读 `starsector.log`**。指纹脚本已经把它压成"判定 + 指纹名 + 行号"；
> 需要细节时用它的 `--json` 拿行号，再按 `wf-launch-audit.md` §0 定向取几行。

## 阶段 2 · FAIL 时：按指纹查表 → 修 → **重跑烟测**

1. 看阶段 1 输出里的 `[R#] … 指纹名`（可能多条，**先修第一条/最靠前的**，链条上层的往往是根因）。
2. 到 `wf-launch-audit.md` §1 **同一指纹名**那一行 → 拿到"根因 + 该跑的闸门"。
3. 跑那个闸门**定位**（只跑这一个，不要全量）→ 按 §2 修。
4. **回到阶段 1 重跑烟测**（不要用"重跑一堆闸门"代替）。

循环直到 PASS。**每修一个指纹就重跑一次**，不要攒着一起测 —— 攒着会分不清是哪条修好的、哪条又引入的新问题。

> **先判归属再动手**：如果指纹指向的东西**不是我们这次改的**（文件 mtime 是原作者时间戳、
> 数据自洽闸门 0 问题），那这不是"收尾关口"的事，而是**修 mod 本身** ⇒ 转
> `workflows\wf-mod-fix.md`（烟测驱动的修复循环，含归属判定与最小修复手法）。
> 反过来，若 `mod_info.json` 的 `gameVersion` 与 0.98a 有代差 ⇒ 转 `workflows\wf-game-update.md`。

### 常见分支

| 情况 | 处理 |
|---|---|
| `rc=3` 超时，日志无致命指纹 | 可能是**首次加载慢**（mod 多/贴图大）→ 加 `-TimeoutSec 900` 重跑；仍超时再查"卡在哪个加载阶段"（`smoke_scan --context` + 最后一条 INFO 行） |
| `rc=4` 崩溃且无指纹 | 拿 `--json` 的 `lastFatal`，或看 `results\<时间戳>*\boot_capture.log`；仍无线索 → `starsector-engine-diagnose` |
| `rc=2` 环境不满足 | 看输出里的 `SMOKE-ENV-FAIL:` 行（找不到 modcheck / 日志 / 游戏根）；**别改脚本硬编码路径**，脚本用"向上找 `starsector.exe`"推断 |
| `-NewGame` 建不出存档（`boot=0 newgame≠0`） | 加载没问题、**战役期**出问题：看 `results\...\ng_frames\` 的失败帧；常见是某个界面的 tooltip/描述崩、或规则脚本报错 |
| 指纹说是"环境"类（`VerifyError`/`UnsupportedClassVersionError`） | **不是 mod 的问题**，按 `env.md` §4 处理（`-noverify` / `--release` 版本） |
| 只有"噪音"类提示 | **PASS**。这些在原版与别的 mod 上也会出现，先判归属再决定是否追 |

## 阶段 3 · PASS 后：才做全量校验（收尾关口）

烟测连续通过（**建议同一配置跑通 2 次**，避免偶发），再进
`starsector-mod-localization-verify` 走 G2–G6。

- G2/G3 内容与字节安全、G4 jar 安全、G5 引用与类加载、G6 装船目检。
- 闸门里凡是**已被烟测覆盖**的（如"能不能加载"），全量时按档位表（`shared\verification-ledger.md` §8）
  该跳就跳；**base 档仍要跑**，因为烟测覆盖不到"点进去才崩"的路径（悬停 tooltip、refit、图鉴详情）。
- 全量发现的问题若**玩家能看见但烟测看不见**（如显示 `?`、分类名英文）→ 记一笔
  "烟测盲区"，考虑是否要补进 `wf-launch-audit.md` §1 的指纹表。

## 阶段 4 · 交付

`starsector-mod-delivery`（结构介绍 + `ai\` + git + zip）。
**交付说明里报告烟测结论**：加载 PASS / 建存档 PASS、用时、有无噪音类提示。

## 与全量校验的分工（别再搞混）

```
改了 mod 文件
   └─ 阶段 1 烟测（1 分钟，先跑）── FAIL ─→ 阶段 2 查表修 → 回阶段 1
                                    └─ PASS ─→ 阶段 3 全量校验（G2–G6）─→ 阶段 4 交付
```

**不要**在烟测之前做全量校验，也**不要**在全量校验里重跑烟测已经证明的事。

## 触发词

- "烟测" / "冒烟" / "先跑一遍游戏" / "自动开游戏测一下" → 本流程阶段 0–2。
- "修完重测" → 阶段 1。
- "跑通了" → 阶段 3。
