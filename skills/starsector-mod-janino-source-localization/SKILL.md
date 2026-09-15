---
name: starsector-mod-janino-source-localization
description: Janino 运行时编译型 mod（无 jars 目录、Java 源码直接放 data/plugins 与 data/scripts，游戏启动时编译）的汉化专用流程。覆盖载体判定、.java 字符串字面量词法提取与独立残留复查、% 写法逐行保持的实证判据、注入器三坑（parseCsv 丢表头/occ 行内序号语义/紧凑 JSON 锚定）、源码层 G4/G5 替代闸门（骨架等价证明）、JSON 值内 ASCII 引号事故与 org.json 权威校验。是 starsector-mod-localization-extract/apply 在"源码即载荷"形态下的专项补充。首次实战：sic-auxiliaries 1.3.0（2026-09，560 条全过）。
---

# Janino 源码层汉化（无 jars 的 Java mod）

**何时用**：摸底发现 mod **没有 `jars/` 目录**，而 `data/plugins/*.java`、`data/scripts/**/*.java` 直接躺在
数据目录里 → 游戏启动时用 Janino 编译它们，**源码就是运行载体**。
 jar 层流程（常量池补丁/`starsector-mod-java-hardcoded-text`）**不适用**；翻译载体 = `.java` 文件本身。
**上游/下游**：仍走 `wf-localize.md` 全流程；本 skill 替换其中"jar 层"的提取/注入/验证三段。
**必读**：`shared/env.md`、`shared/iron-rules.md`、`starsector-mod-localization-extract`（data 层部分照常）。

## 1. 判定与策略

```
mod 根下无 jars/，且 data/plugins|data/scripts 有 .java？
├─ 是 → 本 skill：直接改 .java 源码里的字符串字面量（游戏 UTF-8 读取，中文直接写，无需 \uXXXX）
└─ 否 → 走 jar 常量池补丁（starsector-mod-java-hardcoded-text）
```

- **不需要 javac 重编译**：Janino 启动时自己编；翻译只动字面量内容，风险 = 转义写坏，用 §4 的骨架闸门兜住。
- **不要**因"想验证可编译"去搭 SiC/框架类的编译环境（依赖 mod 缺失时根本编不过）；骨架等价证明足够。

## 2. 提取（两层网，缺一不可）

1. `node <skills>\shared\scripts\extract_java_strings.js <modRoot> <outJson>`
   词法状态机抓全部 `"..."` 字面量（跳过 `//` `/* */`，保留原始转义不做解码 ⇒ 注入按字节替换）。
   **历史 bug（2026-09）**：行注释状态不随换行退出 → 每文件首个 `//` 之后全部漏抓。
   ⚠️ 因此**必须跑第 2 层**。
2. `node <skills>\shared\scripts\check_java_residue.js <modRoot> <literalsJson> <worklistDir>`
   **独立解析路径**的复查网（逐行正则），未覆盖英文字面量必须 = 0。实测抓回 79 条真实 UI 文本
   （里程碑修正标签 "Explorer"、效果拼接段 `"% sensor range"`、情报标题等全在漏网里）。
3. 分类判据 = **调用点语义**（铁律 R12 同源）：`getBoolean/isSkillActive/hasHullMod/addMod/getMod/
   hasIndustry/spawnExecutive/setPostId/tags.add` 等查找类 API 的实参 → 绝不译；
   `addPara/setName/getAffectsString/modifyXxx(…, "标签")/item.label` 等显示位 → 译。
   参考实现：`_work\mod_work\sic-auxiliaries\tools\classify_java.js`（复制改白名单即可复用）。

## 3. 写作期判据（本形态特有）

| 场景 | 规则 |
|---|---|
| `getEffectDescription()` 等效果返回串 | **单 `%` 安全**（原版 API 源码即 `return "+" + x + "% sensor range"`，裸显示不过 format） |
| `addPara(...)` 各行 | **逐行保持原文的 `%` 写法**：该行单 `%` 就单 `%`，该行 `%s`/`%%` 就原样保留数量与顺序。**不要**按 R4 一刀切写 `%%`——本形态两种渲染管线并存，逐行照抄是唯一安全解 |
| 高亮词（`addPara` 可变参末尾的字符串） | 译文段落里**必须包含该词的译文**（否则不高亮；无害但不美观）。判定：stmt 里 `getTextColor(), getXxxColor(), "词");` 形态 |
| 拼接句分段（`"a" + var + "b"`） | 按段翻译、顺序不变，译者须看整句（worklist 的 `stmt` 字段即上下文） |
| 战斗 HUD 状态名（`private static final String Description =`） | 译（显示在舰载机技能状态图标旁） |
| 与其它 mod 文本 `contains` 比对的常量 | **绝不译**（实测：`WingRoleUpdater` 的 `Transience`/`Fragments` 是逻辑键） |

## 4. 注入（三坑 + 骨架闸门）

参考实现：`_work\mod_work\sic-auxiliaries\tools\inject.js`（数据层 CSV/JSON + Java 字面量两栖）。

1. **`parseCsv` 返回的 rows 不含 header** —— 整文件重写必须先补回 `csvJoinRow(header)`，
   否则表头静默丢失（2026-09 实际事故，靠抽查首行发现）。
2. **行内多个字面量的 occ 语义** = "该行第 N 个被提取的字面量"（不同字符串共享一行各自计数）。
   注入按 `行 + 同 en 的第 prior+1 次出现` 定位，不要把 occ 当"同一字符串第 N 次出现"。
3. **紧凑 JSON 的键锚定**必须用 `"key"\s*:\s*"value"` 弹性正则（`.skin` 常是 `"hullName":"..."` 无空格）。
4. **JSON 值内禁未转义 ASCII `"`**（`称为"风暴"` 会截断字符串 → 引擎解析失败）。中文引用用**弯引号“”**
   （有字形、无结构含义）或【】。教训见 §5。
5. 写回保持每文件自己的 EOL 与末尾换行（R17）；Java 的 zh 转义只需 `\` → `\\`、`"` → `\"`。
6. 注入前 R15 断言 + `pre_zh` 备份照常；**部分失败后必须还原英文原版重注**（注入器不是幂等的）。

## 5. 验证（源码层 G4/G5 替代）

```powershell
node <skills>\shared\scripts\check_java_equiv.js <EN备份> <modRoot>     # 骨架等价 + 字面量数 + 词法完整
```

- **骨架等价**：把所有字面量内容换成占位符后，EN 与 ZH 的代码骨架必须逐字节相同
  ⇒ 机器证明"只改了字面量内容，没碰任何语法结构"。这是无 jar 形态的 G4 主闸门。
- 数据层照常 G3 全套；**JSON 系文件加跑 org.json 权威解析**（`JsonProbe.java`，游戏自带 json.jar）：
  - 编译探针必须 `javac --release 17`（env.md 毒点 3，否则 JRE 17 跑 69 版 class 直接 LinkageError）；
  - **先 probe 英文基线再 probe 注入版**：基线也 FAIL 的是"引擎本就容忍的伪 JSON"（如 `.ship` 尾随逗号），
    保持原样；基线 OK 注入版 FAIL 才是注入引入的破坏（2026-09 实抓：译文 ASCII 引号截断 `.skin` 字符串，
    `check_refs` 的严格解析报警是真问题，`JsonProbe` + 基线对照定分责任）。
- 无依赖 mod 编译不过 = 预期（缺 SiC/LunaLib 类），**不要**为此补依赖；骨架闸门已覆盖语法风险。

## 6. 交付与留档

- 照 `starsector-mod-delivery`；`ai/en` 放原文清单、`ai/zh` 放已填清单（跨文件同词联动组写进 README_汉化说明）。
- `mod_work\<Mod>\tools\` 保留 classify/inject（任务特化规则在白名单里，换 mod 只改白名单）。
- 通用提取/复查/等价工具已提升 `shared\scripts\`，登记见 `script-registry.md` A/D 节。
