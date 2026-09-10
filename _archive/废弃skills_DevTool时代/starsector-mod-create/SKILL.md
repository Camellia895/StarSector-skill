---
name: starsector-mod-create
description: 新建 Starsector（远行星号）mod 骨架时使用。要求：在 mods\<Mod>\ 建立本地 git 仓库、创建 mod_info.json（id/名称/作者/版本/依赖/modPlugin，UTF-8 无 BOM）、创建 changelog.txt（版本历史）、生成项目说明.md，并按 starsector-mod-delivery 的 AI 工作区要求建 mods\<Mod>\ai\skills 与 ai\脚本。默认用户环境与当前环境一致（游戏根 C:\game\StarSector.v0.9.8a-RC8，中文 Windows）。
---

# Starsector 新建 mod 骨架

目标：在 `mods\<Mod>\` 建立符合交付规范的新 mod 骨架——本地 git + mod_info.json + changelog.txt + 项目说明.md + ai 工作区。

## 第 1 步 · 基本信息确认

与用户确认并记录：

- **mod id**（ASCII 小写，如 `randnames_cn`）、**显示名**（中文，如 随机名汉化）；
- **作者**（社区网名，如 不拉屎将军）；
- 游戏版本（0.98a-RC8）、依赖（LunaLib/LazyLib/MagicLib…，含 id 与 name）、modPlugin 入口类、一句话描述。

目录命名 `mods\<显示名>\`（中文文件夹名在中文 Windows 下可用；启动器按 mod_info.json 的 id 识别，文件夹名不影响功能）。

## 第 2 步 · mod_info.json（UTF-8 无 BOM）

字段：`id`、`name`、`author`、`version{major,minor,patch}`、`description`、`gameVersion`、`modPlugin`、`dependencies[{id,name}]`。

- `modPlugin` 可为 `data.scripts.<Class>`（janino 运行时编译源码，无需 jar）或 `jars/<X>.jar`；
- 文件必须 UTF-8 无 BOM；用 JSON 解析校验（PS5.1 读取用 `-Encoding UTF8`，写入勿用 `Set-Content -Encoding UTF8`（会带 BOM）——用无 BOM 编码写回）。

## 第 3 步 · changelog.txt（UTF-8 无 BOM）

- 顶部：mod 名 + 说明行（游戏版本/依赖/设置页入口）；
- 首条为当前版本（如 `【v1.0.0】<日期>`）+ 要点；以后每次改动在顶部追加新版本；
- 格式参考《随机名汉化》mod 的 changelog.txt（`mods\随机名汉化\changelog.txt`）。

## 第 4 步 · 本地 git

- `git init`；写 `.gitignore`（`Thumbs.db`/`desktop.ini`/`*.bak`/`*.bak_*`/`*.orig`/`*.rej`/`.idea/`/`*.iml`；**不要忽略交付所需内容**如 data/、ai/、changelog.txt、项目说明.md）；
- 确认 `git config user.name/email` 已配置（未配置则 `git config --global user.name "<网名>"` 等）；
- `git add -A && git commit -m "<版本>：初始骨架"`——提交消息文件用**无 BOM UTF-8**（PS5.1 `Set-Content` 会写 BOM，改用无 BOM 编码或交由编辑器写入）。

## 第 5 步 · 项目说明.md + AI 工作区

- `项目说明.md`：功能一句话、基本信息（id/名称/版本/依赖/插件入口）、目录结构树、用户可编辑配置说明、常见操作表（启用/校验/测试/重新打包/git）；如有改名历史另加「改名记录与可能的问题」。
- `ai\skills\`：放置本 mod 用到的 skill 完整目录（如 `starsector-mod-create`、`starsector-mod-delivery`、`starsector-mod-localization`）。
- `ai\脚本\`：放置本项目的脚本/工具（校验、翻译、打包、测试等）。

## 校验清单（交付前必做）

- [ ] mod_info.json 存在、UTF-8 无 BOM、可解析，author/version/依赖正确
- [ ] changelog.txt 存在且含当前版本条目
- [ ] 本地 git 仓库存在、工作树干净、最近提交包含骨架
- [ ] `ai\skills\` 与 `ai\脚本\` 存在（均在 ai\ 下）
- [ ] 项目说明.md 与实际结构一致
- [ ] 骨架完成后按 starsector-mod-delivery 打包交付
