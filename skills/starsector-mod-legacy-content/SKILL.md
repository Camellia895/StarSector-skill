---
name: starsector-mod-legacy-content
description: 为旧版（0.9 以下，≤0.8x）Starsector（远行星号）mod 制作或补全"派系、星系、星球"内容时使用——不是修升级后跑不通的东西，而是把缺的/新的世界内容从零做出来并能在 0.98a-RC8 正确生成。覆盖：三条路线判定（带 jar/源码→Java 世界生成路线；纯数据→CSS 路线+数据派系；≤0.8x 与 wf-game-update 并行）、0.98a 派系文件权威格式（factions.csv 单列登记、known* 四键、factionDoctrine、default_ship_roles、designTypeColors）与三个 faction 闸门、Java 星系生成七步配方（onNewGame+Nexerelin 守卫、SectorGeneratorPlugin、addMarketplace、population 产业、跳跃点/超空间清理）、星球类型三件套与 descriptions.csv type=CUSTOM 接线、Nexerelin 四件套、worldgen id 语义闸门 check_worldgen_ids.js。实战参照与阳性对照 = mods\Celestial Mount Circle（0.9 时代 mod 已跑在 0.98a）。不用于：整体版本升级（→ wf-game-update）、修跑不通的 mod（→ wf-mod-fix）、纯 CSS 星系细节（→ starsector-mod-star-system）。
---

# 为旧 mod 制作派系 / 星系 / 星球（0.98a）

**职责**：给旧 mod（尤其 ≤0.8x）把"势力 + 星系 + 行星"内容做出来，且在 0.98a-RC8 新档能正确生成。
**不做**：整体升级（→ `wf-game-update` + `starsector-mod-game-upgrade`）、修跑不通（→ `wf-mod-fix`）、CSS 星系制作细节（→ `starsector-mod-star-system`）。
**上游/下游**：常被 `wf-game-update` §1 分派表点名；产出后闸门与冒烟仍走该 wf，交付走 `starsector-mod-delivery` 简化档。
**必读**：`shared\env.md`、`shared\iron-rules.md`（R8 宽松 JSON）、`shared\conventions.md`（闸门编号）。
**实战参照**：`mods\Celestial Mount Circle`（下称 CMC，仙山密教）与 `mods\Citadel`（城塞财团，0.8.3Dev2 已适配 0.98a +
汉化，2026-10-05 按 skill 完成内容现代化 0.9.1）。本文每个配方都有对应文件可整段照抄。
**改了本 skill 的脚本/配方，先对 CMC 与 Citadel 各跑一遍闸门，全绿才可信。**

## 0. 三条已核实的前提（动手前先记住，别再查）

1. **0.98a 没有官方 JSON 星系定义路线**。核心 `starsector-core\data\campaign\econ\*.json`（askonia/corvus…）
   只是**经济接线层**——把市场（派系/规模/条件/产业）接到**已生成实体**上，由 `econ\economy.json` 的
   `starSystems` 数组汇总；星体本身仍由 Java 代码生成。⇒ 新星系只有两条路：**Java 代码**（§3）或 **CSS**（第三方）。
2. **派系是纯数据**：`data\world\factions\<id>.faction` + `factions.csv` 登记。`factions.csv` 是
   **单列（列头 `faction`）路径表**，一行一个 `.faction` 路径——DevTool 时代归档 skill 写的 `id,file`
   两列是错的，以 core 同名文件为准。
3. **派系 id 与文件名无关**：Persean League 的文件是 `persean_league.faction`，内部 id 是 **`persean`**
   （且是裸键 `id:"persean"`——宽松 JSON 裸键合法，铁律 R8）。查关系/引用一律按 id 注册表，别按文件名猜。

## 1. 路线判定

```
mod 有 jar 或源码（或本次升级本来就要重编译）？
├─ 是 → **Java 路线**：§3 星系七步 + §2 派系数据（CMC 即此路线）
├─ 否（纯数据 mod）/ 只想加星系不想碰代码
│    → **CSS 路线**：星系走 `starsector-mod-star-system`（依赖 CustomizableStarSystems）；
│      派系仍按 §2（纯数据）做；星球类型三件套同 §3.2
└─ mod 本身在 wf-game-update 流程里（≤0.8x）→ 本 skill 与其 §7 专项**并行**，闸门共用
```

## 2. 派系（faction）制作

### 2.1 文件清单（CMC 全套实证）

| 文件 | 作用 | CMC 参照 |
|---|---|---|
| `data\world\factions\<id>.faction` | 势力本体（显示名/颜色/logo/蓝图/教条/军衔/音乐/头像/行为） | `cmc.faction` |
| `data\world\factions\factions.csv` | 登记：列头 `faction`，一行路径 | 同目录 |
| `data\world\factions\default_ship_roles.json` | 舰队角色 → 变体权重（多 mod 同名**合并**；空对象 `"combatSmall":{}` 占位合法） | 有 |
| `data\config\settings.json` | `designTypeColors` 键=设计类型名，须与 CSV `tech` 列逐字一致（否则静默不上色） | `"仙山密教"` |
| `data\strings\descriptions.csv` | **派系介绍**：`<id>,FACTION` 行（text1=情报页与 Nexerelin 选派系页的势力描述）。缺失**不崩**，游戏里就是"这个势力没有介绍"（IFR 上游从没写过这行，2026-10-05 用户报告实证；已入 check_faction_file 检查 7） | `cmc,FACTION` |
| `data\campaign\special_items.csv` | （可选）蓝图包物品 | `cmc_package` |

### 2.2 `.faction` 键要点（照 hegemony.faction 打底 + CMC 对照）

- **顶层键**：`id`（=文件名去后缀，改 id 破坏存档兼容）、显示名四键（`displayName` /
  `displayNameWithArticle` / `displayNameLong` / `displayNameLongWithArticle`）、`color`、`logo`/`crest`、
  `names`、`portraits`。原版 21 势力顶层键交集 8 项里 `personNamePrefixAOrAn`、`displayNameIsOrAre`
  **实测可省**（CMC 缺失照玩；闸门只警告）。**缺 `names` = 启动崩**（SpecStore 硬读，IFR 事故实证）。
- **蓝图四键**（0.8a 起，缺=势力选不到船/装备）：`knownShips` / `knownWeapons` / `knownFighters` /
  `knownHullMods`，结构统一 `{tags:[…], hulls|weapons|fighters|hullMods:[…]}`。
  hullmod 填 `hull_mods.csv` 的**小写 id**（不是类名）；knownShips **不会**从 shipRoles 自动生成。
  `tags`（如 `base_bp`/`luddic_church`/自定 `cmc_bp`）与显式 id 数组并存，指蓝图包。
- **教条**：`factionDoctrine`（0.98 只认它，旧 `doctrine` 块被忽略——warships/carriers/phaseShips/
  officerQuality/shipQuality/numShips/shipSize/aggression/combatFreighterProbability…照 hegemony 迁权重）。
- 常用可选：`priorityShips/priorityWeapons/priorityFighters`、`hullFrequency`、`shipsWhenImporting`、
  `shipNamePrefix`/`shipNameSources`/`names`、`ranks`（含 `posts`）、`fleetTypeNames`、`music`、
  `illegalCommodities`、`custom`（offersCommissions/buysAICores/punitiveExpeditionData…）、`portraits`。
- 宽松 JSON 合法：`#` 注释、尾逗号、裸键（铁律 R8）；UTF-8 无 BOM。
- **只写自己新增的键即可**；同名覆盖 core 派系（如 mod 内放 `pirates.faction`）才是按键深度合并。

### 2.3 闸门（进冒烟前必过，脚本在 `shared\scripts\`）

```powershell
node <skills>\shared\scripts\check_faction_file.js <modDir>        # 必填键/资产存在/factions.csv 登记
node <skills>\shared\scripts\check_faction_known_lists.js <modDir> # known* 对照注册表（读档期 verifyFactionData 复刻）
node <skills>\shared\scripts\check_faction_shiproles.js <modDir>   # 写了 shipRoles 才需要；变体 id 按注册 id
node <skills>\shared\scripts\check_wing_data_schema.js <modDir>    # mod 里有自定机翼时
node <skills>\skills\starsector-mod-legacy-content\scripts\check_worldgen_ids.js <modDir>  # §5
```

**阳性对照基线**：CMC 四闸 = file 全过（两条惯例键警告属预期）/ known* 39 条 PASS / 无 shipRoles / worldgen 0 FAIL。
Citadel 四闸 = file 解析失败属已知假阳性（`noPatrols:False` 游戏能读，JsonProbe 实证）/ known* 72 条 PASS /
shipRoles 35 变体 PASS / worldgen 0 FAIL。

## 3. 星系 + 星球（Java 路线，CMC 配方七步）

### 3.0 骨架（两个类 + 一行注册）

- `data.scripts.<Mod>ModPlugin extends BaseModPlugin`：`onNewGame()` 里直接调世界生成（**推荐无条件生成**，
  见 §4 守卫时序警告）；`mod_info.json` 加 `"modPlugin": "data.scripts.<Mod>ModPlugin"`。
- `data.scripts.world.<Mod>WorldGen implements SectorGeneratorPlugin`（0.98a 仍在）：
  `generate(SectorAPI)` 里 `new <Mod>_系统类().generate(sector)` +
  `SharedData.getData().getPersonBountyEventData().addParticipatingFaction("<id>")` +
  一组 `setRelationship(Factions.X, 值)`（CMCWorldGen.java 照抄）。
- **给同时代其它 mod 势力设关系必须判空**（旧 mod 常硬编码友 mod 派系 id，对方没装=静默无效，
  Citadel 对 blackrock/shadow_industry/exigency 等 9 处实证）：

```java
private static void setRelIfPresent(SectorAPI sector, FactionAPI f, String id, RepLevel lv) {
    if (sector.getFaction(id) != null) f.setRelationship(id, lv);
}
```

### 3.1 七步（代码骨架摘自 CMC_PeachGarden.java，完整实现照抄该文件）

```java
StarSystemAPI system = sector.createStarSystem("桃园");            // ① 建系（名=星系名）
system.getLocation().set(-14200f, -10000f);                        // ② 定位+背景+光色
system.setBackgroundTextureFilename("graphics/backgrounds/background6.jpg");
PlanetAPI star = system.initStar("TaoHuaYuan", "star_yellow", 600f, 350f); // ③ 恒星(类型须已注册)
system.addAsteroidBelt(star, 100, 2200f, 150f, 180, 360, Terrain.ASTEROID_BELT, "");
PlanetAPI p = system.addPlanet("cmc_planet_yuanming", star, 名字, "terran", 215, 120f, 4500f, 365f); // ④ 行星
MarketAPI m = addMarketplace("cmc", p, null, p.getName(), 6, 条件列表, 子市场列表, 产业列表,
                             0.3f, false, true);                   // ⑤ 市场（helper 在 CMCWorldGen，直接抄）
p.setCustomDescriptionId("cmc_planet_yuanming");                   // ⑥ 描述接线（→descriptions.csv CUSTOM 行）
system.autogenerateHyperspaceJumpPoints(true, true);               // ⑦ 跳跃点 + 超空间清理
```

七步之外的可选项：碎片带（`Misc.addDebrisField` + `SalvageSpecialAssigner.assignSpecialForDebrisField`），
贴恒星系统要在收尾 `cleanup(system)` 用 `NebulaEditor.clearArc` 清掉周围超空间星云（CMC 有现成实现）。

**三条硬规则**：
- **population 产业必须显式加**（食物需求与人口增长都在它身上）；helper 内 `addIndustry` 先于
  `economy.addMarket(market, true)`，顺序不能反（≤0.8x 经济断点全表 → `starsector-mod-game-upgrade` §7.3）。
- 行星/恒星类型：core 类型（`terran`/`barren`/`star_yellow`…）直接用；**自定义类型**须先注册三件套
  （`planets.json` + `planet_gen_data.csv`/`star_gen_data.csv`，频率 0、列数与表头精确一致 47/21 列，
  漏一个=新档生成崩）——机制与坑见 `starsector-mod-star-system\SKILL.md` §3。
- **位置红线**：别放 (0,0) 或超空间中心附近——核心世界簇就在原点周围 ~8000px 内；选空旷坐标后用
  **含核心世界的原版档**取证不撞系（尺度表与取证法 → `starsector-mod-star-system\SKILL.md` §尺度与坐标参考）。

### 3.2 星球显示与描述

- 描述：`data\strings\descriptions.csv` 加行 `id=customDescriptionId, type=CUSTOM`——**type 必须 `CUSTOM`**
  （`PLANET` 是类型层路径，按 id 查询落空=描述不显示，这是 star-system skill 踩坑①的引擎机制）。
- 显示名：可硬编码，或走 i18n——CMC 用 `data\strings\strings.json` + `data.utils.cmc.Constants` 读取。
- 设计类型上色：`settings.json` 的 `designTypeColors` 键须与 `ship_data`/`weapon_data` 的 `tech` 列
  逐字一致（`check_designtype.js` 闸门）。

## 4. Nexerelin 适配（可选，CMC 实证"四件套 + 一守卫"）

> **先查 `mods\nexerelin\data\config\exerelinFactionConfig\` 有没有该派系的内置配置**（Citadel 的
> citadeldefenders 就有，含 spawnpoints）——有内置就不要在 mod 侧重做，改它属于 Nexerelin 本体的事。
>
> ⚠️ **onNewGame 里别用 `SectorManager.getCorvusMode()` 这类守卫决定是否生成**（CMC/Citadel 同款）：
> Citadel 实证（2026-10-05 用户报告）——存档 `corvusMode=true`、日志零异常，但自建星系整个没生成
> ⇒ 守卫在插件调用时刻读到的模式与最终模式不一致（时序/类加载器）。**首选无条件生成**：
> Corvus 模式下 Nexerelin 按 spawnpoints 安置派系时星系已存在；随机模式下星系就在生成的星域里
> （硬编码坐标有与随机星系重叠的小概率，接受或用控制台挪）。旧档世界已生成，无法补建，需开新档。

1. `data\config\exerelinFactionConfig\<id>.json`：`playableFaction`/`corvusCompatible`/`rebelFleetSuffix`/
   `alignments`/`diplomacyTraits`/`startShipsSolo|CombatSmall|CombatLarge|CarrierSmall`/`startSpecialItems`…（抄 cmc.json）。
2. `data\config\exerelinFactionConfig\mod_factions.csv`：列头 `faction`，登记 id（**大小写敏感**）。
3. `data\config\exerelin\corvus_capitals.csv`：`system,entityID`（#人类名/#机器名注释行 + `桃园,cmc_planet_yuanming`）。
4. `data\config\exerelin\corvus_spawnpoints.csv`：`faction,system,entityID`。
5. **onNewGame 守卫**（CMCModPlugin.java 原样）：Nex 存在且非 Corvus 模式 ⇒ **跳过自生成**
   （Nex 接管世界生成，mod 只提供出生点），否则正常生成：

```java
boolean haveNex = Global.getSettings().getModManager().isModEnabled("nexerelin");
if (!haveNex || SectorManager.getManager().isCorvusMode()) new CMCWorldGen().generate(Global.getSector());
```

## 5. 闸门与冒烟（id 语义层是本 skill 的独有闸门）

编译探测（wf-game-update 第 2 步）只抓 API 签名断裂；**字符串/常量形式的 id**（行星/恒星类型、条件、
产业、子市场、商品、物品、派系 id）编译器不查，加载期不崩或运行期才崩。分层拦截：

```powershell
node <skills>\skills\starsector-mod-legacy-content\scripts\check_worldgen_ids.js <modDir>
# 缺省扫 <modDir>\src 与 <modDir>\data 下全部 .java（janino 同覆盖）；jar-only mod 传反编译目录 --java=<dir>
```

覆盖：`Conditions/Industries/Submarkets/Commodities/Items/Factions/Planets/StarTypes.<常量>` →
解析 `_work\_api_src` 的 `impl\campaign\ids\*.java` 常量值后对照注册表（core+已启用 mod+被测 mod）；
调用点字面量：`initStar` 第 2 参（恒星类型）、`addPlanet` 第 4 参（行星类型）、`addCondition`/`addIndustry`/
`addSubmarket` 第 1 参、`getFaction`/`setRelationship`/`addParticipatingFaction`/`addMarketplace` 第 1 参（派系）、
`setInteractionImage` 第 1+2 参（插图类别/键 → settings.json graphics 类别注册表；核心大文件解析失败时
自动降级为 graphics 块正则提取——core settings.json 含 `:.5` 裸浮点，parseJsonLoose 不认，铁律 R8）。
验证记录：CMC 阳性 16 文件全绿；Citadel 阳性 29 文件全绿；注入 11 种坏 id + `("illustrations","twin_cities")`
（真崩溃案例）全部 FAIL。

之后照 `wf-smoke-first` **深烟测（-NewGame）+ 读一次档**：`verifyFactionData` 在**读档期**逐条核对 known*，
只进主菜单测不出来（AI War 五轮炸点教训）。游戏内检查：新档星系出现 → 市场/产业正确 → 势力舰队带自机翼 → 关系值生效。
存档取证（`saves\save_*\campaign.xml`，**用 Buffer + latin1 逐字节搜**——node 按 utf8 解码后 indexOf 会丢
ASCII 匹配，IFR 实测一次；也别猜 UTF-16）：

- 星系实体 id（如 `ifed_corinth_star`/`ifed_concord`）与派系 id 计数 >0；
- **产业核对**（population 缺失不崩、殖民地只是不增长，编译器与闸门都查不到，只有存档能证明）：
  产业在存档里是**类名元素**（`<Farming id="farming">`、`<PopulationAndInfrastructure>`…），
  **不是** `<Industry>` 节点；提取式：`<(\w+) z="\d+" id="([a-z_0-9]+)"[^>]*>\s*<m [^>]*ref="市场z"`。
  市场 z 取自其开标签（`<Market z="…">` 与 `<market cl="Market" z="…">` 两种形态都出现）。
  目标市场产业列表里没有 population ⇒ onNewGame 的产业数组漏了 `Industries.POPULATION`（IFR 实测踩过）。

## 6. 项目骨架（旧 mod 没有像样源码工程时）

wispborne/Starsector-IntelliJ-Template（github.com/wispborne/Starsector-IntelliJ-Template）是现代 mod 工程
骨架：`.idea`（必需）、`.run`（开箱即跑游戏的运行配置）、`data/`+`graphics/`+`sounds/`+`src/` 目录约定、
`mod_info.json`、`<作者>_<唯一id>.version`（Version Checker 文件，建议保留）。无 gradle——本库构建口径是
`build_java_mod.ps1`（`--release 8`，见 `env.md`）；`.idea/.run` 属本机 IDE 产物，`deliver.ps1` 打包会排除。
IDE 设置细节：starsector.wiki.gg/wiki/IntelliJ_IDEA_Setup。**给旧 mod 补工程时**：复制 `.idea`+`.run` 改包名即可，
源码目录沿用 mod 现有布局（CMC 是 `src\` 顶层，模板是 `src\`——一致）。

## 7. 坑表（本流程实证）

1. **factions.csv 是单列 `faction` 路径表**——DevTool 时代归档 skill 的 `id,file` 两列说法错误（core+CMC 双证）。
2. **`.faction` 裸键合法**：`id:"persean"`（persean_league.faction 实测无引号）——自写解析器/正则键名引号必须可选。
3. **派系 id ≠ 文件名**：Persean League id=`persean`。CMC 旧代码 `setRelationship(Factions.PERSEAN,…)` 恰好因此踩对；
   反过来按文件名写 `persean_league` 反而错。
4. 缺 `names` = 启动崩（SpecStore 硬读）；`personNamePrefixAOrAn`/`displayNameIsOrAre` 惯例键可省。
5. **population 产业必须显式加**；`addIndustry` 必须在 `addMarket(market, true)` 之前（helper 已保证顺序）。
6. known* 四键与 shipRoles 是两个命名空间：knownShips 管市场出售与舰队构成，shipRoles 管角色装配；
   只写 shipRoles 不写 knownShips ⇒ 船进舰队但不进市场（上游设计，别"顺手补"）。
7. 变体 id 按**文件内 `variantId` 字段**（注册 id），不是文件名（`kite_Interceptor` 注册为 `kite_hegemony_Interceptor`）。
8. 宽松 JSON 全程合法：`#` 注释/尾逗号/裸键/`1f` 后缀——判死用游戏 `org.json`（铁律 R8），CMC 的
   `mod_info.json` 连 `dependencies` 数组都带尾逗号、照常加载。
9. 星系位置撞核心世界：原点 ±8000px 内就有 Hybrasil/Valhalla 等（§3.1 位置红线）。
10. **改闸门/脚本先对 CMC 跑**（阳性对照）；怀疑闸门失效时，注入一个坏 id 看它会不会 FAIL（阴性对照）——
    本 skill 的脚本两项都做过并留档于此。
11. **`setInteractionImage` 的"怪类别"可能是 mod 自定义，不是拼写错误**：Citadel 的 `illustrationz` 是
    settings.json graphics 里定义的自定义插图类别（streets/twin_cities），把它"改回"核心 `illustrations`
    ⇒ 开局世界生成直接 `RuntimeException: Texture [twin_cities] not found`（**不是静默**，用户会看到错误弹窗，
    2026-10-05 实际翻车一次）。判据=查 mod+core 合并的 graphics 类别注册表，交给闸门 B2，别靠眼睛。
12. **世界生成类常被常量池汉化**（天体/市场/空间站显示名：Citadel 的 Citadel.class 有 10 键中文名）。
    改这类代码的正确姿势：①先 `scan_jar_cjk` 该类摸清中文键；②源码照常改（英文）；
    ③用"中文化临时源码"直接编译（10 键 EN→ZH 机械替换，等效常量池补丁、零字节码手术）；
    ④`cmp_build` 归一化对比（基线编译 vs 原 jar 应 diff=0）+ `dump_utf8` 多重集差（应只剩声明改动）+
    条目哈希比对（原位替换，其余条目逐字节一致）。
13. **Nexerelin 兼容先查它自带的**：`mods\nexerelin\data\config\exerelinFactionConfig\` 内置了一大批旧 mod
    派系配置（citadeldefenders/exigency/exipirated…，含 startShips/corvus_spawnpoints/customStations）。
    有内置 ⇒ mod 侧**不要**再建四件套（重复/冲突）；没有才按 §4 自建。
14. **上游 jar 可能带 central-dir CRC=0 的条目**（Citadel 31 处，JVM 按 local header 读、游戏无感）：
    `7z x` 会拒写、`unzip` 照常解内容（非零退出码属预期）——条目级比对用 unzip；**不要**为此整体重打 jar。
15. **cmp_build 的 classpath 参数传错会假绿**：javap "找不到类" 的失败被当作空输出=两侧"相等"。
    第 3/4 参必须传**各自类目录**（不是 API jar）。采信前看输出里有没有"找不到类"。
16. 烟测自动化的窗口坑（`_work\explore\modcheck\NewGame.ps1`，2026-10-05 已修）：游戏窗口最小化时
    `GetClientRect`=0×0 → Bitmap 构造崩；主菜单日志标记可能早于窗口就绪 → 一次性查找窗口有竞态。
    已加 SW_RESTORE 自愈 + 30s 查找重试。深烟测 newgame 段 FAIL 时先看是不是自动化层（证据目录
    verdict.json 的 load 判定 PASS + 无游戏栈帧 ⇒ 别急着怀疑 mod）。
17. **"派系只剩开局选项、星域里找不到派系和星系" = onNewGame 生成被跳过**（Citadel 0.9.2 实证）：
    取证三连——存档 `corvusMode` 字段值、星系实体 id 计数、日志有无 `at data.scripts.world` 栈帧；
    三者组合（true / 0 / 无异常）⇒ 生成被静默跳过而非崩溃。元凶多为 onNewGame 里的模式守卫
    （坑 16 前述时序），修法=无条件生成。带 nexerelin 的深烟测自动化 2026-10-05 实测可自动走完
    NGC 配置并建出存档（IFR 全默认集 rc=0）；仅当复现 rc=3 卡配置屏时改走用户实测。
18. **派系介绍不在 `.faction` 里，在 descriptions.csv 的 `<id>,FACTION` 行**：漏写不崩，
    玩家只会看到"势力没有介绍"（情报页与 Nexerelin 选派系页都吃这一行）——IFR 上游从没写过、
    用户报告后才补（2026-10-05）。已入 `check_faction_file` 检查 7（阳性对照 CMC/Citadel 各恰一条）。
19. **`.system` 的 `statsScript` 引用核心 janino 类是常态，不是缺陷**：LoadTest 的 SYS 段对
    `data.shipsystems.scripts.FortressShieldStats` 这类引用报"缺失"是**假阳性**——核心源在
    `starsector-core\data\shipsystems\scripts\` 由引擎运行时编译，离线工具看不到。全库普查
    78 例生态常态（SWP 的 swp_boss_zeusshield 同款、Starsector AI Overhaul 整套照抄原版系统、
    Vayra Ship Pack 等）⇒ **不要**按这条"修"mod（IFR 2026-10-05 定性，详见 registry LoadTest 行）。
20. **mod 派系市场建在 onNewGame + Nexerelin = 开局即征服胜利**（The Nomads 1.4.12 实证，2026-10-05）：
    Nexerelin 分配/转移核心首都走 `SectorManager.transferMarket`，每次转移末尾 `checkForVictory()`；
    新档早期全场计入人口只有 ~19（自家市场 + 首个首都），mod 派系 14 人口 ≥ max(0.501×total,
    1.5×第二名) ⇒ 瞬间 CONQUEST（存档证据：`victoryHasOccured=true` + VictoryScreenScript）。
    旧版单 6 人口空间站恰好低于阈值线所以以前没爆——**"以前没问题"不证明写法安全**。修法：
    市场/舰队/跳跃点挪到 **`onNewGameAfterEconomyLoad`**（此时首都分配完毕、全场市场齐备），
    星系布局/实体留 onNewGame；并反射调用 `exerelin.campaign.SectorManager.addLiveFactionId("<id>")`
    补登记存活派系（它的 reinitLiveFactions 先于我方市场创建跑，漏登记=派系在 Nexerelin
    外交/AI 里当已死）。验证：新档 `victoryHasOccured` 必须为 false——**烟测框架不查这个字段，
    要手动 grep 存档**。

## 完成标准

- [ ] `.faction`：必填键齐、id=文件名、factions.csv 已登记；三个 faction 闸门 PASS（惯例键警告可留）
- [ ] descriptions.csv 有 `<id>,FACTION` 派系介绍行（faction 闸门检查 7，缺失=情报页无介绍）
- [ ] `check_worldgen_ids.js` 0 FAIL；有机翼 ⇒ wing 闸门 PASS
- [ ] Java 路线：编译探测干净（`--release 8`）；LoadTest 通过；系统七步齐全（含 population 产业、跳跃点）
- [ ] CSS 路线：`validate_star_system.ps1` PASS（星系路线细节归 star-system skill）
- [ ] 描述接线：descriptions.csv `type=CUSTOM` 行齐；`designTypeColors` 与 tech 列一致
- [ ] （做了 Nexerelin）四件套齐 + onNewGame 守卫在位
- [ ] 深烟测 + **读档**通过；游戏内新档：星系/市场/舰队/关系全部生成
- [ ] 存档取证含**产业核对**：目标市场产业列表里有 population（§5 提取式）
- [ ] 版本号/changelog/交付按 `wf-game-update` 第 10 步 + `starsector-mod-delivery` 简化档

## 脚本（本 skill 的 `scripts\`）

| 脚本 | 用途 |
|---|---|
| `check_worldgen_ids.js` | Java 世界生成 id 语义闸门（只读+打印；命中 exit 1）。用法与覆盖面见 §5 |

> 相关：≤0.8x 升级断点与经济映射 → `starsector-mod-game-upgrade` §7；CSS 星系/星球类型三件套细节 →
> `starsector-mod-star-system`；冒烟 → `wf-smoke-first`；交付 → `starsector-mod-delivery`。
