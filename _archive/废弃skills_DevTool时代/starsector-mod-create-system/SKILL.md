---
name: starsector-mod-create-system
description: 创建/编辑 Starsector（远行星号）mod 舰船战术系统（ship system）时使用。依据 DevTool 的 shipSystems.columns.json 逆向整理：在 data/shipsystems/ship_systems.csv 加一行（名称/ID/幅能消耗/次数/渐入渐出/冷却/切换/各类禁止标记/相位旗标/标签/图标），复杂效果可选在 data/shipsystems/<id>.system 写扩展定义。舰船在 ship_data.csv 的 system id 列引用它。ID 规则：字母/数字开头，可含 _ . -。全部文件 UTF-8 无 BOM。
---

# 创建战术系统（Ship System）

目标：为 mod 新建一个舰船战术系统（如加速、相位、护盾强化的按键技能）。

## 第 1 步 · 文件位置

- `mods\<Mod>\data\shipsystems\ship_systems.csv`（表格编辑）
- 可选扩展：`mods\<Mod>\data\shipsystems\<id>.system`（战术系统编辑器写）

## 第 2 步 · 关键列

| 列 | 说明 |
|---|---|
| `name` / `id` | 名称 / 唯一 ID |
| `flux/second`、`flux/use` | 持续幅能 / 每次幅能（另有基础倍率/上限列 `f/s (base rate)`、`f/s (base cap)`、`f/u (base rate)`、`f/u (base cap)`） |
| `cr/u` | 每次使用 CR 消耗 |
| `max uses`、`regen` | 最大使用次数 / 使用次数恢复 |
| `charge up`、`active`、`down`、`cooldown` | 渐入 / 持续 / 渐出 / 冷却（秒） |
| `toggle` | 是否切换型（boolean） |
| `noDissipation`、`noHardDissipation`、`hardFlux` | 幅能行为：禁耗散 / 禁硬幅能消散 / 产硬幅能 |
| `noFiring`、`noTurning`、`noStrafing`、`noAccel`、`noShield`、`noVent` | 使用期间禁止开火/转向/横移/加速/护盾/排幅 |
| `isPhaseCloak` | 相位隐身（boolean） |
| `tags`、`icon` | 标签 / 图标 |

## 第 3 步 · 舰船引用

- 在 `data/hulls/ship_data.csv` 的 `system id` 列填该系统 id，舰船即可使用。

## 第 4 步 · 校验

- [ ] `ship_systems.csv` 行合法、UTF-8 无 BOM
- [ ] `id` 唯一且符合 ID 规则
- [ ] `icon` 存在；`charge up/active/down/cooldown` 数值合理（0 表示无该阶段）
- [ ] 有脚本效果时确认 `.system`/脚本类真实存在

## 备注

- 纯数值系统（无脚本）也能工作：游戏按上述列驱动幅能/禁用/冷却行为。
- 战术系统编辑器只显示/保存当前 type 合法的字段，未知内容按正式结构保留。
