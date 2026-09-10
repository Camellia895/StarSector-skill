# wf-translate-update · 汉化迁移（mod 更新版本 + 复用旧汉化）

> **任务分类 ②**。输入：同一个 mod 的**新版**（英文）+ 已有的**旧版汉化**。
> 输出随"新内容占比 R"分三档：**仅告知** / **汉化完交检阅** / **不汉化，只整理清单交用户**。
> 需要读：`shared\conventions.md`（§3 条目计数口径！）、`shared\env.md`、
> `skills\starsector-mod-localization-migrate\SKILL.md`、`-extract`、`-apply`、`-verify`。

## 0. 核心规则：按"新内容占比"分档

**R = 待译新条目数 ÷ 需汉化总条目数**
其中 `需汉化总条目数 = 旧译可复用条目数 + 待译新条目数`。

**条目计数口径**（`shared\conventions.md` §3）：只计需要汉化的可见文本条目；
**超短字段不计**（舰船名、军官名、人名、单个专有名词、单位/缩写），标识符/引擎常量/路径/URL/纯数字也不计。
被排除项写入 `excluded_entries.json` 留档（locator + 理由），便于复核口径。

| R | 档位 | AI 做什么 | 交付给用户什么 |
|---|---|---|---|
| **R < 10%** | ① 微量更新 | 旧译按 locator/id 迁移 → 构建完整中文版；**新条目不翻译**，保留英文并在清单中标注 | **一条通知**：新增 N 条清单（locator + en + 所在文件）+ 已交付的中文版位置。**不请求检阅**，但**明确告知这批新内容仍是英文** |
| **10% ≤ R ≤ 20%** | ② 中等更新 | 旧译迁移 → **新条目由 AI 完成翻译** → 构建完整中文版 | **完整中文版 + 新译 en/zh 对照清单**，**交用户检阅**（用户逐条确认或改） |
| **R > 20%** | ③ 大量更新 | 旧译迁移 → **新条目一律不翻译**，只做整理 | **①全部旧汉化内容清单 ②全部新增待译条目清单**（可拆多份），交用户汉化/参考；同时给出"旧译已就位、新增留空"的**合并待填清单** |

> 判定取整侧保守：R 恰好落在边界（10%/20%）时，按**更保守的档**处理则取 ①③、按用户口径则取 ② —— **默认按 ② 处理**（10%/20% 都归入"翻译并交检阅"），除非用户另行指定。

**三档共同点**：**旧汉化迁移在每一档都做**（那是复用已有资产，不算新翻译工作）。
差别只在"新内容谁来译、要不要用户检阅"。

## 1. 阶段 1 · 迁移旧译（AI 做）

0. **先给旧汉化"体检"再算复用面**（**2026-09 Hostile Intercept 教训**：`_work\mod_zh\` 里名为"中文版"的存档，
   实际只有 2 条 jar 字符串 + 4 行注释是中文 ⇒ 有效复用 5 条，其余 88 条全新 ⇒ 名义 ③ 档）：
   - 逐文件数中文字符数（`[regex]::Matches($t,'[\u4e00-\u9fff]').Count`，**别只看 `mod_info.json` 的 name**，见 `conventions.md` §1.3）；
   - 解包旧汉化 jar，用 `analyze_jar_strings.js` 数**实际被译的可见字符串条数**（不是常量总数）；
   - 把"体检结论"写进 `out\old_reuse_detail.json`（哪些真能复用、哪些只是英文壳）。
   > 体检结果若为"稀疏补丁"，本次性质其实更接近**首次汉化**（`wf-localize.md`），R 会天然接近 100%，
   > **不要**因为"有个中文目录"就假设能复用大半、把 R 算低而误落 ①/② 档。

1. 定位旧汉化（**外部中文版**）：`<game>\_work\mod_zh\`（本项目收存的外部中文版与旧汉化存档）、旧版发布 zip、`mods\` 内残留旧版目录。

   > **旧汉化 jar 是"重编译产物"且类名与新 jar 完全不同时**（如 1.3.2 Java `scripts\HostileIntercept_*` → 1.6.0 Kotlin `hostileIntercept\**`）：
   > `align_newjar_oldzh.js` 按类名对齐会**一条都配不上**。改用"**旧 EN 源码 ↔ 旧中文 jar**"配对
   > （旧汉化包里常带反编译源码；`scan_jar_sources.js` 或自写脚本按类取源码字面量 vs jar 字符串常量做 LCS），
   > 再用新版的 `src`+`strings.json` 判断哪些新串能接上旧译。
2. 备份新版英文原版：`mods\<Mod>\` → `<game>\_work\mod_bak\<Mod>_<新版本>_EN_backup`。
3. 若本次同时含版本升级，另存 `_premerge_backup` / `_pre_zh_backup`（后缀含义见 `conventions.md` §1.2）。
4. 执行 `starsector-mod-localization-migrate`：
   - 判定旧汉化 jar 是**常量池补丁**还是**重编译产物**；
   - `extract_old_map.js`（LCS）→ `align_newjar_oldzh.js`；
   - 数据层 `csvtool.js` / `migrate_rules_script.js` / `migrate_faction2.js` / `migrate_json.js`；
   - **可疑条目逐条核验**（纯数字/纯占位符/超短/空串）；
   - **低质旧译标记不沿用**（误译、错位、语病、与核心术语冲突）。
5. 产出 `old_en_zh_map.json` + 已预填的 worklist（`zh` 已填、`source:"old-migrated"`）。

## 2. 阶段 2 · 提取新内容并算 R（AI 做）

1. 执行 `starsector-mod-localization-extract`，产出新版完整 worklist。
2. **diff 出"待译新条目"**：`en` 未变 → 复用旧 `zh`；`en` 变了 / 新增 / 新版新增文件里的条目 → 待译（`source:"new"`）。
3. **算 R**：按 §0 口径统计条目数（分子 = 待译新条目，分母 = 需汉化总条目），
   把统计过程与 `excluded_entries.json` 一起留档（用户要能复核数字）。
4. 按 R 进入 §3 的对应档。

> 若**完全没有旧汉化** ⇒ R = 100% ⇒ 落 ③ 档；但这种情况通常应直接走 `wf-localize.md`（首次汉化），
> ③ 档的意义是"有旧汉化但新内容已占多数"。

## 3. 分档执行

### ① R < 10%（微量）

1. 旧译迁移注入 → 生成完整中文版（`-apply`）。
2. 新条目不翻译：数据文件里保留英文原文，**同时在清单中标注 `source:"new"` + `untranslated:true`**。
3. 跑 `-verify` 的 G2（此时允许 `zh` 为空，但必须与"未译清单"一一对应）/G3/G4/G5。
4. 交付中文版 + 复核后的 G 闸门结果。
5. **告知用户**（不请求检阅）：新增 N 条、位于哪些文件、哪些界面会看到英文、是否愿意让 AI 补译。

### ② 10% ≤ R ≤ 20%（中等，需检阅）

1. 旧译迁移注入。
2. **AI 翻译新条目**：先读 `starsector-mod-localization-spec`（格式铁律），
   界面/功能文本按 `-content`，对话/叙事按 `translation-voice`，术语查 `shared\glossary.md`。
   > 注意 `translation-voice` 的"程序使用限制"：**长文本（对话/人物/叙事）必须逐段理解后亲自写**，
   > 不得用机器翻译或模板拼接；界面/功能短文本可批量处理但同样要过 `-content` 的自检清单。
3. 注入 + 生成
   **交检阅包**：`新译对照清单`（`locator` / `en` / `zh` / `note`，标出与旧译的差异）+
   `旧译不沿用的条目`（含理由）+ 完整中文版。
4. 跑 `-verify` 全部适用闸门。
5. **交用户检阅**，说明：新译条目数、R 的计算、哪些旧译被弃用及原因、需要用户重点看的条目。
6. 用户反馈后按 `-apply` 更新 → 重跑对应闸门 → 交付（`starsector-mod-delivery`）。

### ③ R > 20%（大量，不汉化）

1. 旧译迁移注入 → 生成"**旧译已就位、新增留空**"的**合并待填清单**（可拆多份，按文件/section 分片）：
   每项 = `locator` / `file` / `id` / `field` / `line` / `en` / `zh`（旧译已填；新增为空）/ `source` / `note`。
2. **不翻译任何新条目**（这是硬要求），产出两份清单：
   - **A. 全部旧汉化内容清单**（哪些条目已有中文、来自旧版哪个文件、是否被沿用或弃用）；
   - **B. 全部新增待译条目清单**（可按模块拆多份，附 `note` 上下文与所在文件）。
3. 附**工作量评估**：新增条目数、涉及文件、建议处理顺序（先术语密集区）、预计哪类文本最费时。
4. **交付给用户**：清单 + 说明 + "填完 `zh` 后我直接注入"的操作约定（用户不必碰文件结构）。
5. 用户译完 → 走 `-apply` 注入 → `-verify` → `starsector-mod-delivery`。

## 4. 完成标准

- [ ] 旧译迁移完成，且**弃用的旧译有理由记录**
- [ ] R 的统计过程留档（分子/分母/排除项），用户可复核
- [ ] 按档执行：① 已告知且未代译 ② 已交检阅 ③ 未翻译且已交完整清单
- [ ] 闸门：G1–G3 必过；动过 jar 加 G4；改了引用加 G5；交付前 G6
- [ ] `mod_info.json`/`*.version` 版本号与 changelog 已按 `starsector-mod-delivery` 处理（若本次含版本升级）
- [ ] 留档更新（映射、术语表、脚本、清单）

## 5. 反复踩到的坑（2026-09 追加，来自 Hostile Intercept 1.3.2→1.6.0 实战）

| 坑 | 现象 | 正确做法 |
|---|---|---|
| **管线顺序** | 先 `apply_zh.js` 再 `build_worklist.js` ⇒ 清单里抽到的是中文，回填全失败（"未译 94 条"） | 严格 **build → fill → apply**；每次重跑前先从 `mod_bak\..._EN_backup\` 还原英文原版 |
| **换行风格被抹平** | 注入脚本一律写 CRLF，而上游 `mod_info.json` / `*.version` 是 **LF-only** ⇒ 全文件 diff 噪声 | 注入器写盘时**探测并保持**原文件 EOL（`'keep'` 模式），交付前逐文件对比注入前的 `LF/CRLF` 计数 |
| **全角符号缺字形** | `－`(U+FF0D)/`／`(U+FF0F) 在 6742 字形外，游戏内显示 `?`（R3） | 减号/斜杠一律 ASCII；落笔后**必跑** `check_font_glyphs.js` |
| **Header 行的 `defaultValue`** | 只译 `fieldName`，`verify_all_data.js` 仍报英文残留 | LunaSettings 的 **Header 行**把 `defaultValue` 一起译（LunaLib 在 `tab` 为空时用它当分区标题）；非 Header 行一律不译 |
| **Radio 取值被译** | 译了 LunaLib 的 `Disabled`/`All Contacts`… ⇒ 代码 `when(string)` 不匹配，功能静默失效 | 取值保持英文，并在 `settings.json` 注释里加中文警示；校验脚本只提示不改 |
| **"有中文目录"≠"有汉化"** | 旧版存档只有 2 条中文串，却按"有旧汉化"走 ② 档 | 先做 §1 step 0 的体检，用数字说话 |

> 工具复用：本类任务的注入器/清单器结构直接抄 `_work\mod_work\Hostile Intercept\tools\`（`zh_table.json` 单一译文源 +
> `build_worklist.js` + `fill_review.js` + `apply_zh.js`（`--dry` + 结构自查 + EOL 保持）），比每次重写省一半时间。
