---
name: starsector-engine-diagnose
description: 排查/预防 Starsector（远行星号）mod 启动或加载阶段崩溃与"无报错的静默失效"，用引擎自己的代码离线复现而不是盲猜。覆盖：大日志（GBK、多会话）切分与"崩溃行=最后打印那行"的时序语义、反汇编定位引擎读取逻辑、调用引擎公开静态方法（G.o00000 / LoadingUtils.super / SpecStore.?00000）离线复现 CSV 解析以判定"EN 原版问题还是汉化引入"、三条引擎级铁律的权威实证（CSV 弯引号归一化→拆列崩溃、rules 命令参数内嵌引号→静默截断、中文核心字库 ~6742 字形→显示 ?）、语义核查方法（反汇编 starfarer_obf.jar 终结"看起来像 bug 就乱改"）。是汉化/升级流程的公共诊断 skill。默认用户环境与当前环境一致（游戏根 C:\game\StarSector.v0.9.8a-RC8，中文 Windows，日志 GBK）。
---

# 引擎行为复现与诊断

**职责**：面对"启动就崩"或"汉化后静默失效"，不靠盲猜，而是**用引擎自己的代码离线复现**，
定位到具体文件、具体行、具体机制，并给出不会再犯的写作规范。
**调用方**：`wf-diagnose.md`；`-verify` 的崩溃速查指向本 skill。
**必读**：`<skills>\shared\env.md`（路径/JRE/JDK/编码/三条环境毒点）、`<skills>\shared\iron-rules.md`。
**相关**：反编译工具与用法 → `starsector-jar-decompile`；反汇编 `javap` 见 `env.md` 的 JDK 路径。

## 1. 症状识别与"崩溃行"定位

典型崩溃签名（rules.csv 类）：

```
ERROR com.fs.starfarer.combat.CombatMain - org.json.JSONException: JSONObject["options"] not found.
    at com.fs.starfarer.campaign.rules.Rules.o00000
    at com.fs.starfarer.loading.SpecStore.?O0000
    at com.fs.starfarer.loading.ResourceLoaderState.init
```

1. **会话切分**：日志常含多次启动，每次启动毫秒时间戳会回退。用
   `node <skills>\shared\scripts\find_crash.js <starsector.log> [--all]`
   （切出会话边界 + 逐会话 ERROR/Exception/Caused-by + 最后会话首个致命错上下文）。
2. **打印时序语义（关键）**：rules 加载器对每行依次 `getString("id")` → `getString("trigger")`
   → **打印 `Loading rule: X`** → 后面才读 `conditions`/`text`(optString)/`options`(getString)/`script`(getString)。因此：
   - **崩溃行 = 最后一条打印的那行，而不是它后面的行**（曾误判成下一行，浪费大量时间）；
   - `getString` 是**无条件必读**（缺键即 JSONException），`optString(key, null)` 是可选的
     ⇒ 据此判断某文件每行**必须**有哪些列（rules 每行必须 id/trigger/conditions/options/script，`text` 可选）。
3. **初判责任方**：搜整份日志中该 mod 规则**首次**被加载的会话（`Loading rule: <mod前缀>`）。
   若崩的是该 mod 第一次被加载（此前从未加载过其 EN 版），**不能默认"EN 也崩"**——
   先用 §2 离线复现 EN 原版文件做基线。

## 2. 复现方法论（核心）：反汇编 + 调用引擎公开静态方法

### 2.1 反汇编定位读取逻辑

```powershell
& "C:\Program Files\Android\Android Studio\jbr\bin\javap.exe" -p -c `
  -cp "<game>\starsector-core\starfarer_obf.jar" com.fs.starfarer.campaign.rules.Rules
```

读法要点：

- 留意**预处理**调用：如 `Rules.o00000(ResourceLoaderState)` 内部经 `LoadingUtils.super(List, path, true, true)`，
  其中第 4 个布尔为真时先对整段文本调 `SpecStore.?00000(String)` 再交 CSV 解析器 `G.o00000(String)`
  —— **这段预处理就是"弯引号归一化"**（§3 R1 的根源）。
- 逐行看常量池字符串（`ldc`）能直接还原引擎的提示/规则文本
  （如 `rule [ ] has = ('assignment')...`、`Option id starts with $...`）。

### 2.2 可离线调用的入口

| 类 | 方法 | 作用 | 能否离线 |
|---|---|---|---|
| `com.fs.starfarer.loading.G` | `public static JSONArray o00000(String)` | CSV 文本 → JSONArray（每行一个 JSONObject，键 = 表头） | ✅ 纯文本 |
| `com.fs.starfarer.loading.LoadingUtils` | `super(List, String, ZZ)` 等 | 文件读取 + 可选归一化 + 解析（依赖资源管理器 `C`，需游戏上下文） | ❌ 直接调用需环境；内部两步可手工复刻 |
| `com.fs.starfarer.loading.SpecStore` | `?00000(String)` | 弯引号归一化（`“”→"`、`‘’\ufffd→'`） | ✅ 纯文本（正则即可复刻） |

**离线复刻管线（rules.csv 权威验证）**：

```
text = 读文件（UTF-8）
text = text.replaceAll("[\u201c\u201d]+", "\"")        // 复刻 SpecStore.?00000
text = text.replaceAll("[\u2018\u2019\ufffd]+", "'")
rows = com.fs.starfarer.loading.G.o00000(text)          // 引擎真实 CSV→JSON
```

classpath：`starfarer_obf.jar;starfarer.api.jar;json.jar;fs.common_obf.jar;log4j-1.2.9.jar`。
编译：JBR `javac --release 17`；运行：游戏 JRE。
现成模板：`node <skills>\shared\scripts\...` 无此功能，用 `TestCsv.java`：

```powershell
& "<JBR>\bin\javac.exe" --release 17 -cp "<上述 jars>" -d <out> <skills>\shared\scripts\TestCsv.java
& "<game>\jre\bin\java.exe" -cp "<上述 jars>;<out>" TestCsv <rules.csv>
```

**判定**：EN 原版文件跑一遍得基线（行数、0 缺键）；汉化/合并文件跑一遍对比——
缺 `options`/`script` 的行就是会崩的行；**行数比基线多 = 有行被拆散**（引号问题典型症状）。
曾以此 100% 复现两行缺键，与游戏日志崩溃点逐行吻合。

## 3. 三条引擎级铁律的实证（规范全文见 `iron-rules.md`）

### 3.1 R1 数据 CSV 引号（**崩溃**）

引擎事实：读 CSV **前**把弯引号归一化（`[\u201c\u201d]+→"`、`[\u2018\u2019\ufffd]+→'`），
作用于整个文件文本（含 CSV 字段引号外的内容）。
⇒ 数据 CSV 严禁直接写 `“”‘’`；出现在**字段边界/字段开头**时字段被提前闭合 → 行拆成多行、列错位 →
引擎读 `options`/`script` 缺键 → 启动崩溃。
安全写法见 `iron-rules.md` R1；验证 `check_csv_quotes.js` + `TestCsv.java`。

### 3.2 R2 rules 命令参数内嵌引号（**不崩溃，静默截断**）

`script` 列存的是命令文本（`AddText "显示文本" textBlueColor`、`SetTooltip <optionId> "提示"`），
解释器把字符串参数读到**第一对 ASCII 引号**为止 ⇒ 参数内再出现 `"`（含被归一化的 `“”`）就提前闭合，
后续全部丢弃：游戏内文本在 `最"体面"…` 处戛然而止。

- **R1 作用于 CSV 结构层**（崩溃）；**R2 作用于解析之后的命令解释层**（截断）。
- R2 对"被正确 RFC 包裹的单元格"**依然成立** —— `""` 转义保护不了命令解释器的引号配对。
- 验证：`check_rules_arg_quotes.js`（三项全 0）。

### 3.3 R3 字库覆盖（**显示 `?`，无报错**）

中文核心把 6 个字体文件替换为含 CJK 的位图字库（`<game>\starsector-core\graphics\fonts\`），
各约 **6742 字形**；`.fnt` 为 AngelCode 文本格式，逐行 `char id=<十进制码点>` 即字形表，
**表外字符渲染为 `?`**。实测：`「」『』〈〉〔〕`、生僻字 `艏`(U+824F)、全角空格 U+3000 缺字形；
`【】《》（）—…、。，：；？！·“”‘’` 有字形。
验证：`check_font_glyphs.js <data目录>`（缺字形字符种类 0 / 总出现 0）。

## 4. 语义核查：用反汇编终结猜测

"签名相同但语义变了"无法靠读源码判断，也不要联网猜。
**直接反汇编游戏本体 `starfarer_obf.jar`，找那段逻辑。**

实战两例（都是关键判决，避免了"看起来合理其实有害"的改动）：

1. **相位披风怎么创建**：`javap -p -c com.fs.starfarer.combat.entities.Ship | Select-String 'getShipDefenseId' -Context 12,30`
   → 字节码显示披风由 `ship_data.csv` 的 `shield type=PHASE` + `defense id` 决定；
   再全 jar 搜字符串 `isPhaseCloak`：**只有 `SpecStore` 与 spec 实现类持有它，无任何调用方**
   ⇒ 该列在本版"只存不用" ⇒ **不用补**（差点做了一次有害改动）。
2. **酒吧事件为何永远刷不出来**：搜 `addEventCreator` 全 jar 无调用 + 读
   `_api_src\...\BarEventManager.java` 的 `advance()` ⇒ 事件只从 `creators` 列表产生，
   唯一入口是 `addEventCreator()`，原版在 `CoreLifecyclePluginImpl.onGameLoad → addBarEvents()` 注册
   ⇒ **确认是真 bug**，且从 0.95 就没接线（不是 0.98 regression）。

**方法要点**：

- `javap -p -c -cp <jar> <类>`，用 `Select-String -Context` 定位关键调用
  （`getShipSystemId`/`getShipDefenseId`/`createSystem` 这些名字在混淆 jar 里**仍是原样**）。
- 判"某方法/字段有没有被用"：对 jar 内全部 class 做**字符串扫描**
  （`[System.Text.Encoding]::ASCII.GetString(bytes)` 后 `.Contains("名字")`）——方法名会出现在调用方的常量池里。
  **只有定义处出现 ⇒ 无人调用。**
- 判"某 id/文件名是否还被读取"：同上扫描（曾用它确认某 mod 已不读某个 whitelist CSV）。

## 5. 快速检查清单

- [ ] `find_crash.js` 切出最后会话，确认 ERROR 签名与最后打印的规则行
- [ ] EN 原版数据文件过 `TestCsv` 作基线（行数 / 缺键 = 0）
- [ ] 汉化文件过 `TestCsv`：行数一致、0 缺键；行数变多 → 有行被拆散
- [ ] `check_csv_quotes.js`：弯引号 = 0（或全在安全中段），无行列数 < 表头行
- [ ] （rules.csv）`check_rules_arg_quotes.js`：三项全 0（R2 截断）
- [ ] `check_font_glyphs.js <data目录>`：缺字形 = 0（R3 显示 `?`）
- [ ] 结构逐格对比（仅映射单元格改动、列数一致）
- [ ] 若同时改了 jar：→ `starsector-mod-localization-verify` 的 G4

## 6. 反模式

- ❌ 不要联网搜引擎行为（本机 `starfarer.api.zip` 是权威文档，`starfarer_obf.jar` 是权威行为）。
- ❌ 不要用严格 JSON 解析器给游戏数据判死刑（铁律 R8）。
- ❌ 不要在没反汇编确认前"顺手修"看起来多余的数据。
- ❌ 不要因为症状"很像 X"就跳过离线复现——本 skill 的价值就在于把猜测变成证据。
