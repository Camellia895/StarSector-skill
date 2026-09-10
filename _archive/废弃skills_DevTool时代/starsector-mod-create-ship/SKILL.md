---
name: starsector-mod-create-ship
description: 创建/编辑 Starsector（远行星号）mod 舰船时使用。依据 DevTool 的 ships.columns.json 与 defaultShip 逆向整理：在 data/hulls/ship_data.csv 加一行舰船属性（结构/装甲/幅能/护盾/速度/船员/货仓/标签等），在 data/hulls/<hullId>.ship 写几何规格（贴图、武器槽、引擎槽、内置插件/武器/联队、bounds），必要时在 data/variants/ 建默认装配。舰船编辑器只写 .ship 不反写 CSV。ID 规则：字母/数字开头，可含 _ . -。全部文件 UTF-8 无 BOM。
---

# 创建舰船（Ship）

目标：为 mod 新建一艘可用的舰船（含数据行 + 几何规格 + 装配）。

## 第 1 步 · CSV 数据行（data/hulls/ship_data.csv）

| 关键列 | 说明 |
|---|---|
| `name` / `id` | 名称 / 唯一 ID（与 .ship 的 hullId 一致） |
| `designation`、`tech/manufacturer` | 定位（如 护卫舰）/ 设计类型 |
| `system id` | 战术系统（引 `csv:shipSystems.id`） |
| `hitpoints`、`armor rating` | 结构 / 装甲 |
| `max flux`、`flux dissipation` | 幅能容量 / 幅能耗散 |
| `ordnance points` | 装配点 |
| `shield type` | `NONE/FRONT/OMNI/PHASE`；配 `shield arc`、`shield upkeep`、`shield efficiency` |
| `phase cost` / `phase upkeep` | 相位舰用 |
| `max speed`、`acceleration`、`deceleration`、`max turn rate`、`turn acceleration`、`mass` | 机动 |
| `min crew` / `max crew`、`cargo`、`fuel`、`fuel/ly`、`range`、`max burn` | 后勤 |
| `fighter bays` | 甲板数量（放战机用） |
| `fleet pts`、`base value`、`rarity`、`tier` | 部署/价值 |
| `hints`、`tags` | 提示与标签（供势力 knownShips 与市场引用） |
| `CR` 相关列 | `cr %/day`、`CR to deploy`、`peak CR sec`、`CR loss/sec` |
| `supplies/rec`、`supplies/mo` | 维修与月维护补给 |

## 第 2 步 · 几何规格（data/hulls/<hullId>.ship）

必需结构（参考 defaultShip）：

- `hullId` / `hullName`、`hullSize`（`FIGHTER/FRIGATE/DESTROYER/CRUISER/CAPITAL_SHIP`）、`style`（`LOW_TECH/MIDLINE/HIGH_TECH/CUSTOM`）
- `width` / `height` / `center`（[x,y]）、`collisionRadius`（圆必须包住护盾/槽位/引擎）、`bounds`（多边形顶点数组）
- `spriteName`（贴图引用）、`viewOffset`、`coversColor`
- `shieldCenter` / `shieldRadius`（护盾几何）
- `weaponSlots`：每槽 `id/size(SMALL|MEDIUM|LARGE)/type(BALLISTIC|ENERGY|MISSILE|HYBRID|UNIVERSAL|SYNERGY|COMPOSITE|SYSTEM|STATION_MODULE|BUILT_IN)/mount(TURRET|HARDPOINT|HIDDEN)/angle/arc/locations`（普通槽一个 location，`LAUNCH_BAY` 可多点）
- `engineSlots`：`id/style/length/width/angle/location`
- `builtInMods`（船插 ID 列表）、`builtInWeapons`（槽位ID→武器ID）、`builtInWings`（联队 ID 列表）

## 第 3 步 · 装配（可选）

- `data/variants/<variantId>.variant`：`variantId`、`hullId`、`displayName`、`fluxVents/fluxCapacitors`、`hullMods/permaMods/sMods`、`weaponGroups[{mode(LINKED|ALTERNATING|...), weapons, autofire}]`、`wings`、`modules`。
- 势力要使用该船，把它加进对应 `.faction` 的 `knownShips`。

## 第 4 步 · 校验

- [ ] `ship_data.csv` 的 `id` 与 `.ship` 的 `hullId` 一致
- [ ] `spriteName` 图片存在（graphics/ships/）
- [ ] collisionRadius 圆包住全部槽位/引擎/护盾
- [ ] 槽位 `type` 是准入类别，与武器 CSV 的 `type` 匹配才能装武器
- [ ] 文件 UTF-8 无 BOM

## 备注

- 舰船编辑器只写 `.ship`，不会自动改 `ship_data.csv`——两处需分别维护。
- `hullSize`/`style` 是数据字段，不是 UI 风格。
