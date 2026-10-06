# wf-balance-revision · 按更改意见文档调整 mod 强度（数值平衡_revision）

> **任务分类 ⑨（工作流层）**。触发：手里有一份**成文的更改/平衡意见**（docx / md / 评论合集，
> 常见=mod 作者或社区写的"FDS更改意见"式文档），要**逐项落到 mod 数据里**调整强度。
> 与 `skills\starsector-mod-balance-patch\SKILL.md` 的分工：**skill 管"武器数值怎么定才合理"
> （锚点对照、断言式 CSV 手法、按 id 查核心表）；本 wf 管"整份文档怎么落地"**
> （舰船/武器/战机/战术系统/槽位/船插全覆盖 + 矛盾与假设留痕 + 闸门与烟测收尾）。
> **不用于**：跑不起来/崩溃（→ `wf-mod-fix`）、版本升级适配（→ `wf-game-update`）、汉化（→ `wf-localize`）。
> 需要读：`shared\env.md`、`shared\iron-rules.md`（R1/R8/R12/R15/R17/R18/R21）、`shared\conventions.md`；
> 武器锚点与 CSV 手法 → `starsector-mod-balance-patch`；烟测 → `wf-smoke-first.md`。

## 0. 开工（先取证，先备份，先落文档）

1. **查旧档**（conventions §6）：`_work\mod_work\<Mod>\` 有无既往配方/映射/工具，有就复用。
2. **备份**：`mods\<Mod>` → `_work\mod_bak\<Mod>_<版本>_backup_pre_balance_<日期>`（整目录复制）。
   动 jar 前另存 `jars\<X>.jar.orig`。
3. **意见文档落工作区**：docx = zip 包，`unzip` 后抽 `word/document.xml` 的 `<w:t>` 按段落拼文本
   （表格/批注/修订分别查 `w:tbl`/`comments.xml`/`w:ins`；**嵌入图片用 Read 看图转述**——
   截图常是"描述与面板不符"的证据）。纯文本存 `_work\mod_work\<Mod>\in\<文档名>.txt`，报告引用它。

## 1. 取证：把意见落成配方 `revision_items.json`

**中文名 → id 三通道**：舰船/战机本体 = `data\hulls\ship_data.csv` 的 `name` 列（含战机 hull 行）；
武器 = `data\weapons\weapon_data.csv` 的 `name` 列；描述/图鉴 = `data\strings\descriptions.csv`。
⚠️ 文档用字常与 mod 内实现有**别字**（实测：文档"塔里"=mod"塔利"、"忤悔"=mod"忏悔"）——
按"原值也能对上"来定案（忏悔：文档"原为200 结构"=文件 hitpoints 200 ✓）。

**每条意见 → 一个 item**，目标文件 `_work\mod_work\<Mod>\out\revision_items.json`：

```json
{
  "id": "S07-1",                       // 段落号-序号，报告回链用
  "doc": "部署点降低至2（原为3）",       // 文档原句（逐字抄）
  "kind": "csv_cell",                  // csv_cell | json_mut | ship_slot | text
  "file": "data/hulls/ship_data.csv",  // 相对 mod 根
  "locator": {"matchId": "fds_prudence", "column": "fleet pts"},
  "assertOld": "3",                    // 改前必须等于；不等 ⇒ 记 conflict、默认仍应用
  "value": "2",
  "note": "审慎 DP 3→2"
}
```

- `kind=csv_cell`：CSV 单元格（ship_data / weapon_data / wing_data / hull_mods）。
- `kind=json_mut`：`.ship`/`.variant`/`.skin` 的 JSON 字段（`builtInMods` 增删等）。
- `kind=ship_slot`：`.ship` 的 `weaponSlots[i]` 的 `type`/`arc`（按 id 定位）。
- `kind=text`：descriptions.csv 或武器名等**点名要改的文本**（唯一允许动文本列的通道）。

### 1.1 字段字典（0.98a 实测语义，直接用别再查）

| 文档用语 | 落点 |
|---|---|
| 部署点/DP | ship_data.csv `fleet pts` |
| 装配点/OP | ship_data.csv `ordnance points`；武器 = weapon_data.csv `OPs` |
| 幅能容量/耗散 | `max flux` / `flux dissipation` |
| 结构/装甲 | `hitpoints` / `armor rating` |
| 峰值时间 | `peak CR sec` |
| 月度补给 | `supplies/mo` |
| 护盾效率 | `shield efficiency` |
| 相位线圈维持 | `phase upkeep`（**先查原版锚点定单位**，见 1.2） |
| 航速 | `max speed`；战机更换时间 = wing_data.csv `refit`；战机结构/装甲 = 战机 hull 行 `hitpoints`/`armor rating` |
| 战术系统 | ship_data.csv `system id` 列。常用对照：热诱弹发射器=`flarelauncher`、追踪热诱弹=`flarelauncher_active`、机动推进器=`maneuveringjets`、加速填弹器=`ammofeed`、导弹自动工厂=`forgevats`、烈焰推进器=`burndrive`（拿不准 → 按 id 查核心 `starsector-core\data\strings\descriptions.csv` 中文名） |
| 槽位类型/射界 | `.ship` 的 `weaponSlots[i]`：`type`(ENERGY/BALLISTIC/HYBRID/SYNERGY/UNIVERSAL/COMPOSITE/BUILT_IN)、`arc`(炮塔射界)、`angle`(初始朝向)。"内置武器"=`.ship` `builtInWeapons`；"内置船插"=`builtInMods`（如 牵引线缆=原版 `tow_cable`） |
| 武器单发/备弹/齐射/弹速/弹体血量 | weapon_data.csv `damage/shot` / `ammo` / `burst size` / `proj speed` / `proj hitpoints`；**再生弹药** = `ammo/sec`（>0 即再生）；开火间隔 = `chargeup+chargedown`（burst 另乘 `burst delay`） |
| 光束 DPS | `damage/second` 列 |

### 1.2 三类"意见 ≠ 文件"的处置（本 wf 的核心纪律）

1. **原值不符**（文档"原为X"≠文件现值）：**以文件现值为基线，仍设文档目标值**；
   全部记入 `out\value_conflicts.md`（文档句、文档原值、文件现值、处置），交付时提醒用户找作者核对。
   实测教训：FDS 大船 DP 全系不符（文档记 20/35/60，文件 16/20/32）而 OP/容量/装甲全符
   ⇒ 文档 DP 基线来自另一版本，目标值仍有效。
2. **指代不明**（"中央/后方第 N 个槽位"）：先打印该舰 `.ship` 全部槽位表
   （`id/size/type/mount/x/y/ang/arc`），按**方位+数值锚点**定槽位
   （文档"原为约135"⇔arc=140 这类数字锚点是铁证），**把判定依据写进 item 的 note**。
   "射界对齐恐惧-级"类：按**只放宽不收窄**执行——`arc := max(现值, 对齐目标)`，避免把加_strength 做成削弱；
   "扩展至能向正前方集火"：`arc := 2×|angle|+40`（正前方留 40° 集火锥）。
   全部假设记入 `out\assumptions.md`。
3. **文本/描述改动**：只动文档点名的条目；改描述前**先读实际数据行为**
   （如"凯恩爆能炮描述与面板不符"= 先看 burst/damage/proj 再重写），保持原文风格与长度量级。

## 2. 应用：断言式批量执行

- 手法与 `starsector-mod-balance-patch` §3 相同：**每格改前断言旧值**，不匹配即报错退出（不许静默）。
- 本仓库现成工具：`_work\mod_work\<Mod>\tools\balance_apply.js`（配方驱动，CSV 状态机防 R1 引号事故、
  保持原行尾 R17、UTF-8 无 BOM、跳过 `#` 行 R21；JSON 走 parse→mutate→stringify(2空格)，
  应用前先做"空转对照"——原文件 parse→stringify 与原文 byte 比对，不一致就停）。
- 一次跑完全部 items，输出 `applied / skipped(conflict) / failed` 三张表；
  **failed=0 才进下一阶段**，skipped 逐条人工复核。

## 3. 特殊项：新船插（文档点名"参考 XX mod 加插件"时）

以 FDS 2026-10 实战为模板（后置槽位射程补正，参考 狐狐船包 `data\hullmods\gcsRangeSync.java`）：

1. 新建 `<Mod>\src\data\hullmods\FDS_<名字>.java`：`BaseHullMod` +
   `applyEffectsAfterShipCreation` 挂 `WeaponRangeModifier` 监听器，`getWeaponRangeFlatMod`
   按 `slot.getLocation().x` 给平坦射程（实现逐行参考引用对象，常量注明出处）。
2. 编译：`javac --release 8 -cp <game>\starsector-core\starfarer.api.jar;... -d <临时out>`（jar 内旧 class 是 major 51，新类 52 可混装；env.md §2 JDK 路径）。
   ⚠️ Git Bash 传 `-cp` 多段路径会被 MSYS 搅坏（env.md §4.7）⇒ 命令写进**纯 ASCII .cmd** 再 `cmd /c`。
3. `jar uf <Mod>.jar -C <out> data/...class`（条目名正斜杠 R9；改前存 `.jar.orig`）。⚠️ `jar uf -C` 后**一次只跟一个文件**——第二个文件会按当前目录解析、假报"没有这个文件或目录"（与 `# wf-balance-revision · 按更改意见文档调整 mod 强度（数值平衡_revision）

> **任务分类 ⑨（工作流层）**。触发：手里有一份**成文的更改/平衡意见**（docx / md / 评论合集，
> 常见=mod 作者或社区写的"FDS更改意见"式文档），要**逐项落到 mod 数据里**调整强度。
> 与 `skills\starsector-mod-balance-patch\SKILL.md` 的分工：**skill 管"武器数值怎么定才合理"
> （锚点对照、断言式 CSV 手法、按 id 查核心表）；本 wf 管"整份文档怎么落地"**
> （舰船/武器/战机/战术系统/槽位/船插全覆盖 + 矛盾与假设留痕 + 闸门与烟测收尾）。
> **不用于**：跑不起来/崩溃（→ `wf-mod-fix`）、版本升级适配（→ `wf-game-update`）、汉化（→ `wf-localize`）。
> 需要读：`shared\env.md`、`shared\iron-rules.md`（R1/R8/R12/R15/R17/R18/R21）、`shared\conventions.md`；
> 武器锚点与 CSV 手法 → `starsector-mod-balance-patch`；烟测 → `wf-smoke-first.md`。

## 0. 开工（先取证，先备份，先落文档）

1. **查旧档**（conventions §6）：`_work\mod_work\<Mod>\` 有无既往配方/映射/工具，有就复用。
2. **备份**：`mods\<Mod>` → `_work\mod_bak\<Mod>_<版本>_backup_pre_balance_<日期>`（整目录复制）。
   动 jar 前另存 `jars\<X>.jar.orig`。
3. **意见文档落工作区**：docx = zip 包，`unzip` 后抽 `word/document.xml` 的 `<w:t>` 按段落拼文本
   （表格/批注/修订分别查 `w:tbl`/`comments.xml`/`w:ins`；**嵌入图片用 Read 看图转述**——
   截图常是"描述与面板不符"的证据）。纯文本存 `_work\mod_work\<Mod>\in\<文档名>.txt`，报告引用它。

## 1. 取证：把意见落成配方 `revision_items.json`

**中文名 → id 三通道**：舰船/战机本体 = `data\hulls\ship_data.csv` 的 `name` 列（含战机 hull 行）；
武器 = `data\weapons\weapon_data.csv` 的 `name` 列；描述/图鉴 = `data\strings\descriptions.csv`。
⚠️ 文档用字常与 mod 内实现有**别字**（实测：文档"塔里"=mod"塔利"、"忤悔"=mod"忏悔"）——
按"原值也能对上"来定案（忏悔：文档"原为200 结构"=文件 hitpoints 200 ✓）。

**每条意见 → 一个 item**，目标文件 `_work\mod_work\<Mod>\out\revision_items.json`：

```json
{
  "id": "S07-1",                       // 段落号-序号，报告回链用
  "doc": "部署点降低至2（原为3）",       // 文档原句（逐字抄）
  "kind": "csv_cell",                  // csv_cell | json_mut | ship_slot | text
  "file": "data/hulls/ship_data.csv",  // 相对 mod 根
  "locator": {"matchId": "fds_prudence", "column": "fleet pts"},
  "assertOld": "3",                    // 改前必须等于；不等 ⇒ 记 conflict、默认仍应用
  "value": "2",
  "note": "审慎 DP 3→2"
}
```

- `kind=csv_cell`：CSV 单元格（ship_data / weapon_data / wing_data / hull_mods）。
- `kind=json_mut`：`.ship`/`.variant`/`.skin` 的 JSON 字段（`builtInMods` 增删等）。
- `kind=ship_slot`：`.ship` 的 `weaponSlots[i]` 的 `type`/`arc`（按 id 定位）。
- `kind=text`：descriptions.csv 或武器名等**点名要改的文本**（唯一允许动文本列的通道）。

### 1.1 字段字典（0.98a 实测语义，直接用别再查）

| 文档用语 | 落点 |
|---|---|
| 部署点/DP | ship_data.csv `fleet pts` |
| 装配点/OP | ship_data.csv `ordnance points`；武器 = weapon_data.csv `OPs` |
| 幅能容量/耗散 | `max flux` / `flux dissipation` |
| 结构/装甲 | `hitpoints` / `armor rating` |
| 峰值时间 | `peak CR sec` |
| 月度补给 | `supplies/mo` |
| 护盾效率 | `shield efficiency` |
| 相位线圈维持 | `phase upkeep`（**先查原版锚点定单位**，见 1.2） |
| 航速 | `max speed`；战机更换时间 = wing_data.csv `refit`；战机结构/装甲 = 战机 hull 行 `hitpoints`/`armor rating` |
| 战术系统 | ship_data.csv `system id` 列。常用对照：热诱弹发射器=`flarelauncher`、追踪热诱弹=`flarelauncher_active`、机动推进器=`maneuveringjets`、加速填弹器=`ammofeed`、导弹自动工厂=`forgevats`、烈焰推进器=`burndrive`（拿不准 → 按 id 查核心 `starsector-core\data\strings\descriptions.csv` 中文名） |
| 槽位类型/射界 | `.ship` 的 `weaponSlots[i]`：`type`(ENERGY/BALLISTIC/HYBRID/SYNERGY/UNIVERSAL/COMPOSITE/BUILT_IN)、`arc`(炮塔射界)、`angle`(初始朝向)。"内置武器"=`.ship` `builtInWeapons`；"内置船插"=`builtInMods`（如 牵引线缆=原版 `tow_cable`） |
| 武器单发/备弹/齐射/弹速/弹体血量 | weapon_data.csv `damage/shot` / `ammo` / `burst size` / `proj speed` / `proj hitpoints`；**再生弹药** = `ammo/sec`（>0 即再生）；开火间隔 = `chargeup+chargedown`（burst 另乘 `burst delay`） |
| 光束 DPS | `damage/second` 列 |

### 1.2 三类"意见 ≠ 文件"的处置（本 wf 的核心纪律）

1. **原值不符**（文档"原为X"≠文件现值）：**以文件现值为基线，仍设文档目标值**；
   全部记入 `out\value_conflicts.md`（文档句、文档原值、文件现值、处置），交付时提醒用户找作者核对。
   实测教训：FDS 大船 DP 全系不符（文档记 20/35/60，文件 16/20/32）而 OP/容量/装甲全符
   ⇒ 文档 DP 基线来自另一版本，目标值仍有效。
2. **指代不明**（"中央/后方第 N 个槽位"）：先打印该舰 `.ship` 全部槽位表
   （`id/size/type/mount/x/y/ang/arc`），按**方位+数值锚点**定槽位
   （文档"原为约135"⇔arc=140 这类数字锚点是铁证），**把判定依据写进 item 的 note**。
   "射界对齐恐惧-级"类：按**只放宽不收窄**执行——`arc := max(现值, 对齐目标)`，避免把加_strength 做成削弱；
   "扩展至能向正前方集火"：`arc := 2×|angle|+40`（正前方留 40° 集火锥）。
   全部假设记入 `out\assumptions.md`。
3. **文本/描述改动**：只动文档点名的条目；改描述前**先读实际数据行为**
   （如"凯恩爆能炮描述与面板不符"= 先看 burst/damage/proj 再重写），保持原文风格与长度量级。

## 2. 应用：断言式批量执行

- 手法与 `starsector-mod-balance-patch` §3 相同：**每格改前断言旧值**，不匹配即报错退出（不许静默）。
- 本仓库现成工具：`_work\mod_work\<Mod>\tools\balance_apply.js`（配方驱动，CSV 状态机防 R1 引号事故、
  保持原行尾 R17、UTF-8 无 BOM、跳过 `#` 行 R21；JSON 走 parse→mutate→stringify(2空格)，
  应用前先做"空转对照"——原文件 parse→stringify 与原文 byte 比对，不一致就停）。
- 一次跑完全部 items，输出 `applied / skipped(conflict) / failed` 三张表；
  **failed=0 才进下一阶段**，skipped 逐条人工复核。

## 3. 特殊项：新船插（文档点名"参考 XX mod 加插件"时）

以 FDS 2026-10 实战为模板（后置槽位射程补正，参考 狐狐船包 `data\hullmods\gcsRangeSync.java`）：

1. 新建 `<Mod>\src\data\hullmods\FDS_<名字>.java`：`BaseHullMod` +
   `applyEffectsAfterShipCreation` 挂 `WeaponRangeModifier` 监听器，`getWeaponRangeFlatMod`
   按 `slot.getLocation().x` 给平坦射程（实现逐行参考引用对象，常量注明出处）。
2. 编译：`javac --release 8 -cp <game>\starsector-core\starfarer.api.jar;... -d <临时out>`（jar 内旧 class 是 major 51，新类 52 可混装；env.md §2 JDK 路径）。
   ⚠️ Git Bash 传 `-cp` 多段路径会被 MSYS 搅坏（env.md §4.7）⇒ 命令写进**纯 ASCII .cmd** 再 `cmd /c`。
3. `jar uf <Mod>.jar -C <out> data/...class`（条目名正斜杠 R9；改前存 `.jar.orig`）。
   ⚠️ `jar uf -C` 后**一次只跟一个文件**——第二个文件会按当前目录解析、假报"没有这个文件或目录"
   （与文件名含不含 `$` 无关；env.md §4.10）；**含内部类的类必须把 `Foo$Bar.class` 一并入包**，
   否则要到加载探针/战斗期才发现。
4. 注册：`data\hullmods\hull_mods.csv` 加行（id/中文名/desc/script 列，内置专用则 `hiddenEverywhere` 留空不外显）；
   目标舰 `.ship` 的 `builtInMods` 数组追加该 id。
5. 编译自证（**类链接探针**，实战必备）：解包回读 class 魔数 `CAFEBABE`、major=52；
   再用游戏真实 jar 路径做 `Class.forName` + `newInstance` 探针每个类（**含 `$Bar` 内部类**），
   并 `isInstance` 验证监听器接口实现（探针程序 `--release 17` + `-noverify` + logs 重定向，env.md §4）。

## 4. 闸门（G 编号沿 conventions §5；数值补丁适用子集）

| 闸门 | 命令/做法 | 通过标准 |
|---|---|---|
| G3' 结构安全 | `node <skills>\shared\scripts\check_csv_quotes.js <改过的每个csv>`；改过的 `.ship/.variant/.skin` 逐个 `JSON.parse`；行尾/BOM 与改前一致 | 全 0 |
| 译文列零漂移 | `git -C mods\<Mod> diff` 逐文件核对：**文本列差异 = 文档点名项**（本次实战 = 塔利改名 + 凯恩/怨恨描述），其余文本列零变动 | 0 计划外文本差异 |
| G5 引用闭合 | `node <skills>\shared\scripts\check_refs.js <modDir> <game根>` | 0 真问题 |
| G5' 类加载 | 新 class 解包回读魔数/版本；烟测日志无 `NoSuchField/ClassNotFound` | 通过 |
| **深烟测（关口）** | 动了 jar / system id / 船插注册 ⇒ **必须**：`powershell -NoProfile -ExecutionPolicy Bypass -File <skills>\shared\scripts\smoke_run.ps1 -ModIds <modId> -NewGame` | 退出码 0（判定只看它；FAIL 按 `wf-smoke-first` 阶段 2 查表，不要通读日志） |
| G6 装船目检 | 烟测 PASS 后玩家侧抽查：refit 界面看 2–3 艘重改舰船的槽位射界/OP/描述 tooltip | 无异常 |

> 数值改动本身烟测查不出对错——**对错由断言与配方回链保证**，烟测只保"没把 mod 弄坏"。

## 5. 收尾

1. **`BALANCE_PATCH.md`**（mod 根，双语，可转发）：意见来源 → 每舰/武器/战机前后值表 →
   **矛盾清单**（1.2-1）→ **假设清单**（1.2-2/3）→ 未动区域与理由。
2. **`Changelog.txt` 记录一笔（用户要求过，默认必做）**：⚠️ 先验编码再写（上游 changelog 常为
   ASCII/GBK，禁 UTF-8 覆盖 GBK=全文乱码；env.md §3），保持原行尾与**制表符缩进**，新条目**置顶**，
   格式沿用既有 `[日期] /(版本) / Changes: / 分类:` 结构；标题行标注"local balance revision"并指向 BALANCE_PATCH.md。
3. **详细说明 docx（中文交付件，用户要才做）**：python-docx 生成（`pip install python-docx`，样式设
   `w:eastAsia=微软雅黑`），结构=头部元信息表/背景/舰船·武器·战机逐表前后值/新船插专章/文本改动/执行口径/矛盾清单/验证与回滚；
   落 `_work\mod_work\<Mod>\out\`（**不放 mod 根**，避免混进交付 zip）。
4. `项目说明.md`（若有）补一节"强度调整记录"；git commit（mod 仓库，信息=动作：对象；原因）。
5. 台账：`_work\mod_work\<Mod>\` 留 revision_items.json / value_conflicts.md / assumptions.md / 工具脚本；
   新增**跨 mod 可复用**脚本才进 `<skills>\shared\scripts\` 并登记 `script-registry.md`；
   新坑固化为 iron-rule 或本 wf 增补（R 编号）。
6. 交付 zip（可选，用户要才做）：`starsector-mod-delivery` 简化档。

## 完成标准

- [ ] 意见文档已转纯文本落 `in\`，图片证据已转述；
- [ ] 每条意见都有 item 与回链；`applied+skipped+failed = 意见总数`，failed=0；
- [ ] 原值冲突 100% 记录进 `value_conflicts.md`，指代假设 100% 记录进 `assumptions.md`；
- [ ] G3'/译文零漂移/G5/G5'/深烟测 全过；改动清单 = 配方清单（git diff 无计划外差异）；
- [ ] Changelog.txt 已按原编码/制表符风格置顶记一笔（或注明本次不记的理由）；
- [ ] `BALANCE_PATCH.md` 可独立转发（外人不懂聊天记录也能看懂为什么这么改）；
- [ ] mod 仓库 git 提交 + 台账/索引更新。

## 实战记录

- **2026-10-07 FDS_ROTS 0.11.4m**（31 舰 + 16 武器 + 8 战机 + 新船插）：配方与结果见
  `_work\mod_work\FDS_ROTS\out\{revision_items, value_conflicts, assumptions}.*` 与 mod 根 `BALANCE_PATCH.md`；
  DP 系矛盾、塔利/忏悔别字、"中后方4槽"判定等一手经验都已回灌本文相应章节。
- **烟测战果**：第一轮深烟测加载 PASS 但建存档被弹窗挡住 ⇒ 根因是系统 id 凭记忆写错（加速填弹器/导弹自动工厂的正确 id = `ammofeed`/`forgevats`，§1.1 字典已修正）——**烟测 newgame 段失败先查自己的改动，再怀疑脚手架**；配套补了"类链接探针"（§3 第 5 步）。
