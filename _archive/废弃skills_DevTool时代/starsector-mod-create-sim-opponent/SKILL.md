---
name: starsector-mod-create-sim-opponent
description: 创建/编辑 Starsector（远行星号）mod 战斗模拟器对手（sim opponent，模拟战里可选的敌方舰队）时使用。依据 DevTool 的 simOpponents.columns.json 逆向整理：在 data/campaign/sim_opponents.csv 加一行（variant id 引用装配）。模拟器对手 = 一个装配 variantId；游戏用该装配生成敌方舰队。全部文件 UTF-8 无 BOM。
---

# 创建模拟器对手（Sim Opponent）

目标：在战斗模拟器（Test Campaign 的模拟战）里新增一个可选敌方舰队。

## 第 1 步 · 文件位置

- `mods\<Mod>\data\campaign\sim_opponents.csv`（表格编辑）

## 第 2 步 · 关键内容

| 列 | 说明 |
|---|---|
| `variant id` | 引用装配（reference，源 `csv:variants.variantId`）——对手舰船由该装配决定 |

- 每一行 = 一个可选对手；可以只填一艘船，游戏会自动补足成一支小队。

## 第 3 步 · 前置

- 被引用的 `.variant` 必须存在（见 `starsector-mod-create-variant`），且其 hull 属于可部署舰船。

## 第 4 步 · 校验

- [ ] 行合法、UTF-8 无 BOM
- [ ] `variant id` 真实存在（variantId 匹配）
- [ ] （可选）加入 `sim_opponents_dev.csv` 可在开发/测试环境看到

## 备注

- 这是 DevTool 里列最少的表（仅一列引用）；模拟对手主要是测试便利，不参与正式战役。
