---
name: zcode-dispatch-translate
description: 为汉化翻译派发 AI 执行（触发词："派 AI 翻译"、"开个翻译会话"、"用闲时任务翻译"）。两条路线：**闲时任务（优先）**——用 OffPeakCreate 创建无人值守续跑任务整包翻译 worklist 产出 zh\，走闲时独立配额池、不受主计划 5 小时上限影响、可上 GLM 系模型，完成后自动唤醒主会话做结构核对；**可见子会话（备用）**——zcode -p 创建持久可对话子会话，用户在会话列表打开直接审改，但模型不可选（CLI 无 --model，无头进程注册表只有自配 provider，拿不到 bigmodel 目录）。覆盖派发硬门槛（提取完成、用户确认、无双开、路线判定）、自包含提示词模板（三份必读文件与 zh\ 产物的具体路径、发挥想象原创译写、只填 zh、格式铁律）、首轮结构核对、对话式审改与定稿注入。不用于提取（starsector-mod-localization-extract）、注入（-apply）、闸门校验（-verify）、烟测；主会话顺手翻几条小新增（wf-translate-update 微量档）不需要本 skill。
---

# zcode-dispatch-translate · 派发汉化翻译（闲时任务优先 · 可见子会话备用）

**职责**：提取完成后，把整包翻译派给 AI 执行并守住质量闸。两条路线：
- **路线 A · 闲时任务（默认优先）**：用 `OffPeakCreate` 工具创建无人值守续跑任务——走闲时独立配额池
  （不受主计划「5 小时上限」影响、可上 GLM 系模型）；任务在**本会话内续跑**，产物写 `zh\`，
  完成后自动唤醒主会话。**没指定模型、指定 GLM 系、或不确定时，一律走它。**
- **路线 B · 可见子会话（备用）**：`zcode -p` 创建真正持久的子会话，出现在 ZCode 会话列表（与主会话同项目），
  用户打开即可像普通会话一样直接对话审改。**代价：模型不可选**（只能用宿主自配 provider 的默认模型，见 §5 坑表）。

**不做**：提取、注入、闸门校验、烟测（各见对应 skill/workflow）；路线 A 的审改直接在主会话进行，主会话不当传声筒（那是路线 B 的纪律）。
**上游**：`wf-localize.md` 阶段 1–2（G1 通过、交付包就绪）；`wf-translate-update.md` ②档大批量新条目也可用。
**下游**：用户认可译文后，`wf-localize.md` 阶段 3（`-apply` 注入，流程与人工回传完全一致）。
**机制出处**：`_work\explore\zcode-session-dispatch-plan-a.md`（2026-09-30 首测 §1–8；
**2026-10-01 补充实测 §9**：CLI 注册表构成、`--model` 不存在、1308 配额上限、`session/setModel` 失效、闲时任务行为——路线判定的全部证据在那）。

## 0. 动手前（硬门槛，缺一不派）

1. **提取已完成**：shard 齐、`worklist_index.json` 在、`glossary.md` 在、**`worklist\zh\` 空文件夹已建**（含 README）。
2. **用户已明确同意派发**；若用户点名模型（如"用 GLM-5.3"），直接走路线 A——路线 B 给不了指定模型。
3. **无双开**：没有旧译者会话/闲时任务还在写同一 worklist（`OffPeakList` 查排队任务；确认用户没在编辑器占着 `zh\`）。
4. **路线判定**：

| 用户要求 | 走 |
|---|---|
| 没指定模型 / 指定 GLM 系 / "先跑起来再说" | **A 闲时任务** |
| 要独立可对话的译者会话，且接受宿主默认模型（见 §5 坑表第 4 条） | B CLI 子会话 |
| 要指定 bigmodel 且必须独立可对话会话 | 主会话备好提示词 → **用户在桌面 App 手动建会话粘贴**（CLI 建不出来；`--resume` 桌面旧会话属污染性兜底，须用户明确同意） |

规模预算（两路线通用）：清单 ≤ 约 3000 条 → 一次整包；更大 → 先只派 `01_*`、`02_*` 两片，其余等用户说"继续"（续跑方有完整记忆）。

## 1. 路线 A：闲时任务派发（优先）

用 ZCode 的 **`OffPeakCreate` 工具**（不是 Bash）：

- `title`：`<Mod> 汉化整包翻译（闲时）`；
- `model`：**省略**——闲时队列有自己的允许模型清单，`ListModels` 里的 id（含闲时计划的 GLM-5.3）传进去会被拒；
  省略 = 用默认允许模型（实际是哪个看创建后的任务卡片，并向用户如实说明）；
- `permissionMode`/`thoughtLevel`：省略（默认全自动 + 最高推理）；
- `prompt`：自包含提示词，**路径必须写全**——虽是本会话续跑（带全部历史），但输入/输出路径与汇报格式写进提示词才稳。

提示词模板（照抄，只替换 `<Mod>`；不要出现半角单引号）：

```
你是本mod的汉化译者。任务：汉化 C:\game\StarSector.v0.9.8a-RC8\_work\mod_work\<Mod>\worklist 下的全部待译清单，产物写入该目录下的 zh\ 子文件夹（只处理 0*_*.json 五份清单；zh\ 里已有 README.md 不要动）。

动笔前先读三份：
1 C:\game\StarSector.v0.9.8a-RC8\_work\mod_work\<Mod>\worklist\worklist_index.json ——分片结构、条目数、consistencyRequirements 一致性硬约束
2 C:\game\StarSector.v0.9.8a-RC8\_work\mod_work\<Mod>\worklist\glossary.md ——术语表；mod 专名附录中标注【待定】的由你定夺（表内已给证据与候选），定名后全篇一致
3 C:\game\StarSector.v0.9.8a-RC8\_work\skills\skills\starsector-mod-localization-spec\SKILL.md ——格式铁律

翻译规则：
- 发挥想象进行汉化：先读懂再译，按游戏语域原创译写，允许脱离原文结构、不受英文句式束缚，不逐字硬译、不带机翻腔；图鉴与叙事文本逐段理解后亲自写
- 只填 zh 字段，其余字段一律不动；不得增删条目、不得改变顺序；填完写入 zh\，文件名与原清单一致
- 有意保留原文的条目：zh 与原文逐字相同（缩写、引擎枚举、纯数值高亮值等）
- 格式铁律（违反会导致注入失败或游戏内显示问号）：字面百分号写成 %%；%s %d 占位符原样保留数量与顺序；\u0001 数量与位置不变；CSV 单元格内按原格式处理引号与逗号；禁用直角引号，中文强调用【】或《》；id、路径、引擎常量、枚举值绝不译
- 04_jar.json 条目没有 en 字段，原文在 c 字段，翻译对照 c
- worklist_index.json 的 consistencyRequirements 列出的跨文件术语必须逐处同译
- 除 worklist\zh\ 的五份清单外不得改动任何文件；不要创建任何新的定时或闲时任务

译完后回复一份汇报：每份文件的条目数、实译条数、保留原文条数、总计；你为 mod 专名定的译名对照（EN→ZH）；未译条目及原因。
```

**行为特性（创建前讲给用户听）**：
- 闲时任务 = **本会话的无人值守续跑**：带全部会话历史，翻译过程与译名决策都留在本会话记录里，用户随时可翻；
- **开始时间不保证**（队列位次 + 服务器空闲；`OffPeakList` 查位次），主会话创建后**只做简短确认**然后转空闲等唤醒；
- **没有独立译者会话**——审改直接在主会话提意见（"01_data 第 X 条改成……"），译者上下文都在，改稿最准；
- 完成后自动唤醒主会话 → 走 §3 结构核对 → 向用户交棒（统计 + 译名对照 + 审改方式）。

## 2. 路线 B：可见子会话派发（CLI，备用）

**派发前先确认默认模型可接受**：`-p` 会话的模型 = `~\.zcode\v2\provider_config.json` 里 `providerOrder`
首个 provider 的首个模型（本机 2026-10-01 实测为自配中转 `new-provider/gemini-3.8-flash`）。
**传 model 参数没有用**：CLI 无 `--model` 选项；app-server `session/create` 指定 `account:*`/`builtin:*`（bigmodel 系）
一律报「Provider Registry 中不存在 Model」——不要重试代理/等待/大小写/provider 变体（全测过，见机制文档 §9）。

主会话用 **Bash 工具 + `run_in_background: true`** 执行（整包翻译远超前台 10 分钟上限）：

```bash
mkdir -p "C:/game/StarSector.v0.9.8a-RC8/_work/mod_work/<Mod>/dispatch"
node "C:/Users/Camellia895/AppData/Local/Programs/ZCode/resources/glm/zcode.cjs" \
  -p '<§1 的提示词模板，仅末行汇报段之后追加一句：之后用户会直接在本会话里提修改意见，按同样的规则改 zh\ 里对应的文件即可。>' \
  --json --cwd "C:\game\StarSector.v0.9.8a-RC8" \
  > "C:/game/StarSector.v0.9.8a-RC8/_work/mod_work/<Mod>/dispatch/result.json" \
  2> "C:/game/StarSector.v0.9.8a-RC8/_work/mod_work/<Mod>/dispatch/stderr.log"
```

## 3. 首轮结束：结构核对（两路线通用，硬步骤）

1. **取汇报**：路线 A = 唤醒轮次里闲时续跑的完工汇报（无需解析文件）；路线 B = 读 `dispatch\result.json` 拿
   `sessionId`（**抄进 `dispatch\session.txt` 留档**）与 `response`。
2. **跑结构核对**（条目数、增删、"动了 zh 以外字段"一次看清；比较前剥掉 zh；`en??c` 兼容两类条目）：

```bash
node -e "const fs=require('fs');const d=process.argv[1],z=process.argv[2];const cmp=(o)=>JSON.stringify(o,(k,v)=>k==='zh'?undefined:v);for(const f of fs.readdirSync(d).filter(x=>x.endsWith('.json')&&x!=='worklist_index.json')){const a=JSON.parse(fs.readFileSync(d+'/'+f,'utf8'));let b=null,t=0,e=0;try{b=JSON.parse(fs.readFileSync(z+'/'+f,'utf8'))}catch{};if(!b){console.log(f,a.length,'条; zh 缺这份');continue}if(b.length!==a.length)console.log(f,'!! 条目数不符',a.length,'->',b.length);b.forEach((it,i)=>{if(i>=a.length){e++;return}const s=it.en??it.c;if(cmp(it)!==cmp(a[i]))e++;if(it.zh&&it.zh!==s)t++});console.log(f,a.length,'条; zh外被改/多出',e,'; 已填译',t)}" \
  "C:/game/StarSector.v0.9.8a-RC8/_work/mod_work/<Mod>/worklist" \
  "C:/game/StarSector.v0.9.8a-RC8/_work/mod_work/<Mod>/worklist/zh"
```

3. **预期全绿**：每份都有输出、无 `!! 条目数不符`、`zh外被改/多出` 为 0、`已填译 + 保留原文 = 条目数`
   （"已填译"按 zh≠原文计，有意保留原文的条目落在差值里，属正常）。
4. **向用户交棒**：首轮统计与专名译名对照；结构核对是否全绿；审改方式（路线 A 在本会话直接说 / 路线 B 打开译者会话说）。

## 4. 审改 → 定稿 → 注入

- **路线 A**：审改就在主会话提；按同样规则改 `zh\` 对应文件，**每轮改完重跑 §3 核对**。
- **路线 B**：审改由用户与译者会话直接进行；**用户开着该会话时主会话/CLI 绝不能 `--resume` 它**（双写冲突，机制文档坑 #7）。
  `--resume` 仅当会话没在任何地方打开时代跑反馈用：
  `node <zcode.cjs> --resume <session.txt 里的 sess_…> -p '<反馈>' --json --cwd "C:\game\StarSector.v0.9.8a-RC8"`。
- **定稿判定**：用户对主会话表示"译文定稿/可以注入了" → **再跑一次 §3 核对**（多轮对话后防改坏结构）→ 全绿进 `wf-localize.md` 阶段 3。
- 专名译名对照记入 `_work\mod_work\<Mod>\` 留档，并回填 `worklist\glossary.md` 附录的定名（供任务②复用）。

## 5. 坑表（实测出处见机制文档 §4、§9）

| 坑 | 处理 |
|---|---|
| 前台跑被 10 分钟上限掐断 | 路线 B 必须 `run_in_background: true` |
| **CLI 无 `--model` 参数**（报 Unknown option） | 无头会话模型不可选；要指定模型走路线 A（省略 model 字段）或桌面手动建会话 |
| **无头进程注册表只有自配 provider**：`session/create` 指定 `account:*`/`builtin:*`（bigmodel 系）必报「Provider Registry 中不存在 Model」 | 别再试代理/等待/大小写/provider 变体（2026-10-01 全测过）；GLM 系一律路线 A |
| `-p` 默认模型 = providerOrder 首个 provider 的首个模型（实测 new-provider/gemini 中转，不是 GLM） | 派发前向用户确认默认模型可接受，否则路线 A |
| **GLM-5.3（非 Flash）有 5 小时使用上限**（bigmodel 错误码 1308） | 重置时刻查 `~\.zcode\cli\log\zcode-YYYY-MM-DD.jsonl` 搜 `1308`（报错信息内含 UTC+8 时刻）；锁定期内桌面手动建会话也请求失败；Flash 配额池独立（实测不受影响） |
| `session/setModel` 协议调用传对象报 [object Object] | 别用协议改模型 |
| 闲时任务 `model` 字段传 ListModels 的 id 被拒（"not in the idle-time allowed model list"） | **省略 model 字段**，用默认允许模型；实际模型看任务卡片并告知用户 |
| 闲时任务开始时间不保证 | `OffPeakList` 查队列位次；创建后转空闲等唤醒，别傻等 |
| 闲时任务没有独立会话、无 sessionId | 句柄是 `offpeak-*` 任务 id（`OffPeakList` 查）；审改在主会话 |
| 要指定 bigmodel 的独立可对话会话 | 只能桌面 App 手动建（提示词主会话备好）；`--resume` 桌面旧 GLM 会话可绕过校验但**污染该会话记录**，仅用户明确同意才用 |
| 只信首轮 response 不验文件 | §3 结构核对是硬步骤；对话多轮后定稿前再跑一次 |
| 提示词里出现半角单引号 | 打断 bash 单引号串——模板照抄，别即兴加英文缩写 |
| 超大清单撑爆译者上下文（约 20 万窗口） | ≤3000 条整包；更大先两片，其余说"继续" |
| `--cwd` 不写或写错项目 | 会话落到别的项目列表，用户找不到——固定写游戏根 |
| `zh\README.md` 被当清单 | 不会——续跑方只处理 `0*_*.json`；§3 核对也跳过 index 与 README |

## 完成标准

- [ ] 派发前用户已确认（含路线选择，对话里能回溯）
- [ ] 路线 A：`OffPeakCreate` 成功、已向用户说明"开始时间不保证 + 实际模型 + 审改在本会话"；路线 B：`dispatch\result.json` 已解析、`sessionId` 已写 `session.txt`
- [ ] 首轮 §3 结构核对跑过且全绿，结果已随交棒信息告知用户
- [ ] 专名译名对照已汇报并留档
- [ ] 用户定稿 → 定稿前复查结构核对全绿 → 已交接 `wf-localize.md` 阶段 3
