---
name: starsector-mod-create-description
description: 创建/编辑 Starsector（远行星号）mod 描述文本（description，舰船/武器/势力/星球等百科文本）时使用。依据 DevTool 的 descriptions.columns.json 逆向整理：在 data/strings/descriptions.csv 加一行（ID/类型/文本1-5/备注）。类型枚举：ACTION_TOOLTIP/ASTEROID/CUSTOM/FACTION/GALLERY/PLANET/RESOURCE/SHIP/SHIP_SYSTEM/TERRAIN/WEAPON。舰船皮肤等通过 descriptionId 引用。全部文件 UTF-8 无 BOM。
---

# 创建描述文本（Description）

目标：为舰船、武器、势力、星球、战术系统等实体提供百科/悬停文本。

## 第 1 步 · 文件位置

- `mods\<Mod>\data\strings\descriptions.csv`（表格编辑）

## 第 2 步 · 关键列

| 列 | 说明 |
|---|---|
| `id` | 唯一 ID（如舰船 `SHIP_x`、武器 `WEAPON_x` 惯例） |
| `type` | 类型：`ACTION_TOOLTIP/ASTEROID/CUSTOM/FACTION/GALLERY/PLANET/RESOURCE/SHIP/SHIP_SYSTEM/TERRAIN/WEAPON` |
| `text1` ~ `text5` | 多段文本（具体使用哪段看实体类型；`FACTION` 通常用 text1 等） |
| `notes` | 备注 |

## 第 3 步 · 使用方式

- 舰船/皮肤：`.ship`/`.skin` 的 `descriptionId` 指向此 id（皮肤 schema 里有 `descriptionId` 列）。
- 势力：`.faction` 通过对应机制引用；武器/战术系统同理。

## 第 4 步 · 校验

- [ ] 行合法、UTF-8 无 BOM；`id` 唯一且符合 ID 规则
- [ ] `type` 与引用方匹配（舰船文本用 SHIP 类型等）
- [ ] 被引用实体的 descriptionId 与该行 id 一致

## 备注

- 中文 mod 直接写中文文本即可；文本内换行用 CSV 引号包裹。
- 0.9.8a 原版描述可参考 `starsector-core\data\strings\descriptions.csv`。
