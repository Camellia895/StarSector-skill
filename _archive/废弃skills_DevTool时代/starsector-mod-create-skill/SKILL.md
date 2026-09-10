---
name: starsector-mod-create-skill
description: 创建/编辑 Starsector（远行星号）mod 角色技能（skill）时使用。依据 DevTool 的 skills.columns.json 逆向整理：在 data/characters/skills/skill_data.csv 加一行（ID/名称/排序/层级/所需点数/描述/作者/适用对象/标签/图标），可选在 data/characters/skills/<id>.skill 写扩展定义。combat officer/admiral/admin 三列决定技能出现在军官/指挥官/行政官面板。ID 规则：字母/数字开头，可含 _ . -。全部文件 UTF-8 无 BOM。
---

# 创建技能（Skill）

目标：为 mod 新建一个角色技能（军官/指挥官/行政官可用）。

## 第 1 步 · 文件位置

- `mods\<Mod>\data\characters\skills\skill_data.csv`（表格编辑）
- 可选扩展：`mods\<Mod>\data\characters\skills\<id>.skill`

## 第 2 步 · 关键列

| 列 | 说明 |
|---|---|
| `id` / `name` | 唯一 ID / 显示名称 |
| `order` | 排序（面板位置） |
| `tier` | 层级（技能树第几层） |
| `reqPoints` | 所需技能点数 |
| `reqPointsPerExtraSkill` | 每个额外技能需要的点数（精英化） |
| `description` | 描述文本 |
| `author` | 作者（可选） |
| `combat officer` / `admiral` / `admin` | boolean：军官 / 指挥官 / 行政官面板是否显示该技能 |
| `tags` | 标签（供势力教条 officerSkills/commanderSkills 与过滤引用） |
| `icon` | 图标（path-image） |

## 第 3 步 · 势力使用

- 在 `.faction` 的 `factionDoctrine.officerSkills` / `commanderSkills` 中按 id 引用，可让该势力军官优先学这些技能。

## 第 4 步 · 校验

- [ ] `skill_data.csv` 行合法、UTF-8 无 BOM
- [ ] `id` 唯一且符合 ID 规则
- [ ] 至少 `combat officer`/`admiral`/`admin` 之一为 true（否则无人可见）
- [ ] `icon` 路径存在；`tier`/`reqPoints` 与技能树设计一致

## 备注

- 技能的实际数值/效果由运行时脚本实现，CSV 只决定展示与树形结构；复杂技能需在 `.skill`/脚本中定义具体效果。
- DevTool 中 skills 表的 `rowSpecId` 取自 `id`。
