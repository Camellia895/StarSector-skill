---
name: starsector-mod-create-mission
description: 创建/编辑 Starsector（远行星号）mod 战役（campaign mission，独立剧情关卡）时使用。依据 DevTool 的 mission.schema.json 逆向整理：在 data/missions/mission_list.csv 注册一行（mission 列=战役 ID），在 data/missions/<mission>/descriptor.json 写标题/难度/图标/背景，同目录 mission_text.txt 写任务文本。战役 ID 同时是目录名。文件全部 UTF-8 无 BOM。注意：这是"独立战役"，与动态任务（person_missions）不同。
---

# 创建战役（Campaign Mission）

目标：为 mod 新建一个从主菜单直接进入的独立战役（类似原版 Tutorial/Corvus 等），含列表注册、描述文件与任务文本。

## 第 1 步 · 文件位置

```
mods\<Mod>\data\missions\mission_list.csv      # 战役列表（注册行）
mods\<Mod>\data\missions\<mission>\descriptor.json   # 战役描述
mods\<Mod>\data\missions\<mission>\mission_text.txt  # 任务文本
```

## 第 2 步 · 关键内容

| 文件 | 关键字段 |
|---|---|
| `mission_list.csv` | 列 `mission` = 战役 ID（必填，同时作为 `data/missions/` 下的目录名；**改它会改变保存目标目录**） |
| `descriptor.json` | `title`（标题）、`difficulty`（难度）、`icon`（图标，通常在 `data/missions/<mission>/`）、`background`（背景图） |
| `mission_text.txt` | 战役任务文本（纯文本） |

## 第 3 步 · 校验

- [ ] 三个文件齐全且 UTF-8 无 BOM
- [ ] `mission_list.csv` 已注册该 mission 行
- [ ] `descriptor.json` 的 icon/background 路径存在
- [ ] 战役 ID 唯一且符合 ID 规则

## 备注

- **区分**：DevTool 的 mission 指主菜单独立战役；游戏内由 NPC 发放的动态任务走 `data/campaign/person_missions.csv` + MissionPlugin（DevTool 不覆盖）。
- 战役内需要自定义星系/舰队时，在 descriptor 或战役脚本中引用你建好的 star system。
