---
name: starsector-mod-create-market-condition
description: 创建/编辑 Starsector（远行星号）mod 市场条件/星球特色（market condition）时使用。依据 DevTool 的 marketConditions.columns.json 逆向整理：在 data/campaign/market_conditions.csv 加一行（名称/ID/标签/是否行星/去文明移除/脚本/描述/图标/排序）。星球特色、殖民地加成都是 market condition；脚本类实现实际效果（如行星改造、舰队规模加成）。ID 规则：字母/数字开头，可含 _ . -。全部文件 UTF-8 无 BOM。
---

# 创建市场条件 / 星球特色（Market Condition）

目标：为星球/殖民地添加一个可显示的特色（如"超级动员体系"），条件可带脚本实现实际游戏效果。

## 第 1 步 · 文件位置

- `mods\<Mod>\data\campaign\market_conditions.csv`（表格编辑）

## 第 2 步 · 关键列

| 列 | 说明 |
|---|---|
| `name` / `id` | 名称 / 唯一 ID |
| `tags` | 标签 |
| `planetary` | 是否行星条件（boolean；`TRUE` 表示天然星球条件） |
| `decivRemove` | 去文明时是否移除（boolean） |
| `script` | 条件脚本类全限定名（**实现实际效果；纯展示条件可留空**） |
| `desc` | 描述（显示在星球信息里） |
| `icon` | 图标（path-image，graphics/icons/markets/ 惯例） |
| `order` | 排序 |

## 第 3 步 · 附加到星球/市场

- 在 star system 的星球定义（`data/world/...` 星系 JSON）的 `conditions` 数组里加该条件 id，或在市场定义中 addCondition。
- **示例**："超级动员体系" = 新增一个 condition，脚本类里覆写 `apply`/`unapply`（如提高舰队规模乘数、修改 stability/accessibility 等）。

## 第 4 步 · 校验

- [ ] 行合法、UTF-8 无 BOM；`id` 唯一且符合 ID 规则
- [ ] `icon` 路径存在；`desc` 写清楚效果
- [ ] 有 `script` 时确认脚本类存在且实现 ConditionAPI

## 备注

- 星球特色 = market condition：DevTool 只覆盖 CSV 数据行；脚本效果（如"极大增加舰队规模"）需要 Java/Janino Condition 类，超出数据文件范围。
- 舰队规模效果通常通过脚本调 `market.getFaction().getDoctrine().setNumShips(...)` 或修改 fleet 生成参数实现。
