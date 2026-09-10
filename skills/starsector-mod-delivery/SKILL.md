---
name: starsector-mod-delivery
description: Starsector（远行星号）mod 完成汉化或修复后的交付打包——四项准备（①结构介绍文件 项目说明.md ②AI 工作区 ai\skills 与 ai\脚本，汉化 mod 另加 ai\en + ai\zh 中英对照语料与 README_汉化说明.md ③本地 git 仓库并提交 ④deliver.ps1 打包 zip）与交付前验证清单。zip 名取 mod_info.json 中文名（自动清洗 Windows 非法字符），内部嵌套一个 mod 文件夹，自动排除 .git/out/源码等开发残留，空目录写目录条目保结构，条目名 UTF-8。默认用户环境与当前环境一致（游戏根 C:\game\StarSector.v0.9.8a-RC8，中文 Windows）。
---

# 交付打包

**职责**：把 `mods\<Mod>\` 变成可交付的 zip，且包内**自带协作者/AI 需要的上下文**。
**调用方**：`wf-localize.md`、`wf-translate-update.md`、`wf-game-update.md` 的最后一步。
**必读**：`<skills>\shared\env.md`、`<skills>\shared\conventions.md`（产物留档位置）。

## 1. 结构介绍文件

每个 mod 目录必须包含 `项目说明.md`（或 `README.md`），向协作者/AI 说明：

- mod 功能一句话 + `mod_info` 关键信息（id/名称/版本/依赖/插件入口）；
- 目录结构树（`data/`、`graphics/`、`jars/`、`sounds/` 等，逐项注明作用）；
- 用户可编辑的配置/数据文件说明；
- 常见操作表（启用、更新、重新打包、git）。

**缺失时**：用模板 `<skills>\skills\starsector-mod-delivery\templates\项目说明.md` 复制到 mod 根并按实际结构改写（去掉占位符）。
**已有但过时**：按实际结构修订（版本号、依赖、新增文件）。

## 2. AI 工作区（`ai\` 下）

| 目录 | 内容 |
|---|---|
| `ai\skills\` | 本 mod 开发/维护用到的 skill（完整目录：`SKILL.md` + `scripts/` 等）。从 `<skills>\skills\` 复制需要的若干个 |
| `ai\脚本\` | 本项目的脚本/工具（校验、翻译、打包、测试），从 `_work\mod_work\<Mod>\tools\` 复制 |
| `ai\en\` + `ai\zh\` | **汉化对照语料**（做过汉化时推荐必带）：`en` 纯英文原文、`zh` 对应译文，条目逐条对齐（含 `file`/`id`/`field`/`en`/`zh` 定位与 `note` 上下文；jar 常量用 `c` 键） |
| `ai\README_汉化说明.md` + 术语表 | 决策记录（有意不沿用/有意修正）、术语表快照（来源 = `<skills>\shared\glossary.md`） |

语料来源 = `-extract` 产出的 `worklist_*.json`（已填），整体复制入包，供协作者/AI 审校对照、后续版本复用术语与句式。
纯数据类汉化可只带 en/zh 清单；若同时有 jar 补丁，jar 映射条目（`c`→`zh`）同样归档。

## 3. 本地 git

- 仓库不存在 → `git init`，写 `.gitignore`（`Thumbs.db`/`desktop.ini`/`*.bak`/`.idea/` 等杂项；**不要忽略交付所需内容**）。
- 每次交付前 → `git add -A && git commit -m "<版本号>：<改动摘要>"`，工作树干净。
- 报 `Author identity unknown` → 先 `git config user.name/email`。
- 用户明确不需要版本管理时跳过，并在交付说明中注明。

## 4. 打包

```powershell
powershell -ExecutionPolicy Bypass -File "<skills>\skills\starsector-mod-delivery\scripts\deliver.ps1" `
    -ModPath C:\game\StarSector.v0.9.8a-RC8\mods\<Mod>
```

产出：`<game>\_work\deliver\<Mod中文名>.zip`，解压后顶层是文件夹 `<Mod中文名>\`。

| 参数 | 默认 | 说明 |
|---|---|---|
| `-ModPath` | 当前目录 | mod 目录（须含 `mod_info.json`） |
| `-OutDir` | `<游戏根>\_work\deliver\` | 输出目录；自动从 ModPath 中 `\mods\` 推断游戏根 |
| `-Name` | `mod_info` 的 name | 覆盖压缩包名 |
| `-InnerName` | = 压缩包名 | 覆盖内部文件夹名（可设英文 id，如 `-InnerName Templars`） |
| `-IncludeSrc` | 关 | 保留任意层级 `src` 源码目录 |
| `-NoExclude` | 关 | 完全不过滤（含 `.git`） |

**行为细节**：压缩包名读 `mod_info.json` 的 `name`（UTF-8 显式读取）并清洗 `\/:*?"<>|` 与首尾空白/点，为空回退 `id`；
所有条目写入 `<内部文件夹名>/<相对路径>`；排除 `.git`/`.idea`/`out`/`cache`/`build`/`dist`、任意层级 `src`、
`*.iml`/`*.bak`/`*.orig`/`*.rej`/`Thumbs.db`/`desktop.ini`（**`data\scripts\` 是运行时代码，不排除**）；
空目录写目录条目保结构；`mod_info.json` 读取时容忍 `#` 注释与尾随逗号（**zip 内保留原文件**）；
条目名 UTF-8（别用会写 ANSI 条目名的老工具二次打包）；重复运行覆盖旧 zip。

## 5. 交付前验证清单

- [ ] 结构介绍文件存在，内容与实际结构/版本/依赖一致
- [ ] `ai\skills\`、`ai\脚本\` 齐；汉化 mod 另有 `ai\en\`、`ai\zh\`、`README_汉化说明.md`、术语表
- [ ] git 仓库干净，最近提交含本次改动（不需要版本管理则注明）
- [ ] 解压 zip 到临时目录：顶层**只有一个文件夹**，内容与 `mods\<Mod>\`（除排除项外）一致
- [ ] `mod_info.json` 在 zip 内且 **UTF-8 无 BOM**，中文名/描述正常
- [ ] zip 文件名是清洗后的中文名，无非法字符
- [ ] `jars\*.jar`、`data\`、`graphics\`、`sounds\` 齐全
- [ ] `dependencies` 或说明文档已注明前置（zip 只装 mod 本体）
- [ ] （可选）放入 `mods\` 用启动器启用，确认列表显示中文名
- [ ] 汉化 mod 另需：`starsector-mod-localization-verify` 的 G2/G3（动过 jar 则加 G4/G5）已通过

## 6. 常见问题

- **`mod_info.json` 读出来乱码**：文件是 UTF-8，用脚本默认方式（显式 UTF-8）读，别用 `Get-Content` 默认编码。
- **脚本中文摘要乱码**：`deliver.ps1` 必须 **UTF-8 带 BOM**（PS 5.1 对无 BOM 的 `.ps1` 按 ANSI 读）；
  用编辑器改过脚本后检查开头是否为 `EF BB BF`，丢失则补回。
- **zip 名含 `[ ]` 时删旧包报 "already exists"**：PowerShell `-Path` 把 `[]` 当通配符；脚本已用
  `[System.IO.File]::Exists` + `Remove-Item -LiteralPath` 规避。
- **想要英文内部文件夹**：社区惯例是英文 id 文件夹（`-InnerName Templars`），压缩包名仍可用中文。
- **反编译/解包中间产物被打进包**：确保分析产物落在 `_work\_tmp\`，不放 mod 目录（`starsector-jar-decompile`）。
