---
name: starsector-mod-render-fix
description: 排查并修复 Starsector（远行星号）mod 从 0.95/0.96 迁移到 0.97/0.98 后的渲染坐标兼容事故（舰船特效纹理与舰船分离、偏移随镜头位置/缩放变化）。覆盖症状识别（全部锚定舰船的自绘特效一致偏移 + 镜头相关）、根因机制（逻辑分辨率 getScreenWidth() 与像素分辨率 getScreenWidthPixels() 分离、GraphicsLib 1.12.x viewport 约定）、代码定位清单、只重编译改动类并原位替换 jar 条目的构建方法（保留既有汉化/补丁，逐条目字节校验）、游戏内验证清单、无 javap 环境下的 class 反汇编技巧。是 starsector-mod-game-upgrade 的渲染专项子流程。默认用户环境与当前环境一致（游戏根 C:\game\StarSector.v0.9.8a-RC8，中文 Windows）。
---

# 渲染坐标迁移专项（0.96 → 0.97/0.98）

**调用方**：`starsector-mod-game-upgrade` 第 7 步（先判定"是否命中本 skill"）。
**必读**：`<skills>\shared\env.md`（JRE/JDK/GraphicsLib 版本）、`<skills>\shared\conventions.md`。

## 1. 症状识别（先判定是否命中）

实战原话："舰船上的特效纹理会和舰船分离，分离距离会改变，似乎和摄像头的位置有关"。逐条核对：

- [ ] 舰船**所有**锚定舰船的自绘特效产生**相同**偏移（武器开火辉光、护盾/晶格纹路、受击涟漪、技能光效）——共用同一渲染路径
- [ ] 偏移量与物体相对**屏幕左下原点的距离**成正比：舰船在屏幕中央几乎贴合，移到边缘偏移最大；镜头平移/缩放时随之变化
- [ ] 特效是 mod 用 GraphicsLib `ShaderAPI.renderInWorldCoords` 手绘进离屏缓冲（aux/flare buffer）再全屏后处理合成的（自定义 FBO + glOrtho + glViewport）
- [ ] 与汉化无关：未汉化的英文原版同样存在（若已汉化，先确认目标类未被常量池补丁改动，见 §6）

**注意区分**：若只有**个别**武器/特效错位而船体贴图正常，是武器槽/精灵中心（`.ship` 的 `center`）问题，
**不是**本 skill 的问题；本 skill 的特征是"**全部锚定舰船的特效整体偏移 + 镜头相关**"。

## 2. 根因机制

0.97/0.98 引入了 **UI 缩放 / 渲染缩放**，游戏从此区分两套分辨率（已通过反汇编 `StarfarerSettings`/`A` 类证实，二者是独立字段）：

| API | 语义 |
|---|---|
| `Global.getSettings().getScreenWidth()/getScreenHeight()` | **逻辑分辨率**（受 UI 缩放影响） |
| `Global.getSettings().getScreenWidthPixels()/getScreenHeightPixels()` | **实际渲染像素**（含 UI 缩放/渲染缩放/像素密度折算） |
| `Global.getSettings().getScreenScaleMult()` | 屏幕缩放倍率，默认 1.0 |
| `Display.getPixelScaleFactor()` | LWJGL 像素密度因子 |

0.96 时代两者恒等，mod 怎么写都对齐；0.97/0.98 在 **UI 缩放 ≠ 100% 或渲染缩放开启**时两者不相等，于是：

1. mod 手写世界坐标 pass：`glOrtho(viewport.getLLX(), LLX+visibleW, LLY, LLY+visibleH)` + `glViewport(0,0, <屏宽>×psf, <屏高>×psf)`，把世界坐标映射到离屏缓冲像素。
2. 若 `<屏宽>` 用了**逻辑值** `getScreenWidth()`，而引擎渲染屏幕纹理、GraphicsLib 后处理都用**像素值** `getScreenWidthPixels()`，
   则特效在缓冲里的 UV 位置被等比压缩：`特效屏显位置 = (X-LLX)/visibleW × getScreenWidth()×psf`，而船体在 `…× getScreenWidthPixels()×psf`。
3. 偏移量 = 物体到屏幕原点的距离 × 比例差 → **镜头位置/缩放相关**；走同一 pass 的特效全部一致偏移。

**核心规则**：凡手绘进 GraphicsLib 缓冲的世界坐标 pass，viewport 必须与当前 GraphicsLib 版本的约定**逐字一致**。
GraphicsLib 1.12.1 的约定是 `(int)(Global.getSettings().getScreenWidthPixels() * Display.getPixelScaleFactor())`
（见其源码 `ShaderLib.renderForeground`、`LightShader.drawNormalMaps`）。
屏幕空间的 pass（`glOrtho(0, getScreenWidth(), 0, getScreenHeight(), …)` + 像素 viewport）是引擎 UI 的
"逻辑正交 + 像素 viewport"约定，**保持不动**。

## 3. 代码定位清单

在 mod 的 `jars\src\**\*.java` 中搜：

```
getScreenWidth() * Display.getPixelScaleFactor()
getScreenHeight() * Display.getPixelScaleFactor()
```

凡是出现在 `glViewport(...)` 调用里的都是嫌疑点；尤其检查：

- 继承 `org.dark.shaders.util.ShaderAPI` 且 `getRenderOrder() == RenderOrder.WORLD_SPACE` 的类
  （实战如 `TEM_TemplarShader`、`TEM_LatticeShieldShader`）；
- `renderInWorldCoords(ViewportAPI)` 里绑定 `ShaderLib.getAuxiliaryBufferId()` / 自建 FBO 之后的 viewport；
- 与 `glOrtho(viewport.getLLX(), viewport.getLLX()+viewport.getVisibleWidth(), …)` 配对出现的 viewport。

**判定参照**：打开 `mods\GraphicsLib\org\dark\shaders\util\ShaderLib.java`（GraphicsLib 自带源码），
对比其自绘世界坐标 pass（`renderForeground`、`LightShader.java` 的 `drawNormalMaps`/灯源 pass）用的表达式，照抄即可。
屏幕空间 pass 的 `glOrtho(0, getScreenWidth(), 0, getScreenHeight())` 与 quad 顶点坐标**不改**。

## 4. 修复

```java
// 改动前（错误）
GL11.glViewport(0, 0, (int) (Global.getSettings().getScreenWidth() * Display.getPixelScaleFactor()),
        (int) (Global.getSettings().getScreenHeight() * Display.getPixelScaleFactor()));
// 改动后（正确）
GL11.glViewport(0, 0, (int) (Global.getSettings().getScreenWidthPixels() * Display.getPixelScaleFactor()),
        (int) (Global.getSettings().getScreenHeightPixels() * Display.getPixelScaleFactor()));
```

要点：

- **全部**出现点都要改（同一类里通常有多个 pass：主世界 pass、hue/直绘 pass、后处理 pass、校验失败清理路径），
  漏一处症状不消。实战：`TEM_TemplarShader.java` 4 处 + `TEM_LatticeShieldShader.java` 1 处。
- 改后逻辑：特效与船体在任意 UI 缩放/渲染缩放下都对齐；若用户设置本就使两者相等（UI 缩放 100%），改动是无害等价替换。
- 不改：屏幕空间 `glOrtho(0, getScreenWidth(), …)`、`drawSystemUI` 类纯 UI 绘制、`ShaderLib` 自身的调用。
- 改完 grep 复查：`getScreenWidth() * Display` / `getScreenHeight() * Display` 应只在保留位置出现。

## 5. 构建与替换（关键：保留既有汉化/补丁）

若 jar 已被汉化（常量池补丁）或含其他手改，**绝不能整 jar 重编译**，只重编译改动的类并原位替换条目：

1. **备份**：`Copy-Item jars\<Mod>.jar jars\<Mod>.jar.bak_<时间戳>`。
2. **确认目标类未被补丁改动**：把 jar 中目标类与 `out\production\<Mod>\` 下同名类做**字节 hash 对比**；
   一致 ⇒ 补丁没碰它，可安全用新编译产物替换（实战中两个 shader 类与 out/production 逐字节一致，
   因为这两个类没有用户可见字符串）。
3. **编译**（JBR 17 **不支持 `-source 7`**，用 8）：
   ```
   <JBR>\bin\javac.exe -encoding UTF-8 -source 8 -target 8 -nowarn -cp "<starfarer.api.jar>;<starfarer_obf.jar>;<lwjgl.jar>;<lwjgl_util.jar>;<json.jar>;<log4j-1.2.9.jar>;<Graphics.jar>;<LazyLib.jar>;<MagicLib.jar>;<out\production\<Mod>>" -d <tmpout> <改动的.java 列表>
   ```
   classpath **必须含 mod 自身 `out\production\<Mod>`**（类间交叉引用，如 shipsystems/util 类）。
4. **原位替换 jar 条目**（`jar.exe --dir` 在 Windows 上易出错，用 .NET ZipArchive 更可靠；游戏**必须先关闭**）：
   ```powershell
   Add-Type -AssemblyName System.IO.Compression
   $zip = [System.IO.Compression.ZipFile]::Open($jar, [System.IO.Compression.ZipArchiveMode]::Update)
   foreach($n in $names){            # $names = 新 class 的 jar 内路径（含内部类，如 TEM_TemplarShader$1.class）
     $e = $zip.GetEntry($n); if($e){ $e.Delete() }
     $ne = $zip.CreateEntry($n)
     $b = [IO.File]::ReadAllBytes((Join-Path $tmpout ($n -replace '/','\')))
     $s = $ne.Open(); $s.Write($b,0,$b.Length); $s.Close() }
   $zip.Dispose()
   ```
5. **同步** `out\production\<Mod>`：把新 class 复制回去，保持工作区一致。
6. **验证补丁未损**：对比新 jar 与备份 jar 的**所有条目**（除被替换的类外）**逐字节一致**（实战 116/116 通过）；
   并确认新类字节码含 `getScreenWidthPixels`、class 版本 ≤ JRE 支持（major 52 无碍）。

## 6. 游戏内验证清单

- [ ] 进一场含该 mod 舰船的战斗（模拟战即可）
- [ ] 护盾/晶格纹路与船体贴合
- [ ] 武器开火辉光锚定在炮口
- [ ] 受击涟漪居中于受击点
- [ ] 技能光效贴合船体
- [ ] **重点**：滚轮缩放、平移镜头、舰船处于屏幕角落 vs 中央，分离距离**不再变化**
- [ ] 若用户此前 UI 缩放 > 100% 或开了渲染缩放，**保持该设置**验证（修复正对此情形）；可临时调回 100% 做对照
      （此时旧代码也不偏移，可用于确认根因）
- [ ] 游戏日志无新增着色器/程序错误

## 7. 附：无 javap 环境下的 class 反汇编诊断（判定 API 语义用）

系统无 JDK 工具时，可用 PowerShell 直接解析 class 文件（实战用于确认 `getScreenWidth` vs `getScreenWidthPixels` 的语义）：

- class 文件是**大端**；`[System.IO.BinaryReader]` 默认小端，读多字节必须手动
  `([int]$b[0] -shl 8) -bor [int]$b[1]`；**`[byte] -shl 8` 会按字节截断返回 0**（PowerShell 陷阱），先 `[int]` 再移位。
- 常量池 tag：1=UTF8、7=Class、8=String、9/10/11/12=Field/Method/InterfaceMethod/NameAndType、
  5/6=long/double（占两个槽位，循环里多跳一次）；UTF8 长度与各索引一律大端解析。
- 方法表：access/name/descriptor + 属性表，解析 Code 属性后即可输出字节码
  （`getstatic`/`invokestatic`/`invokeinterface` 的操作数在常量池里解析出类名/方法名/描述符）。
- 用途：确认 `getScreenScaleMult()` 默认 1.0、`getScreenWidthPixels()` 走像素字段、逻辑/像素字段分离，
  从而锁定根因方向。

## 8. 参考案例

`mods/Templars`（圣殿骑士团 0.9.9e 汉化版，0.98a-RC8 + GraphicsLib 1.12.1）：症状为晶格护盾纹路、
圣剑/长枪/朗基努斯炮口辉光、受击涟漪、技能光效全部与船体分离且随镜头变化。根因即 §2：
`TEM_TemplarShader.java` 4 处 + `TEM_LatticeShieldShader.java` 1 处 viewport 用了 `getScreenWidth()*psf`，
改为 `getScreenWidthPixels()*psf` 后全部对齐。修复仅重编译这 2 个类（7 个 class 含内部类）替换进 jar，
其余 109 个条目（含汉化补丁）逐字节保留。

## 9. 常见误区

- **误判为 `.ship` 问题**：`.ship` 的 `center` 字段在两版本间通常不变，不是本症状的原因。
- **游戏进程占用 jar**：替换前必须先关闭游戏（`starsector.exe` + `java.exe`），否则 `ZipFile.Open(...Update)` 报文件被占用。
- **javac 版本**：JBR 报"不支持源选项 7"，用 `-source 8 -target 8`；class major 52 与旧 major 51 混在同一 jar 无碍。
- **漏改**：同一类里多个 pass 各有一处 viewport，漏改则症状残留；用 grep 复查全部出现点。
- **汉化被破坏**：整 jar 重编译会丢失常量池汉化补丁；务必只替换改动类并做全条目字节校验。
