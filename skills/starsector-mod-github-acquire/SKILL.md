---
name: starsector-mod-github-acquire
description: 用户提示词只给出一个 GitHub 仓库（URL 或 owner/repo）时的第一步——评估 Releases 与默认分支最新推送、选定目标版本、连同依赖一起下载并安装进 mods\，再路由到对应任务（汉化/更新/迁移）。覆盖取证三查（repo 元信息 / latest release / compare tag...HEAD 的 ahead_by 与改动文件）、选版决策表（核心判据＝HEAD 领先的改动**不构建能不能跑**：仓库提交了 jars 则源码包即成品，jars 需 Maven/Gradle 构建则选 Release 资产）、依赖链自动补装（mod_info.dependencies 逐个查缺、按 id/作者搜仓库）、下载通道（github.com 直连被断：release 用 gh release download、源码包走 codeload）、安装校验（mod_info 无 BOM、gameVersion 代差路由）。不用于：mod 已在本地只做任务（直接走对应 wf）；只取源码做逆向基线（starsector-repo-source）；发布/上传。
---

# starsector-mod-github-acquire · 从 GitHub 仓库选版并装好 mod

**职责**：输入一个仓库 → 评估"最新 Release vs 默认分支最新推送" → 选定目标版本 →
下载、装进 `mods\`、补齐依赖 → 报告选版依据并路由下一步。
**不做**：不联网猜游戏数据/API 行为（那是 `starfarer.api.zip` 的事）；不自动启用 mod（烟测自己管
`enabled_mods.json`）；不做源码基线（需要读源码时另走 `starsector-repo-source`）。
**上游**：用户一句"汉化/更新 <github 链接>"。
**下游**：`wf-localize`（首次汉化）/ `wf-translate-update`（有旧汉化）/ `wf-game-update`（有版本代差）。
**环境事实**（`shared\env.md` 与实战）：`github.com` 直连被断，`api.github.com`/`codeload` 可用；
gh 已登录 Camellia895——**取证用 `gh api`，下载用 `gh release download` 与 codeload**，
不要用 `github.com/.../archive/...`（被断的域名）。

## 1. 取证三查（缺一不可，选版依据全在这里）

```bash
# ① 仓库元信息：默认分支 + 最近推送时间
gh api repos/<owner>/<repo> --jq '{default_branch, pushed_at}'
# ② 最新 release：tag、发布时间、资产（404 = 无 release，唯一候选是 HEAD 源码包）
gh api repos/<owner>/<repo>/releases/latest --jq '{tag_name, published_at, assets: [.assets[] | {name, size, browser_download_url}]}'
# ③ 差距：release tag 到 HEAD 领先几个提交、改了哪些文件（这是选版的核心证据）
gh api "repos/<owner>/<repo>/compare/<tag>...<default_branch>" --jq '{ahead_by, total_commits, files: [.files[].filename]}'
```

再补一查：**jars 是否随仓库提交**（决定 HEAD 源码包是不是成品）：

```bash
gh api "repos/<owner>/<repo>/git/trees/<default_branch>?recursive=1" --jq '[.tree[].path | select(test("jars/|\\.jar$"))]'
```

## 2. 选版决策表（核心判据：HEAD 领先的改动**不构建能不能跑**）

| 情形 | 选 | 说明 |
|---|---|---|
| HEAD 与 tag 无差距（ahead 0）或只改 README/文档 | **Release 资产** | 玩家实际在用的稳定版 |
| HEAD 领先且改动含代码/数据，但 jars **需构建**（树里有 `src/`+`pom.xml`/`build.gradle`、无提交的 jars） | **Release 资产** | 源码包跑不起来；报告注明"领先 N 提交（内容摘要），需构建才能吃到" |
| HEAD 领先且改动含代码/数据，**仓库直接提交了 jars** | **HEAD 源码包**（codeload zip） | 源码包即成品 mod；标注"源码快照版 <日期>" |
| 无 release | HEAD 源码包 | 解包后**没有 `mod_info.json`** ⇒ 不是成品 mod：报告并转 `wf-game-update`（构建路线），不要硬装 |
| release 资产解包后无 mod 结构（缺 `mod_info.json`/`jars`） | 视为"需构建"情形处理 | 资产名与内容可能不符，**看内容别看名字** |

> 实证（2026-10-02 ItemMarkers）：release v0.1.3（06-22）落后 main 5 提交（新 preset 配置+CRUD 界面、
> 图标、`pom.xml`）——仓库零提交 jars ⇒ **选 Release**；想要 HEAD 新功能就得走构建路线。
> 通用口径：**汉化任务选"玩家在用的版本"；更新任务允许选 HEAD**（它可能已带新适配）。

**双下载（用户要求或两端都有价值时）**：Release 与 HEAD 都可以下载，但必须**标记清楚**——
- 文件名后缀：`<Mod>_<tag>_stable.zip` / `<Mod>_HEAD_<yyyymmdd>_testing.zip`；
- **进 `mods\` 的只有选为目标的那份**；另一份留在 `_work\_tmp\<mod>\`（HEAD 快照若要留作源码参考，
  放 `_work\mod_src\<Mod>\`，与 `starsector-repo-source` 的基线目录对齐）；
- **`mods\` 里不能同时放两份同 id**（启动器双条目、启用互相冲突）；要换测另一版 ⇒ 备份-替换（§5）；
- 报告里写明：哪个是稳定版、哪个是测试版、分别落在哪。

## 3. 下载与验货

```bash
mkdir -p <game>\_work\_tmp\<mod>   # 分析/下载产物只落 _tmp，不进 mods\
cd <game>\_work\_tmp\<mod>
gh release download <tag> --repo <owner>/<repo> --clobber      # release 资产（被断域名下的可靠通道）
# 下载后立即重命名标记（双下载时必须）：ItemMarkers_v0.1.3_stable.zip
# HEAD 源码包走 codeload（github.com/archive 被断）：curl -L -o <Mod>_HEAD_<yyyymmdd>_testing.zip https://codeload.github.com/<owner>/<repo>/zip/refs/heads/<branch>
unzip -o -q <标记过的zip> -d unpacked
```

验货清单：解包根或一级子目录有 `mod_info.json` → 读 `id`/`version`/`gameVersion`/`dependencies`/`jars`；
`gameVersion` 与 **0.98a-RC8** 精确比对（**启动器会静默拒载 gameVersion 不匹配的 mod**，无任何报错）。

## 4. 依赖链（`dependencies` 逐个查缺）

mod 自身装好 ≠ 能跑。对 `mod_info.json` 的 `dependencies[]` 每个 id：
1. 已在 `mods\`（比对 id 不是文件夹名）→ 跳过；
2. 缺 → 按顺序找仓库：`gh api "search/repositories?q=user:<作者login>"`（依赖常在同作者名下，
   实证：ItemMarkers 的依赖 `wfg_native_ui` = 同作者的 **NativeUI** 仓库）→ `search/repositories?q=<依赖名>`
   → 找到后按 §1–§4 同样流程装（依赖多为 `utility: true` 的库 mod）；
3. 找不到可靠来源 ⇒ 报告缺什么，让用户给链接，**不要装来路不明的包**。

## 5. 安装

- 目标 `mods\<名>`（名用 release 包内自带的一级目录名，无则用 mod_info 的 `id`）；
- **已存在同名目录** ⇒ 先整体移到 `<game>\_work\backup\<名>_<yyyyMMdd_HHmm>\`（可逆），再装新的；
- 校验 `mod_info.json` 前三字节非 `EF BB BF`（无 BOM）且可读；
- **不动 `enabled_mods.json`**（烟测会自己改写并恢复）；
- 留档：选版依据（三查结果 + 决策行）写进任务报告，后续落 `_work\mod_work\<Mod>\`。

## 6. 路由（装好 ≠ 完成，报告里必须给下一步）

| 情况 | 去 |
|---|---|
| `gameVersion` 有代差 / 想要 HEAD 新功能但需构建 | `wf-game-update` |
| 零代差 + 要汉化（无旧汉化） | `wf-localize`（①） |
| 零代差 + 本 mod 已有旧汉化（查 `_work\mod_work\<Mod>\` 与包内 `ai\zh`） | `wf-translate-update`（②） |
| 用户其实是在报"这 mod 跑不起来" | `wf-smoke-first` / `wf-mod-fix`（⑦） |

## 完成标准

- [ ] 三查 + jars 查有输出，**选了哪个版本、为什么**能一句话复述（有日期/ahead_by/改动文件佐证）
- [ ] 主 mod 与缺失依赖都已进 `mods\`，`mod_info.json` 无 BOM、字段可读
- [ ] 已有旧安装的被备份到 `_work\backup\`（可逆）
- [ ] 双下载时两个包都有 `_stable`/`_testing` 标记，且 `mods\` 里只有目标那一份
- [ ] 报告含：装了什么（id/版本/文件夹）、稳定/测试版各落在哪、依赖补了什么、gameVersion 比对结果、下一步路由
