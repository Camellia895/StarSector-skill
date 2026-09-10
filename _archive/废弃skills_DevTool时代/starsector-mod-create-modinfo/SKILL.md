---
name: starsector-mod-create-modinfo
description: 创建/编辑 Starsector（远行星号）mod 的 mod_info.json 时使用。依据 DevTool 的 mod-info.schema.json 逆向整理：id/name/author/version/gameVersion/description/modPlugin/jars/dependencies/totalConversion/utility/replace。version 支持字符串或 {major,minor,patch} 对象；dependencies 是 {id,name,version} 数组；totalConversion 会排斥一切非工具类 Mod。文件必须 UTF-8 无 BOM。改 id 会导致存档不兼容。
---

# 创建/编辑 mod_info.json

目标：编写或修改 mod 的入口元数据文件（启动器识别、依赖声明、插件入口都靠它）。

## 第 1 步 · 文件位置

- `mods\<Mod>\mod_info.json`（mod 根目录）

## 第 2 步 · 字段速查

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Mod 唯一标识（必填；**改 ID 会导致存档不兼容**） |
| `name` | string | 显示名称（必填） |
| `author` | string | 作者 |
| `version` | string 或 object | `"1.0.0"` 或 `{"major":1,"minor":0,"patch":0}`（必填） |
| `gameVersion` | string | 适用游戏版本，如 `"0.9.8a"`（必填） |
| `description` | text | 启动器里显示的简介 |
| `modPlugin` | string | 主插件类全限定名（Java class path；可以是 `data.scripts.<Class>` 的 janino 源码类或 jar 内类） |
| `jars` | string[] | 需加载的 jar 路径（相对 mod 根，如 `jars/<X>.jar`） |
| `dependencies` | object[] | `[{id, name?, version?}]`，id 必填（如 lunalib、lazylib） |
| `totalConversion` | boolean | 完全独立 Mod：**会禁用一切非工具类 Mod**（慎用） |
| `utility` | boolean | 工具类 Mod（可与完全独立 Mod 共存） |
| `replace` | string[] | 完全替换（而非合并）的文件路径列表；会覆盖原版内容，易与其他 Mod 冲突 |

## 第 3 步 · 校验

- [ ] UTF-8 无 BOM、JSON 可解析（游戏风格 JSON 容忍 `#` 注释与尾逗号，但建议标准 JSON）
- [ ] `id` 符合 `^[A-Za-z0-9][A-Za-z0-9_.-]*$`
- [ ] `gameVersion` 与目标游戏一致；依赖 id 与名称正确
- [ ] 有 `modPlugin`/`jars` 时确认类/jar 路径真实存在

## 备注

- 新建 mod 的骨架流程见 `starsector-mod-create`（含 git/changelog/项目说明）。
- DevTool 中 mod_info 用 schema 表单编辑，未知字段保留（extraFields）。
