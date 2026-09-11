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
