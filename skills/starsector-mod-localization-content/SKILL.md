---
name: starsector-mod-localization-content
description: Starsector（远行星号）mod 汉化"内容层"（译文本身）的质量规范与质检——原创译写不照抄旧版、以 0.98a 核心汉化为术语基准的取证方法、可见文本分层（数据层/jar 层/日志/注释/绝不译）、跨层术语一致性、风格与标点、字数与信息完整度、内容自检清单与实战案例（automatic-orders 事故）。只管"界面与功能文本译成什么样"，格式铁律见 starsector-mod-localization-spec，对话与叙事文风见 starsector-translation-voice，技术管线见 -extract / -apply / -verify。
---

# 内容与译文规范（界面/功能文本）

> 由 automatic-orders 0.3.3（0.98a 移植版）汉化实战沉淀，聚焦插件名与描述、界面提示、战斗消息、
> 模组信息、日志、配置注释的译文质量。
>
> **分工**：技术管线 → `-extract` / `-apply` / `-verify` / `starsector-mod-kotlin-rebuild`；
> 格式与字符约束 → `starsector-mod-localization-spec`；对话/背景/叙事 → `starsector-translation-voice`。

## 1. 核心原则

1. **原创译写，不照抄**：旧版汉化/机翻只作术语与社区习惯参考，逐句重新译写。沿用旧版前先核对版本差
   （上游文案可能已改）与质量（误译、错位、语病、与当前核心术语不一致的绝不沿用——**沿用等于把旧 bug 一起交付**）。
2. **以 0.98a 核心汉化为术语基准**：游戏本体中文化用词就是玩家的"母语"。取证方法见
   `<skills>\shared\glossary.md`（grep 核心 data + `_work\语料库\parallel\core_parallel.plain.jsonl`）。
3. **社区既有模组中文名沿用**：同一模组已有广泛使用的 CN 名就保持，别另起炉灶（除非与核心严重冲突或明显错误）。
4. **语义正确优先于逐字对应**：先读懂代码行为再译（"assigned a light escort of X" = 该舰被指派为 X 的轻型护航，
   **方向别译反**）；上游文案笔误（复制粘贴错词、desc/short 错位）允许按语义修正，
   但**必须在交付说明/语料 note 记录"有意修正"**。
5. **只译玩家可见文本**；日志、内部 id、路径、引擎常量、配置键一律不译（分层见 §2）。
6. **允许脱离原文的结构**，不用逐句翻译。

## 2. 可见文本分层（动手前先摸清，防漏译也防误译）

| 层 | 典型位置 | 处理 |
|---|---|---|
| 数据层 UI | `hull_mods.csv` 的 name/desc/short/tech、variants `displayName`、faction/rules/strings | 直接改文件（写法见 `-spec` §2） |
| jar 层 UI | 代码里 `addMessage`/界面字符串/`getUnapplicableReason` | 源码级改后整模块重编译，或常量池补丁（见 `-apply` §2） |
| 日志 | `LOGGER.*`（写 `starsector.log`） | 建议与界面文本同译保持一致；**保留 id/常量原文** |
| 注释/文档 | 配置 json 的 `#` 注释、README | 面向玩家的配置注释建议译；开发者说明可留原文 |
| **绝不译** | 模组 id、插件 id、script 类名、图标路径、配置键与枚举值、引擎性格/指令常量、URL | 译了会导致 `NoSuchFieldError`/逻辑失效/崩溃 |

jar 层先跑 `analyze_jar_strings.js` 出常量清单，再决定哪些进清单、哪些改代码、哪些不动
（如 hullmod id 后缀 `light`/`reckless` 是引擎匹配键，必须保留）。

## 3. 术语与风格

1. 先建**术语表**（EN→ZH + 来源 note：核心 grep / 社区习惯 / 自定并标注），所有译者与子代理共用；
   写进 `<skills>\shared\glossary.md` + `glossary.json`。
2. **跨层一致性**：同一概念在插件名、desc、战斗消息、`mod_info`、设置注释里用词必须一致
   （`escort` 全程"护航"，不一会"护送"；`personality` 全程"性格"）。
3. **风格贴合游戏**：军事/战术简报口吻、短句为主。`desc` 讲清"触发条件 + 效果 + 例外/覆盖关系"；
   `short` 一句话；插件名控制长度（放得进 refit 列表）。
4. **数字与单位**：保留阿拉伯数字（`10%`、`0.8`、`[0-1]`）；CR/PPT 等社区通用缩写可保留。
5. **标点全角**：，。；：？！（）——…；中文强调用 **`【】`/`《》`**（**不用 `「」`**，铁律 R3）；
   避免中英混排标点。

## 4. 自检清单

- [ ] 术语表已建且跨层一致（grep 各文件，同概念同词）
- [ ] 占位符/`%%`/`${}`/`\u0001` 按 `-spec` §1 逐项核对过
- [ ] 无整句英文残留（`scan_stragglers.js` / 人工抽查）
- [ ] CSV 无拆列、无 BOM、列数与 header 一致（`-spec` §2）
- [ ] 插件名长度目检；`short` 一句话、`desc` 语义完整（条件/效果/例外）
- [ ] 与旧版汉化的差异已记录（有意不沿用/有意修正）
- [ ] 游戏内触发路径目检：悬停 tooltip、refit 安装、战斗触发消息、模组列表
- [ ] 工具扫描：按 `starsector-mod-localization-verify` 的 G2/G3 跑一遍

随本 skill 分发：`scripts\check_content.js`（占位符/`%%`/`${}`/长度/空译文自检）。

## 5. 实战案例（automatic-orders 0.3.3 汉化）

- 模组名沿用「自动命令」（旧 0.3.2 社区名）；术语按核心取证：护航 / 搜索歼灭 / 峰值时间 / 战备值 /
  性格（鲁莽/激进/沉着/谨慎/胆小）。
- 旧 0.3.2 汉化包**仅参考不照抄**：其 heavy escort 误译"全体护送"、escort 用"护送"、标点风格错位，
  全部原创重写并记录差异。
- 上游文案笔误修正（记录在案）：`BaseRetreatThreshold` 互斥提示原为 "Personality overrides…"（复制粘贴笔误），
  按"撤退命令"语义译；CSV steady/timid 行 desc/short 错位按语义统一。
- **事故 1**：tooltip 文本 `10%时` → `UnknownFormatConversionException`，修复为 `10%%时`（铁律 R4）。
  此坑英文原版从未暴露（对应行只在未发布的 master 存在，0.3.3 移植才首次进游戏）。
- **事故 2**：Kotlin `$typeString护航` 编译错，修复为 `${typeString}护航`（铁律 R5）。
- 舰船身份行 `(hullName-class)` 不译：数据来自 `.ship`（核心船名仍 EN），随游戏自身显示习惯。
- 日志随界面文本同译（保留 id/常量）；舰船/舰体名等数据插值保留原文。

## 6. 与流程的衔接

- 产物形态（en/zh 逐条语料、术语表、决策记录）→ `<skills>\shared\conventions.md` §4、
  `starsector-mod-delivery`（`ai\en` / `ai\zh` + `ai\README_汉化说明.md`）。
- 上游出新版时：diff EN 变更 → 按本 skill 术语与铁律补译 → 工具扫描（`-verify`）→ 目检 → 交付；
  分流规则见 `wf-translate-update.md`。
