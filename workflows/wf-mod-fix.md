# wf-mod-fix · 烟测驱动的 mod 修复（把"跑不通"修到"能跑"）

> **任务分类 ⑦（独立工作流）**。触发："这个 mod 跑不起来"、"启动就崩，帮我修"、
> "拿烟测修 mod"、"FlowerGod 崩了"、烟测 `FAIL` 且**根因不在我们改过的东西上**。
> 输出：**mod 能通过烟测**（+ 一页根因说明）。
> 需要读：`shared\env.md`、`shared\iron-rules.md`；查表 `workflows\wf-launch-audit.md`；
> 深挖时 `skills\starsector-engine-diagnose\SKILL.md`。

## 0. 与相邻流程的边界（**别混用，前提不同**）

| 流程 | 前提 | 节奏 | 收尾 |
|---|---|---|---|
| `wf-smoke-first.md` ⓪ | **我们自己刚改过** mod 文件 | 收尾关口：改动 → 烟测 → PASS 才全量 | 全量校验 + 交付 |
| `wf-game-update.md` ③ | 有**版本代差**（0.7x/0.8x/0.9x → 0.98a） | 先审计再动手：环境取证 → 编译探测 → 一致性证明 → 十步 | 版本号 + changelog + 交付 |
| **本流程 ⑦** | **没有版本代差**（mod 就是给 0.98 写的），但**真跑起来会崩** | **失败驱动**：烟测 → 失败特征 → 定因 → 最小修复 → 重测 | **烟测通过** + 根因说明（**不擅自升版本号**） |
| `wf-diagnose.md` ④ | 只是"出事了"的**症状索引** | — | 指向该读哪个 skill |

**判据**：先看 `mod_info.json` 的 `gameVersion`。
- 远低于 0.98a（如 0.8x/0.9x）→ 走 `wf-game-update.md` ③（本流程的定因与修复可被它复用）。
- 就是 0.98 或 0.98a，但烟测崩 → **本流程**。

> 本流程的立场：**不重编译、不升版本号、不改作者意图**，只做"让它能跑起来"的**最小修复**，
> 并把每个修复都留档成可回滚的证据。
> （唯一例外：崩溃在 mod 自己的 jar 代码里、不改代码修不了时，走代码修复重编译——见 §3 手法表首行。）

## 1. 阶段 A · 烟测拿失败特征（1 分钟）

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File <skills>\shared\scripts\smoke_run.ps1 -ModIds <id> -NewGame
```

拿三样东西：

1. **退出码**（`0`=PASS 收工 / `1`=FAIL / `2`=环境 / `3`=超时 / `4`=崩溃）——**判定只看它**；
2. **证据目录**（`results\<时间戳>_*`：`verdict.json` / `log_tail.txt` / `ng_frames\`）；
3. **失败特征**：从证据目录的 `verdict.json` 取（`reason` + `errorLogLines` 是**运行方已经摘好的**）。

> **不要通读 `starsector.log`**（几万行）。只有 `verdict.json` 不够用时，才做**定向**搜索，
> 且**必须 `-Encoding Default`**（GBK）：
> ```powershell
> Select-String -Path <game>\starsector-core\starsector.log `
>   -Pattern 'FATAL|ExceptionInInitializerError|Caused by|RuntimeException' -Encoding Default
> # 只最后一次会话：Get-Content <log> -Tail 300 -Encoding Default | Select-String 'ERROR|FATAL|Exception'
> ```
> 完整手法见 `wf-launch-audit.md` §0。

> 若报 `-NewGame` 建不出存档而加载 PASS：说明崩在**战役期**，看 `ng_frames\` 的失败帧，再进阶段 B。

## 2. 阶段 B · 定因：先查表，再决定挖多深
> **定因前先翻旧账**（通用纪律，`conventions.md` §6）：`_work\mod_work\<Mod>\` 里若有既往修复日志/失败特征回灌记录，本次特征很可能命中同一根因——先对旧表再动手。

**顺序不能反**——库里的表是几十次事故沉淀的，先查表能省掉大部分深挖。

### B1 查库表（**必做第一步**）

到 `workflows\wf-launch-audit.md` §1，按**同一失败特征**（你抓到的那行内容）找到
"判定（铁律 R#）+ 处置（该跑哪个闸门）"，跑那**一个**闸门定位。表里没有 → 才进 B2。

### B2 归属判定（决定这是"谁的锅"，**必须做，否则会修错对象**）

| 归属 | 判定方法 | 处置 |
|---|---|---|
| **环境** | 特征是 `VerifyError`/`UnsupportedClassVersionError`/`OutOfMemoryError`；或"游戏跑起来但**离线程序**报错" | 按 `env.md` §4 处理（`-noverify`、`--release`、禁双实例）。**这不是 mod 的问题** |
| **对方 mod / 安装** | 崩的行属于另一个 mod 的路径；或 `dependencies` 缺失 | 报告给用户，别改无关 mod（本机日志里别人 mod 的噪音很多） |
| **我们改过的（汉化）** | 崩溃涉及的字段/文件**修改时间晚于** mod 发布（用 §B3 的时间戳法） | 走 `wf-smoke-first.md` 阶段 2 的修复路径；属铁律问题就按 R# 修 |
| **mod 自身缺陷**（版本不兼容/作者 bug） | 涉及的文件**全是原作者时间戳**、且数据自洽（闸门 0 问题） | 进 §3，做**最小修复** |

### B3 时间戳法（**判定"是不是汉化弄坏的"最快的证据**）

```powershell
# 列出崩溃涉及的文件与 mod_info.json / jar 的修改时间
Get-Item <mod>\data\weapons\weapon_data.csv, <mod>\data\variants\*.variant, <mod>\mod_info.json, <mod>\jars\*.jar |
  Select-Object Name, LastWriteTime, Length
```

- 数据文件是**作者发布时的时间戳**（几年前） → **不是汉化弄的**（汉化会改这些文件的 mtime）。
- 只有 `mod_info.json` 是近期 → 那是安装/元信息，不是内容改动。

> 实例（FlowerGod 1.1.2）：`weapon_data.csv` = 2017-12-20、`.variant` = 2017-12-19、jar = 2018-01-11，
> 只有 `mod_info.json` = 2026-09-20 ⇒ 数据是原件 ⇒ **版本不兼容，与汉化无关**。

### B4 数据自洽性核对（区分"数据缺项" vs "引擎解析路径变了"）

```powershell
node <skills>\shared\scripts\check_refs.js <modDir> <游戏根>     # 引用闭合？
```
- **0 问题** ⇒ 数据内部自洽，问题在**引擎怎么解析**（版本行为差异）→ 去 `starsector-engine-diagnose` 反汇编定论，别猜。
- 有真问题 ⇒ 按它报的清单修（通常就是缺 `.wpn`/缺 csv 行/缺 variant）。

## 3. 阶段 C · 最小修复（一次只修一处）

**铁律**：

1. **先备份**：`<mod>` → `_work\mod_bak\<Mod>_<版本>_<日期>_pre_fix`（jar 另存 `*.orig`）。
2. **一次只改一处**，改完立刻回阶段 A 重测（**不要攒着改**——攒着分不清哪个修好的、哪个引的新问题）。
3. **保持字节安全**：CSV 用状态机（别朴素 `split(',')`）、保持行尾风格（R17）、无 BOM、别碰 id/logic key（R12）。
4. **改前留证**：把原文件片段（或哈希）记进修复日志，便于回滚与交付说明。
5. **惰性源码**（2026-09-23 YRXP 实证）：mod 同时带 `jars/` 与 `data/**/*.java` 时，jar 已编入的类以 jar 为准，Janino 只编 jar 缺的类（日志指纹：`ScriptLoader - Compiling script` 有别人没有我们）。别改 data 源码以为改了行为：要么重编 jar（走 `starsector-mod-java-hardcoded-text` §5），要么确认目标类 jar 里确实没有。

### 按崩溃形态选修复手法

| 崩溃形态 | 最小修复 |
|---|---|
| **栈在 mod 自己的 Java 代码里**（`at data.scripts.*` / `at data.hullmods.*`，如技能/插件 NPE） | **代码修复重编译**（本流程"不重编译"立场的唯一例外——不改代码就修不了）：最小改动（判空早退等）+ **保汉化回填 + 等价性三闸门**，完整流程见 `starsector-mod-java-hardcoded-text` §5；归属仍按 §B2 判定 |
| `RuntimeException: Weapon spec [X] not found!` / `Hull spec [X] not found!` | ① 先确认 `X` 该是**武器**还是**模块变体**：搜 `data\variants\*.variant` 有没有 `"variantId": "X"`；② 若是变体却被当武器解析 → **引擎版本行为差异**，在 `data\weapons\weapon_data.csv` 补一条最小 spec（id 必须逐字 = `X`）往往能让它过去；③ 若是作者漏定义 → 同样补 spec，或从 `sim_opponents`/fleet 里去掉该引用 |
| **主菜单点任务即崩 / 任务加载报 variant not found**（独立任务，无报错或无声崩回菜单） | 任务层引用闭包：`node <skills>\shared\scripts\check_mission_refs.js <modDir> <游戏根>`（jar 任务类 + data 源码双载体，惰性源码自动降级 warn）。按 red 清单：照舰舰现有槽位重造缺失的 variant（参考同 hull 其他 variant 风格）或改引用；重复崩点任务直到 PASS。2026-09-23 YRXP 3.1.0 实证：3.x 削舰体槽位后旧任务装配没重建，另有一类是联动舰死引用（版本间从不存在） |
| `JSONObject["options"] not found` | R1/R13/R15（见 `wf-launch-audit.md` §2） |
| `NumberFormatException: For input string: "<选项id>"` | R13 结构重建 |
| `ExceptionInInitializerError` + `Could not find mod X` | R12 逻辑键误译 |
| `wing_data` 缺列 / `.faction` 引用断链 | `game-upgrade` skill 的 §7 专项（那三个闸门） |
| 无报错但界面英文/显示 `?` | 不是崩溃：R16/R10/uiTags/R3，按 `wf-launch-audit.md` §1 对应行 |

> **补 spec 是本流程里最"越界"的动作**（等于替作者补数据）。所以：
> ① 只补**能让崩溃消失的最小字段**；② 在修复日志里写明"这不是原作者内容"；
> ③ **交付前先问用户**要不要保留这个补丁（有人宁可等作者更新）。

## 4. 阶段 D · 重测到 PASS（收敛判据）

回阶段 A，`-NewGame` 一起跑。

- PASS（退出码 0）→ 进阶段 E。
- 仍 FAIL → 看**新的**失败特征（可能是下一层错误，也可能是你引入的）→ 回阶段 B。
  - **同一处特征修了 3 次还不过** → 停下，说明定因错了：换 §B4 的反汇编路线（别继续试）。
  - **冒出新的失败特征** → 那个多半是"下一层"，继续按 B1 查表。
- 循环上限：**同一 mod 超过 5 轮**就写阶段 E 的"未解决"报告交用户，别无限试。

## 5. 阶段 E · 收尾

1. **记录根因**：改了什么文件/字段、依据是什么（表项 / 反汇编 / 自洽性核对）、为什么这么改。
2. **可回滚**：备份路径 + 原始片段/哈希写进修复日志。
3. **新失败特征回灌技能库**（**必做，否则下次还会靠猜**）：
   - 往 `workflows\wf-launch-audit.md` §1 的表加一行：**左列写你抓到的日志行**、右列写根因（铁律 R#）与闸门；
   - 是"引擎行为差异"就写进 `skills\starsector-engine-diagnose` 或 `shared\iron-rules.md`（编 R 号）。
4. **版本号与 changelog**：本次是**修复**不是升级 ⇒ **不擅自改 `version`**。
   只有用户明确要"作为新版本发布"才动；changelog 条目写清"症状 → 根因 → 改法"（一两行）。
5. **交付 = 简化档**：用户要交付包时走 `starsector-mod-delivery` **§0.1 简化档**——
   只做 **changelog 条目 + `deliver.ps1` 打包 + 简化自检**；**不做** `ai\` 工作区、结构介绍、git 新建。
   修复日志留在本 mod 的 `_work\mod_work\<Mod>\`（mod 已有 `项目说明.md` 的"已知修改"段则有才补一行）。

## 6. 完成标准

- [ ] `smoke_run.ps1` 退出码 **0**（`-NewGame` 时也 0）
- [ ] 根因有**证据**（表项编号 / 反汇编片段 / 时间戳对照 / 闸门输出），不是"看起来像"
- [ ] 每处修改都**一次一处且可回滚**（备份 + 原始片段）
- [ ] 新增/修改的数据文件：无 BOM、行尾风格未变、未碰 id 与逻辑键
- [ ] 新失败特征已回灌 `wf-launch-audit.md` §1 的表（左列 = 抓到的日志行）
- [ ] 结论交给用户时说明：这是**修复**（版本号未动）、哪些改动属"替作者补数据"、要不要保留

## 7. 反模式（真实代价）

- ❌ **跳过烟测直接看日志/直接改**——你会对着几十 MB 日志猜，且不知道修完有没有真的解决。
- ❌ **把它当 `wf-game-update` 做**（上全套审计/重编译）——前提不同，白忙且可能引入新问题。
- ❌ **一次改多处**——修好了也不知道为什么，下次复发没线索。
- ❌ **不看时间戳就怀疑自己的汉化**——原作者时间戳是"与我无关"的铁证；反过来，mtime 是近期就是有力嫌疑。
- ❌ **把"引擎解析行为差异"当"数据缺项"硬补**——补之前先 `check_refs.js` 证明数据自洽，否则补错方向。
- ❌ **修完不登记失败特征**——下次同类崩溃还是会从零开始。
- ❌ **擅自升 `version`**——修复不等于发布；版本号语义由用户决定。
