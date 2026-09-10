---
name: starsector-mod-create-commodity
description: 创建/编辑 Starsector（远行星号）mod 贸易商品（commodity）时使用。依据 DevTool 的 commodities.columns.json 逆向整理：在 data/campaign/commodities.csv 加一行（名称/ID/需求类别/基础价格/出口价值/价格波动/来源/标签/堆叠上限/货舱占用/图标/音效/排序/经济单位/插件）。商品是市场经济的交易标的，可作工业输入输出。ID 规则：字母/数字开头，可含 _ . -。全部文件 UTF-8 无 BOM。
---

# 创建贸易商品（Commodity）

目标：为 mod 新建一种可交易的货物（如新材料、新资源），供工业产出、市场流通。

## 第 1 步 · 文件位置

- `mods\<Mod>\data\campaign\commodities.csv`（表格编辑）

## 第 2 步 · 关键列

| 列 | 说明 |
|---|---|
| `name` / `id` | 名称 / 唯一 ID |
| `demand class` | 需求类别（如 ORGANICS、METALS 等，影响市场供需匹配） |
| `base price` | 基础价格 |
| `export value` | 出口价值 |
| `price variability` | 价格波动 |
| `utility` | 用途值（影响殖民地需求计算） |
| `origin` | 来源 |
| `tags` | 标签（供非法品/任务/市场引用） |
| `stack size` | 堆叠上限 |
| `cargo space` | 货舱占用 |
| `icon` | 图标（path-image） |
| `sound id` / `sound id drop` | 获取/丢弃音效 |
| `order` | 排序 |
| `economyTier`、`econUnit` | 经济层级 / 经济单位 |
| `plugin`、`desc` | 插件 / 描述 |

## 第 3 步 · 使用方式

- 工业（industries.csv）的 `data`/产出物引用商品 id；势力市场按供需自动流通。
- 作为违禁品：加进 `.faction` 的 `illegalCommodities`。

## 第 4 步 · 校验

- [ ] 行合法、UTF-8 无 BOM；`id` 唯一且符合 ID 规则
- [ ] `icon` 路径存在；`base price`/`stack size` 等数值合理
- [ ] 若被工业产出/消耗引用，确认 id 与 industries 的 data 一致

## 备注

- 商品在势力市场自动交易，无需额外脚本即可流通；要做"独特货币"一般用特殊物品（special item）而非普通商品。
