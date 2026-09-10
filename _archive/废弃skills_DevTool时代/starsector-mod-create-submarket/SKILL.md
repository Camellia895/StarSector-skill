---
name: starsector-mod-create-submarket
description: 创建/编辑 Starsector（远行星号）mod 子市场（submarket，市场内的特殊交易区）时使用。依据 DevTool 的 submarkets.columns.json 逆向整理：在 data/campaign/submarkets.csv 加一行（ID/名称/势力/描述/脚本/图标/排序）。子市场是市场内的独立交易区（如 黑市、武器店），可用脚本控制可交易物品——适合做"兑换页面"。ID 规则：字母/数字开头，可含 _ . -。全部文件 UTF-8 无 BOM。
---

# 创建子市场（Submarket）

目标：在市场内新增一个独立交易区（如 黑市、专属商店），可自定义可交易内容。

## 第 1 步 · 文件位置

- `mods\<Mod>\data\campaign\submarkets.csv`（表格编辑）

## 第 2 步 · 关键列

| 列 | 说明 |
|---|---|
| `id` | 唯一 ID |
| `name` | 名称 |
| `faction` | 所属势力（文本） |
| `desc` | 描述 |
| `script` | 子市场脚本类（**控制该市场的库存/交易规则**） |
| `icon` | 图标（path-image） |
| `order` | 排序 |

## 第 3 步 · 使用方式

- 在星球/空间站的市场 JSON 的 `submarkets` 数组里引用该子市场 id。
- **兑换页面**：用自定义子市场脚本 + 特殊物品货币，即可实现"用货币兑换奖品"（脚本控制买家只收超级货币、库存为奖品）。
- 也可以只做展示型子市场（无脚本）。

## 第 4 步 · 校验

- [ ] 行合法、UTF-8 无 BOM；`id` 唯一且符合 ID 规则
- [ ] `icon` 路径存在
- [ ] 有 `script` 时确认类存在；被市场 JSON 正确引用

## 备注

- 子市场脚本（SubmarketPlugin）是 0.9.8a 实现自定义交易的正式入口，比对话更省事地实现"兑换"。
- 只声明数据行不会自动出现在任何市场——必须被 market 定义引用。
