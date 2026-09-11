| 校验 | severity | tier | 备注 |
|---|---|---|---|
| `verify_identifiers.js` | red | base | 标识符含 CJK → 闪退（铁律 R7）。**永不退役** |
| `check_u0001.js` | red | base | `\u0001` 数量漂移 → StringConcatException（R6） |
| `verify_u0001_jar.js` | red | cond | 仅动过 jar |
| `check_encoding.js` | red | base | BOM/乱码 → 启动失败或乱码 |
| `check_csv_quotes.js` | red | base | 弯引号拆列 → 启动崩溃（R1） |
| `check_rules_arg_quotes.js` | red | cond | 仅当有 rules.csv；静默截断（R2） |
| `verify_all_data.js` | red | base | 数据层易漏区/键唯一性（R10） |
| `scan_data_stragglers.js` | red | base | **data 层提取完整性**：未被清单覆盖的人可读英文 = 0。G1（英文原版）与 G3（注入后）各跑一次 |
| `check_options_structure.js` | red | base | **options 结构等价**（rules/zgrstuff）：段数与 optionId 序列一致、无字面 `\n`；坏了启动崩溃而列数检查看不见 |
| `scan_logic_keys.js` | red | base | **逻辑键误译**（显示文本与查找键字面相同）：保留键被译 = 启动 Fatal（本项目实测 `LunaSettings.getBoolean("Nightcross",…)`） |
| `check_install_source.js` | red | base | **注入前置断言**：目标目录必须是英文原版，否则合成字段会被追加成"一行变两行 + optionId 重复" |
| `check_jar_patch_integrity.js` | red | cond | **补丁洁净性**：类集合一致 + 映射外常量改动 = 0（补丁脚本退化成全量替换会立刻暴露） |
| `check_homoglyphs.js` | yellow | base | 同形异义字符（西里尔/希腊伪拉丁）→ 字库缺字形显示 `?` + 英文检索静默失败 |
| `check_refs.js` | red | cond | 改过装配/舰船/武器/贴图引用 |
| `LoadTest.java` | red | cond | 离线类加载/实例化 + 脚本类存在性（skill 自带脚本，见 `script-registry.md` F 节） |
| `check_font_glyphs.js` | yellow | base | 缺字形 → `?`（R3）；零宽字符单列提示、不计命中 |
| `check_content.js` | yellow | base | 空译文/占位符/字段结构（skill 自带脚本） |
| `check_assets.js` | yellow | cond | 改过 `graphics/` 引用 |
| `check_sprites.js` | yellow | cond | 改过源码 `getSprite` |
| `check_deprecated.js` | yellow | cond | 版本升级场景 |
| `JsonProbe.java` | yellow | cond | 伪 JSON 存疑时（R8） |
| `cmp_strings.js` | yellow | cond | 仅 jar↔源码一致性证明 |
| `validate_star_system.ps1` | yellow | cond | 仅星系 mod（skill 自带脚本，见 F 节） |
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
`align_newjar_oldzh.js`、`find_crash.js`、`TestCsv.java`、`build_java_mod.ps1`、`build_kotlin_mod.ps1`、
`deliver.ps1`、`install-cfr.ps1`、`fork_src.ps1`、`probe_github.ps1`、`run_check.js`、`ledger_report.js`。

> `TestCsv.java` 是**排查期**的引擎级复现工具（不是每次交付该跑的闸门），故按"工具"登记；
> 位在 `script-registry.md` E 节。
