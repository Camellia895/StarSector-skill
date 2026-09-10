// Translate data/missions/*/MissionDefinition.java string literals (runtime-compiled sources).
// Replace only the exact English string literal contents, keeping Java syntax intact.
const fs = require('fs');

const missions = {
  'tem_ahardplace': {
    'Persean League security detachment': '英仙座联盟治安分队',
    'Templar incursion': '骑士团突袭部队',
    'Defeat all enemy forces': '消灭所有敌方力量',
    'PLSS Stoneskin must survive': 'PLSS Stoneskin 必须存活',
  },
  'tem_atallcosts': {
    'Remnant allied fleet': '遗民联合舰队',
    'Templar Final Crusade': '骑士团的最终圣战',
    'Survive': '活下去',
  },
  'tem_excommunication': {
    'Templar strike fleet': '骑士团打击舰队',
    'Ragesh III garrison and mercenary allies': 'Ragesh III 守备部队与友军雇佣兵',
    'Defeat all enemy forces': '消灭所有敌方力量',
    'The Estoc must survive': 'Estoc 必须存活',
  },
  'tem_massacre': {
    'Templar seeker unit': '骑士团寻觅者小队',
    'Tri-Tachyon task force': '速子特别行动小组',
    'Defeat all enemy forces': '消灭所有敌方力量',
  },
  'tem_smite': {
    'The Durandal': 'Durandal，帕拉丁',
    'Hegemony system defense fleet': '霸主星系防御舰队',
    'Defeat all enemy forces': '消灭所有敌方力量',
  },
};

const base = 'C:/game/StarSector.v0.9.8a-RC8/mods/Templars/data/missions';
for (const [mission, map] of Object.entries(missions)) {
  const file = `${base}/${mission}/MissionDefinition.java`;
  let t = fs.readFileSync(file, 'utf8');
  let replaced = 0;
  for (const [en, zh] of Object.entries(map)) {
    // replace "en" literal with "zh" literal (escape for regex; handle quotes)
    const esc = en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('"' + esc + '"', 'g');
    const before = t;
    t = t.replace(re, '"' + zh.replace(/"/g, '\\"') + '"');
    if (t !== before) replaced += (before.match(new RegExp('"' + esc + '"', 'g')) || []).length;
  }
  fs.writeFileSync(file, t, 'utf8');
  console.log(mission + ': replaced ' + replaced + ' literals');
}
