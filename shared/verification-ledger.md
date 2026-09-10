# 校验记账本与档位（verification ledger）

> **解决的问题**：校验清单是静态的——每条校验都是"第一次遇到问题"时加的，
> 之后无论它是否还有价值，都照样占步骤、占上下文。本文件给它加**记忆 + 计票 + 降档**机制。
>
> **机制来源**：Risk-Based Testing（按"失败概率 × 后果严重度"决定投入）、
> Mutation Testing（用注入缺陷验证"这条校验到底能不能发现东西"）、
> 历史结果驱动的回归测试选择（从未失败过的测试 → 降级）、flaky test quarantine（设状态而非删除）。

## 1. 三条铁律（防止机制本身变成负担）

1. **档位决定"要不要加载/执行"，不决定"要不要保留知识"**。休眠的校验定义**永远留在文件里**，
   只是不再默认读进上下文、不再默认执行。省的是上下文，不是能力。
2. **机械记账，不靠判断**：记的是"检查项 + 是否命中（退出码）"，**绝不记原始输出**。
   账本自己不能变成吃上下文的东西。
3. **频率 ≠ 价值**：退役判据是 **命中频率 × 后果等级（severity）** 两轴。红级校验
   再长期通过也**不退役**，最多降为抽样（因为漏一次的代价是崩服）。

## 2. 后果等级（severity）

| 级 | 权重 | 含义 | 判据 |
|---|---|---|---|
| **red** | 3 | 违反 ⇒ **崩溃 / 静默失效 / 丢汉化** | 症状玩家无法绕过，或错误不可见 |
| **yellow** | 2 | 违反 ⇒ **数据错 / 显示 `?` / 部分失译** | 玩家能看出不对，但不崩 |
| **green** | 1 | 违反 ⇒ 卫生问题、交付噪音 | 不影响游戏运行 |

## 3. 档位（tier）= 加载策略

| 档位 | 何时执行 | 何时升入 | 何时降出 |
|---|---|---|---|
| `base` | **每次相关任务必跑**（步骤可内联在工作流里） | 红级 且 命中 ≥ 1 次 | 红级只降 `sample`；黄/绿见下 |
| `cond` | **条件触发**（该场景存在时才跑，如动了 jar 才跑 jar 校验） | 命中 ≥ 1 次 | 连续 **10** 次运行 0 命中 → `sample` |
| `sample` | **每 10 次任务跑 1 次**，或本次改动风险高时跑 | 红级 且 再次命中；或黄级命中 ≥ 2 | 连续 **25** 次运行 0 命中 → `dormant` |
| `dormant` | 不主动执行；保留定义 + 一行"重新启用"命令 | 手动 / 探针发现它其实能命中 | 手动 |

**升级优先于降级**：同一账本里命中次数 ≥ 1 的校验，**不允许**停留在 `dormant`。

## 4. 探针复查（M3，防"温室效应"）

**问题**：一条校验连续 25 次通过，可能是"确实没问题"，也可能是"**它根本没在工作**"
（正则写错、列名变了、字体目录路径失效）。纯计票会把最后一道防线撤掉。

**做法**：在 `_work\_tmp\` 下复制一份数据，**故意注入一个已知缺陷**，跑该校验，看是否报警。

- 报警 ⇒ `probeWorked: true`，计票有效，可以继续走降档。
- **没报警 ⇒ 标记 `需修复`，禁止降档/退役**（这条校验是坏的，不是多余的）。
- **未探针过的校验禁止退役**。
- 探针**只动 `_work\_` 下的副本，绝不碰 `mods\<Mod>\`**。
- 探针按需执行（`workflows\wf-audit-checks.md`），不混进日常汉化流程。

## 5. 计票公式

```
prio(check) = Σ(severity权重 × 每次命中) − c × 运行次数      # c 默认 1
```

`prio > 0` ⇒ 这条校验的历史价值为正，保留甚至升级。
`prio ≤ 0` ⇒ 进入降档流程（**但红级 + 未探针 的校验不降**）。

## 6. 触发词（手动记票）

用户/AI 可以用自然语言直接驱动记账，不必记命令：

| 说法 | 含义 | 落库 |
|---|---|---|
| "校验一直没问题" | 本轮该跑的都跑了、都干净 | 各 `base`/`cond` 记 `clean` |
| "这次校验发现 X" | 某条校验命中了 | 命中项记 `hit` + 备注 |
| "校验审计" | 跑聚合报告 + 探针复查 | 读账本 → 输出升降档建议 |
| "别再跑 X 了" | 手动休眠某条 | 该条 → `dormant`（红级需探针通过才允许） |

## 7. 落库位置

| 文件 | 作用 |
|---|---|
| `shared\verification-ledger.md` | 本文件：机制 + 档位表（人读，**报告脚本的档位来源**） |
| `shared\verification-ledger.jsonl` | **append-only** 机械记账，一行一次运行 |
| `shared\scripts\run_check.js` | 包装执行校验 → 自动记账（退出码） |
| `shared\scripts\ledger_report.js` | 聚合 → 升降档/退役候选/需探针 报告 |

### 7.1 已知局限（必须知道，否则账本会被污染）

**退出码约定并不被所有脚本遵守** —— 实测 `verify_identifiers.js` 在**用法错误时也返回 1**，
若不处理，一次错误调用就会被记成"命中"，把这条校验的价值虚高。

`run_check.js` 的两级防线：

1. **推荐**：给每条调用加 `--expect-args=<N>` 声明该命令最少需要几个参数（只数**脚本自身**的参数，
   自动跳过 `node`/`java`/`powershell -File` 等解释器包装）。不足即判 `invalid`、不计票。
2. **兜底**：`exit=1` 且**完全无输出**也判 `invalid`。
3. 真有意义的"静默命中"用 `--allow-silent-hit` 显式放行。

**仍存在的局限**：若"目标不存在"与"校验发现问题"返回同一个退出码（都返回 1），
账本会把"跑不起来"记成"命中"。**规避方式：跑之前先确认目标存在**
（目录/文件存在性检查），或用 `--expect-args` + 先决条件断言把它挡住。

> 因此：`hit` 只是**线索**，不是判决。任何一条校验连续多次 hit 而实际没发现问题时，
> 应先怀疑"它是不是在报调用错误"，而不是先怀疑 mod。


记账行格式：

```json
{"t":"2026-08-20T10:00:00+08:00","check":"verify_identifiers.js","target":"<Mod>","exit":1,"hit":true,"probe":false,"note":""}
```

- `exit: 2+`（用法错误/文件缺失）= **不计票**（既不算命中也不算干净），避免把调用错误当成校验有效。
- `seed: true` = **账本建立前的人工补录**（依据是事故记录、而非机械采集）。补录只允许写"有据可查的命中/复查"，
  不许编造数字；有 `seed` 的行会随时间被机械记录稀释。
- `probe: true` = 该次是**探针运行**（§4），用于验证校验有效性，计入 `probes`/`probeWorked`。

## 7.5 首次探针结果与一个真实发现

**探针（对 `check_content.js`）**：在 `_work\_tmp\probe-ledger\` 造两份 CSV ——
一份注入两个已知缺陷（字面裸 `%` 后接汉字、丢失 `%s`），一份干净对照：

| 目标 | 结果 | 结论 |
|---|---|---|
| `probe_content.csv`（注入缺陷） | `hit`（报 2 ERROR + 1 WARN） | 校验**有效**：能发现注入的缺陷 |
| `clean_content.csv`（干净） | `clean` | **无假阳性** |

⇒ `check_content.js` 计票有效，可参与升降档。

**真实发现（顺带命中）**：`check_font_glyphs.js` 扫官方中文核心
`starsector-core\data\campaign\rules.csv` 时命中 **U+200B（零宽空格）×3**
（片段："们发展出了丰富多彩的​社会环境​​、世界"）。
这不是本技能库的产物，而是**官方中文包的小瑕疵**：零宽字符无字形，渲染为空（不会显示成 `?`，
与 R3 的普通缺字形表现不同）。影响极小，仅提示"官方核心也不是零缺陷基线"。

> 已据此修正 `check_font_glyphs.js` 的提示语：区分"会显示为 `?`"与"零宽字符会不可见"。


## 8. 当前档位表（维护入口）

> 新增校验时必须在此登记（同时更新 `script-registry.md` 的 severity/tier 列）。
> 修改本表后跑 `node shared\scripts\ledger_report.js` 复核是否与账本冲突。

| 校验 | severity | tier | 备注 |
|---|---|---|---|
| `verify_identifiers.js` | red | base | 标识符含 CJK → 闪退（铁律 R7）。**永不退役** |
| `check_u0001.js` | red | base | `\u0001` 数量漂移 → StringConcatException（R6） |
| `verify_u0001_jar.js` | red | cond | 仅动过 jar |
| `check_encoding.js` | red | base | BOM/乱码 → 启动失败或乱码 |
| `check_csv_quotes.js` | red | base | 弯引号拆列 → 启动崩溃（R1） |
| `check_rules_arg_quotes.js` | red | cond | 仅当有 rules.csv；静默截断（R2） |
| `verify_all_data.js` | red | base | 数据层易漏区/键唯一性（R10） |
| `check_refs.js` | red | cond | 改过装配/舰船/武器/贴图引用 |
| `LoadTest.java` | red | cond | 离线类加载/实例化 + 脚本类存在性（skill 自带脚本，见 `script-registry.md` F 节） |
| `validate_star_system.ps1` | yellow | cond | 仅星系 mod（skill 自带脚本，路径见 `script-registry.md` F 节） |
| `check_font_glyphs.js` | yellow | base | 缺字形 → `?`（R3） |
| `check_content.js` | yellow | base | 空译文/占位符/字段结构 |
| `check_assets.js` | yellow | cond | 改过 `graphics/` 引用 |
| `check_sprites.js` | yellow | cond | 改过源码 `getSprite` |
| `check_deprecated.js` | yellow | cond | 版本升级场景 |
| `JsonProbe.java` | yellow | cond | 伪 JSON 存疑时（R8） |
| `validate_star_system.ps1` | yellow | cond | 仅星系 mod |
| `cmp_strings.js` | yellow | cond | 仅 jar↔源码一致性证明 |
| `scan_stragglers.js` | green | sample | 漏译网；`sweep_sentences.js` 是其句子级补充 |
| `sweep_sentences.js` | green | sample | 专治注释夹折叠漏译 |
| `verify_patched.js` | green | sample | 迁移场景的合并版扫描 |
| `csvcheck.js` | green | sample | 只读列检查（`verify_all_data.js` 已覆盖常见段） |
| `jsonkeys.js` | green | sample | 键对比，排查期用 |
| `build_worklist2.js` | green | dormant | 旧版清单生成器，已被 `scan_jar_sources.js` 取代 |

**不登记为校验**（属工具/提取/写入，不参与计票）：
`build_data_worklist.js`、`build_jar_worklist.js`、`scan_jar_sources.js`、`analyze_jar_strings.js`、
`extract_jar_constants.js`、`patcher.js`、`patchdir.js`、`rezip.js`、`migrate_*.js`、
`translate_missions.js`、`csvlib.js`、`pseudojson.js`、`classparser.js`、`extract_old_map.js`、
`align_newjar_oldzh.js`、`find_crash.js`、`build_java_mod.ps1`、`build_kotlin_mod.ps1`、
`deliver.ps1`、`install-cfr.ps1`、`fork_src.ps1`、`probe_github.ps1`。
