# 术语表（唯一权威，按需扩展）

> **定位：本表只收 0.98a 核心（原版）术语**，是全项目统一核心用词的权威。
> **不收录具体 mod 的专名，也不为 mod 汉化提供建议译名** —— mod 专名由译者按下面的取证顺序自行定名，
> 决定记入本 mod 的译名留档（`_work\mod_work\<Mod>\`），**不写回本表**。

> **取证优先顺序**（不要凭感觉译）：
> 1. **0.98a 核心汉化** —— 游戏本体中文化用词就是玩家的"母语"。
>    - grep `<game>\starsector-core\data\`（`strings\strings.json`、各 CSV、`rules.csv`）；
>    - 全项目平行语料：`<game>\_work\语料库\parallel\core_parallel.plain.jsonl`（15,033 对，中位 119 字符）。
> 2. **社区既有模组中文名** —— 同一 mod 已有广泛使用的 CN 名就沿用，别另起炉灶（除非与核心严重冲突或明显错误）。
> 3. **本项目既有译名** —— 查 `_work\mod_work\<Mod>\` 的 EN→ZH 映射与 `ai\zh\` 语料。
> 4. 以上都没有 → 译者自定，记入本 mod 的译名留档（`_work\mod_work\<Mod>\`）。

每条注明来源：`[核心]` = 0.98a 核心汉化 grep 证实。

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
| `d-mods` | D-插件 | [核心] |
| `ship system` | 战术系统 | [核心] |
| `phase` / `time flow` | 相位 / 时间流速 | [核心] |
| `burn` / `burn level` / `sustained burn` | 燃烧 / 燃烧等级 / 持续燃烧 | [核心] |
| `sensor profile` | 被侦测范围 | [核心] |
| `story point` | 故事点 | [核心] |
| `credits` | 星币 | [核心] |
| `automated ship` / `AI core` | 自动化舰船 / AI 核心 | [核心] |
| `Alpha/Beta/Gamma Core` | 阿尔法/贝塔/伽马核心 | [核心] |
| `salvage` / `derelict` | 打捞 / 残骸 | [核心] |
| `Close Support`（武器角色词） | **密接支援** | [核心]（**不是**「支援密接」——注意词序；同类还有 `Fire Support` 火力支援） |
| `hullmod` 分类标签（`hull_mods.csv` 的 `uiTags` 显示列） | 武器 / 特殊 / 后勤 / 需要船坞 / 防御 / 护盾 / 引擎 / 战机 / 相位 / 支援 | [核心]（逐字照抄核心中文同列；该列**引擎直接显示、不查表** ⇒ 单独闸门 `check_uitags_zh.js`，专项提示词 `workflows\prompt-船插分类汉化.md`） |

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
| `Pirates` / `Independent` | 海盗 / 非势力团体 | [核心]（`independent.faction` 四显示字段 + `descriptions.csv` + `rules.csv` 十处一致；⚠️ 旧表作「独立势力」系误读——核心数据中「独立势力」仅 1 处，译的是形容词语境 "rising independent **power**"，非势力名。形容词用法照常「独立＋名词」：独立舰队/独立世界/独立政体；个别语境：`independent trade` 民间贸易、`independent operator` 自由人/个体商户/独立经营者） |
| `Domain` / `Domain-era` | 人之领 / 人之领时代 | [核心] |
| `Persean Sector` | 英仙座星域 | [核心] |
| `Transplutonics`（武器制造商） | 稀有元素 | [核心] |
| `hyperspace` / `gate` | 超空间 / 星门 | [核心] |

> 势力显示名须与 `weapon_data.csv` 的 `tech/manufacturer`、`settings.json` 的 `designTypeColors` 键**精确一致**（铁律 R10）。
> 分类/制造商名同时存在于 `ship_data.csv` 的 `tech`/`manufacturer` **和** `.skin`/`.ship` 的 `tech` —— 两处都要改，且值必须**命中已注册的键**，
> 否则引擎不报错、直接把该值当分类名显示（症状：分类名还是英文）。闸门 `check_designtype.js`。

## 5. 商品

`supplies` 补给 · `fuel` 燃料 · `crew` 船员 · `marines` 陆战队员 · `heavy machinery` 重型机械 ·
`food` 食物 · `organics` 有机物 · `ore` 矿石 · `rare ore` 稀有矿石 · `volatiles` 挥发物 ·
`refined metals` 精炼金属 · `domestic goods` 生活用品 · `luxury goods` 奢侈品 · `drugs` 毒品 ·
`hand weapons` 轻武器 · `heavy armaments` 重武器 · `Volturnian lobster` 蓝龙虾 [核心]

## 6. 船插 / 舰船系统 / 武器（核心常见条目）

| EN | ZH | 来源 |
|---|---|---|
| `Hardened Subsystems` | 硬化子系统 | [核心] |
| `Integrated Point Defense AI` | 整合点防御 AI | [核心] |
| `Advanced Targeting Core` | 先进目标定位核心 | [核心] |
| `Safety Overrides` / `Unstable Injector` | 安全协议超驰 / 不稳定喷射器 | [核心] |
| `Phase Skimmer`（舰船系统） | 闪现 | [核心] |
| `Hellbore` / `Heavy Mauler` / `Autopulse Laser` | 炼狱炮 / 重型撕裂者 / 自动脉冲激光 | [核心] |

## 7. 写作铁律摘要（详见 `iron-rules.md`）

- 标点全角：，。；：？！（）——…；中文强调用 **`【】`/`《》`**，**禁用 `「」『』`**（缺字形 → `?`，铁律 R3）。
- 字面 `%` 写 `%%`；`%s`/`%d` 按需保留（铁律 R4）。
- 数字与百分比保留阿拉伯数字（`25%` → `25%%`、`100 单位`）。
- **人名**：项目一直保留拉丁字母就继续保留，不强制音译（`Amelie`、`Xander` 原样）。
- **船名**：按本表固定译名；`ship_names.json` 的重复词是加权设计，同词同译（铁律 R11）。
- 引擎常量值、配置枚举、id、路径、URL **绝不译**。

## 8. 机器可读副本

`<skills>\shared\glossary.json`（`glossary` 映射 + `style_notes`）供脚本消费（`build_worklist2.js` 等）。
**新增核心术语请同时更新 `.md`（人读，带来源）与 `.json`（脚本读）；mod 专名不进这两份表。**
