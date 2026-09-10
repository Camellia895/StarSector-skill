---
name: starsector-mod-create-industry
description: 创建/编辑 Starsector（远行星号）mod 工业（industry，殖民地建筑）时使用。依据 DevTool 的 industries.columns.json 逆向整理：在 data/campaign/industries.csv 加一行（ID/名称/成本倍数/建造时间/收入/维护费/降级为/升级为/标签/数据/图标/插件/描述/排序/破坏危险度）。工业由 colony 建造，可产出商品、提供功能。ID 规则：字母/数字开头，可含 _ . -。全部文件 UTF-8 无 BOM。
---

# 创建工业（Industry）

目标：为 mod 新建一种殖民地建筑（如新工厂、新设施），可产出商品或提供殖民功能。

## 第 1 步 · 文件位置

- `mods\<Mod>\data\campaign\industries.csv`（表格编辑）

## 第 2 步 · 关键列

| 列 | 说明 |
|---|---|
| `id` / `name` | 唯一 ID / 名称 |
| `cost mult` | 建造成本倍数 |
| `build time` | 建造时间 |
| `income` | 收入（每周期） |
| `upkeep` | 维护费 |
| `downgrade` / `upgrade` | 降级为 / 升级为（引用其它工业 id，构成升级链） |
| `tags` | 标签（`industry` 等，供殖民地 AI 判断） |
| `data` | 数据（产出/消耗商品配置等，文本格式） |
| `image` | 图标（path-image） |
| `plugin` | 插件类（实现工业行为；有特殊逻辑时必填） |
| `desc` | 描述 |
| `order` | 排序 |
| `disruptDanger` | 破坏危险度 |

## 第 3 步 · 校验

- [ ] 行合法、UTF-8 无 BOM；`id` 唯一且符合 ID 规则
- [ ] `image` 存在；`upgrade/downgrade` 引用的工业 id 存在
- [ ] 有自定义产出/消耗时 `data` 格式正确（参照原版 industries.csv 写法）

## 备注

- 纯数值工业（无插件）可工作；需要特殊逻辑（如按星球条件变化）时用 `plugin` 类。
- 工业在 0.9.8a 中由市场/殖民地引用，标签 `industry` 通常不可少。
