# wf-diagnose · 出事入口（症状 → 诊断路径）

> 任何阶段发现问题都从这里进。目标：**把"看起来像 bug"变成证据**，再决定改不改。
> 需要读：`shared\iron-rules.md`（每条症状对应哪条铁律）、`shared\env.md`（日志/编码/`-noverify`）、
> `skills\starsector-engine-diagnose\SKILL.md`（离线复现与反汇编方法）。

## 0. 先做三件事

1. **读日志**（`<game>\starsector-core\starsector.log`，**`-Encoding Default`** 读，GBK）：
   ```powershell
   node <skills>\shared\scripts\find_crash.js <game>\starsector-core\starsector.log
   ```
   切出最后一次会话 + ERROR/Exception + 首个致命错上下文。
2. **区分归属**：日志里别人的 mod 也在报错（`Weapon spec [...] not found`、`Ship hull spec [...] not found`、
   `Error while initializing plugin` 常来自 assortment_of_things / vol_ / fds_ / stormwall_ 等）。
   用正则把 `[id]` 一起匹配出来再判归属。
3. **判定"崩"还是"静默失效"**：日志里**有没有目标 mod 自己的栈帧**（`at data.scripts…` / `at <包名>`）？
   没有 ⇒ 是功能静默失效（规则没接线、条件永不满足、列没被读…），别只盯报错。

## 1. 症状 → 处置表

| 症状 | 最可能原因 | 处置 |
|---|---|---|
| 启动崩，日志 `JSONException: JSONObject["options"] not found` | 数据 CSV 被弯引号拆列（**R1**） | `check_csv_quotes.js` → `TestCsv.java` 离线复现（EN 基线对比）→ 修文件 |
| 启动崩，`Loading rule: X` 之后就崩 | **崩溃行 = 最后打印的那行**（不是下一行） | `diagnose` §1 的打印时序语义 |
| 游戏内文本在某个引号处戛然而止，**无报错无日志** | rules script 命令参数内嵌引号（**R2**） | `check_rules_arg_quotes.js` → 参数内改 `【】` |
| 个别字显示 `?`，无报错 | 缺字形（**R3**） | `check_font_glyphs.js` → 换同义常用字/改写法 |
| 悬停 tooltip 即崩，`UnknownFormatConversionException` | 字面 `%` 未写 `%%`（**R4**） | 全量搜 `%` → 修 → 重跑 G3 |
| **战斗中**（开火/导弹命中/切船）崩，`JSONException: JSONObject["range"] not found`，栈里有 `ProximityFuseAI.updateDamage` ← `<init>` | 某个 `.proj`/`.wpn` 写了 `behavior":"PROXIMITY_FUSE"` 却漏 `range`（引擎用**严格** `getDouble("range")` 读 `behaviorSpec` 本体；`optXxx` 的默认值救不了它）。**与汉化无关**（译的是显示文本，键不改），要先看是不是原版数据就有的老问题 | `run_projspeccheck.ps1 -AllMods`（`ProjSpecCheck.java`）→ 按 `PFAI-RANGE-MISSING` 报出的文件补 `"range":<数值>`；顺带用它排掉"引擎侧严格读法"类的其它漏键 |
| 闪退，`NoSuchFieldError`/`NoSuchMethodError`（消息乱码） | 标识符被误译（**R7**） | `verify_identifiers.js` → 修映射 → `patchdir.js` 重打 |
| 运行时报 `StringConcatException: Mismatched number of concat arguments` | `\u0001` 数量/位置被改（**R6**） | `check_u0001.js` → 修译文 → `verify_u0001_jar.js` |
| 启动崩，`Duplicate key "xxx"`（settings.json） | JSON 键译后重复（**R10**） | 合并同义键，保持键唯一 |
| 数据加载报"格式错误"但文件看着没问题 | 用了严格解析器（**R8**） | 用 `JsonProbe.java`（游戏 `org.json`）复验 |
| mod 加载了但内容不生效、无报错 | 缺列/未注册/条件永不满足/上游一直未接线 | `diagnose` §4 反汇编定论；数据层查注册三件套 |
| 舰船名/分类显示英文，但 `.ship` 已译 | 真正来源是 `ship_data.csv` | `-extract` 易漏区 ⑬ |
| 特效与舰船分离且随镜头变化 | 渲染坐标（逻辑 vs 像素分辨率） | `starsector-mod-render-fix` |
| `VerifyError: StackMapTable error`（自己写的验证程序报） | 本机 `starfarer.api.jar` 被汉化改过 | 加 `-noverify`（游戏本来就带） |
| `Could not initialize class X` / `ExceptionInInitializerError` | 类加载期抛异常（伴生对象默认值/插件构造函数） | `starsector-mod-kotlin-rebuild` §6 事故 3/4 |
| jar 替换失败"文件被占用" | 游戏正在运行 | 完全退出游戏再替换 |
| `Could not load the following classes`（反编译输出顶部） | 缺 `--extraclasspath` | `starsector-jar-decompile` §2 |

## 2. 通用诊断手法

1. **EN 基线对比**：任何"汉化后才出现"的问题，先用 EN 原版文件跑一遍同样的校验（`TestCsv` / 结构对比），
   确认是原版就有还是本次引入。
2. **离线复现**：用引擎自己的静态方法（`G.o00000`、`SpecStore.?00000`）在不开游戏的情况下复刻解析管线
   → `starsector-engine-diagnose` §2。**这是判"谁的责任"最快的手段。**
3. **反汇编定论**：拿不准"引擎是否读这个字段/是否调用这个方法"时，`javap -p -c` + 全 jar 字符串扫描
   → `starsector-engine-diagnose` §4。**只有定义处出现 ⇒ 无人调用。**
4. **逐层排除**：按闸门顺序 G2 → G3 → G4 → G5 → G6 走一遍，先证明"不是内容层的问题"再怀疑引擎。

## 3. 修完必须做的

- [ ] 复现命令重跑一次，确认症状消失（不接受"看着好了"）
- [ ] 相关闸门重跑（改数据 → G2/G3；改 jar → G4；改引用 → G5）→ `starsector-mod-localization-verify`
- [ ] 游戏内走一遍触发路径（G6）
- [ ] 把根因与修法写进交付说明 / `ai\README_汉化说明.md`（避免下版本再犯）
- [ ] 若属新的通用陷阱 → 追加到 `shared\iron-rules.md` 或对应 skill 的坑表（**skill 是不断进化的**）
