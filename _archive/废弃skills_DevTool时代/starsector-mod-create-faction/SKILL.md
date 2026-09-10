---
name: starsector-mod-create-faction
description: 创建/编辑 Starsector（远行星号）mod 势力（faction）时使用。依据 DevTool 的 faction.schema.json 逆向整理：在 data/world/factions/<id>.faction 写入势力 JSON（显示名、颜色、logo/crest、舰船/武器/战机/船插蓝图与优先级、舰队教条、舰名/人名来源、市场出售频率、关系行为标记等），并在同目录 factions.csv 注册索引行。ID 规则：字母/数字开头，可含 _ . -。全部文件 UTF-8 无 BOM。
---

# 创建势力（Faction）

目标：为 mod 新建一个可被游戏识别的势力，包含外观、蓝图与舰队行为配置。

## 第 1 步 · 文件位置

- 势力本体：`mods\<Mod>\data\world\factions\<势力ID>.faction`（JSON）
- 势力索引：`mods\<Mod>\data\world\factions\factions.csv`（列：`id,file`，注册一行 `myfaction,data/world/factions/myfaction.faction`）
- 势力 ID 必须匹配 `^[A-Za-z0-9][A-Za-z0-9_.-]*$`；改 ID 会导致存档不兼容。

## 第 2 步 · 必填字段

| 字段 | 说明 |
|---|---|
| `id` | 势力唯一标识（与文件名一致） |
| `displayName` / `displayNameWithArticle` / `displayNameLong` | 短名 / 带冠词名（英文 the X，中文可相同）/ 长名 |
| `logo`、`crest` | 势力标志与徽章图片路径（相对游戏/mod 根目录） |
| `color` | 主色调 `[R,G,B,A]`（0-255），还有 `baseUIColor/darkUIColor/gridUIColor/brightUIColor` |
| `knownShips` / `knownWeapons` / `knownFighters` | 已知蓝图：`{tags:[...], hulls|weapons|fighters:[...]}`（`tags` 引 `csv:ships.tags` 等） |
| `factionDoctrine` | 舰队教条：`warships(0-7)`、`carriers(0-7)`、`phaseShips(0-7)`、`officerQuality(1-5)`、`shipQuality(1-5)`、`numShips(1-5)`、`shipSize(1-5)`、`aggression(1-5)`，可选 `officerSkills`/`commanderSkills`（引 `csv:skills.id`）及各类概率 |

## 第 3 步 · 可选字段（按需）

- 蓝图优先级：`priorityShips/priorityWeapons/priorityFighters`（同 known 结构）
- 市场：`weaponSellFrequency/fighterSellFrequency/hullmodSellFrequency`（ID→权重）、`illegalCommodities`（引 `csv:commodities.id`）
- 命名：`shipNamePrefix`（如 HSS）、`shipNameSources`（如 `ROMAN:2,GREEK:1`，枚举见 schema）、`names`（人名来源）
- 角色装配：`shipRoles`（`combatSmall` 等角色 → `{includeDefault, 装配ID:权重}`）
- 行为标记 `custom`：`offersCommissions`、`buysAICores`、`decentralized`、`pirateBehavior`、`fightToTheLast`、`engageWhenEvenStrength`、`makesPirateBases` 等布尔
- 其它：`music`（各场景音乐）、`ranks/posts`（军衔/职位名）、`voices`（对话人格权重）、`fleetTypeNames`、`internalComms`、`portraits`

## 第 4 步 · 校验

- [ ] `.faction` 为合法 JSON，UTF-8 无 BOM
- [ ] `factions.csv` 已注册索引行且路径正确
- [ ] 蓝图 ID 与 ships/weapons/wings CSV 中的 id 一致（DevTool 会用 reference 校验）
- [ ] `logo/crest` 图片路径真实存在（graphics/ 下）

## 备注

- 势力要能在游戏里刷出舰队，需把舰船/武器/战机加进 known 清单，并按需求配置 factionDoctrine 权重。
- 若势力不参与常规玩法，可只配外观 + known 空标签，随后在 market/star system 中引用。
