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

## 2026-09 大更新

本轮把「**先真跑一遍游戏**」做成了标准收尾关口，并沉淀了配套的修复循环与升级审计脚本。

### 自动冒烟测试工作流（本地测试 mod 用）

改了 mod 文件之后，**先花约 1 分钟自动跑一遍游戏**，PASS 之后才做几十个闸门的全量校验。

```powershell
# 只验证能否加载到主菜单（约 40 秒）
powershell -NoProfile -ExecutionPolicy Bypass -File .\shared\scripts\smoke_run.ps1 -ModIds <modId>

# 推荐：加载 + 自动创建生涯存档（约 1 分钟，能暴露战役期错误）
powershell -NoProfile -ExecutionPolicy Bypass -File .\shared\scripts\smoke_run.ps1 -ModIds <modId> -NewGame
```

`smoke_run.ps1` 一条命令内部做完四件事，**你不用分别调用**：

1. 改写 `enabled_mods.json`，只启用目标 mod（自动补上它声明的依赖）
2. 启动游戏并等到主菜单（加 `-NewGame` 则继续走完角色创建，建出 `save_autotest_*`）
3. 关闭游戏，**并恢复你自己原来的 mod 列表**
4. 跑日志指纹扫描，只输出 **6–10 行**摘要

输出长这样（**不需要去读几十 MB 的 `starsector.log`**）：

```
判定: PASS   FATAL=0  ERROR=26  (文件 41.2 MB，未整篇读入)
未命中任何致命指纹。
== 烟测结果: PASS ==  原因: 加载成功
```

**退出码**（与 `run_check.js` 约定一致，便于记账）：
`0`=PASS / `1`=FAIL / `2`=环境不满足 / `3`=超时 / `4`=崩溃

**配套文件**

| 文件 | 作用 |
|---|---|
| `workflows\wf-smoke-first.md` | 烟测先行流程（任务分类⓪，所有改动的收尾关口） |
| `shared\scripts\smoke_run.ps1` | 一条命令跑完启动→判定→极简输出 |
| `shared\scripts\smoke_scan.js` | 日志指纹扫描：把日志压成「指纹名 + 行号」，并指回铁律 R# 与该跑的闸门 |
| `workflows\wf-mod-fix.md` | 烟测驱动的修复循环（分类⑦）：失败驱动 → 定因 → 一次一处最小修复 → 重测到 PASS |

失败时：看输出的指纹 → 到 `wf-launch-audit.md` §1 查表拿根因与闸门 → 只跑那一个闸门定位 → 修 → **重跑烟测**。
若判定问题**不是本次改动引入的**（文件时间戳仍是作者原始时间戳），转 `wf-mod-fix.md` 走修复循环。

### 其他新增

- **修复循环 `wf-mod-fix.md`**（分类⑦）：烟测驱动的 mod 修复，含归属判定、时间戳法与最小修复手法。
- **API 引用审计**：`extract_api_refs.js` + `ApiRefCheck.java`，全量审计 jar 对 API 的方法/字段引用（含返回类型描述符）。
- **变体槽位检查**：`check_variant_slots.js`，查变体槽位 × 船体 `weaponSlots`（原版船重做后的幽灵槽）。
- **jar 代码修复保汉化**：`java-hardcoded-text` §5 重编译方法 + `dump_utf8.js` / `diff_utf8_multiset.js` / `cmp_build.js` 三个闸门脚本。
- **汉化流程**：交付契约（给译者的文件 ≤10 份）、新增 `mod_info` / `changelog` 汉化、`worklist\zh\` 回传规则。

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
