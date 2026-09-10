---
name: starsector-mod-create-ability
description: 创建/编辑 Starsector（远行星号）mod 舰队能力（ability，玩家可激活的舰队技能/行动）时使用。依据 DevTool 的 abilities.columns.json 逆向整理：在 data/campaign/abilities.csv 加一行（名称/ID/类型 campaign|combat/标签/激活与停用的天数与冷却/初始解锁/AI 默认/音乐抑制/UI 与世界音效/图标/插件/AI 脚本/描述/排序）。能力需要 plugin 类实现具体效果。ID 规则：字母/数字开头，可含 _ . -。全部文件 UTF-8 无 BOM。
---

# 创建舰队能力（Ability）

目标：为 mod 新建一个玩家可在舰队界面激活/停用的能力（如 超空间滑流、扫描等）。

## 第 1 步 · 文件位置

- `mods\<Mod>\data\campaign\abilities.csv`（表格编辑）

## 第 2 步 · 关键列

| 列 | 说明 |
|---|---|
| `name` / `id` | 名称 / 唯一 ID |
| `type` | `campaign`（战略地图）或 `combat`（战斗） |
| `tags` | 标签 |
| `activationDays` / `activationCooldown` | 激活所需天数 / 激活冷却 |
| `durationDays` | 持续天数 |
| `deactivationDays` / `deactivationCooldown` | 停用天数 / 停用冷却 |
| `unlockedAtStart` | 初始解锁（boolean） |
| `defaultForAIFleet` | AI 舰队默认使用（boolean） |
| `musicSuppression` | 音乐抑制 |
| `uiOn` / `uiOff` / `uiLoop` | UI 开关/循环音效 |
| `worldOn` / `worldOff` / `worldLoop` | 世界开关/循环音效 |
| `icon` | 图标（path-image） |
| `plugin` | 能力插件类（**实现实际效果，必填**） |
| `ai` | AI 脚本类（可选） |
| `desc` | 描述 |
| `sortOrder` | 排序 |

## 第 3 步 · 校验

- [ ] 行合法、UTF-8 无 BOM；`id` 唯一且符合 ID 规则
- [ ] `plugin` 类真实存在（能力无插件不生效）
- [ ] `icon` 路径存在；激活/冷却数值合理

## 备注

- 能力的效果全在 plugin 类里（Java/Janino），CSV 只声明激活参数与展示。
- 0.9.8a 原版能力可参考 `starsector-core\data\campaign\abilities.csv`。
