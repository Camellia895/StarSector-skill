---
name: starsector-translation-voice
description: Starsector（远行星号）mod 汉化的"角色声线与叙事文风"规范——对话/人物台词按性格（quarrelsome/martial/calculating/upstanding）写出真的会这么说的话，允许脱离英文句式、不机械求同、可用粗话/黑色幽默/Starsector 内部典故；人物背景、领主传记、势力档案、舰队介绍按"翻译信息不翻译英文句法"、事实与传闻严格区分、不同势力不同叙事气质、去 AI 味审校。含 15+ 对话案例与八步工作流。只管"长文本与人物文本写成什么样"，不含提取/注入/格式铁律（见 starsector-mod-localization-extract / -apply / -spec）。默认用户环境与当前环境一致（游戏根 C:\game\StarSector.v0.9.8a-RC8，中文 Windows）。
---

# 角色声线与叙事文风

**职责**：对话、人物背景、领主传记、势力档案、舰队介绍、世界观说明的**文风与人物感**。
**细分文档**（按任务类型读其一或两者）：

| 任务 | 读 |
|---|---|
| 对话/台词/选项文本（含 personality 分支） | `<skills>\skills\starsector-translation-voice\voice-dialogue.md` |
| 人物背景/传记/势力档案/舰队介绍/世界观 | `<skills>\skills\starsector-translation-voice\voice-narrative.md` |

**不负责**：提取与注入（`-extract` / `-apply`）、格式与字符铁律（`-spec`）、界面/功能文本的一般质量规范（`-content`）。

## 通用底线（两份文档的共同前提）

1. **不改剧情逻辑与关键信息**——这是硬约束，优先级高于口语感与文采。
2. **不擅自补充信息**：原文没有的动机、结论、因果、心理、评价一律不写。
3. **区分事实与传闻**：`allegedly`/`supposedly`/`rumored`/`reportedly`/`is said to`/`according to`/`claims to`/`is believed to`
   必须保留其不确定性（"据称拥有" ≠ "拥有"）。
4. **允许脱离原文句式重组**：英文一句可压成半句、拆成两三句、调整句序；不机械翻译连接词（however/furthermore/meanwhile…）。
5. **相同英文不默认同译**：按 `group`/`scene`/`entry`/人物关系/情绪/场景重写；
   但**禁止为求异机械追加无意义句尾**。
6. **优先级**（冲突时从上到下）：
   不改剧情逻辑和关键信息 > 人物口语感 > 性格差异 > Starsector 游戏味与黑色幽默 > 对英文句式的忠实。
7. **专名沿用**：先查参考汉化 → 再查同项目其他文本 → 保持项目内部一致 → 都没有才自定
   （人名/地名若项目一直保留拉丁字母就继续保留，不强制音译）。

## 程序使用限制（重要）

**禁止用程序、机器翻译、批量替换规则或语言模型脚本生成汉化正文。**
每一段中文必须由译者在理解上下文后亲自生成。程序**只允许**用于：
读取 JSON、统计条目、查找重复项、把已写好的译文回填 `zh`、同步完全相同的重复记录、
检查空译文、检查字段结构、检查变量与占位符、导出最终 JSON。

> 原则：**人负责理解和写作，程序只负责搬运和检查。**

## 与其他 skill 的衔接

- 落笔前后的**格式与字符**约束 → `starsector-mod-localization-spec`（先读，否则可能写出崩服文本）。
- 一般界面/功能文本的质量规范与自检清单 → `starsector-mod-localization-content`。
- 输出形态（worklist 的 `zh` 字段）→ `<skills>\shared\conventions.md` §4。
- 术语音译/意译依据 → `<skills>\shared\glossary.md`。
