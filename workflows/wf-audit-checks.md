# wf-audit-checks · 校验审计（账本体检 + 探针复查）

> **触发词**："校验审计"、"这些校验还有用吗"、"校验一直没问题"、"别再跑 X 了"。
> 目的：让校验集合随实证**自我修剪** —— 有命中的升档保留，长期空转的降档，坏掉的修好或明确休眠。
> 需要读：`shared\verification-ledger.md`（机制与档位表）、`shared\script-registry.md`（D 节）。

## 阶段 1 · 读账本（AI 做，零成本）

```powershell
node <skills>\shared\scripts\ledger_report.js          # 人读报告
node <skills>\shared\scripts\ledger_report.js --json   # 机读
```

报告给出四类行动项：

| 输出 | 含义 | 处置 |
|---|---|---|
| **建议变更**（升/降档） | 账本与档位表不一致 | 确认后改 `verification-ledger.md` §8 |
| **需探针** | 运行 ≥10 次 0 命中且从未探针过 | 跑阶段 2 探针，**通过才允许降档** |
| **需修复** | 探针注入了缺陷却报不出来 | 这条校验是坏的 → 修脚本，**禁止降档/退役** |
| **未登记项** | 账本里有、档位表没登记 | 补登到 §8（新加的校验忘了登记） |

**关键规则**（`verification-ledger.md` §1–§5）：
- 红级（崩服/静默失效/丢汉化）校验**永不退役**，最多降 `sample`；
- **未探针通过的红级校验禁止降档**；
- 命中 ≥ 1 次的校验不允许停在 `dormant`（升级优先于降级）；
- `exit ≥ 2` 的运行**不计票**（调用错误不算校验结果）。

## 阶段 2 · 探针复查（M3，只对"需探针"项做）

**原理**：一条校验长期通过，可能是"确实没问题"，也可能是"**它根本没在工作**"。
用一个**故意注入的已知缺陷**去问它：你能不能发现？

**做法（严格限定）**：

1. **只在 `_work\_tmp\probe-<check>\` 下造副本**，绝不碰 `mods\<Mod>\`。
2. 注入**至少 2 个不同类型的已知缺陷** + 留**1 份干净对照**（用来测假阳性）。
3. 用 `run_check.js --probe` 跑，让记账与探针标记一起落库：

```powershell
# 探针（注入缺陷，期望 hit）
node <skills>\shared\scripts\run_check.js --check=<校验名> --expect-args=<N> --target=probe --probe `
     --note="注入<缺陷描述>" -- <命令...> <探针副本>

# 对照（干净副本，期望 clean —— 若这里 hit，说明校验有假阳性）
node <skills>\shared\scripts\run_check.js --check=<校验名> --expect-args=<N> --target=probe-control --probe `
     -- <命令...> <干净副本>
```

> `--expect-args=<N>` 务必填：它挡住"参数不足也返回 1"的脚本（实测 `verify_identifiers.js`），
> 否则一次错误调用会被记成"命中"，把这条校验的价值虚高（详见 `verification-ledger.md` §7.1）。

**判读**：

| 探针 | 对照 | 结论 |
|---|---|---|
| hit | clean | ✅ 校验有效 → `probeWorked`，可参与降档 |
| hit | hit | ⚠️ 有假阳性 → 记在案，先修误报再谈降档 |
| clean | clean | ❌ **校验失效** → 标 `需修复`，禁止降档/退役 |

**各校验的注入配方**（照着造，无需思考）：

| 校验 | 注入什么 | 期望 |
|---|---|---|
| `check_csv_quotes.js` | 在某单元格开头放一个 `“` | hit（归一化后拆列） |
| `check_rules_arg_quotes.js` | 在某行 `AddText "…"` 参数内嵌一个 `"` | hit（截断） |
| `check_font_glyphs.js` | 写入 `「」` 或 `艏` | hit（缺字形） |
| `check_content.js` | 写 `10%时`（裸 `%`）+ 删掉一个 `%s` | hit（R4/占位符） |
| `verify_identifiers.js` | 用 `patchdir.js` 把某**字段名**译成中文（只对副本） | hit（标识符含 CJK） |
| `check_u0001.js` | 把某映射译文的 `\u0001` 数量改掉 | hit |
| `verify_all_data.js` | 在 `designTypeColors` 造两个同名键 | hit（Duplicate key） |
| `check_encoding.js` | 给某个 `.json` 加 UTF-8 BOM | hit |
| `verify_u0001_jar.js` / `cmp_strings.js` / `check_refs.js` / `check_assets.js` / `check_sprites.js` / `check_deprecated.js` | 造一份"删掉一条引用/改一个签名/加一个 `@Deprecated` 调用"的副本 | hit |

> 首次探针已完成：`check_content.js` = hit（注入裸 `%` + 丢 `%s`）/ 对照 clean，结论"有效、无假阳性"。
> 记录见 `shared\verification-ledger.md` §7.5。

## 阶段 3 · 落笔（AI 做，必须人工确认）

1. 把确认后的档位改动写进 `shared\verification-ledger.md` §8（这是**权威档位表**，报告只是建议）。
2. 同步改 `shared\script-registry.md` D 节的 `tier` 列（两处必须一致）。
3. 若某条 `dormant`：在文档里保留一行**重新启用**命令，并注明休眠原因与日期。
4. 若某条 `需修复`：修脚本 → 重跑探针 → 通过后才允许继续走降档流程。
5. 档位若影响了工作流步骤（例如某条从 `base` 降为 `sample`）→ 同步改对应 `wf-*.md` / skill 的闸门描述。

## 阶段 4 · 自然语言触发词（用户不必记命令）

| 用户说法 | AI 动作 |
|---|---|
| "校验一直没问题" | 给本轮实际跑过的校验各记一次 `clean`（用 `run_check.js` 跑，不要手写账本） |
| "这次校验发现 X" | 记 `hit` + 备注 X；并检查该条是否需要升档 |
| "校验审计" | 执行阶段 1→2→3 |
| "别再跑 X 了" | 把 X 设为 `dormant`（红级需先探针通过）；在档位表注明 |

## 完成标准

- [ ] 报告中的"建议变更/需探针/需修复/未登记"四类全部有处置结论
- [ ] 档位表（`verification-ledger.md` §8）与 `script-registry.md` D 节 `tier` 列一致
- [ ] 每条降档决定都有依据（命中频率低 **且** 后果等级允许 **且** 探针通过）
- [ ] 探针产物只在 `_work\_tmp\`，`mods\` 未被触碰（用 git status / 哈希确认）
- [ ] 受影响的工作流/skill 描述已同步
