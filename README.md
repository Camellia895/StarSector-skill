# 这是不拉屎将军更新/迁移/汉化用的skill

Starsector 模组开发技能库：`skills` / `workflows` / `shared` 台账。

## 下载

[![下载](https://img.shields.io/github/v/release/Camellia895/StarSector-skill?style=for-the-badge&label=%E4%B8%8B%E8%BD%BD&color=2ea44f)](https://github.com/Camellia895/StarSector-skill/releases/latest) [![下载次数](https://img.shields.io/github/downloads/Camellia895/StarSector-skill/total?style=for-the-badge&label=%E4%B8%8B%E8%BD%BD%E6%AC%A1%E6%95%B0&color=2ea44f&labelColor=555)](https://github.com/Camellia895/StarSector-skill/releases)

- **最新 Release 页面**（推荐）：<https://github.com/Camellia895/StarSector-skill/releases/latest>
- **直接下载压缩包**（永久稳定链接，始终指向最新版）：
  <https://github.com/Camellia895/StarSector-skill/releases/latest/download/StarSector-skill-latest.zip>

> 该链接的文件名固定为 `StarSector-skill-latest.zip`，不随版本变化，因此**永远无需更新**。
>
> 发新版时请照做：除了带版本号的压缩包（如 `StarSector-skill-v2026.10.01.zip`），
> **再上传一份内容相同、名字固定为 `StarSector-skill-latest.zip` 的附件**。
> 两者内容一致即可；只要最新 Release 里存在这个固定名附件，上面的链接就不会失效。

## 内容

| 目录 | 内容 |
|---|---|
| `skills\` | 执行层 skill（每个含 `SKILL.md`） |
| `workflows\` | 任务流程（`wf-*.md`，写清步骤、闸门、产出） |
| `shared\` | 共享台账：环境、铁律、术语表、脚本登记表、验证账本 |
| `reference\` | SSTLib API 文档等参考资料 |
| `notes\`、`_archive\` | 用户注释与归档（只归档不删除） |

## 入口

先读 `00-索引.md` —— 它是唯一入口，给出「任务分类 → 该读哪个 wf → 该读哪几个 skill」的加载顺序，
避免通读整个 `skills\` 目录。

因此你只需要和ai说，参照.\_work\skills 汉化/汉化迁移/更新 .\mods\..

## 许可

Copyright (C) 2026 Camellia895

本仓库以 **GNU General Public License v3.0 or later** 授权发布，全文见 `LICENSE`。

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
