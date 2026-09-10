---
name: starsector-mod-create-projectile
description: 创建/编辑 Starsector（远行星号）mod 弹体（projectile/missile）时使用。依据 DevTool 的弹体编辑器与术语表逆向整理：在 data/weapons/proj/<id>.proj 写弹体规格；specClass=projectile 用 spawnType（BALLISTIC/BALLISTIC_AS_BEAM/ENERGY）+ bulletSprite，specClass=missile 用 missileType（MISSILE/ROCKET/MIRV/PHASE）+ sprite；共享字段如 collisionRadius、bounds、engineSpec、explosionSpec 按对象解释。ID 规则：字母/数字开头，可含 _ . -。全部文件 UTF-8 无 BOM。
---

# 创建弹体（Projectile）

目标：为一个武器创建子弹/导弹实体（`.proj`），供 `.wpn` 的 `projectileSpecId` 引用。

## 第 1 步 · 文件位置

- `mods\<Mod>\data\weapons\proj\<弹体ID>.proj`（JSON）
- 弹体 ID 规则同其它实体：`^[A-Za-z0-9][A-Za-z0-9_.-]*$`。

## 第 2 步 · 按 specClass 分支

| 分支 | 关键字段 |
|---|---|
| `specClass: "projectile"` | `spawnType`（`BALLISTIC/BALLISTIC_AS_BEAM/ENERGY`）、`bulletSprite`（贴图，graphics/missiles/）、`speed`、`damage`、`emp`、`lifetime` 等 |
| `specClass: "missile"` | `missileType`（`MISSILE/ROCKET/MIRV/PHASE`）、`sprite`、`engineSpec`（推进尾焰）、`explosionSpec`（爆炸效果）、`turnRate`、`maxSpeed` 等 |

## 第 3 步 · 共享字段（按对象解释）

- `collisionRadius`：命中判定半径；`bounds`：多边形边界
- 弹体的引擎位置字段常为 `loc`（区别于舰船的 `location`）
- `engineSpec` / `explosionSpec` 是对象编辑字段，按引擎/爆炸专用结构填写
- 颜色/尾焰：`fringeColor/coreColor` 等 RGBA 数组

## 第 4 步 · 校验

- [ ] `.proj` 为合法 JSON，UTF-8 无 BOM
- [ ] 被至少一个 `.wpn` 的 `projectileSpecId` 正确引用
- [ ] 贴图存在（projectile 的 bulletSprite、missile 的 sprite 均在 graphics/missiles/）
- [ ] 不要用默认对象掩盖缺失字段——缺少必填弹体参数会导致武器不可用

## 备注

- 弹体编辑器只写该 `.proj`，不反写武器或 CSV。
- `specClass` 的分支以后端/结构为准：`projectile` 与 `missile` 是两种正式形态，不可混用。
