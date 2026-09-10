---
name: starsector-mod-create-hullmod
description: 创建/编辑 Starsector（远行星号）mod 舰船插件（hull mod，船插）时使用。依据 DevTool 的 hullmods.columns.json 逆向整理：在 data/hullmods/hull_mods.csv 加一行（名称/ID/等级/稀有度/标签/分舰级 OP 成本/脚本/描述/图标）；成本列 cost_frigate/cost_dest/cost_cruiser/cost_capital 控制不同舰级装配点消耗，unlocked/hidden/hiddenEverywhere 控制可见性，script 指向运行时脚本类。ID 规则：字母/数字开头，可含 _ . -。全部文件 UTF-8 无 BOM。
---

# 创建舰船插件（Hull Mod / 船插）

目标：为 mod 新建一个可安装/内置在舰船上的插件。

## 第 1 步 · 文件位置

- `mods\<Mod>\data\hullmods\hull_mods.csv`（表格编辑；无专用编辑器）

## 第 2 步 · 关键列

| 列 | 说明 |
|---|---|
| `name` / `id` | 名称 / 唯一 ID |
| `tier`、`rarity` | 等级 / 稀有度 |
| `tech/manufacturer` | 设计类型 |
| `tags`、`uiTags` | 标签（供势力 knownHullMods 与 UI 过滤引用） |
| `base value` | 基础价值 |
| `unlocked` | 是否默认解锁（boolean） |
| `hidden`、`hiddenEverywhere` | 隐藏 / 完全隐藏（boolean） |
| `cost_frigate` / `cost_dest` / `cost_cruiser` / `cost_capital` | 护卫舰/驱逐舰/巡洋舰/主力舰上的 OP 消耗（-1 或空表示该舰级不可装） |
| `script` | 插件运行时脚本类全限定名（实现 HullMod 效果的 Java/Janino 类） |
| `desc`、`short`、`sModDesc` | 描述 / 短描述 / 内置（S-mod）描述 |
| `sprite` | 图标（path-image，graphics/icons/hullsys/ 惯例） |

## 第 3 步 · 使用方式

- 直接装配：在 `.variant` 的 `hullMods` / `permaMods` / `sMods` 中引用该 id。
- 舰船自带：在 `.ship` 的 `builtInMods` 中引用；皮肤（`.skin`）可用 `builtInMods` / `removeBuiltInMods` 增删。
- 势力可用：加进 `.faction` 的 `knownHullMods`（按 tags 或具体 ID）。

## 第 4 步 · 校验

- [ ] `hull_mods.csv` 行为合法 CSV（`#` 开头行为注释），UTF-8 无 BOM
- [ ] `id` 唯一且符合 ID 规则
- [ ] 有 `script` 的插件确认脚本类真实存在；纯数值/纯描述插件可无脚本
- [ ] `sprite` 图标路径存在
- [ ] 至少一个舰级 OP 成本可装（否则该船插无处安装）

## 备注

- 船插的 `tags` 是势力/市场流通的关键，需要刷出的插件必须被某势力 known 或可购买。
- `sModDesc` 是内置强化版描述，可选。
