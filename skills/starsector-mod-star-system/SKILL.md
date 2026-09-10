---
name: starsector-mod-star-system
description: 用 CustomizableStarSystems（CSS）制作自定义星系（星图）时使用。覆盖：customStarSystems.json 结构与中心规则（含非恒星中心/地心式结构）、行星/恒星类型注册三件套（planets.json + star_gen_data.csv + planet_gen_data.csv）、描述接线（descriptions.csv type=CUSTOM）、星系命名机制，以及本流程实际踩过的全部坑与解决方法（描述不显示、类型未注册崩溃、存档取证双标签、尺度/坐标设计等）。附带通用校验脚本 scripts/validate_star_system.ps1。默认用户环境与当前环境一致（游戏根 C:\game\StarSector.v0.9.8a-RC8，0.98a-RC8，中文 Windows）。
---

# Starsector 自定义星系制作（基于 CustomizableStarSystems）

目标：用 CSS 制作一个可随新档生成的星系（含"非恒星中心"如地球居中的展示结构），并避开本流程已验证的坑。产出一个纯数据 mod（无需 jar）：`data/config/customStarSystems.json` + 类型注册 CSV + `planets.json` + `descriptions.csv`。

## 核心机制

### 1. 星系定义文件与合并

- CSS 读取所有 mod 的 `data/config/customStarSystems.json` 并**合并**（`getMergedJSONForMod`）——独立 mod 只需放同名文件即可被 CSS 加载，**不要改 CSS 本体**。
- 顶层键 = 星系 id（须唯一）；`isEnabled`、`numberOfSystems`、`setLocation`、`systemTags`、`systemLightColor`、`entities` 等。

### 2. entities 列表与中心规则（最容易崩的地方）

- **`entities[0]` 必须是 `star` 或 `empty_location`**，否则报错 "Invalid entities list ... must start with either a star entity or an empty_location"。
- **非恒星中心（地心式：让某行星在地图正中）**：
  1. `entities[0]` = `{"entity":"empty_location","numOfCenterStars":1,"orbitRadius":<太阳轨道>,"orbitDays":<太阳周期>}`——生成一个不可见中心令牌 + 声明 1 颗恒星绕它运行；
  2. `entities[1]` = 那颗恒星（`entity":"star"`，绕中心运行，轨道用 empty_location 的 orbitRadius）；
  3. 中心行星 = `{"entity":"planet","focus":0,"orbitRadius":0,"orbitDays":365}`——**轨道半径 0 恰好钉在中心**（0 半径轨道是游戏原生支持的），**必须显式给 orbitDays > 0**；
  4. 其余天体 `"focus":2`（中心行星下标）按距离排列。
- 轨道参数：`focus`（绕谁转，下标从 0 起，必须小于自身下标；`[f,l]` 为拉格朗日点）、`orbitRadius`、`orbitDays`（不填则按半径/25 自动）、`orbitAngle`、`orbitClockwise`。
- 特殊实体：`ring`/`asteroid_belt` 的 focus 指向**行星本身**，orbitRadius 是相对该行星的环半径（参考 ≈2.2×行星半径）；CSS 对它们不额外定位。

### 3. 类型注册三件套（漏一个就崩）

CSS 生成时**强校验类型存在**：

| 文件 | 作用 | 注意 |
|---|---|---|
| `data/config/planets.json` | 天体外观（贴图/大气/云层/光晕/图标） | 贴图按路径懒加载，**无需预加载**；可引用游戏本体路径（如 `graphics/warroom/icon_planet.png`，自动回退 starsector-core） |
| `data/campaign/procgen/star_gen_data.csv` | 恒星类型（StarGenDataSpec） | `star` 实体必须在此注册 |
| `data/campaign/procgen/planet_gen_data.csv` | 行星类型（PlanetGenDataSpec） | `planet` 实体必须在此注册 |

- 自定义类型**频率填 0**（永不程序生成），仅用于 CSS 引用。
- **CSV 列数必须与表头精确一致**（0.98a：planet_gen_data 47 列、star_gen_data 21 列），多/少一列会导致该行解析错位或加载失败。

### 4. 描述接线（0.98a 关键机制）

- 实体层：CSS 的 `customDescriptionId` → 游戏用 `getDescription(id, Type.CUSTOM)` 查找 → **descriptions.csv 里该 id 的行 type 必须为 `CUSTOM`**（这是本流程最深的坑，见踩坑 ①）。
- 类型层：行星 spec 的 `descriptionId`（缺省 = 类型 id）→ `Type.PLANET` 查找 → 行 type 为 `PLANET`。两条路径不互通。
- 文件格式：UTF-8 无 BOM；0.98a 表头 `id,type,text1,text2,text3,text4,text5,notes`（8 列）；text1 内不要出现裸 ASCII 逗号/引号。

### 5. 命名机制

- **星系名 = entities 中第一颗恒星实体的 `name`**（CSS 用它 `createStarSystem`），没有独立星系名选项；
- 要星系名与恒星名不同：游戏内控制台 `setname <名称>`（选中星系后执行）。

## 制作流程

1. 建 mod 骨架（`mod_info.json` 依赖 `customizablestarsystems`，UTF-8 无 BOM；本地 git；项目说明.md——见 `starsector-mod-delivery` §1/§3）。
2. `planets.json` 定义外观（或复用现有类型 + specChanges，注意 specChanges 的 texture 覆盖需先在 settings.json "graphics" 预加载）。
3. 注册类型：star_gen_data.csv / planet_gen_data.csv（频率 0，列数精确）。
4. 写 `customStarSystems.json`（中心规则、轨道、`setLocation`、`customDescriptionId`）。
5. 写 `descriptions.csv`（type=CUSTOM）。
6. 跑校验脚本 → 游戏内新档验证（CSS 在开新档时生成；描述在启动时加载，改后需重启）。
7. 按 starsector-mod-delivery 打包交付。

## 踩坑记录（症状 → 根因 → 解决）

### ① 写了描述但游戏里不显示（最隐蔽）
- **症状**：descriptions.csv 有内容、文件被加载（日志能看到 "Loading CSV data"），但点行星对话框无描述。
- **根因**：0.98a 行星对话框用 `Global.getSettings().getDescription(planet.getCustomDescriptionId(), Type.CUSTOM)`——**按 Type 过滤查找**；行 type 写成了 `PLANET`（那只是类型层路径），CUSTOM 查找落空。
- **解决**：自定义实体描述行 type 统一用 `CUSTOM`（对照：原版 `planet_jangala,CUSTOM`、mod 的 `aglaia,CUSTOM` 都是 CUSTOM；`terran,PLANET` 是类型描述）。

### ② 类型未注册 → 新档生成直接崩
- **症状**：开新档报 `Planet type X not found in "..."'s "entities" entry N!` / `Star type ... not found`。
- **根因**：CSS `addPlanet` 强校验 `planet_gen_data.csv`（StarGenDataSpec ← star_gen_data.csv）中存在该类型。
- **解决**：三个文件齐备（planets.json + 两个 procgen CSV），频率 0；CSV 列数与表头一致。

### ③ 中心实体规则
- **症状**：`Invalid "entities" list ... must start with either a "star" entity or an "empty_location" entity`。
- **根因**：entities[0] 不是 star/empty_location。
- **解决**：中心必须 star 或 empty_location；非恒星中心按"核心机制 §2"做，中心行星 orbitRadius=0 且显式 orbitDays>0。

### ④ 星系名不对
- **症状**：星系名是某行星名/随机名，或与预期不符。
- **根因**：星系名固定取第一颗恒星实体的 name；改名后要新档或重生成才生效。
- **解决**：把恒星 name 设为想要的星系名；要独立名用游戏内 `setname`。

### ⑤ "放大 4 倍"歧义
- **根因**：面积 4 倍 = 半径 2 倍（面积∝r²），线性 4 倍是半径 4 倍。
- **解决**：动手前与用户确认是半径还是面积；本流程惯例"放大 N 倍"指面积 → 半径 ×√N。

### ⑥ 大太阳放内圈会"掠过"内行星
- **症状**：行星轨道从太阳盘面穿过，视觉上行星扫过太阳表面。
- **根因**：太阳盘面 = 轨道 ± 半径（如轨道 3000、半径 850 → 盘面 2150~3850），内圈行星轨道在其范围内。
- **解决**：行星轨道 + 行星半径 < 太阳轨道 - 太阳半径（留 ≥35px）；同时注意日冕（伤害区 = 恒星半径+coronaRadius）与光晕（starCoronaSizeMult × 半径，非中心恒星要调小，原版 5.12 倍会把全图糊白）。

### ⑦ 把展示星系放"地图绝对中心"——会撞核心世界
- **根因**：原版核心世界簇就落在 (0,0) 附近（实测 Hybrasil 在 (-200,400)，距原点仅 ~447px）；超空间中心质心约 (-4531,-5865)。
- **解决**：不要用 `setLocation:[0,0]` 或超空间中心坐标；用空旷偏远坐标（如 (400,-19500)）。判定"某坐标是否空"必须用含核心世界的原版档取证，随机档（Nexerelin）的空位不可靠。

### ⑧ 存档取证：campaign.xml 双标签坑
- **症状**：从存档提取星系只拿到一小部分（如 36/219），或坐标全变成 (0,0)。
- **根因**：系统定义标签有 `<s cl="Sstm" ...>` 与 `<cL cl="Sstm" ...>`（还有 ls/e/f 前缀）两种；只匹配 `<s` 会漏掉大多数。系统超空间坐标在**超空间锚点**里，锚点 LocationToken 的标签是 `<sP cl="LocationToken">`（不是 `<LocationToken>`），坐标为其中 `<loc>X|Y</loc>`。
- **解决**：定义匹配用 `^<[A-Za-z]+ cl="Sstm" z="\d+" dN="..."`；锚点匹配 `^<(LocationToken|sP cl="LocationToken") `；`corvusMode=false` = 非标准（随机）星域，核心世界可能不存在。

### ⑨ PowerShell 路径含 [] 是通配符
- **症状**：`Get-ChildItem`/`Test-Path`/`Remove-Item` 对含 `[Geocentric Sol]` 的路径找不到文件或报 "already exists"。
- **根因**：PS 把 `[ ]` 当字符类通配符。
- **解决**：一律用 `-LiteralPath`（`.NET` 的 `[System.IO.File]` 天然无此问题）。

### ⑩ JSON 带注释与尾随逗号
- **根因**：游戏 JSON 允许 `#` 注释（整行/行内）与尾随逗号（`,}`/`,]`），`ConvertFrom-Json` 不支持。
- **解决**：校验前先清洗——去整行注释、去行内 `#` 到行尾、去字符串外尾随逗号（用状态机避免误伤字符串内 `#`/逗号）。

### ⑪ PS 读 CSV 计数不稳定
- **根因**：`Get-Content` + `-split ','` 对尾部空列计数在不同环境下结果不一致（曾出现同文件两种结果）。
- **解决**：用 .NET `[System.IO.File]::ReadAllLines` 读行 + 逐字节数逗号（0x2C）+1 判列数。

### ⑫ 编码
- 游戏要求 JSON/CSV 严格 UTF-8 无 BOM（含中文）；带 BOM 或无 BOM 的 JSON 都可能出问题（mod_info 必须无 BOM）。
- PS 5.1 读无 BOM 的 `.ps1` 按 ANSI 解释 → **带中文的 .ps1 脚本必须存 UTF-8 带 BOM**（EF BB BF）。
- 用 `Set-Content -Encoding UTF8` 会写 BOM，注意区分。

### ⑬ 生效时机
- 星系布局：CSS 在**开新档**（或控制台/Luna 重生成）时生效；
- 描述：`descriptions.csv` 在**游戏启动**时加载，改后需重启。

## 尺度与坐标参考（0.98a 实测，来自原版存档）

- 原版行星间距约 **1000–1500px**；行星系统最远轨道：3 行星 ~3900–5200、4 行星 ~5600–7700、5 行星 ~6800–7400。
- 黄矮星（star_yellow）半径 **800–900**，coronaMin 400、coronaMult 1、solarWind 10、crLossMult 3、光色 255 205 205 → 255 255 255。
- 核心世界簇质心 ≈ (-4531,-5865)（CSS 文档值，实测 (-4979,-5639)）；(0,0) 周围 8000 内就有 Hybrasil/Valhalla/Yma/Zagan 等核心世界。

## 校验（scripts\validate_star_system.ps1）

```powershell
powershell -ExecutionPolicy Bypass -File "<skills>\skills\starsector-mod-star-system\scripts\validate_star_system.ps1" -ModPath mods\<Mod>
```

检查：JSON 可解析（含注释/尾随逗号清洗）、entities 中心规则与 focus 索引、每个 `customDescriptionId` 在 descriptions.csv 中有行且 type=CUSTOM、CSV 列数与表头一致、文本文件严格 UTF-8。

## 验证清单（交付前必做）

- [ ] `customStarSystems.json` 可解析；entities[0] 为 star 或 empty_location；所有 focus < 自身下标
- [ ] 所有用到的行星/恒星类型已在 planets.json + 两个 procgen CSV 注册（频率 0），CSV 列数精确
- [ ] `descriptions.csv`：customDescriptionId 对应行存在且 type=CUSTOM；UTF-8 无 BOM；列数与表头一致
- [ ] 布局间距校验：内圈行星轨道不穿过太阳盘面；相邻行星轨道差 > 两者半径和
- [ ] `setLocation` 不与核心世界/其他已知系统重叠（用原版档取证）
- [ ] 游戏内新档验证：星系出现、行星居中/按轨道运行、描述显示
- [ ] 按 `starsector-mod-delivery` 提交 git 并打包

> 相关：中文文本（星系名/描述）的写法与格式铁律 → `starsector-mod-localization-spec` + `<skills>\shared\iron-rules.md`；
> 描述行 `type=CUSTOM` 是引擎硬要求（踩坑 ①），汉化时**不要**把 `CUSTOM` 改成 `PLANET`。
