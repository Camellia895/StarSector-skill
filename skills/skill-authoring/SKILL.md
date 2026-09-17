---
name: skill-authoring
description: 为本技能库（<game>\_work\skills\）新增、改写或拆分 skill 时使用，也用于回答"这条经验该写成新 skill 吗"。覆盖分层架构（00-索引 / workflows / skills / shared / reference / _archive）、SKILL.md 标准卡模板与 frontmatter 要求、description 的可路由性规则、新建 vs 改写 vs 只登记进 shared 的判定、必须内联的原文（避免"见另一 skill"的悬挂引用）、脚本落地与登记（含校验类须进 verification-ledger 档位表）、以及技能库自身的持续演化流程（固化经验、修错路由、裁剪校验、结构迁移、变更纪律）。不用于为 dsh 安装插件（见 install-dsh-plugin），也不用于具体汉化/升级执行（见对应 workflow）。
---

# 编写与演化本技能库

**读者**：要给 `<game>\_work\skills\` 加东西的 AI（或人）。
**目标**：让新 skill 一放进去就能被正确路由、不重复既有事实、不制造悬挂引用；让库**越用越瘦越准**。

## 1. 先读现状（别凭记忆写）

按序读，只读需要的：

1. `<skills>\00-索引.md` —— 现有任务分类、工作流与 skill 清单（**路由入口**）。
2. `<skills>\shared\conventions.md` §7 —— 上下文节约纪律（引用语法、加载顺序）。
3. `<skills>\shared\script-registry.md` —— 已有脚本，**先查表再写新脚本**。
4. `<skills>\shared\verification-ledger.md` §8 —— 已有校验及其 severity/tier。
5. 若为改写：读目标 `SKILL.md` 全文。

## 2. 架构分层（新内容必须归到正确的层）

```
<skills>\
├─ 00-索引.md        唯一入口：三类任务 → 读哪个 workflow
├─ workflows\        编排层：多 skill 的顺序、闸门、产出（"怎么做这件事"）
├─ skills\           执行层：单一职责的 SKILL.md（"这类活怎么干"）
├─ shared\           公共事实：env / iron-rules / conventions / glossary / 两本账（script-registry、verification-ledger）
│   └─ scripts\      共享脚本（唯一份）
├─ reference\        只读资料（API 文档等）
├─ notes\            用户留下的零散提示
└─ _archive\         只归档不删除
```

**分层判据**：

| 内容性质 | 归到 |
|---|---|
| 一件事的**事实/规则**（路径、铁律、术语、约定） | `shared\*.md`（**只写一份**） |
| 一次任务的**步骤顺序 + 闸门 + 交接物** | `workflows\wf-*.md` |
| 一类活的**方法、坑、脚本用法** | `skills\<名>\SKILL.md` |
| 被多于一个 skill 用的**可执行脚本** | `shared\scripts\` + 登记表 |
| 只有一个 skill 用的脚本 | 该 skill 的 `scripts\` |
| 校验类脚本 | **还要进 `verification-ledger.md` §8 档位表** |

## 3. 标准卡（SKILL.md 模板）

### 3.1 frontmatter 必须且只有这两项

```yaml
---
name: <目录名，kebab-case，与目录一致>
description: <见 §3.2>
---
```

`name` **必须等于目录名**（`skill-authoring\SKILL.md` → `name: skill-authoring`）。

### 3.2 description 的可路由性规则

description 是**路由的唯一依据**（AI 只看得到它）。必须让"该用我"和"不该用我"都能判出来：

1. **写清干什么**（能力清单，可略密）；2. **写清何时用**（触发场景/任务分类）；3. **写清不干什么**（排除项，指向该去哪）。
2. 用**中文**写（本库面向中文用户），专有名词保留原文。
3. 长度：一段话，**150–500 字**。太短路由不准，太长浪费摘要预算。
4. ✅ 好例子（本库现行写法）：
   > "…覆盖 X/Y/Z…**不用于** …（见 `install-dsh-plugin`），**也不用于** …（见对应 workflow）。"
5. ❌ 反例：只写"用于处理 mod 相关任务"——无法区分 `-extract`/`-apply`/`-verify`/`game-upgrade`。

### 3.3 正文结构（推荐骨架，按需增删）

```markdown
# <一句话标题>

**职责**：一句话说清本 skill 管什么。
**不做**：明确排除，并指向正确去处。
**上游 / 下游**：谁调用我、我交付给谁。
**必读**：<skills>\shared\env.md、<skills>\shared\iron-rules.md、…（只列真正需要的）

## 0. 动手前
## 1..N 主体（步骤 / 判定树 / 坑表 / 配方）
## 闸门 / 完成标准（引用 G1–G6 编号，不重述定义）
## 脚本（本 skill 自带的；共享的引用 script-registry）
```

### 3.4 必须内联 vs 可以引用（悬挂引用的坑）

- **必须内联**：本 skill 独有的**具体命令、参数、代码、判定阈值、坑的现象与解法**。
- **可以只写编号/名字**：`iron-rules.md` 的 R1–R11、`conventions.md` 的 G1–G6、`script-registry.md` 的脚本用法、
  `env.md` 的路径与环境事实、`glossary.md` 的术语。
- ❌ **禁止**写"具体见另一 skill 的 §5"这种**无定义引用**——读者手边未必有那个文件。
  正确写法：内联一句话结论 + 需要细节时给出**路径**（如"完整机制见 `shared\verification-ledger.md`"）。
- ❌ **禁止**复制 `env.md`/`iron-rules.md` 的内容——重复即漂移。

## 4. 判定树：新经验该往哪写

```
这条经验是什么性质？
├─ 环境/路径/工具链事实           → shared\env.md（若确属全局）
├─ 会导致崩溃/静默失效的硬约束     → shared\iron-rules.md（编 R 号）
├─ 工作区/命名/计数/闸门约定       → shared\conventions.md
├─ 术语与译名                     → shared\glossary.md + .json（同步两份）
├─ 某个脚本的用法                 → shared\script-registry.md
├─ 已有校验的档位/命中历史         → shared\verification-ledger.md（跑 ledger_report.js 后落笔）
├─ 一条任务的顺序与交接           → 对应 workflows\wf-*.md
├─ 一个已有 skill 的方法/坑补充    → 就地**追加**到该 SKILL.md（最常见！）
└─ 确实是"一类新活"的方法          → 新建 skill（§5）
```

**默认追加，而非新建。** 新建 skill 是最后手段——每个 skill 都要付 description 的摘要成本。

## 5. 新建 skill 的门槛（三条全满足才建）

1. **有独立的触发场景**：能用一句话说清"什么时候只用它、不用别的"。
2. **不是既有 skill 的补充**：若 90% 内容能并入现有 skill 且不撑爆它 → 追加。
3. **有可复用的方法或脚本**：只是"一次性的操作步骤" → 写进 workflow 或就地记录，不建 skill。

**新建时同步做全（漏一项就是悬挂引用）**：

- [ ] 建目录 + `SKILL.md`（frontmatter 两项齐，`name` = 目录名）
- [ ] 在 `00-索引.md` 的"执行层 skill 一览"加一行
- [ ] 若它属于某类任务的必经/可选步骤 → 在对应 `workflows\wf-*.md` 里**点名**它
- [ ] 若自带脚本 → 放进该 skill 的 `scripts\`，并在 `script-registry.md` F 节登记
- [ ] 若是**校验类**脚本 → 另在 `verification-ledger.md` §8 登记 `severity` 与 `tier`，**两处必须一致**
- [ ] 在相关 skill 的 description / "相关"段里**互指**（双向引用才不会孤儿）
- [ ] `git add -A && git commit -m "<动作>：<对象>；<原因>"`

## 6. 反模式（本库真实踩过）

| 反模式 | 后果 | 正确做法 |
|---|---|---|
| 每个 skill 重述环境事实 | 事实漂移 + 每次加载重复付 token | 只写 `读 <skills>\shared\env.md` |
| 一个 skill 装完整工作流 | 被调用时必须整篇读入，上下文爆炸 | 拆：编排放 `workflows`，方法放 `skills` |
| 同一步骤写两份（如备份路径） | 一处改了另一处没改，自相矛盾 | 单点定义 + 其余引用 |
| description 写得太笼统 | 路由错，AI 读错 skill 或干脆不读 | 按 §3.2 写清能力 + 触发 + 排除 |
| "见另一 skill §X"无定义引用 | 读者手里没有那份文件，等于没写 | 内联结论 + 给路径 |
| 加脚本不登记 | 下个会话重复造轮子 | 先查 `script-registry.md`，再加登记 |
| 校验脚本不进档位表 | 账本收不到票，无法裁剪 | 同步 `verification-ledger.md` §8 |
| 直接删旧内容 | 丢失历史决策依据 | 移入 `_archive\`（只归档不删除） |
| 改档位表只改一处 | 两表不一致，报告与文档打架 | `ledger` 与 `registry` 同时改，改完用 §8 的核对命令 |
| 目录层级变化不改脚本路径推断 | 脚本静默取错游戏根 | 检查 `Split-Path` 上溯级数（本库曾因此失效） |

## 7. 持续演化（库的"自我升级"机制）

技能库是**活的**：每次任务结束后按下面四问决定要不要改库。

| 现象 | 动作 |
|---|---|
| 同一个坑**第二次**出现 | **固化**：写进 `iron-rules.md`（编 R 号）或对应 skill 的坑表 |
| 某个 skill 被**错误路由**（该用它时没用、或读错） | **修 description**（能力/触发/排除三项补齐），而非改正文 |
| 某条校验多次命中 | 跑 `ledger_report.js` → 按建议**升档**（进 `base`），并同步 workflow 步骤 |
| 某条校验长期 0 命中 | 先做**探针**（`wf-audit-checks.md` 阶段 2）再谈降档；报不出注入缺陷 ⇒ 修脚本 |
| skill 太长（>200 行）或职责已混 | **拆分**：抽出 workflow 或 shared，两半互指 |
| 出现新的任务分类 | 在 `00-索引.md` 加一行"分类 → 读哪个 workflow"，并建对应 `wf-*.md` |

**用户触发词**（可直接照做，不必追问）：`"校验审计"` → `wf-audit-checks.md`；`"优化 skill 库"` / `"整理 skill"` → 本节 + §8 体检。

## 8. 改完必须体检（可复现命令）

```powershell
$sk = '<game>\_work\skills'
# 1) 每个 skill 的 frontmatter 与目录名一致
Get-ChildItem "$sk\skills" -Directory | ForEach-Object {
  $f = Join-Path $_.FullName 'SKILL.md'
  $n = (Select-String -Path $f -Pattern '^name:\s*(\S+)' | Select-Object -First 1).Matches.Groups[1].Value
  if ($n -ne $_.Name) { "NAME MISMATCH: $($_.Name) → $n" }
}
# 2) JS 语法
Get-ChildItem $sk -Recurse -File -Filter *.js | ForEach-Object { node --check $_.FullName }
# 3) 文档引用的 shared 脚本是否存在（悬挂脚本引用）
Select-String -Path "$sk\*.md","$sk\shared\*.md","$sk\workflows\*.md","$sk\skills\*\SKILL.md" `
  -Pattern 'shared\\scripts\\([A-Za-z0-9_]+\.(js|java))' -AllMatches |
  ForEach-Object { $_.Matches } | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique |
  Where-Object { -not (Test-Path "$sk\shared\scripts\$_") }
# 4) 档位表两处一致（ledger §8 vs registry D 节）
$l = (Select-String -Path "$sk\shared\verification-ledger.md" -Pattern '^\|\s*`([a-z_0-9A-Z.]+)`\s*\|\s*(red|yellow|green)\s*\|\s*(base|cond|sample|dormant)' | ForEach-Object { $_.Matches[0].Groups[1..3].Value -join '|' })
$r = (Select-String -Path "$sk\shared\script-registry.md" -Pattern '^\|\s*`([a-z_0-9A-Z.]+)`\s*\|\s*(red|yellow|green)\s*\|\s*(base|cond|sample|dormant)' | ForEach-Object { $_.Matches[0].Groups[1..3].Value -join '|' })
Compare-Object ($l | Sort-Object -Unique) ($r | Sort-Object -Unique)   # 无输出 = 一致
```

## 9. 变更纪律

1. **小步提交**：一次改动一个主题，commit message 写"**动作：对象；原因**"（便于回溯"为什么加这条"）。
2. **结构/路径变更要留档**：在 `_work\README-整理说明.md` 记"新旧对照 + 原因"（本库重构过一次，靠它才能回看）。
3. **不删只归档**：废弃内容进 `_archive\`，并说明废弃原因与替代者。
4. **改动必须自检**：§8 体检通过才算完成；路径层级变化时要额外验证脚本的路径推断。
5. **保持"事实唯一"**：同一事实只出现在一处；发现问题先问"这是不是重复的第二份"。

## 10. 与其他 skill 的边界

- 为 dsh 装插件 / 改宿主配置 → `install-dsh-plugin`（那是**宿主**的事，不是本库的事）。
- 具体汉化/迁移/升级怎么干 → `wf-localize` / `wf-translate-update` / `wf-game-update`。
- 校验该不该继续跑 → `wf-audit-checks`（本 skill 只负责"把新校验登记进档位表"这一步）。
