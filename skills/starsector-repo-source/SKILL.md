---
name: starsector-repo-source
description: 为 Starsector（远行星号）mod 汉化/分析准备"上游源码基线"的标准流程：gh CLI 创建 fork → 网络诊断（github.com:443 常被阻断，而 api/codeload/raw 域名可用）→ 经官方 codeload tarball 离线下载到 _work\mod_src\<Mod> → 本地 git 化（import 提交 + origin 远程）→ 与已安装 mod 版本一致性校验（含解包逐条目哈希）→ 供汉化提取、汉化迁移、版本升级、引擎诊断共用。默认用户环境与当前环境一致（游戏根 C:\game\StarSector.v0.9.8a-RC8，gh/git 已登录 Camellia895，网络存在 github.com 直连阻断）。
---

# 上游源码基线获取（fork + codeload tarball）

**目标**：把上游 mod 源码可靠地拿到 `_work\mod_src\<Mod>`，形成"可追溯、可回推、与安装版可比对"的源码基线。

> **`mod_src` 是只读基线**（`shared\conventions.md` §1.4）：只做摸底 / grep / diff / 编译探测；
> **不改文件、不放汉化产物、不放分析中间物**。要改源码 → 复制到 `_work\mod_work\<Mod>\` 再改。
> 无源码的 mod 走 `starsector-jar-decompile`（CFR）反编译，**产物同样落 `mod_src\<Mod>\`** ——
> 它就是"源码基线"目录，无论来源是 GitHub 还是反编译。
**调用方**：`wf-localize.md`（需要源码做摸底）、`wf-translate-update.md`、`wf-game-update.md`（第 2/3 步要源码）、
`starsector-engine-diagnose`（对比 EN 基线）、`starsector-jar-decompile`（装 CFR 时复用本流程）。
**必读**：`<skills>\shared\env.md`（gh/git 状态、网络与工具链）、`<skills>\shared\conventions.md`（目录约定）。

## 1. 流程

### 第 1 步 · 确认身份与上游

```powershell
gh auth status
gh api user --jq '.login'
gh repo view <owner>/<repo> --json name,defaultBranchRef,primaryLanguage,description
```

### 第 2 步 · 查是否已 fork（避免重复）

```powershell
gh repo view <you>/<repo> --json nameWithOwner,isFork,parent
# 报 "Could not resolve to a Repository" = 尚未 fork；有 parent 且指向上游 = 已 fork
```

### 第 3 步 · Fork（只建远程，不 clone）

```powershell
gh repo fork <owner>/<repo> --clone=false     # 输出 https://github.com/<you>/<repo> 即成功
```

### 第 4 步 · 网络诊断（先探再选下载通道）

```powershell
powershell -File <skills>\skills\starsector-repo-source\scripts\probe_github.ps1
```

**探针结论会骗人（实测）**：显示 `github.com :443 -> True` 时 `git clone` 仍可能报
`Empty reply from server`（TCP 可达 ≠ git 智能协议可用，TLS/HTTP 层仍会被拦或抖动）。
**策略**：探针通过就先试一次 `git clone`；失败（无论 `Failed to connect` 还是 `Empty reply`）**最多再试一次**，
仍失败立即走第 5 步 tarball 通道，**不要反复重试同一命令**。

### 第 5 步 · 经官方 codeload 下载（github.com 被阻断时的标准通道）

```powershell
# 推荐直接跑脚本（未传 -Branch 时自动探测默认分支；分支拉不到会自动回退 refs/tags/<Branch>）
powershell -File <skills>\skills\starsector-repo-source\scripts\fork_src.ps1 -Repo <owner>/<repo> [-Branch <b>]
```

手工等价步骤：

```powershell
curl.exe -L -sS -o "<dst>.tar.gz" "https://codeload.github.com/<you>/<repo>/tar.gz/refs/heads/<branch>"
tar -xzf "<dst>.tar.gz" -C <parentDir>          # 解出 <repo>-<branch> 目录
Rename-Item "<parentDir>\<repo>-<branch>" "<parentDir>\<repo>"
```

要点：codeload 是 GitHub 官方下载域名（与网页 Releases 同源），tarball = 指定分支当前快照，**不含 git 历史**，
比第三方镜像可信。**分支名不要硬编码 master**——先用
`gh repo view <owner>/<repo> --json defaultBranchRef --jq '.defaultBranchRef.name'` 取实际默认分支。

### 第 6 步 · 本地 git 化（import 提交 + 远程）

```powershell
git init <dir>; git -C <dir> add -A
git -C <dir> -c user.name="<you>" -c user.email="<you@x>" commit -m "Import <Repo> <branch> (fork of <owner>/<repo>)"
git -C <dir> remote add origin https://github.com/<you>/<repo>.git
```

意义：本地有干净基线提交可 diff；后续改动（若要把汉化推回 fork）基于此提交；`origin` 指向自己的 fork。
⚠️ **git 命令一律带绝对路径或 `-C <repo>`**：在其它工作目录直接 `git init <相对目录>` 会在错误位置建出空仓库，
之后 `git -C` 到目标目录全报 `not a git repository`（实测事故：在游戏根误建空仓库）。
误建后清理：`Remove-Item <误建路径> -Recurse -Force`，再回正确位置重来。

### 第 7 步 · 与安装版一致性校验（汉化前必做）

下载的 fork 分支未必等于 `mods\` 里装的发布版，逐项比对再决定以谁为基准：

- `mod_info.json`/`*.version`：id/版本/依赖是否一致；
- 数据文件逐文件 **SHA-256**（仓库 `assets\data\...` vs `mods\<Mod>\data\...`）；
- jar：先比整包哈希（常因打包时间戳不同而不同），再**解包逐条目比内容哈希**，内容一致才算同一产物；
- 不一致时：到 fork 上 checkout 与发布版对应的 tag/commit（`gh api repos/<owner>/<repo>/releases` 列 tag）再走第 5/6 步。

## 2. 后续衔接

- `starsector-mod-localization-extract`：以 `_work\mod_src\<Mod>` 源码/jar 做摸底（strings 表？jar 常量池？）。
- `starsector-mod-localization-migrate`：需要旧版/新版两份源码时同样先 fork。
- `starsector-mod-game-upgrade`：源码是编译探测（第 2 步）与 jar↔源码一致性证明（第 3 步）的前提。
- `starsector-engine-diagnose`：汉化后启动崩溃时用 fork 源码 + 安装版做 EN 基线复现。
- 把汉化结果回推 fork：需在 github.com 可达时 `git push origin master`（可选，用户决定）。

## 3. 验证清单

- [ ] fork 存在于 `https://github.com/<you>/<repo>`（`gh repo view` 有 parent）
- [ ] 本地 `_work\mod_src\<Mod>` 存在，`git log` 有 "Import …" 根提交，`git remote -v` 指向 fork
- [ ] 仓库文件完整（与 codeload tarball 一致；无解压残留、无多余目录）
- [ ] 与安装版比对结论已记录：一致 or 差异清单（决定汉化基准与是否 checkout 对应 tag）
- [ ] fork 目录**保持纯净**（分析/汉化产物放 `_work\mod_work\<Mod>`，别污染源码基线）

## 4. 常见问题

- **`fork_src.ps1` 在第 2 步就中断（2026-09 已修）**：脚本首行 `$ErrorActionPreference='Stop'` 会让
  PS 5.1 把 `gh repo view <you>/<repo>`（fork 尚不存在时必然报的 GraphQL 错）**升级为终止错误**，
  于是**走不到 fork 与下载**。症状：只打印 `[fork_src] account: …` 然后抛 `NativeCommandError`。
  现脚本已内置 `Invoke-Capture`（局部把 EAP 降为 `Continue`，回传 `$LASTEXITCODE` 与 stdout），
  并以"输出为空"而非"报错"作为"尚未 fork"的判据。
  **写新脚本时的通用纪律**：PS 5.1 下任何**预期会失败**的 native 命令（`gh` 查不存在的仓库、`git` 写 stderr 进度）
  都必须 `2>$null` 或走 `Invoke-Capture`，否则在 `EAP='Stop'` 下会把正常流程打断。
- **gh 能通、git clone 不通**：`api.github.com` 通 ≠ `github.com` 通；git 智能协议走 github.com，
  被阻断时无解（`insteadOf` 改写也无法替代 git 协议），用第 5 步 tarball。
- **fork 报 404 查看失败**：`gh repo view <you>/<repo>` 对不存在的仓库报 GraphQL 错——这正是"尚未 fork"的判定信号。
- **tar 解出的目录名带 `-master` 后缀**：解压后立即 Rename-Item 成 `<Repo>`，别在后续路径里带分支后缀。
- **想保留完整历史**：只能等 github.com 可达时正常 clone；tarball 是快照（历史可用 `git fetch` 补，同样依赖可达性）。
- **`git push` 时好时坏**：可在网络空档重试几次；`gh api` 类请求不受影响。
