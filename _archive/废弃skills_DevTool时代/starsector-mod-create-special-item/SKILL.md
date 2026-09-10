---
name: starsector-mod-create-special-item
description: 创建/编辑 Starsector（远行星号）mod 特殊物品（special item）时使用。依据 DevTool 的 specialItems.columns.json 逆向整理：在 data/campaign/special_items.csv 加一行（名称/ID/标签/设计类型/稀有度/基础价格/堆叠数量/货舱占用/袭击风险/图标/拾取与丢弃音效/插件/插件参数/描述/排序）。特殊物品是任务奖励/独特货币/收藏品的载体，也可用 plugin 实现独特行为。ID 规则：字母/数字开头，可含 _ . -。全部文件 UTF-8 无 BOM。
---

# 创建特殊物品（Special Item）

目标：为 mod 新建一种独特物品（AI 核心类、任务奖励、或自定义"货币"载体）。

## 第 1 步 · 文件位置

- `mods\<Mod>\data\campaign\special_items.csv`（表格编辑）

## 第 2 步 · 关键列

| 列 | 说明 |
|---|---|
| `name` / `id` | 名称 / 唯一 ID |
| `tags` | 标签 |
| `tech/manufacturer` | 设计类型 |
| `rarity` | 稀有度（文本） |
| `base price` | 基础价格 |
| `stack size` | 堆叠数量 |
| `cargo space` | 货舱占用 |
| `baseRaidDanger` | 袭击风险 |
| `icon` | 图标（path-image） |
| `sound id` / `sound id drop` | 拾取 / 丢弃音效 |
| `plugin` / `plugin params` | 插件类 / 插件参数（特殊行为时用） |
| `desc` | 描述 |
| `order` | 排序 |

## 第 3 步 · 使用方式

- 任务奖励：由任务/对话脚本往玩家货舱添加该物品（addSpecial）。
- **自定义货币**：可用特殊物品充当"超级货币"载体（玩家持有数量 = 货币余额），配合自定义对话/兑换页面读写数量。
- 蓝图/收藏品：加进势力或市场流通。

## 第 4 步 · 校验

- [ ] 行合法、UTF-8 无 BOM；`id` 唯一且符合 ID 规则
- [ ] `icon` 路径存在（graphics/icons/ 惯例）
- [ ] 有 `plugin` 时确认类存在

## 备注

- 特殊物品天然可堆叠、可入货舱、可被脚本读取数量——是实现"独特货币 + 兑换"的最简载体（见对话/兑换类脚本知识）。
