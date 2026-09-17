---
name: starsector-mod-localization-migrate
description: Starsector（远行星号）mod 汉化"迁移"环节——存在旧版手工汉化时，从旧汉化产物里按 id/类名/LCS 对齐抽出 EN→ZH 映射，供新版复用。覆盖旧译 jar 是"常量池补丁"还是"重编译产物"的判定、三种匹配方式（索引/等长/位置）全部不可信的实证、LCS 对齐流程与可疑条目人工核验、占位符风格转换（{%s}→%s）、新增列值处理、版本扩写文本不可直接覆盖、空字符串不进映射、映射质量审核。不含提取新内容（starsector-mod-localization-extract）、不含注入（starsector-mod-localization-apply）、不含任务2 的分流判定（wf-translate-update）。默认用户环境与当前环境一致（游戏根 C:\game\StarSector.v0.9.8a-RC8，中文 Windows）。
---

# 迁移：从旧汉化抽 EN→ZH 映射

**职责**：把"旧版汉化已经译好的东西"变成可复用的映射，最大化复用、最小化新译。
**不负责**：产出新译文（那是上游人/AI 的事）、注入（`starsector-mod-localization-apply`）。
**调用方**：`wf-translate-update.md`（任务2）、`wf-localize.md`（任务1 有旧译可参考时）。
**必读**：`<skills>\shared\env.md`、`<skills>\shared\conventions.md`（§6 增量复用）。

## 0. 先判定旧汉化是哪种产物（决定用什么匹配方式）

**0.0 先量"中文密度"——别假设"有中文目录 = 有汉化"（2026-09 实证）**

`_work\mod_zh\<Mod>` 里名为中文版的存档，实测可能只有零星中文：Hostile Intercept 1.3.2 存档里
jar 仅 **2 条**中文串（`侦测到潜在威胁` / `侦测到不少潜在威胁`）、`settings.json` 4 行中文注释、
`mod_info.json` name/description 中文，其余（changelog / commands.csv / 全部 Java 源码）全英文
⇒ 有效复用 5 条（数据层 93 条里 88 条是新译）。**先量再算 R**，否则会把 R 算低、误落 ①/② 档。

量法（三条都要做，写进 `out\old_reuse_detail.json`）：

1. 逐文件中文字符数：`([regex]::Matches($t,'[\u4e00-\u9fff]')).Count`（**不要**只看 `mod_info.json` 的 `name`，`conventions.md` §1.3）；
2. 旧汉化 jar 用 `analyze_jar_strings.js` → 数**被译的可见字符串**（不是常量总数）：`stringRefs 且有 CJK` 的条数；
3. 数据层：逐 CSV/JSON 用 `csvtool.js parse` / `pseudojson.js` 看目标列到底有没有中文。

**0.1 再判产物类型**：解包旧汉化 jar，与**同版本的英文原版** jar 对比同类的字面量序列：

- **常量池补丁产物**：字面量条目的**顺序与数量不变**，只有文本不同 → 可按位置匹配。
- **重编译产物**（从翻译后源码重新编译）：**同类但顺序偏移/多出条目** → 位置匹配必错。

判定方法：逐类比对两边 Utf8 条目序列，出现"插入/缺失/错序"即重编译。

> **实战案例**：旧汉化 jar 是重编译产物 ⇒ 索引匹配产生 `fuel→hand_weapons` 之类垃圾对。

## 1. 三种匹配方式都不能单独信任（实证）

| 方式 | 为何不可信 | 实测错例 |
|---|---|---|
| 按常量池索引 | 重编译后索引完全错位 | `fuel → hand_weapons` |
| 等长按位置 | 中间插入条目（如空串 `""`）导致整体偏移 | `% damage absorption → % 护盾完整度` |
| LCS 对齐（锚点 = 未翻译的相同字面量，段内按位置补对） | 多数类正确，但**"锚点相同而段内长度不同"仍会错配** | 纯数字/纯占位符条目最易错（`halved`、`75%`、`twice`） |

## 2. 正确流程

```powershell
# 1) LCS 级配对产初稿
node <skills>\shared\scripts\extract_old_map.js <旧EN jar解包目录> <旧ZH jar解包目录>   # → old_en_zh_map.json
# 2) 新 jar 类 vs 旧译 jar 类按类名对齐（产出对"新 jar"有效的 EN→ZH）
node <skills>\shared\scripts\align_newjar_oldzh.js <新jar解包目录> <旧ZH jar解包目录>
```

3. **打开对应 `.java` 源码逐条核验可疑键**：纯数字/纯占位符条目（`halved`、`75%`、`twice`）最易错配——
   必须看源码里它在哪个 `return`/拼接位置。错误条目从映射剔除，改用手工值
   （如 `halved→减半`、`% damage absorption→% 伤害吸收`、`% shield integrity→% 护盾完整度`）。
   > **新 jar 与旧 jar 类名完全不同时**（Java→Kotlin 包名重构，如 `scripts\HostileIntercept_*` → `hostileIntercept\**`）：
   > `align_newjar_oldzh.js` 按类名对齐会**一条都配不上**（实测 0 命中）。此时改用
   > "**旧 EN 源码字面量 ↔ 旧中文 jar 字符串常量**"按类配对（旧汉化包常附反编译源码），
   > 产出的 EN→ZH 再拿去和**新版的 `src` + 外部化字符串文件（如 `data/strings/strings.json`）**逐条对，
   > 只有"新版本确实还在用的串"才进复用集；新版改写的文案（哪怕语义相近）一律重译。
   > 版本升级若还伴随**字符串外置化**（硬编码 → `strings.json`），旧译只能按"语义等价"复用，
   > 不能按常量位置复用。
   >
   > **第 4 种情形：旧译在 jar 里、新译在 JSON 字符串表里，且键名整体重构**（2026-09-17 RetroLib 1.0.1→1.1.1 实证）：
   > 上游 1.1.0 把界面文案**全部外置到 `data/strings/strings.json`** 并把编号式键
   > （`RetroLib_impl.BaseRetrofitPluginView_29`）改成语义化键（`RetroLib.sourcesTextLegalFree`）。
   > 此时 `extract_old_map.js` / `align_newjar_oldzh.js` **两条都用不上**（jar 类虽同名，但新类的常量池里
   > 只有"键名"、没有文案；按类 LCS 配出来的是键名对中文，毫无用处）。正确流程：
   > 1. **旧 jar 里被译的中文常量本身就是要复用的语料**——用 `analyze_jar_strings.js` + 过滤 `asString && CJK`
   >    抽出（RetroLib 实测 21 条：`- 需要 $cost 并耗时 $time 天`、`要求： $factionName - $repLevel` …）；
   > 2. 与**新 `strings.json` 的英文值**做**语义配对**（人工/LLM 逐条判断，不按键名、不按位置），
   >    配对依据是 1.1.1 的 `src/**`：`ExternalStrings.kt` 给出"键 → 语义"，`BaseRetrofitPluginView.kt`
   >    给出"键 → 渲染位置/占位符消费顺序"（如 `%s` 是按序 `replaceFirst` 消费的高亮片段）；
   > 3. **一旧对新多**是常态：旧版 37 条碎句 → 新版 82 条（合并碎句 + 按单复数展开 4 个变体）。
   >    单复数的多个新键**共用同一句中文**（中文不分单复数），标注为 `old-migrated`；
   >    真正新写的才记 `new`；
   > 4. 产出仍按 `conventions.md` §4 的 worklist 形态（`locator` = `data/strings/strings.json#<ns>.<key>`），
   >    **别忘 `line` 要用 `search(new RegExp('"key"\\s*:'))` 算**——表里 `:` 后空白不一致，按 `indexOf` 会错位；
   > 5. jar **不需要补丁**：先量新 jar 的 CJK（`analyze_jar_strings.js` + CJK 过滤），
   >    为 0 就说明新版本没留硬编码文案（RetroLib 实测 0/2201），交付说明里写清"不改 jar"及其理由。
   >    剩下的英文（如 `ModPlugin` 抛的依赖缺失 `RuntimeException`）先判**是否玩家可见**：
   >    `starfarer_obf.jar` 里搜已汉化的启动器文案（本项目实测核心 `GLModPickerV2` 已有
   >    `错误：你并未安装该 MOD 所要求的前置 MOD。`）⇒ 启动器已用 `mod_info.dependencies` 拦住，
   >    那条英文异常基本不可达，本地同类 mod 也一律留英文 ⇒ **有意不动 jar** 并记录。
4. **空字符串 `""` 一律不进映射**（常是 `getDisplayName` 的空返回，重编译时位置漂移）。
5. **映射键以 jar 常量原文为准**（逐字符，含弯引号/撇号与首尾空格），不做手工转写。

## 3. 数据层按 id 迁移（列级差异逐项处理）

用 `<skills>\shared\scripts\csvtool.js`（RFC4180，支持引号内逗号/换行）按 id 列迁移：

1. **占位符风格**：旧版可能用 `{%s}`（花括号包裹），新版用 `%s` —— 一律 `{%s}`→`%s`，否则游戏显示字面 `{750}`。
   迁移后抽验 `customPrimary` 等列，确认 `%s` 数量与新版英文一致。
2. **新增列值**：新版给旧版为空的列填了值（如战机型武器新增 `primaryRoleStr=General/Pressure/Suppression`）——
   旧版没有就**新译**（普通/压制），不要留英文。
3. **多列文本**：`rules.csv` 除 `text`/`options` 外，**`script` 列也有文本**（`AddText "…"` 的对话、
   `$marketLeaveTooltip = "…"` 的提示）——按行 zip 迁移引号内容，规则语法与 `$变量` 原样保留
   （`migrate_rules_script.js`）；改完必跑 R2 校验。
4. **嵌套对象**：`templars.faction` 的 `ranks`/`posts`/`fleetTypeNames` 是嵌套结构
   （`"spaceSailor":{"name":"Page"}`）——按"行前缀 + 引号值"匹配迁移（`migrate_faction2.js`），**不要按外层 key**。
5. **版本扩写**：新版 `mission_text.txt` 等纯文本若比旧版长很多（内容扩写），**不能直接覆盖旧译**——
   按新版全文重译（旧译作风格参考），段落结构一一对应。
6. **`descriptions.csv` 的 `{词}` 高亮**：旧译风格是新版没有的，可保留（游戏支持金色高亮），
   花括号内放原文专有名词且**必须配对**。
7. **英文基准来源**：若旧汉化已把英文替换掉，从 GitHub Releases 下载同版本官方 zip 提取英文 CSV 作对比基准
   （`starsector-repo-source`）。

## 4. 产出与审核

产出 `old_en_zh_map.json`（jar 层）与各数据文件的 EN→ZH 映射，并把可复用译文**预填**进
`starsector-mod-localization-extract` 的 worklist（`zh` 预填、`source:"old-migrated"`）。

**映射质量审核（必做）**：

- [ ] **旧汉化"中文密度"体检做过**（§0.0），复用条数有数字支撑（不是"看着像有汉化"）
- [ ] 可疑条目（纯数字/纯占位符/单字符/超短）全部人工核验过，核验结论留档
- [ ] 空字符串不在映射里
- [ ] 键与 jar 常量/旧 CSv 原文**逐字符**一致（抽样 10 条比对）
- [ ] 键去重后无一对多冲突（同一 EN 出现多个 ZH 时，逐个确认是"场景求异"还是"错配"）
- [ ] **不照抄的低质旧译已标记**：误译、错位、语病、与当前核心术语冲突的条目**不要沿用**
      （沿用等于把旧 bug 一起交付）；标记后交给上游重译
- [ ] 旧译**文案随版本改动**的条目已识别（示例：1.3.2 `description` 与 1.6.0 英文语义不同 ⇒ 整条重译，不沿用）
- [ ] 差异已记录（有意不沿用/有意修正，写进汉化说明或语料 note）
- [ ] **旧译的"碎句"在新版被合并/拆分时，逐条确认语义边界**（RetroLib 实测：旧版把「- 获得 %s」同时当
      "免费"与"返还舰体框架"两条用 ⇒ 新版拆成 `sourcesTextLegalFree`（`- %s` + 高亮）与
      `sourcesTextFrameReturn`（`- 返还 %s`）时必须**分别给译文**，照抄会出现"返还 免费"）
- [ ] **旧译的"名词短语"在新版被用作动作按钮时改成动作句式**（`Prioritize retrofits` 当按钮 ⇒「将改装提前」，
      对话框标题仍可保留名词短语「选择要优先进行的改装」）
- [ ] **旧译的空格/标点瑕疵被发现并修正**（RetroLib 实测：`…获得 $cost 。` 中英混排空格；沿用即交付 bug）
- [ ] **旧译的关键术语误译被识破**（RetroLib 实测：`source ship` 被旧译成「原材料」，
      实际是"可作为改装来源的舰船"；判据是读新版 `src/**` 里该串的渲染位置）

> 质量判定标准见 `starsector-mod-localization-content` §1（原创译写，不照抄）。

## 5. 任务2 的接口

本 skill 只产出映射与"待译新条目"的划分。**按比例决定要不要翻译**由 `wf-translate-update.md` 负责
（< 10% 仅告知 / 10%–20% 汉化完交检阅 / ≥ 20% 不汉化只整理；条目计数口径见 `conventions.md` §3）。
