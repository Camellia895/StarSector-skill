---
name: starsector-mod-balance-patch
description: Starsector（远行星号）mod 的数值平衡补丁：玩家/社区反馈武器或舰船超模时（典型场景=作者弃坑、社区接手），把抱怨翻译成有原版基准支撑的数据修改。覆盖：评论数字与数据文件逐项取证、按同病模式排查全家族、以核心中文 weapon_data.csv 为基准的锚点对照（按 id 查——核心武器名已中文化；列语义：type 列=伤害类型而非挂载类型、energy/shot=幅能/发、射速=1/(chargeup+chargedown)、impact 列=数字语义未明勿动）、带旧值断言的 CSV 修改模式、译文列零变动校验（汉化 mod 上动数值不碰文本）、中英双语补丁说明 BALANCE_PATCH.md、git 提交与 zip 重打包。**不用于**：mod 跑不起来/崩溃（见 wf-mod-fix 与 wf-launch-audit）、版本升级适配（见 wf-game-update）、文本汉化（见 wf-localize）。
---

# mod 数值平衡补丁（社区反馈 → 有据可查的数据修改）

**职责**：把"某武器/舰船超模"的社区反馈落成**有原版基准支撑、可转发、可回滚**的数据修改。
**不做**：让跑不起来的 mod 跑起来（→ `wf-mod-fix`）、版本适配（→ `wf-game-update`）、汉化（→ `wf-localize`）。
**上游**：玩家评论 / 用户指示。**下游**：`starsector-mod-delivery`（重打包）。
**必读**：`<skills>\shared\env.md`、`<skills>\shared\conventions.md`（§1.5 交付命名）。

## 0. 取证：评论数字 vs 数据文件（先证明评论说得对/错）

1. 从评论逐项抄数字 → 打开数据文件逐项核对（武器在 `data/weapons/weapon_data.csv`，同名 `.wpn` 文件只含视觉/音效不含数值；弹体 `.proj` 一般无 speed 字段，弹速以 CSV `proj speed` 列为准）。
2. 记录矛盾：评论数字 ≠ 文件现值时以文件为准并在补丁说明里写明（可能版本不同）。
3. **按同病模式排查全家族**：抱怨点往往是"设计语言"问题（如"能量伤害弹道炮+高额EMP"）——grep 同 mod 的同类武器/同一作者的其它行，单独修两把小型会让更超模的大型成为新的版本答案（2026-10-02 Hyperion 实测：大型米诺陶的 OP 效率比被点名的小型还差 40%）。

## 1. 基准对照（锚点表，0.98a 核心实测）

**权威数据源 = 本机核心中文 `starsector-core/data/weapons/weapon_data.csv`**；⚠️ **武器名已中文化，必须按 `id` 列查**（`lightac`/`mjolnir`/`hil`…），按名查全空。

| 锚点（按被改武器的槽位+类型选） | OP | 输出 | 射程 | 幅能 |
|---|---|---|---|---|
| Mjolnir Cannon（L 弹道，能量伤害——能量弹道的定价锚点） | 24 | 533 E-dps + 267 EMP | 900 | 667/s（1.25/dmg） |
| High Intensity Laser（L 光束） | 20 | 500 dps | 1000 | 400/s |
| Tachyon Lance（L 光束） | 25 | 1500 dps + 1000 EMP | 1000 | 2000/s |
| Light Needler（S 动能） | 8 | 148 kin dps | 700 | 119/s |
| Ion Cannon（S 能量+EMP——EMP 定价锚点：800 EMP dps 只要 60 幅能/s） | 6 | 50 E-dps + 800 EMP | 500 | 60/s |
| Heavy Autocannon（M 动能） | 10 | 165 kin dps | 800 | 270/s |

**核心指标 = 每 OP 输出**（dps/OP、EMP dps/OP）与**幅能/非EMP伤害**。超模结论要用这两个数说话（Hyperion 实测：Mini Minotaur 35 E-dps+70 EMP dps 每 OP，是 Mjolnir 的 3–6 倍——写进补丁说明才有说服力）。

**weapon_data.csv 列语义**（实测核实）：`type` 列=**伤害类型**（ENERGY/KINETIC/…，能量伤害的弹道炮=type 列写 ENERGY；**挂载槽位类型在 `.wpn` 文件**的 `"type":"BALLISTIC"`）；`energy/shot`=每发幅能耗、`energy/second`=光束幅能/s；射速=1/(chargeup+chargedown)（burst 另计 delay）；`impact` 列是**数字**、语义未明——**别动**。

## 2. 设计：评论配方 × 基准锚点

1. **评论给的配方优先**（"dps 减半/幅能减半/射程 −150~250/精度加倍/弹速减半"），用锚点复核结果是否落回正常区间。
2. **伤害类型改不改要有可写进补丁说明的论证**。有原版先例就保留（Mjolnir=能量伤害弹道炮的先例，"人之领高科技"阵营设定同理），并让每把武器支付**1.0–1.3 幅能/非EMP伤害**的能量税；没有先例才改 KINETIC/HIGH_EXPLOSIVE。
3. **偏离评论处逐条写理由**（例：PD 武器弹速砍半会废掉拦截功能 → 只降 31%）。
4. OP：评论通常许可"全改完后降 1~2 点"；保守取值，改多了不是补丁是重做。

## 3. 实施：断言式修改（每格改前必须匹配旧值）

```js
// 模式见 _work\mod_work\Hyperion Systems\tools\balance_patch.js（可直接改造）
const edits = [['武器id', '列名', '旧值', '新值', '备注'], ...];
// parseCsv → 按 id 找行 → 断言 cells[ci].trim()===旧值（不匹配=列错位/版本不同，报错退出）
// 写回：⚠️ csvlib.parseCsv 的 rows 不含表头——必须 [csvJoinRow(header), ...rows.map(csvJoinRow)] 拼回（详见 csvlib.js 头注与 apply skill §1）
```

汉化 mod 上动数值：**name/primaryRoleStr/customPrimary 等译文列一个都不许碰**——改完与 git 上一版逐格比对译文列 = 0 差异。

## 4. 校验

- `check_csv_quotes.js <文件>`（结构/引号）；
- 译文列零变动比对（§3 模式）；
- 涉及 weapon/variant 引用 id 时跑 `check_refs.js`；重打包前 `check_eol.js`（若有基线）。

## 5. 交付

1. mod 根写 **`BALANCE_PATCH.md`**（英文主体 + 中文摘要——可直接转发论坛/mod 页）：触发反馈 → 基准锚点表 → 每武器前/后表 → 偏离及理由 → 未动区域与理由；
2. `git commit`（mod 仓库）；
3. 重打包：`deliver.ps1` → 改名 `<Mod>_<版本>_zh_<日期>.zip`（conventions §1.5，旧包保留可回溯）；
4. 项目说明.md 与留档（`mod_work\<Mod>\out\`）各补一笔。

## 完成标准

- [ ] 评论数字已逐项核实（含"评论说错"的澄清）；
- [ ] 每处修改有锚点对照或评论配方依据，偏离有书面理由；
- [ ] 旧值断言全部命中，译文列零变动，CSV 结构校验通过；
- [ ] BALANCE_PATCH.md 可独立转发（外人不看聊天记录也懂为什么这么改）；
- [ ] git 提交 + 新 zip + 留档更新。
