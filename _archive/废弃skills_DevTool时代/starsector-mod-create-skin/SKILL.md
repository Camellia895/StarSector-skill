---
name: starsector-mod-create-skin
description: 创建/编辑 Starsector（远行星号）mod 舰船皮肤（skin）时使用。依据 DevTool 的 skin.schema.json 与舰船皮肤编辑器逆向整理：在 data/hulls/skins/<skinHullId>.skin 写皮肤 JSON（skinHullId/baseHullId/hullName、标签与 hints 增删、数值覆盖 fleetPoints/ordnancePoints/baseValueMult 等、内置船插/武器/联队增删、武器槽与引擎槽变更、systemId/coversColor）。皮肤编辑器只写当前 .skin。ID 规则：字母/数字开头，可含 _ . -。全部文件 UTF-8 无 BOM。
---

# 创建舰船皮肤（Skin）

目标：在基础舰船（base hull）之上创建变体外观/配置（换色、换武器、换内置船插、改数值），共享同一 hull。

## 第 1 步 · 文件位置

- `mods\<Mod>\data\hulls\skins\<skinHullId>.skin`（JSON）

## 第 2 步 · 关键字段

| 分区 | 字段 |
|---|---|
| 基础 | `skinHullId`（必填，与文件名一致）、`baseHullId`（必填，源 `csv:ships.id`）、`hullName`、`hullDesignation`、`descriptionId`（源 `csv:descriptions.id`）、`descriptionPrefix`、`tech`、`spriteName`（path-image） |
| 标签与规则 | `tags`、`removeHints` / `addHints`（增删 ship hints）、`restoreToBaseHull`、`incompatibleWithBaseHull`（boolean） |
| 数值覆盖 | `fleetPoints`、`ordnancePoints`、`baseValueMult`（倍率）、`suppliesToRecover`、`suppliesPerMonth`、`fighterBays`、`maxSpeed`、`shieldEfficiency` |
| 插件 | `builtInMods` / `removeBuiltInMods`（增删内置船插，源 `csv:hullmods.id`） |
| 武器 | `builtInWeapons`（槽位ID→武器ID）、`removeBuiltInWeapons`、`removeWeaponSlots`、`weaponSlotChanges`（槽位变更：`{type(BALLISTIC|ENERGY|MISSILE|HYBRID|UNIVERSAL|SYNERGY|COMPOSITE|DECORATIVE|SYSTEM|STATION_MODULE|LAUNCH_BAY), size(SMALL|MEDIUM|LARGE), mount(TURRET|HARDPOINT|HIDDEN), angle, arc}`） |
| 联队 | `builtInWings`（源 `csv:wings.id`） |
| 系统与视觉 | `systemId`（源 `csv:shipSystems.id`）、`coversColor`（color-rgba） |
| 引擎槽 | `removeEngineSlots`、`engineSlotChanges`（`{style, length, width, angle}`） |

## 第 3 步 · 使用方式

- 游戏内皮肤会作为独立"船型"出现在市场/势力舰队（如 海盗版、余烬版）。
- 势力可用：加进 `.faction` 的 `knownShips.hulls` 或通过 ships CSV 标签。

## 第 4 步 · 校验

- [ ] `.skin` 为合法 JSON，UTF-8 无 BOM
- [ ] `skinHullId` 唯一且符合 ID 规则；`baseHullId` 存在于 ships CSV
- [ ] 变更的槽位 ID 在 base hull 的 `.ship` 中存在
- [ ] `spriteName` 图片存在；`systemId` 存在（若覆盖）
- [ ] 数值覆盖在合法范围（baseValueMult ≥ 0 等）

## 备注

- 皮肤编辑器只写当前 `.skin`，重命名/删除由后端连同文件处理。
- `weaponSlotChanges` 里 `DECORATIVE/SYSTEM/STATION_MODULE/LAUNCH_BAY` 是特殊槽类型，勿作普通武器槽新增。
