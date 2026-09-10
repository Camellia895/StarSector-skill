# Starsector Mod 0.96 → 0.97/0.98 渲染坐标迁移问题（可分发 skill）

> **本文档的用途**：这是一份自包含的 skill，可整体输入到另一个 AI（如朋友使用的 AI 助手）中，让它独立排查并修复同一类 bug。
> **安装方式（二选一）**：
> - **方式 A（DeepSeek Harness 等带 skill 目录的 AI）**：把本文件放入 AI 的 skill 目录，例如 `~\.dsh\skills\starsector-mod-render-migration\SKILL.md`（与本文件同结构），随后按该 AI 的规则调用 skill。
> - **方式 B（普通对话式 AI）**：把本文档全文（从 `# 目标` 开始，直到文末）作为一条附加指令粘贴给 AI，并告诉它："请按这份 skill 的步骤诊断并修复我的 Starsector mod。"
> 两种方式都要求 AI 能执行文件系统/命令行操作（本 skill 需要读写文件、运行 javac 与打包命令）。

---

## 0. 目标

修复 0.95/0.96 时代（或更早）编写的 Starsector mod 迁移到 0.97/0.98 后出现的渲染兼容事故：**舰船上的特效纹理与舰船分离，分离距离随镜头位置/缩放变化**。本 skill 由一次真实修复（`mods/Templars` 圣殿骑士团 0.9.9e 汉化版）沉淀而成，技术结论均已用游戏字节码与 GraphicsLib 源码交叉验证。

## 1. 症状识别（先判定是否命中本 skill）

典型表现（实战原话）："舰船上的特效纹理会和舰船分离，分离距离会改变，似乎和摄像头的位置有关"。逐条核对：

- [ ] 舰船**所有**锚定舰船的自绘特效都产生**相同**偏移（武器开火辉光、护盾/晶格纹路、受击涟漪、技能光效）——因为它们共用同一套渲染路径
- [ ] 偏移量与物体相对**屏幕左下原点的距离**成正比：舰船在屏幕中央时几乎贴合，移到屏幕边缘时偏移最大；镜头平移/缩放时分离距离随之变化
- [ ] 特效是 mod 用 GraphicsLib `ShaderAPI.renderInWorldCoords` 手绘进离屏缓冲（aux/flare buffer）再全屏后处理合成的（自定义 FBO + glOrtho + glViewport 模式）
- [ ] 与汉化无关：未汉化的英文原版同样存在

**注意区分**：若只有**个别**武器/特效错位而船体贴图正常，那是武器槽/精灵中心（`.ship` 的 `center` 字段）问题，**不是**本 skill 的问题；本 skill 的特征是"全部锚定舰船的特效整体偏移 + 镜头相关"。

## 2. 环境探测（朋友 AI 必须先做，路径可能与本文示例不同）

开始修复前，用命令探测目标机器的环境，把下列路径记录下来：

1. **游戏根目录**：包含 `starsector-core\`、`mods\`、`jre\` 的目录。示例：`C:\game\StarSector.v0.9.8a-RC8`。
2. **游戏版本**：读 `starsector-core\data\config\version\version.json` 或问用户；本 skill 针对 **0.97/0.98a**（UI 缩放/渲染缩放引入后）。
3. **JRE**：`<游戏根>\jre\bin\java.exe`（OpenJDK 17，无 javac）。
4. **JDK/javac**：依次探测常见位置（Windows）：
   - `C:\Program Files\Android\Android Studio\jbr\bin\javac.exe`（实战所用）
   - `C:\Program Files\Java\*\bin\javac.exe`、`C:\Program Files\Eclipse Adoptium\*\bin\javac.exe`、`C:\Program Files\Zulu\*\bin\javac.exe`
   - `where.exe javac`
   - 若找不到 javac：请用户安装/提供任意 JDK，或把编译步骤交给有 JDK 的环境执行（见 §5）。
5. **GraphicsLib**：`<游戏根>\mods\GraphicsLib\`。**关键**：确认其 `mod_info.json` 的 `gameVersion` 与游戏版本匹配（1.12.1 对应 0.98a-RC8）。GraphicsLib **自带源码** `org\dark\shaders\**\*.java`，它是坐标约定的权威参照，务必可读。
6. **依赖 jar**：`mods\GraphicsLib\jars\Graphics.jar`、`mods\LazyLib\jars\LazyLib.jar`、`mods\MagicLib\jars\MagicLib.jar`；核心 jar 在 `<游戏根>\starsector-core\`：`starfarer.api.jar`、`starfarer_obf.jar`、`lwjgl.jar`、`lwjgl_util.jar`、`json.jar`、`log4j-1.2.9.jar`。
7. **目标 mod**：`mods\<Mod>\`，源码通常在 `jars\src\`，已编译类在 `out\production\<Mod>\`，发布 jar 在 `jars\<Mod>.jar`（mod 实际加载的是它）。

> 下文所有命令示例中的路径请替换为实际探测结果。示例以 Templars 实战环境为参考。

## 3. 根因机制

0.97/0.98 引入 **UI 缩放 / 渲染缩放**，游戏从此区分两套分辨率（已通过反汇编 `StarfarerSettings`/`A` 类证实，二者是独立字段）：

| API | 语义 |
|---|---|
| `Global.getSettings().getScreenWidth()/getScreenHeight()` | **逻辑分辨率**（受 UI 缩放影响） |
| `Global.getSettings().getScreenWidthPixels()/getScreenHeightPixels()` | **实际渲染像素**（含 UI 缩放/渲染缩放/像素密度折算） |
| `Global.getSettings().getScreenScaleMult()` | 屏幕缩放倍率，默认 1.0 |
| `Display.getPixelScaleFactor()` | LWJGL 像素密度因子 |

0.96 时代两者恒等，mod 怎么写都对齐；0.97/0.98 在 **UI 缩放 ≠ 100% 或渲染缩放开启**时两者不相等，于是：

1. mod 手写世界坐标 pass：`glOrtho(viewport.getLLX(), LLX+visibleW, LLY, LLY+visibleH)` + `glViewport(0,0, <屏宽>×psf, <屏高>×psf)`，把世界坐标映射到离屏缓冲像素。
2. 若 `<屏宽>` 用了**逻辑值** `getScreenWidth()`，而引擎渲染屏幕纹理、GraphicsLib 后处理都用**像素值** `getScreenWidthPixels()`，则特效在缓冲里的 UV 位置被等比压缩：
   `特效屏显位置 = (X-LLX)/visibleW × getScreenWidth()×psf`，而船体在 `…× getScreenWidthPixels()×psf`。
3. 偏移量 = 物体到屏幕原点的距离 × 比例差 → **镜头位置/缩放相关**；走同一 pass 的特效全部一致偏移。

**核心规则**：凡手绘进 GraphicsLib 缓冲的世界坐标 pass，viewport 必须与当前 GraphicsLib 版本的约定逐字一致。GraphicsLib 1.12.1 的约定是 `(int)(Global.getSettings().getScreenWidthPixels() * Display.getPixelScaleFactor())`（见其源码 `ShaderLib.renderForeground`、`LightShader.drawNormalMaps`）。屏幕空间的 pass（`glOrtho(0, getScreenWidth(), 0, getScreenHeight(), …)` + 像素 viewport）是引擎 UI 的"逻辑正交 + 像素 viewport"约定，**保持不动**。

## 4. 代码定位清单

在 mod 的 `jars\src\**\*.java` 中搜索：

```
getScreenWidth() * Display.getPixelScaleFactor()
getScreenHeight() * Display.getPixelScaleFactor()
```

凡是出现在 `glViewport(...)` 调用里的，都是嫌疑点；尤其检查：

- 继承 `org.dark.shaders.util.ShaderAPI` 且 `getRenderOrder() == RenderOrder.WORLD_SPACE` 的类（如 `TEM_TemplarShader`、`TEM_LatticeShieldShader`）
- `renderInWorldCoords(ViewportAPI)` 里绑定 `ShaderLib.getAuxiliaryBufferId()` / 自建 FBO 之后的 viewport
- 与 `glOrtho(viewport.getLLX(), viewport.getLLX()+viewport.getVisibleWidth(), …)` 配对出现的 viewport

判定参照：打开 `<游戏根>\mods\GraphicsLib\org\dark\shaders\util\ShaderLib.java`，对比其自绘世界坐标（`renderForeground`、`LightShader.java` 的 `drawNormalMaps`/灯源 pass）用的表达式，照抄即可。屏幕空间 pass 的 `glOrtho(0, getScreenWidth(), 0, getScreenHeight())` 与 quad 顶点坐标**不改**。

## 5. 修复

把上述所有 `glViewport(0, 0, (int)(Global.getSettings().getScreenWidth() * Display.getPixelScaleFactor()), (int)(Global.getSettings().getScreenHeight() * Display.getPixelScaleFactor()))` 改为：

```java
GL11.glViewport(0, 0, (int) (Global.getSettings().getScreenWidthPixels() * Display.getPixelScaleFactor()),
        (int) (Global.getSettings().getScreenHeightPixels() * Display.getPixelScaleFactor()));
```

要点：

- **全部**出现点都要改（同一类里通常有多个 pass：主世界 pass、hue/直绘 pass、后处理 pass、校验失败清理路径），漏一处症状不消。实战中 `TEM_TemplarShader.java` 4 处 + `TEM_LatticeShieldShader.java` 1 处。
- 改后逻辑：特效与船体在任意 UI 缩放/渲染缩放下都对齐；若用户设置本就使两者相等（UI 缩放 100%），改动是无害等价替换。
- 不改：屏幕空间 `glOrtho(0, getScreenWidth(), …)`、`drawSystemUI` 类纯 UI 绘制、`ShaderLib` 自身的调用。
- 改完用 grep 复查：`getScreenWidth() * Display` / `getScreenHeight() * Display` 应只在非 viewport 的保留位置出现。

## 6. 构建与替换（关键：保留既有汉化/补丁）

若 jar 已被汉化（常量池补丁）或包含其他手改，**绝不能整 jar 重编译**，只重编译改动的类并原位替换条目：

1. **备份**：`Copy-Item jars\<Mod>.jar jars\<Mod>.jar.bak_<时间戳>`。
2. **确认目标类未被补丁改动**：把 jar 中目标类与 `out\production\<Mod>\` 下同名类做字节 hash 对比；若一致说明补丁没碰它，可安全用新编译产物替换（Templars 实战中两个 shader 类与 out/production 逐字节一致，补丁未涉及，因为这两个类没有用户可见字符串）。
3. **编译**（注意：JDK 17 的 javac 不支持 `-source 7`，用 8）：
   ```
   <javac路径>\bin\javac.exe -encoding UTF-8 -source 8 -target 8 -nowarn -cp "<starfarer.api.jar>;<starfarer_obf.jar>;<lwjgl.jar>;<lwjgl_util.jar>;<json.jar>;<log4j-1.2.9.jar>;<Graphics.jar>;<LazyLib.jar>;<MagicLib.jar>;<out\production\<Mod>>" -d <tmpout> <改动的.java 列表>
   ```
   注意 classpath 必须含 mod 自身 `out\production\<Mod>`（类间交叉引用，如 shipsystems/util 类），否则编译报找不到符号。
4. **原位替换 jar 条目**（游戏**必须先关闭**，否则 jar 被进程占用无法写入；`jar.exe` 的 `--dir` 模式在 Windows 上易出错，用 .NET ZipArchive 更可靠）：
   ```powershell
   Add-Type -AssemblyName System.IO.Compression
   $zip = [System.IO.Compression.ZipFile]::Open($jar, [System.IO.Compression.ZipArchiveMode]::Update)
   foreach($n in $names){            # $names = 新 class 的 jar 内路径列表（含内部类，如 TEM_TemplarShader$1.class）
     $e = $zip.GetEntry($n); if($e){ $e.Delete() }
     $ne = $zip.CreateEntry($n)
     $b = [IO.File]::ReadAllBytes((Join-Path $tmpout ($n -replace '/','\')))
     $s = $ne.Open(); $s.Write($b,0,$b.Length); $s.Close() }
   $zip.Dispose()
   ```
   替换完成后，`out\production\<Mod>` 下的同名 class 也要同步复制，保持工作区一致。
5. **验证补丁未损**：对比新 jar 与备份 jar 的**所有条目**（除被替换的类外）逐字节一致（Templars 实战 116/116 条目通过）；并确认新类字节码含 `getScreenWidthPixels`、class 版本 ≤ JRE 支持（major 52/Java 8 无碍，JRE 17 可加载）。

## 7. 游戏内验证清单

- [ ] 进一场含该 mod 舰船的战斗（模拟战即可）
- [ ] 护盾/晶格纹路与船体贴合
- [ ] 武器开火辉光锚定在炮口
- [ ] 受击涟漪居中于受击点
- [ ] 技能光效贴合船体
- [ ] **重点**：滚轮缩放、平移镜头、舰船处于屏幕角落 vs 中央，分离距离不再变化
- [ ] 若用户此前 UI 缩放 > 100% 或开了渲染缩放，保持该设置验证（修复正是针对此情形）；可临时调回 100% 做对照（此时旧代码也不偏移，可用于确认根因）
- [ ] 游戏日志无新增着色器/程序错误

## 8. 附：无 javap 环境下的 class 反汇编诊断（判定 API 语义用）

系统无 JDK 工具时，可用 PowerShell 直接解析 class 文件（实战用于确认 `getScreenWidth` vs `getScreenWidthPixels` 的语义，从而锁定根因方向）：

- class 文件是**大端**；`[System.IO.BinaryReader]` 默认小端，读多字节必须手动 `([int]$b[0] -shl 8) -bor [int]$b[1]`；**`[byte] -shl 8` 会按字节截断返回 0**（PowerShell 陷阱），务必先 `[int]` 再移位（`[int]$b[0] -shl 8`）。
- 常量池 tag：1=UTF8、7=Class、8=String、9/10/11/12=Field/Method/InterfaceMethod/NameAndType、5/6=long/double（占两个槽位，循环里多跳一次）。UTF8 长度、各索引一律大端解析。
- 方法表：access/name/descriptor + 属性表，解析 Code 属性后即可输出字节码（getstatic/invokestatic/invokeinterface 的操作数在常量池里解析出类名/方法名/描述符）。
- 用途示例：确认 `getScreenScaleMult()` 返回静态字段默认 1.0、`getScreenWidthPixels()` 走像素字段、逻辑/像素字段分离存在，从而证实根因机制。

## 9. 参考案例

`mods/Templars`（圣殿骑士团 0.9.9e，汉化版，游戏 0.98a-RC8 + GraphicsLib 1.12.1）：症状为晶格护盾纹路、圣剑/长枪/朗基努斯炮口辉光、受击涟漪、技能光效全部与船体分离且随镜头变化。根因即 §3：`TEM_TemplarShader.java` 4 处 + `TEM_LatticeShieldShader.java` 1 处 viewport 用了 `getScreenWidth()*psf`，改为 `getScreenWidthPixels()*psf` 后全部对齐。修复仅重编译这 2 个类（7 个 class 含内部类）替换进 jar，其余 109 个条目（含汉化补丁）逐字节保留。

## 10. 常见误区与排错

- **误判为 .ship 问题**：`.ship` 的 `center` 字段在两版本间通常不变（Templars 实战中旧版新版完全一致），它不是本症状的原因；症状是"全部特效整体偏移 + 镜头相关"。
- **游戏进程占用 jar**：替换 jar 前必须先关闭游戏（`starsector.exe` + `java.exe` 进程），否则 `ZipFile.Open(...Update)` 报"文件被另一进程使用"。
- **javac 版本**：JBR 17 报"不支持源选项 7"，用 `-source 8 -target 8` 即可；class major 52 与旧 class major 51 混在同一 jar 无碍。
- **漏改**：同一类里多个 pass 各有一处 viewport，漏改则症状残留；用 grep 复查全部出现点。
- **汉化被破坏**：整 jar 重编译会丢失常量池汉化补丁；务必只替换改动类并做全条目字节校验。
