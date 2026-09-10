---
name: starsector-mod-create-variant
description: 创建/编辑 Starsector（远行星号）mod 舰船装配（variant）时使用。依据 DevTool 的 variant.schema.json 与装配编辑器逆向整理：在 data/variants/<variantId>.variant 写装配 JSON（variantId/hullId/displayName、fluxVents/fluxCapacitors、hullMods/permaMods/sMods、weaponGroups 武器组、wings 联队、modules 模块、autofit 质量参数）。装配编辑器只写当前 .variant，路径与 ID 由后端校验。ID 规则：字母/数字开头，可含 _ . -。全部文件 UTF-8 无 BOM。
---

# 创建舰船装配（Variant）

目标：为某艘舰船（或战机 hull）创建一套完整装配，供游戏刷新舰队/玩家购买时使用。

## 第 1 步 · 文件位置

- `mods\<Mod>\data\variants\<variantId>.variant`（JSON）

## 第 2 步 · 关键字段

| 字段 | 说明 |
|---|---|
| `variantId` | 装配唯一 ID（与文件名一致；必填） |
| `hullId` | 所属舰船（reference，源 `csv:ships.id`；必填） |
| `displayName` | 显示名（如 "突击型"）；`goalVariant`（boolean）标记 AI 目标装配 |
| `fluxVents` / `fluxCapacitors` | 散热器 / 电容数量（整数 ≥0） |
| `hullMods` / `permaMods` / `sMods` | 已装船插 / 永久船插 / 内置强化船插（ID 列表，源 `csv:hullmods.id`） |
| `weaponGroups` | 武器组数组：每项 `{mode(LINKED|ALTERNATING|LINKED_GROUP|ALTERNATING_GROUP), weapons(槽位ID→武器ID), autofire}` |
| `wings` | 联队 ID 列表（源 `csv:wings.id`） |
| `modules` | 模块舰：`{模块槽位ID: 子装配variantId}` |
| `quality` / `weaponQuality` / `fighterQuality` | 自动装配质量（0-1，step 0.05），配 `doctrine{warships,carriers,phaseShips,officerQuality}` |

## 第 3 步 · 使用方式

- 游戏自动生成舰队时按势力教条挑 variant；自定义舰队/任务可在 rules/脚本中引用 `variantId`。
- 势力 `shipRoles` 可按角色（combatSmall 等）指定装配权重。
- 战机联队（wing）的 `variant` 列引用战斗机 hull 的装配。

## 第 4 步 · 校验

- [ ] `.variant` 为合法 JSON，UTF-8 无 BOM
- [ ] `variantId` 唯一且符合 ID 规则；`hullId` 存在于 ships CSV
- [ ] 武器组槽位 ID 在 `.ship` 的 `weaponSlots` 中存在；武器 ID 存在于 weapons CSV
- [ ] 船插/联队 ID 真实存在
- [ ] `fluxVents + fluxCapacitors` 不超过装配点预算（游戏会在超配时提示）

## 备注

- 装配编辑器只写当前 `.variant`，重命名会连同文件路径一起由后端处理。
- 首行列表显示 `ships.name · variant.displayName`；无 displayName 时显示 hull 名。
