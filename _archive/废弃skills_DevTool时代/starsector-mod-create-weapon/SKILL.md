---
name: starsector-mod-create-weapon
description: 创建/编辑 Starsector（远行星号）mod 武器时使用。依据 DevTool 的 weapons.columns.json、defaultWeapon 与武器编辑器逆向整理：在 data/weapons/weapon_data.csv 加一行武器属性（类型/射程/伤害/幅能/散布/弹药等），在 data/weapons/<id>.wpn 写发射规格（炮管偏移、barrelMode、specClass=projectile/beam、弹体引用 projectileSpecId、光束颜色），弹体另见 starsector-mod-create-projectile。武器编辑器只写 .wpn 不反写 CSV。ID 规则：字母/数字开头，可含 _ . -。全部文件 UTF-8 无 BOM。
---

# 创建武器（Weapon）

目标：为 mod 新建一件可装配的武器（数据行 + .wpn 发射规格 + 弹体/光束）。

## 第 1 步 · CSV 数据行（data/weapons/weapon_data.csv）

| 关键列 | 说明 |
|---|---|
| `name` / `id` | 名称 / 唯一 ID（与 .wpn 一致） |
| `type` | `BALLISTIC/ENERGY/MISSILE/HYBRID/UNIVERSAL/SYNERGY/COMPOSITE/BUILT_IN` |
| `range`、`damage/second`、`damage/shot`、`emp`、`impact` | 射程 / DPS / 单发伤害 / EMP / 冲击 |
| `OPs`、`tier`、`rarity`、`base value` | 装配点 / 级别 / 稀有度 / 价值 |
| `turn rate` | 转向速度 |
| `ammo`、`ammo/sec`、`reload size` | 弹药（有限弹药武器用） |
| `energy/shot`、`energy/second` | 每发幅能 / 每秒幅能 |
| `chargeup`、`chargedown`、`burst size`、`burst delay` | 渐入 / 渐出 / 爆发时长 / 爆发间隔 |
| `min spread`、`max spread`、`spread/shot`、`spread decay/sec` | 散布曲线 |
| `beam speed`（光束）、`proj speed`、`launch speed`、`flight time`、`proj hitpoints` | 弹道参数 |
| `hints`、`tags`、`groupTag`、`tech/manufacturer` | 提示 / 标签（供势力 knownWeapons 引用）/ 分组 / 设计类型 |
| 提示文本列 | `primaryRoleStr/speedStr/trackingStr/turnRateStr/accuracyStr/customPrimary/.../noDPSInTooltip` |

## 第 2 步 · 发射规格（data/weapons/<id>.wpn）

参考 defaultWeapon 结构：

- `id`、`specClass`（`projectile` 或 `beam`，决定表单/预览分支；`beam speed` 非空时默认 beam）
- `type`（大写，与 CSV 一致）、`size`（`SMALL/MEDIUM/LARGE`）
- 贴图：`turretSprite`/`turretGunSprite`、`hardpointSprite`/`hardpointGunSprite`（graphics/weapons/）
- 炮管：`turretOffsets`+`turretAngleOffsets`、`hardpointOffsets`+`hardpointAngleOffsets`（炮塔/插槽视图的发射位置与角度）；`barrelMode`（`ALTERNATING/LINKED`）
- `animationType`（如 `MUZZLE_FLASH`）、`fireSoundTwo`
- 弹体：`projectileSpecId` → 指向 `data/weapons/proj/<id>.proj`（弹体编辑器按此打开）
- 光束字段（specClass=beam）：`fringeColor/coreColor/glowColor`（RGBA）、`width`、`textureType(ROUGH/SMOOTH/NONE)`、`textureScrollSpeed`、`convergeOnPoint`、`darkCore`

## 第 3 步 · 弹体引用

- 非光束武器必须有一个 `.proj`（见 `starsector-mod-create-projectile`），`.wpn` 的 `projectileSpecId` 指向它；缺弹体是错误，预览不构造默认值。

## 第 4 步 · 校验

- [ ] `weapon_data.csv` 的 `id` 与 `.wpn` 的 `id` 一致
- [ ] `projectileSpecId` 指向真实存在的 `.proj`
- [ ] 贴图存在（graphics/weapons/）；弹体/导弹贴图在 graphics/missiles/
- [ ] 槽位类型与武器 `type` 匹配才能在舰船上装配
- [ ] 文件 UTF-8 无 BOM

## 备注

- 武器编辑器只写 `.wpn`，`weapon_data.csv` 需另行维护。
- 武器 `type=MISSILE` 不等于 `.proj` 的 `specClass=missile`：前者是武器类别，后者是弹体形态。
