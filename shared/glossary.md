# 术语表（唯一权威，按需扩展）

> **取证优先顺序**（不要凭感觉译）：
> 1. **0.98a 核心汉化** —— 游戏本体中文化用词就是玩家的"母语"。
>    - grep `<game>\starsector-core\data\`（`strings\strings.json`、各 CSV、`rules.csv`）；
>    - 全项目平行语料：`<game>\_work\语料库\parallel\core_parallel.plain.jsonl`（15,033 对，中位 119 字符）。
> 2. **社区既有模组中文名** —— 同一 mod 已有广泛使用的 CN 名就沿用，别另起炉灶（除非与核心严重冲突或明显错误）。
> 3. **本项目既有译名** —— 查 `_work\mod_work\<Mod>\` 的 EN→ZH 映射与 `ai\zh\` 语料。
> 4. 以上都没有 → 自定，并在本文件**标注"自定"**。

每条注明来源：`[核心]` = 0.98a 核心汉化 grep 证实 / `[社区]` = 社区沿用 / `[自定]` = 本项目新定。

## 1. 核心机制与数值

| EN | ZH | 来源 |
|---|---|---|
| `combat readiness` / CR | 战备值 | [核心] |
| `peak performance time` / PPT | 峰值时间 | [核心] |
| `deployment points` | 部署点数 | [核心] |
| `ordnance points` / OP | 装配点 | [核心] |
| `flux` / `flux capacity` / `flux dissipation` | 幅能 / 幅能容量 / 幅能耗散 | [核心] |
| `hull` / `armor` / `shield` | 结构 / 装甲 / 护盾 | [核心] |
| `hullmod` | 船插 | [核心] |
| `ship system` | 战术系统 | [核心] |
| `phase` / `time flow` | 相位 / 时间流速 | [核心] |
| `burn` / `burn level` / `sustained burn` | 燃烧 / 燃烧等级 / 持续燃烧 | [核心] |
| `sensor profile` | 被侦测范围 | [核心] |
| `story point` | 故事点 | [核心] |
| `credits` | 星币 | [核心] |
| `automated ship` / `AI core` | 自动化舰船 / AI 核心 | [核心] |
| `Alpha/Beta/Gamma Core` | 阿尔法/贝塔/伽马核心 | [核心] |
| `salvage` / `derelict` | 打捞 / 残骸 | [核心] |

## 2. 性格（引擎常量值，**只译显示名，值不译**）

`personality` 值 `reckless`/`aggressive`/`steady`/`cautious`/`timid` 是代码匹配键，**绝不译**；
其显示名为：**鲁莽 / 激进 / 沉着 / 谨慎 / 胆小** [核心]。

## 3. 舰船分类（`ship_data.csv` 的 `designation` 列）

`Frigate` 护卫舰 · `Phase Frigate` 相位护卫舰 · `Destroyer` 驱逐舰 · `Cruiser` 巡洋舰 ·
`Heavy Cruiser` 重型巡洋舰 · `Battleship` 战列舰 · `Heavy Battleship` 重型战列舰 ·
`Dreadnaught` 无畏舰 · `Light Carrier` 轻型航母 · `Carrier` 航母 · `Battlecarrier` 战列航母 ·
`Freighter` 货船 · `Tanker` 油船 · `Tug` 拖船 · `Combat Freighter` 武装货船 ·
`Gunship` 炮艇 · `Fighter` 战机 · `Interceptor` 截击机 · `Bomber` 轰炸机 · `Heavy Fighter` 重型战机 [核心]

## 4. 势力与专名

| EN | ZH | 来源 |
|---|---|---|
| `Hegemony` | 霸主 | [核心] |
| `Tri-Tachyon` | 速子科技 | [核心] |
| `Persean League` / `Persean` | 英仙座联盟 / 英仙座 | [核心] |
| `Luddic Church` / `Luddic Path` | 卢德教会 / 卢德左径 | [核心] |
| `Sindrian Diktat` | 辛达强权 | [核心] |
| `Pirates` / `Independent` | 海盗 / 独立势力 | [核心] |
| `Domain` / `Domain-era` | 人之领 / 人之领时代 | [核心] |
| `Persean Sector` | 英仙座星域 | [核心] |
| `hyperspace` / `gate` | 超空间 / 星门 | [核心] |

> 势力显示名须与 `weapon_data.csv` 的 `tech/manufacturer`、`settings.json` 的 `designTypeColors` 键**精确一致**（铁律 R10）。
> 分类/制造商名同时存在于 `ship_data.csv` 的 `tech`/`manufacturer` **和** `.skin`/`.ship` 的 `tech` —— 两处都要改，且值必须**命中已注册的键**，
> 否则引擎不报错、直接把该值当分类名显示（症状：分类名还是英文）。闸门 `check_designtype.js`。

## 5. 商品

`supplies` 补给 · `fuel` 燃料 · `crew` 船员 · `marines` 陆战队员 · `heavy machinery` 重型机械 ·
`food` 食物 · `organics` 有机物 · `ore` 矿石 · `rare ore` 稀有矿石 · `volatiles` 挥发物 ·
`refined metals` 精炼金属 · `domestic goods` 生活用品 · `luxury goods` 奢侈品 · `drugs` 毒品 ·
`hand weapons` 轻武器 · `heavy armaments` 重武器 [核心]

## 6. 社区/项目专有译名

| EN | ZH | 来源 |
|---|---|---|
| `Automatic Orders` | 自动命令 | [社区]（旧 0.3.2 社区名沿用） |
| `ChickenTechShop` | 小鸡科技商店 | [社区] |
| `TouchOfVanilla (vri)` | 沃兰缇亚归复局 | [社区] |
| `Templars` | 圣殿骑士团 | [社区] |
| `Nexerelin` | 星域争锋（Nexerelin） | [社区] |
| `Exo-Tech` / `Exoship` | 异想科技 / 异想母舰 | [社区] |
| `Abyssal Grid` / `Abyssal Adaptability` | 深渊幅能网络 / 深渊适应 | [自定] |
| `Crew Conversion` | 船员改造 | [自定] |

### 6.1 敌对拦截 Hostile Intercept（1.6.0 汉化）

| EN | ZH | 来源 |
|---|---|---|
| `Hostile Intercept (and Autopause!)` | 敌对拦截 (Hostile Intercept) | [社区]（沿用旧汉化 `mod_info.json` 里的社区名「敌对拦截」，括注保留原文） |
| `autopause` | 自动暂停 | [社区]（沿用旧汉化；Pause 单独出现时作「暂停」） |
| `jump pause` | 跳跃暂停 | [自定]（`jump point` 用核心「跳跃点」，故取「跳跃」而非「跃迁」） |
| `intercept` / `intercepting` | 拦截 / 正在拦截 | [核心]（`swarmer` 武器描述作「拦截或抵御」） |
| `hostile` | 敌对 | [核心] |
| `alarm` | 警报 | [核心]（`cr_allied_warning` 类音效提示） |
| `sensor contact` | 传感器接触目标 | [核心]（核心用「传感器」，contact 取「接触目标」以别于已识别舰队） |
| `autopilot` | 自动驾驶 | [核心]（`descriptions.csv` 的 `ACTION_TOOLTIP`） |
| `course` | 航线 | [核心] |
| `(Cheat)` | （作弊） | [自定]（模组作弊开关标记，全角括号） |
| `LunaSettings` 的 Radio 取值（`Disabled`/`All Contacts`/`Intercept Or Hostile`/`Intercept Only`/`Always`/`Hostile Only`） | **保留英文** | [自定·铁律]（被 `Settings.loadAutopauseMode`/`loadJumpPauseMode` 的 `when(string)` 精确匹配，译后静默失效） |

### 6.2 RTSAssist 0.1.9c（0.98a-RC8 汉化）

| EN | ZH | 来源 |
|---|---|---|
| `RTS mode` / `vanilla` | RTS 模式 / 原版 | [自定]（`vanilla` 与核心「原版」一致） |
| `assignment` | 命令 | [自定]（指 RTSAssist 的 assignment 体系；避免与核心 `order`「指令」混淆） |
| `attack move` | 攻击移动 | [自定] |
| `move and hold` / `move and release` | 移动并坚守 / 移动后释放 | [自定] |
| `formation` / `control group` | 阵型 / 控制组 | [自定] |
| `broadside` / `broadside modifier` | 舷侧 / 舷侧射击修正 | [自定]（ReadMe 里 `side` 作「舷侧」） |
| `strafe (camera)` / `translate` / `rotate` | （镜头）平移 / 平移 / 旋转 | [自定] |
| `vent (flux)` | 排幅 | [自定]（核心 `vent` 作「排幅」） |
| `focus enemy` / `target enemy` | 锁定敌人 / 指定为目标 | [自定] |
| `escort assignment` | 护航指派 | [自定]（沿用 §1 的 `escort` = 护航） |
| `selection tolerance` | 选取容错判定范围 | [自定] |
| `scroll speed` / `scroll smoothing` | 滚动速度 / 平滑程度 | [自定] |
| `UI scaling` | 界面缩放 | [自定] |
| LunaLib 页签名 `HotKeys`/`Settings`/`UI Settings`/`Dev Tools` | 热键 / 设置 / 界面设置 / 开发者工具 | [自定] |
| ⚠️ **绝不译** | 全部 `RTSA_Settings*` 键、`hotKeys`/`config`、`modID`（**同时是 `Config.ini` 的键** `confPointer.get("modID")`，且与局部变量同名 ⇒ patcher 会按标识符保护跳过）、音效事件名（sounds.json 的键）、第三方舰体/系统 id、`Point Defense (Area)` 等与原版比对的串 | [铁律 R7] |

### 6.3 San-Iris（`Sikair/SanIris` 1.1.0，0.98a-RC8 汉化）

> **2026-09 用户决策**（本表为权威，全 mod 必须同词）：

| EN | ZH | 来源 / 约束 |
|---|---|---|
| `San-Iris`（**设计类型/制造商名**） | **圣艾瑞斯联邦** | [用户决策] ⚠️ **铁律 R10 关键项**：同一字符串同时是 ① `data/config/settings.json` 的 `designTypeColors` **键**、② `data/hullmods/hull_mods.csv` 与 `data/weapons/weapon_data.csv` 的 `tech/manufacturer` **值** —— 这两处**必须逐字一致**且键唯一 |
| `San-Iris`（势力**显示名**） | **圣艾瑞斯联邦** | [用户决策] `.faction` 的 `displayName` |
| `San-Iris Federation` / `The San-Iris Federation` / `the San-Iris Federation` | 圣艾瑞斯联邦（带冠词版与主名一致） | [用户决策] `.faction` 的 `displayNameLong*` |
| `San Iris`（jar 常量，**无连字符**） | 圣艾瑞斯联邦 | [用户决策] ⚠️ 事件/情报文本里作者写作 `San Iris`，与 `San-Iris` **指同一势力**，须同词 |
| `Eternal Empress` | 永恒女皇 | [自定] `.faction` 的 `ranks`+`posts` 同名（对话/称号显示） |
| 舰名 / 武器名（~240 条） | **音译** | [用户决策] 逐条见 `_work\mod_work\SanIris\out\worklist\02_hulls_weapons.json` |
| `Edel` / `Iris` / `Lily` / `Hyacinth`（星系与星球名） | **由用户自行翻译** | [用户决策] 我（AI）不预设汉化方案；译则须全 mod 同译（星球名 ↔ 市场名 ↔ 任务文案 ↔ 图鉴描述） |

**易错点**：
- `Aegirràn`（jar 常量，带重音符）与 CSV 里的 `Aegirran Frame` / `Aegirran Manufacturing` 指同一事物，**译名须一致**。
- `hull_mods.csv` 里 `#Chitin Armor` / `#Offensive Targeting Array` 是**被 `#` 注释掉的整行**，译文必须保留开头 `#`。

### 6.4 星际联邦：重制版（Interstellar Federation Refurbished v1.00，2026-09 汉化）

| EN | ZH | 来源 |
|---|---|---|
| `Interstellar Federation`（势力/制造商） | **星际联邦** | [用户决策] tech/manufacturer 55 格 + 描述内同名，全 mod 一致 |
| `Interstellar Federation Refurbished`（mod 名） | 星际联邦的遗产 | [用户决策] `mod_info.json` name |
| `Ifed`（武器制造商旧拼写，4 格） | 星际联邦 | [用户决策] 与 Interstellar Federation 归一同词（英文原版两种拼写并存） |
| 舰名（Dakota/Rickshaw/Titan… 约 30 条） | 音译，逐条见 `mods\Interstellar Federation Refurbished\ai\zh\02_ship_data.json` | [用户决策] |
| designation 体系（Frigate/Carrier/…） | 沿用 §3 核心译名 | [核心] |

> 完整 EN→ZH 语料（298 条）：`mods\Interstellar Federation Refurbished\ai\zh\`（与 `ai\en\` 逐条对齐）。

### 6.5 Second-in-Command: Auxiliaries（1.3.0 汉化，2026-09）

| EN | ZH | 来源 / 约束 |
|---|---|---|
| `Cadet` / `Storm` / `Valkyrie` / `Apostle` / `Nomad` / `Guerilla` / `Helios` | 学员 / 风暴 / 女武神 / 使徒 / 游牧者 / 游击者 / 赫利俄斯 | [用户决策]（7 倾向名；同时是 Java 高亮词与职务名括号内词，全 mod 同词） |
| `Raptor` / `Raptor Mk.II`（= `.ship` 的 `Mega Raptor`） | 猛禽 / 猛禽 Mk.II | [用户决策]（显示名以 `ship_data.csv#name` 为准；`.ship` hullName 已对齐同词） |
| `Tempest (Mk. Storm)` | 暴雨 (风暴型) | [用户决策]（`.skin` hullName） |
| `Perfect Construction` | 完美构造 | [用户决策]（Nomad 技能名 ↔ Inactive S-Mods 船插 tooltip 高亮词联动） |
| `Explorer`（修正来源标签） | 探索 | [用户决策]（4 处 `modifyXxx` tooltip 标签） |
| `Transverse Jump` | 横轴跳跃 | [自定]（核心译名在混淆包内 grep 不到，取「横轴」呼应横移语义） |
| `Emergency Burn` | 紧急加速 | [核心]（core `strings.json`） |
| `Megaport` / `Orbital Works` / `High Command` | 特大型港口 / 轨道工业设施 / 最高指挥部 | [用户决策]（产业名，与核心产业词风格一致） |
| 里程碑名 `Threat/Dweller/Derelict/Remnant/Omega` | 威胁 / 潜伏者 / 残骸 / 余晖 / 欧米伽 | [用户决策]（残骸/余晖与核心势力词一致） |
| `Open market` / `Black market` | 公开市场 / 黑市 | [核心] |
| 舰载机类型 `Bomber/Fighter/Interceptor/Support` | 轰炸机 / 战机 / 截击机 / 支援 | [用户决策]（WingType 常量 ↔ WingRoleUpdater 替换词联动） |

> 完整 EN→ZH 语料（560 条）：`mods\sic-auxiliaries-1.3.0\ai\zh\`（与 `ai\en\` 逐条对齐）。

### 6.4 OMM / OrbitalManipulationMaintenance（0.9.0f master 汉化）

| EN | ZH | 来源 / 约束 |
|---|---|---|
| `Freitag Corporation`（设计类型/制造商/势力全名） | **弗赖塔格公司** | [自定] ⚠️ **R16 四处一致**：settings.json designTypeColors 键 + ship_data/weapon_data/hull_mods 三表 tech,manufacturer 值 |
| `Freitag Co.` / `the Freitag Co.` | 弗赖塔格商行 | [自定] .faction displayName |
| `Freitag Corporation HQ` | 弗赖塔格公司总部 | [自定] jar addCustomEntity/市场名（与 custom_entities freitag_hq 语境衔接） |
| `Anthozoa Station`（freitag_hq 兜底名） | 珊瑚虫站 | [自定] custom_entities defaultName（代码显式名优先，兜底亦译） |
| `The Dead Titan`（salvage_gate 兜底名） | 死亡泰坦 | [自定] custom_entities defaultName（代码显式名 "Destroyed Gate"=摧毁的星门 优先） |
| `Knights of Ludd` | 卢德骑士团 | [核心] jar 军事子市场名 |
| `commission`（jar Highlights 匹配词） | 委托 | [自定] ⚠️ 必须与 jar Req: 系列配方中 commission 同词，否则高亮静默失效 |
| `Suspicion level: none/…/extreme` | 怀疑程度：无/轻微/中等/较高/很高/极高 | [自定] 黑市交易风险提示 |
| Pod 系无人机 | 能量/协同/导弹/复合/混合/大型 荚舱；护盾/点防御/维护 无人机 | [自定] wing_data role desc + ship_data name 同词 |
| 蟹虾系舰名（Crevette 罗氏虾 / Ecrevisse 螯虾 / Euphausia 磷虾 / Macrocheira 巨螯蟹 / Sesarma 沙蟹 / Limnopilos 淡水蟹 / Sand Hopper 沙跳虫 等） | 见 `_work\mod_work\OMM\out\zh\03_data_ship_data.json` | [自定] 舰名 ↔ 变体 ↔ 图鉴 ↔ tips 全 mod 同词（R11） |
| `Valhalla` | **不译** | [铁律 R12] 代码星系查找键 |

## 7. 写作铁律摘要（详见 `iron-rules.md`）

- 标点全角：，。；：？！（）——…；中文强调用 **`【】`/`《》`**，**禁用 `「」『』`**（缺字形 → `?`，铁律 R3）。
- 字面 `%` 写 `%%`；`%s`/`%d` 按需保留（铁律 R4）。
- 数字与百分比保留阿拉伯数字（`25%` → `25%%`、`100 单位`）。
- **人名**：项目一直保留拉丁字母就继续保留，不强制音译（`Amelie`、`Xander` 原样）。
- **船名**：按本表固定译名；`ship_names.json` 的重复词是加权设计，同词同译（铁律 R11）。
- 引擎常量值、配置枚举、id、路径、URL **绝不译**。
- 模组名 → 沿用 `[社区]` 名。

## 8. 机器可读副本

`<skills>\shared\glossary.json`（`glossary` 映射 + `style_notes`）供脚本消费（`build_worklist2.js` 等）。
**新增术语请同时更新 `.md`（人读，带来源）与 `.json`（脚本读）。**

### 6.6 SCAV-CO Ship Works（sv，X-8 汉化）

| EN | ZH | 来源 |
|---|---|---|
| `SCAV-CO` / `VACS-INC` | **保留英文品牌名**（designTypeColors 注册键 + tech/manufacturer + 舰名前缀三通道同步保留，R16） | [自定] |
| `Ultima`（设计类型/武器商） | 终极（舰名"终极号"；designTypeColors 已注册键"终极"） | [自定] |
| `d-mods` | D-插件 | [核心] |
| `Transplutonics` | 稀有元素 | [核心] |
| `Hardened Subsystems` | 硬化子系统 | [核心] |
| `Integrated Point Defense AI` | 整合点防御 AI | [核心] |
| `Advanced Targeting Core` | 先进目标定位核心 | [核心] |
| `Safety Overrides` / `Unstable Injector` | 安全协议超驰 / 不稳定喷射器 | [核心] |
| `Phase Skimmer` | 闪现 | [核心] |
| `Hellbore` / `Heavy Mauler` / `Autopulse Laser` | 炼狱炮 / 重型撕裂者 / 自动脉冲激光 | [核心] |
| `Volturnian lobster` | 蓝龙虾 | [核心] |
| `Corvette`（designation） | 护卫艇 | [自定]（核心语料无该词） |
| uiTags 分类词（`Shields/Weapons/.../Requires Dock`） | 护盾/武器/…/需要船坞 | [核心]（与核心 hull_mods.csv 同列用词逐字一致；该列为显示列） |
