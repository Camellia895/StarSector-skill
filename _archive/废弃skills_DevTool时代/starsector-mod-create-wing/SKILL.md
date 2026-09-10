---
name: starsector-mod-create-wing
description: 创建/编辑 Starsector（远行星号）mod 战机联队（wing）时使用。依据 DevTool 的 wings.columns.json 逆向整理：在 data/hulls/wing_data.csv 加一行（ID/引用装配 variant/标签/级别/舰队点/装配点/阵型/作战范围/数量/角色/整备时间/价值）。联队依赖一个引用战斗机 hull 的 .variant；舰船用 fighter bays 放联队，势力用 knownFighters 获取。ID 规则：字母/数字开头，可含 _ . -。全部文件 UTF-8 无 BOM。
---

# 创建战机联队（Wing）

目标：为 mod 新建一个战机联队（战斗机/轰炸机编队）。

## 第 1 步 · 文件位置

- `mods\<Mod>\data\hulls\wing_data.csv`（表格编辑）

## 第 2 步 · 关键列

| 列 | 说明 |
|---|---|
| `id` | 联队唯一 ID |
| `variant` | 引用装配（reference，源 `csv:variants.variantId`）——联队由战机 hull 的装配定义 |
| `tags` | 标签（供势力 knownFighters/priorityFighters 引用） |
| `tier`、`rarity`、`fleet pts`、`op cost` | 级别 / 稀有度 / 舰队点 / 装配点 |
| `formation` | 阵型 `CLAW/V/BOX/DIAMOND/WALL` |
| `range`、`attackRunRange`、`attackPositionOffset` | 作战范围 / 攻击距离 / 攻击位置偏移 |
| `num` | 联队飞机数量 |
| `role` | 角色 `FIGHTER/INTERCEPTOR/BOMBER/ASSAULT/SUPPORT`，配 `role desc` 文本 |
| `refit` | 整备（重新装填/修复）时间 |
| `base value` | 基础价值 |

## 第 3 步 · 前置：战机装配

- 联队的 `variant` 必须指向一个装配，其 `hullId` 是一艘 `hullSize=FIGHTER` 的舰船（见 starsector-mod-create-ship / starsector-mod-create-variant）。

## 第 4 步 · 使用方式

- 舰船：`ship_data.csv` 的 `fighter bays` > 0，且 `.ship` 的 `builtInWings` 或 `.variant` 的 `wings` 引用联队 id。
- 势力：加进 `.faction` 的 `knownFighters`（按 tags 或具体 ID），可选 `priorityFighters`。

## 第 5 步 · 校验

- [ ] `wing_data.csv` 行合法、UTF-8 无 BOM
- [ ] `variant` 存在且其 hull 是战斗机（hullSize=FIGHTER）
- [ ] `id` 唯一且符合 ID 规则
- [ ] `num`、`role`、`formation` 与装配武器匹配（轰炸机应带炸弹/鱼雷）

## 备注

- 联队不直接引用武器，武器在战机的 `.variant` 里配。
- `attackRunRange` 等 AI 行为参数可按角色微调。
