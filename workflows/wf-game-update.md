# wf-game-update · 给 mod 更新版本以适配新版游戏（任务分类 ③）

> 输入：0.95/0.96/0.97 时代写成的 mod（Java 或 Kotlin；有源码或只有 jar）。
> 输出：能在 **0.98a-RC8** 正常运行的 mod（+ 版本号/changelog/交付包）。
> 需要读：`shared\env.md`、`shared\iron-rules.md`、`shared\conventions.md`、
> `skills\starsector-mod-game-upgrade\SKILL.md`（主体执行手册）。

## 0. 原则

**该改的都改了、不该改的一个都没动、每一步都有实证。**
实战参照（sylphon RnD 1.0→1.1）：126 个 Java 源文件 + 346 个数据文件，最终**真要改的只有 8 处**，
"看起来是问题"的假阳性 30+ 条 ⇒ **一半的价值在于避免白忙和乱改**。

## 1. 分派：先判定这个 mod 是什么类型

| 情况 | 走法 |
|---|---|
| **目标准入版本 ≤0.8x（0.9 以下）** | 主体流程 + **必读 skill §7 专项**：三个 faction/wing 闸门（`check_wing_data_schema` / `check_faction_shiproles` / `check_faction_known_lists`）+ **读档冒烟**（verifyFactionData 在读档期跑） |
| Java 源码 + jar | 主体流程（下 §2），编译探测 + jar↔源码一致性证明 |
| Kotlin 源码 + jar | `starsector-mod-kotlin-rebuild` 的编译链；编译探测/一致性仍按主体流程 |
| **只有 jar（无源码）** | 主体流程 §1.1（先只读审计 → 确认 API 真断 → 只替换少数类 → 才考虑整包重编译）；反编译用 `starsector-jar-decompile` |
| 纯数据 mod（无 jar） | 跳过源码步骤，只做数据层审计（§2 的第 5/6 步） |
| 症状是"特效与舰船分离且随镜头变化" | 额外命中 `starsector-mod-render-fix` |
| **此 mod 有汉化** | 全程遵守"不丢汉化"纪律（§3） |

## 2. 主体流程（详细步骤见 `starsector-mod-game-upgrade` §2 十步）

按顺序执行，**不要跳步**：

1. **第 0 步 环境取证**（先读别先改）：日志（区分别人 mod 的噪音）/ 存档（内容是否真的生成过）/ 依赖真实版本 / 备份。
2. **第 1 步 摸清结构**：`jars\src`、`data\scripts\**\*.java`（janino 运行时脚本，也要编译验证）、
   `data\config\settings.json`、`.version`。
3. **第 2 步 编译探测**：用 0.98a API 直接编全部源码 → 编译器一次暴露所有签名级不兼容。
   能干净编译 ⇒ 不会有 `AbstractMethodError`/`NoSuchMethodError`（最强单点证据）。
4. **第 3 步 jar↔源码一致性证明**：`javap -p` 签名逐类 diff + `cmp_strings.js` 常量对比。
   允许的差异只有编译器产物（`$values()`、`$$$reportNull$$$0`、switch-map 合成类、字符串分组方式）。
   **证明通过才允许整包重编译。**
5. **第 4 步 离线 LoadTest**：全类 `Class.forName` + 游戏会实例化的类 `newInstance` + 脚本类存在性。
6. **第 5 步 数据层审计**：**引擎按表头名读列 ⇒ 缺列只是默认值，不错位、不必补**；
   新列该不该填逐项判断（`sModDesc` 只有实现了 S-mod 效果才填，否则是谎报加成）；
   BOM / 宽松 JSON 语法（用游戏 `org.json` 验证）/ CSV 引号内换行。
7. **第 6 步 引用完整性**：`check_refs.js` / `check_assets.js` / `check_sprites.js` / `check_deprecated.js`（脚本化，别靠眼睛）。
8. **第 7 步 语义核查**：用反汇编终结猜测（`starsector-engine-diagnose` §4）——**先确认引擎是否读它，再决定改不改**。
9. **第 8 步 并行深度审查 + 逐条复核**：子代理只写报告不改文件；**每条"必须修"都要自己复核**（实测 75% 是假阳性）。
10. **第 9 步 修复 + 重建 + 全量校验**：`build_java_mod.ps1`（编译→打包→备份 `*.orig`→安装），
    重跑第 3/4/6 步校验。**游戏必须先完全退出**。
11. **第 10 步 版本号 / changelog / 交付**：`version` 与 `*.version` 同步；`gameVersion=0.98a-RC8`；
    `dependencies` 齐；`changelog.txt` 顶部加条目；走 `starsector-mod-delivery`。

## 3. 有汉化的 mod：不丢汉化的纪律

- **动手前查 jar 内是否含 CJK**：含 ⇒ 已被汉化过 ⇒ **整包重编译会丢汉化**。
  两条合法路线：① 只重编译改动的类并**原位替换 zip 条目**（`starsector-mod-render-fix` §5 的方法）；
  ② 先备份 EN jar → 整包重编译 → **重跑汉化**（`starsector-mod-localization-apply`）。
- 原位替换后必须**逐条目比对**剩余条目与原 jar 是否**逐字节一致**，证明没碰汉化。
- 改过字符串/重编译后 → 走 `wf-translate-update.md` 或 `wf-localize.md` 重新注入汉化，
  再跑 `starsector-mod-localization-verify` 的 G4/G5。
- 数据层汉化（CSV/JSON）**不受重编译影响**，但如果本次同时改了数据列结构 → 汉化需重新对齐（走任务②）。

## 4. 反模式（全部有实证代价）

- ❌ 联网搜"0.98a 改了什么" → 本机 `starfarer.api.zip` 是权威文档，`starfarer_obf.jar` 是权威行为。
- ❌ 为了"和别的 mod 对齐"改数据（例：给 `isPhaseCloak` 填 TRUE）→ 先反汇编确认引擎是否读它。
- ❌ 凭"看起来多余"删数据/文件 → 上游残留最多是日志噪音，写成"可选清理"交给用户。
- ❌ 用严格 JSON 解析器给游戏数据判死刑（`.proj` 的 `[255,025,135,55]`、`.0f`、`.5`、尾随逗号都合法）。
- ❌ 在没证明 jar == 源码 之前整包重编译。
- ❌ 完全信任子代理的"必须修"。
- ❌ 在游戏运行时替换 jar。

## 5. 完成标准

- [ ] 源码干净编译（`--release 8`，exit 0）或（无源码时）只替换了必要类且其余条目逐字节一致
- [ ] 签名 diff 只剩编译器产物；字符串常量对比只剩故意改动
- [ ] LoadTest 全通过；引用校验 0 真问题
- [ ] 数据层：无 BOM、宽松 JSON 用游戏 `org.json` 验证过、缺列判断有依据
- [ ] `mod_info.json`：`version` = `*.version`、`gameVersion=0.98a-RC8`、`dependencies` 齐
- [ ] `changelog.txt` 已更新；报告里区分"0.98 回归"与"上游一直就坏"
- [ ] 有汉化 ⇒ 汉化已重新注入并通过 G4/G5
- [ ] `starsector-mod-delivery` 四项齐备并打包自检
- [ ] **（≤0.8x mod）**skill §7 三个专项闸门 PASS + **读档冒烟**通过（verifyFactionData 在读档期核对 known*，只进主菜单不够）
- [ ] **游戏内**：新档生成内容 → 目标功能可用 → 日志无新增 `at data.scripts.` 栈帧
