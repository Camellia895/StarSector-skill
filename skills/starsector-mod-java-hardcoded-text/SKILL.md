---
name: starsector-mod-java-hardcoded-text
description: Starsector（远行星号）mod 的 Java 源码/字节码里"硬编码界面文本"的处理专章——判定 jar 里有没有可见文本、有源码时该「重编译」还是「常量池补丁」的决策树（javac 版本漂移实测证据）、流式条目 jar 的中央目录解析陷阱、javac 21+ enum switch 编译方式变化、patcher 标识符保护的边界（字面量与局部变量同名时会被跳过）、**枚举显示名与常量名共享 Utf8 时的 R7 白名单例外（含"optionData 型枚举名不可动"的区分方法与三条安全前提）**、**补漏扫描器排除规则误杀真文本的两种写法（字符类当格式片段、单词型文本被当键名）及"排除明细必须逐条列"的纪律**、以及交付前"只改了字符串"的等价性证明方法（逐条目内容比对 + javap 指令级 diff + 离线 LoadTest 基线对照）。供汉化提取/注入、版本升级、崩溃排查在遇到"文案写死在代码里"的 mod 时使用。默认用户环境与当前环境一致（游戏根 C:\game\StarSector.v0.9.8a-RC8，中文 Windows）。
---

# Java 硬编码文本：从判定到等价性证明

**适用**：mod 的玩家可见文本不在 CSV/JSON，而是写死在 `.java` / 编进 jar（典型：纯 Java 工具向 mod，如 RTSAssist）。
**分工**：提取清单 → `starsector-mod-localization-extract`；译文质量 → `-content`/`-spec`；本 skill 只管**"文本在代码里"这条链路的判定与落地手法**。
**必读**：`<skills>\shared\env.md`、`<skills>\shared\iron-rules.md`（R6/R7/R9）。

## 0. 判定：jar 里到底有没有可见文本（10 分钟）

```powershell
# ① 有没有 strings 表 / 会不会走引擎取词
Test-Path <mod>\data\strings\strings.json
Select-String -Path (Get-ChildItem -Recurse -File <mod>\src -Filter *.java).FullName -Pattern 'getString\(|addMessage|showMessage|setTitle|System\.out\.print' -Encoding UTF8
# ② 反编译/解包后统计"字符串常量候选"
node <skills>\shared\scripts\analyze_jar_strings.js <jarUnpackedDir> <out.json>   # 给 asString/asId 分类
node <skills>\shared\scripts\scan_jar_sources.js <srcDir> <out.json> <candidates.json>
```
- `asString = true` 且 `asId = false` 才是**可替换候选**（铁律 R7）。
- 工具类 mod 的候选里 95%+ 是标识符（HashMap 键、第三方 id、音效事件名），**真正可见的往往只有一处初始化文件**（如 LunaLib 设置注册类）。
- 判断"是不是玩家可见"的决定性证据是**调用点**：`addKeybind/addBoolean/addInt/addString` 的 title/desc 参数 = UI；
  `HashMap.put`/`get`、`.equals(` 比较、`sounds.json` 的键 = 标识符。

## 1. 决策树：重编译 还是 常量池补丁？

```
玩家可见文本在 jar 里？
├─ 只有字符串要改（不动逻辑）
│   ├─ 本机有与该 jar 相同大版本的 javac（class major 对应）→ 两条路都行，**仍优先常量池补丁**（见 §2 理由）
│   └─ 没有同版本 javac → **只能**常量池补丁，不要用新版 javac 硬编
└─ 要改逻辑（新增/调整代码）→ 必须从源码重编译
```

### 1.1 为什么"有源码"也不该贸然重编译（实测证据）

以 RTSAssist 0.1.9c（官方 jar 的 class major = **61 = Java 17**）为例，用 `javac 25 --release 17` 重编译 84 个源文件：

| 观测 | 结果 |
|---|---|
| 编译 | exit 0，446 个 class（官方 447） |
| 类集合差异 | 官方独有的 **`RTS_CommonsControl$1.class`**（enum switch 的 `$SwitchMap$…` 合成类）在新产物中**消失** |
| 指令级差异 | `RTS_TaskManager` / `RTS_ModeManager` / `RTS_CompatibilityTools*` 等 **31 个类**结构不同 |
| 根因 | **JDK 21+ 改变了 enum switch 的编译方式**：不再生成 `$SwitchMap` 数组，改为 `tableswitch` 直接作用在 `ordinal()` 上 |
| 附带差异 | 方法调用由 `invokevirtual Object.equals` 变为 `invokeinterface <Iface>.equals`；调试表（`LocalVariableTable`）在是否保留上不同 |

⇒ 用不同大版本的 javac 重编译 = 交付一份"源码相同但字节码不同"的 jar，**行为漂移无法穷尽验证**。
**只改字符串时，常量池补丁的正确性可以被证明（§4），重编译不能。**

### 1.2 常量池补丁的收益（同一实测）

`patchClass` 只改被 `CONSTANT_String` 引用、且不被标识符条目引用的 Utf8 常量，其余条目**原样复用官方压缩数据**：

- jar 条目 **546/546** 与官方一致；**内容变化的恰 2 条**（目标 `.class` + 它内嵌的 `.java`）。
- 目标类 `javap -c` 与官方**指令行数完全相同（491/491）**，**零个非 `ldc` 差异**、指令偏移零错位。
- 类内标识符集合零改动；全 jar 标识符含 CJK = 0。
- 离线 LoadTest（游戏 JRE + `-noverify`）：两边**结果完全一致**（447/447 类加载、81 个实例化、0 链接错误）。

## 2. 实现细节：五个必踩的坑

### 坑 1（最容易翻车）：官方 jar 常用**流式条目**，必须走中央目录

`local file header` 的 `csize/usize` 是 **0**，真实尺寸在数据后面的 12 字节 data descriptor 里（flag bit 3）。
若按 local header 的 `csize` 推进解析，**会在第二个条目就断掉**（本工具第一版真实事故：546 个条目只解析出 2 个，写出的 jar 只有 254 字节）。

```js
// 正确：从 EOCD 找中央目录，条目尺寸/偏移一律以中央目录为准
let eocd = -1;
for (let i = buf.length - 22; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
const total = buf.readUInt16LE(eocd + 10);
let p = buf.readUInt32LE(eocd + 16);
for (let i = 0; i < total; i++) {
  const method = buf.readUInt16LE(p + 10), crc = buf.readUInt32LE(p + 16);
  const csize = buf.readUInt32LE(p + 20), usize = buf.readUInt32LE(p + 24);
  const nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
  const lho = buf.readUInt32LE(p + 42);
  const name = buf.toString('utf8', p + 46, p + 46 + nlen);
  const dataStart = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);  // 用 local header 的**名称/扩展长度**定位数据起点
  const comp = buf.subarray(dataStart, dataStart + csize);
  p += 46 + nlen + elen + clen;
}
```
重打包时**未改动的条目直接复用官方压缩字节**、中央目录重算 offset/crc（条目名必须保留正斜杠，铁律 R9）。
⚠️ 不要用 `jar cf` 重建（会丢掉"只改两条"这一可验证性，且引入 `META-INF/MANIFEST.MF` 等新条目）。

### 坑 2：`patchClass` 的映射值必须是 **modified UTF-8 字节**，不是 JS 字符串

`patcher.js` 的 `patchClass(buf, mapping)` 直接把 `mapping.get(str)` 塞进常量池，所以：
```js
const { patchClass, encodeModifiedUtf8 } = require('<skills>/shared/scripts/patcher.js');
const mapping = new Map();               // 键=常量原文（逐字符），值=**字节**
mapping.set(enText, encodeModifiedUtf8(zhText));
```
传字符串会报 `ERR_INVALID_ARG_TYPE: argument must be an instance of Buffer ('舰船排幅')`。

### 坑 3（隐蔽 bug）：字面量与局部变量/字段同名时，patcher 会"静默跳过"
`patchClass` 的保护规则是：**被 `Class`/`NameAndType`/`MethodType`/`Module`/`Package` 引用的 Utf8 一律不改**（R7 红线）。
Java 编译器对相同文本复用同一个 Utf8 条目，因此：

- 源码里 `String modID = ...;`（局部变量名 `modID`）与字面量 `"modID"` **共享条目** ⇒ 该字面量**不会**被替换。
- 这既是**保护**（避免了误改标识符），也可能造成"62 条译文只命中 61 条"。
- **正确处置**：先判该字面量是不是**数据键**。
  - 是键（如 `confPointer.get("modID")`、`configFile.getString("modID")`）⇒ **绝不可译**，把它写进 `excluded_entries.json`，并在交付说明里注明"UI 标签会显示英文"。
  - 只是显示文本但与局部变量同名 ⇒ 需**改源码**（把字面量搬进一个独立方法/常量），不能靠补丁。
- **自查方法**：补丁后把该类 `walkCp` 出来的 Utf8 全集与译文逐条比对，**漏掉的那条必须逐条解释**（是键？同名？键不匹配？）。

### 坑 4：枚举显示名冲突 —— R7 的**白名单例外**（Nomadic Survival 实测）

**症状**：补丁跑完命中率 100%、`verify_identifiers` 显示"标识符含 CJK = 0"，但游戏界面里**仍有整片英文**，
且这些英文**就在你的候选清单里**（例如 `Report` / `Stage` / `Fuel` / `Data`、`Protected` / `Militarized` / `Vulnerable` / `Excess`）。

**根因**：Java 枚举把「常量名」编译成**同名字段** + `Enum.<init>("名", ordinal)` 的字符串参数，
两者**共享同一个 Utf8 条目**；而界面代码直接用 `tab.name()` 或 `getName()`（后者返回构造时传入的名字）
显示 —— 也就是**显示文本恰好就是标识符本身**。

- `asId = true` ⇒ 被铁律 R7 正确拦下；但不改就永远留英文，**清单里删掉它就等于永久漏译**。
- **必须与"optionData 型枚举名"区分**：`addOption(label, OptionId.CONFIRM)` 这类，枚举名**只是逻辑键**、
  界面文字由第一个参数（独立字面量）提供 ⇒ **保持英文**，不要去动。
  判定方法：`javap -p -c` 看该常量是出现在 `ldc` 后**作为参数传给 UI 方法**，还是只作 `getstatic` 字段引用。

**安全前提（三条同时成立才可改名）**：
1. 该 Utf8 只被 ① 本枚举类自己的 `CONSTANT_String`、② 同名字段的 `NameAndType`、③ 枚举构造的字符串参数引用；
2. **不被任何 `Class` / `MethodType` / `Module` / `Package` 条目引用**（否则是类名/模块名，改了必崩）；
3. 代码里没有 `Enum.valueOf(X.class, "<该名>")` 或 `name().equals("<该名>")` 这类**按名字串匹配**的逻辑；
4. ⚠️ **凡是引用该枚举常量的类，必须一起改**（见 §2.4.1 的合成类坑）。

### 2.4.1 ⚠️ 最容易翻车的点：引用点没改全 = `NoSuchFieldError`（同一 bug 崩了两次）

**第一次崩**：白名单**只写常量不限定 class** ⇒ 只改了枚举类，合成类没改。
**第二次崩**（修了第一次之后仍崩，栈还指向 `AnomalyIntel.<init>`）：白名单补了合成类 `$1`，
但**漏了使用方 `AnomalyIntel`** —— 它的构造函数里有 `getstatic TabID.Report`（源码 `TabID selectedTab = TabID.Report;`）。

**枚举常量的引用点一共有三类，一个都不能漏**：

| 引用点 | 引用形态 | 漏改的后果 |
|---|---|---|
| 枚举类自身（字段声明 + `Enum.<init>("Report")`） | `CONSTANT_String` + `NameAndType` | 字段名与显示名不一致 |
| **合成 switch-map 类**（`$1`，`switch` 生成） | **只有 `Fieldref`** | `NoSuchFieldError` |
| **使用方类**（`getstatic TabID.Report`、`putstatic`、枚举字段默认值） | **只有 `Fieldref`** | `NoSuchFieldError` |

**查全的办法（改之前必跑）**：列出该字面量出现在哪些 class、分别是什么形态
```powershell
node scan_refs.js <已解包class目录> Report Stage Fuel Data CR
# 输出形如：AnomalyIntel.class  "Report" ← Fieldref
#          AnomalyIntel$1.class "Report" ← Fieldref
#          AnomalyIntel$TabID.class "Report" ← String+Fieldref
```

**还有一个更隐蔽的坑（第二次崩的第二层原因）**：若补丁器以「被 `CONSTANT_String` 引用」为替换门槛
（`patcher.js` 的默认行为），那么**只被 `Fieldref` 引用的那两类会被结构性跳过** ——
即使把它们写进白名单也不生效。白名单的判定必须与"引用形态"解耦：
**命中白名单就替换**，并加一致性检查——若该字面量被 `Fieldref` 当字段名用，
则**每个使用点的宿主类也必须在同一白名单内**，否则拒绝并报错（杜绝"改名一半"）。

**正确做法**：白名单**逐条限定 classes，列出全部三类引用点**：
```json
{ "c": "Report",
  "classes": ["…/AnomalyIntel$TabID.class", "…/AnomalyIntel$1.class", "…/AnomalyIntel.class"],
  "why": "枚举名=显示名；$1 是合成 switch-map 类、AnomalyIntel 是使用方，三处必须同改" }
```
**怎么找全**：改之前先列出"这个字面量出现在哪些 class 里"（遍历全部 class 的 Utf8）；
原 jar 里 `Report` 会同时出现在 `AnomalyIntel$1.class` 与 `AnomalyIntel$TabID.class`，两个都要进白名单。
同理 `Fuel` **必须限定 class** —— 商品 id `"fuel"` 出现在别的类里，全局放行会误译。

⇒ **白名单的正确形态是 `{常量, 类白名单}`，而不是"常量白名单"**：同一字面量在不同类里含义可能不同。

### 2.4.2 验收：必须强制**初始化**，只"加载"抓不到

| 检查 | 能否抓到 `NoSuchFieldError: Report` |
|---|---|
| `Class.forName(c, false)`（只加载） | ❌ **抓不到** —— 加载不解析成员引用。真实事故里这一步显示 `46/46 OK` |
| `Class.forName(c, true)`（初始化 → 执行 `<clinit>` 里的 `getstatic`） | ⚠️ 能抓，但**不可靠**：若该类 `<clinit>` 里先抛了别的异常（如需要游戏状态的 NPE），`NoSuchFieldError` 会被挡在后面 |
| 专门初始化**合成 switch-map 类**并读它的 `$SwitchMap$…` 数组 | ✅ 最直接（见下） |
| 反射遍历成员（`getDeclaredFields/Methods` + `getType()/getParameterTypes()`） | ✅ 顺带覆盖 |
| **静态核对：补丁后扫"旧名是否还作为 Fieldref 出现"** | ✅ **最可靠、零环境依赖**（推荐作为硬门槛） |

```powershell
# 硬门槛：补丁后不得再有旧名作为 Fieldref 出现
node scan_refs.js <补丁后解包目录> Report Stage Fuel Data CR
# 通过标准：Fieldref 命中 = 0（译文等于原文的条目，如 "CR"→"CR"，可豁免）
```

```java
// 最小探针 ProbeSwitchMap：直接点名合成类，<clinit> 一跑就会暴露引用错误
Class<?> k = Class.forName("pkg.AnomalyIntel$1", true, cl);
for (Field f : k.getDeclaredFields()) if (f.getName().startsWith("$SwitchMap")) {
    f.setAccessible(true); int[] v = (int[]) f.get(null);
    System.out.println(f.getName() + " len=" + v.length);   // 能打印 len ⇒ 枚举字段引用全部解析成功
}
```
> 分类打印异常时，`NoSuchFieldError` 是 `IncompatibleClassChangeError` 的**子类**，别只匹配字面量就放心；
> 也**不要**因为"没抛链接错误"就判定通过 —— 先抛的别的异常会把真问题遮住。

### 2.4.3 保守选项（可作为退路）

不想承担同步全部引用点的风险时：**保留枚举名英文**，只中文化 `getName()` 型显示名（构造参数那个字段），
并在交付说明里写明"哪几处界面会显示英文"。
（Nomadic Survival 最终选择了"改全 + 静态核对 + 探针"这条路，已通过；
保守路线的代价是 `TabID` 的 5 个分页标签保持英文。）

### 坑 5：提取/分类环节的两个"静默误杀"（同一会话，共漏 69 条）

补漏扫描器的排除规则写错时，**真文本会被当成非文本跳过，且不报错**：

| 错误写法 | 误杀了什么 | 正确写法 |
|---|---|---|
| 把"纯格式片段"判成 `/[\u0001%s\d ]+/` 这种**字符类** | `"Lose %s "`（只含字母/%/s/空格）整条被杀 | 先剥掉 `%s`/`%d`/`%%` 与空白数字符号，**剥完为空**才算格式片段 |
| 排除规则写 `/^[A-Za-z_][A-Za-z0-9_]*$/`（想排除键名，实际排除了**所有单词**） | `"Starsector "` 这类单词型文本被杀 | 只排除**明显是键**的形态：snake_case、`$` 开头、路径、类型签名、类名 |

**纪律**：补漏脚本必须先把「排除的条目」**按理由分组列出并计数**，人工抽查 ≥20 条；
"看着像文本但被排除"的一律逐条解释。**只报告"剩下多少条"而没有排除明细，等于没做这步。**

## 3. 验收脚本：把"只改了字符串"证明出来

按顺序跑，每一条都要有命令与通过标准：

| # | 检查 | 手段 | 通过标准 |
|---|---|---|---|
| 1 | 条目集合一致 | 中央目录解析两个 jar 的条目名 | 集合完全相同（缺一不可） |
| 2 | 内容变化可控 | 逐条目解压比对（注意 `usize/csize=0` 的目录条目要按空处理，否则 `inflateRawSync` 报 `unexpected end of file`） | 变化条目 == 预期清单 |
| 3 | 指令等价 | `javap -p -c` 两边对比，把 `// String …` 注释替换为占位符后逐行 diff | **差异行全部是 `ldc`**、行数相同、偏移一一对应 |
| 4 | 标识符未动 | `walkCp` 的标识符集合两边比对 | 集合相等；全 jar 标识符含 CJK = 0 |
| 4b | **引用可解析** | `verify_refs_resolvable.js`（Fieldref/Methodref → 宿主类声明表）或 `ProbeSwitchMap`（初始化合成 switch-map 类） | 补丁**新增**的"无法解析引用" = 0；`$SwitchMap$…` 数组能打印出长度 |
| 5 | 键字面量完好 | 从**全 jar** 的 Utf8 全集里查关键键名 | 全部存在（键可能定义在其它类，别只查目标类） |
| 6 | 类加载 | 离线 LoadTest（游戏 JRE + `-noverify` + `-Dcom.fs.starfarer.settings.paths.logs=<tmp>`） | 失败 = 0；**"需要游戏上下文"的类单列**（见下） |
| 7 | 译文落位 | 数据层文件 + jar 常量池双向确认 | 英文原文消失数 = 应消失数；译文命中数 = 应命中数 |

**第 6 条的判定细则（踩过）**：有的类在 `<clinit>` 里就调 `Global.getSettings().loadText()/getSprite()`，
离线必然 NPE —— `Global.getSettings()` 在没有游戏上下文时返回 **null**。
例：RTSAssist 0.2 的 `RTS_GenericDrawMeth` / `RTS_MiniMapRenderer` 共 11 个类属此类。
把这类当成"mod 缺陷"会冤枉上游；当成"环境噪音"又会漏掉真问题。
✅ 做法：在 LoadTest 里加 `needsGameContext(Throwable)` —— 沿 cause 链查 `NullPointerException` 消息是否提到
`Global.getSettings()`、或栈帧里是否有 `com.fs.starfarer.api.Global.getSettings`，命中则计入
**`env-limited` 单独一类**并打印清单；只有真链接错误（`NoClassDefFoundError`/`NoSuchMethodError`/`VerifyError`…）才算 FAIL。

> 脚本留档：RTSAssist 会话把这套做成了 `verify_zh_final.js` / `compare_jar_entries.js` / `compare_one_class.js` / `loadtest.ps1`（含 `LoadTestRTS.java`）/ `check_luna_diff.ps1`，见 `_work\mod_work\RTSAssist\tools\`。

## 4. 基线纪律（血泪）

1. **`baseline\` / `baseline_mod\` 是只读**，注入产物写 `build\payload_mod\` 与 `build\src_zh\`。
   ✗ 事故：注入脚本直接把译文写回基线 ⇒ 第二次运行时报"未找到原字面量/注释替换无效"**上百条**，只能从备份恢复基线。
2. **先 dry-run 再 `--apply`**：dry-run 只做"逐条 locator 命中 + 替换可行 + 回填后译文落位"校验，不写文件。
3. **备份时机**：注入前 `mods\<Mod>\` → `_work\mod_bak\<Mod>_<版本>_pre_zh_backup`，并在动手前**验证该备份与官方发布包逐字节一致**（它是回滚的唯一依据）。
   ⚠️ 备份目录名**必须带版本号**：换版本后若复用旧版备份名，脚本会误判"备份已存在"而跳过 ⇒ 回滚依据错版。
4. **行号定位注入**：写死文本的 mod 常有"译文行紧邻同形键名"，禁止全文替换。
5. **`%%` 规则只对格式串成立**：先用 `grep 'String\.format|printf|\.format\('` 确认**是否存在格式化调用**；
   零格式化调用时，注释/README 里的 `%%` 会**原样显示成两个百分号**，属过度转义，应改回单 `%`
   （这是铁律 R4 的适用边界，别机械套用）。

### 4.1 多版本轮转：三个必设的"版本错配"防线

同一 mod 出新版、旧译要复用时，最容易出的不是翻译错，而是**工具读错版本**。实测踩过两次：

1. **"单一清单路径 + 单一译文目录"必然产生版本漂移。**
   ✗ 事故：清单生成器写 `out\`，而注入器优先读 `out\zh\`；升级到新版后 `out\zh\` 里还是旧版清单，
   注入器拿着旧 `en` 去新版源码里找 → 报 60+ 条"未找到原字面量"，**看起来像上游改了源码，其实是版本错配**。
   ✅ 对策：① 生成清单时**同时写所有会被读取的目录**（让 `out\` 与 `out\zh\` 内容一致）；
   ② 归档旧版目录时**改名带版本**（`out\zh_corrected_0.1.9c`、`out\zh_backup_0.1.9c`），别让它与"当前"混淆；
   ③ 注入器**开头打印译文来源路径**，dry-run 逐条断言 `en` 能在当前基线命中。
2. **不要用"行号范围"表达块长。**
   ✗ 事故：ReadMe 文本块用 `ReadMe.txt#L3-L8` 定位；新版清单只写起始行 `#L3`，
   注入器解析出 `b = undefined` → 49 条 `ReadMe.txt:276-undefined 块内容与 en 不一致`。
   ✅ 对策：**按内容匹配块** —— 把文件按空行切块，用 `en` 逐字符比对定位后整块替换；locator 里的行号只供译者定位。
3. **升级后"哪些能复用"必须按内容判定，不能按行号。**
   新版 `Config.ini` 开头插了 4 行，逐行对比 ⇒ 误报 50+ 处"改动"；
   按 `en` 逐字符匹配才得到真实工作量（RTSAssist 0.1.9c→0.2.04exp：175 条中 **165 条可复用、仅 10 条需新译**）。

**版本候选的排序原则**（上游常用多条线并存）：`mod_info.json` 的 `gameVersion` + jar 的 **class major** 是硬门槛
（不匹配直接放弃）；`prerelease` 标记、发布日期、变更规模决定优先级；
**发布包永远优先于仓库源码** —— 实测仓库 `main` 可能连**正式版**都落后（RTSAssist 仓库 83 个源文件 vs 发布包 147 个）。

## 5. 与其它 skill 的衔接

- 文本位置判定与清单产出 → `starsector-mod-localization-extract`（§0 摸底 / §3 jar 层提取）。
- 注入与安装的通用流程 → `starsector-mod-localization-apply`（本 skill 是它在"Java 硬编码文本"场景的展开）。
- 需要真的改逻辑/整包重编译 → `starsector-mod-kotlin-rebuild`（Kotlin 按模块编译）与 `starsector-mod-game-upgrade`（编译探测）。
- 崩溃排查（改错标识符 → `NoSuchFieldError`）→ `wf-diagnose.md` + `starsector-engine-diagnose`。
