// Check all modified files are valid UTF-8 without BOM and without mojibake.
const fs = require('fs');
const files = [
  'data/strings/descriptions.csv',
  'data/weapons/weapon_data.csv',
  'data/shipsystems/ship_systems.csv',
  'data/hullmods/hull_mods.csv',
  'data/hulls/ship_data.csv',
  'data/hulls/wing_data.csv',
  'data/campaign/rules.csv',
  'data/campaign/commodities.csv',
  'data/campaign/market_conditions.csv',
  'data/campaign/channels.json',
  'data/config/custom_entities.json',
  'data/config/settings.json',
  'data/world/factions/templars.faction',
  'mod_info.json',
  'data/missions/tem_ahardplace/MissionDefinition.java',
  'data/missions/tem_ahardplace/descriptor.json',
];
for (const rel of files) {
  const p = 'C:/game/StarSector.v0.9.8a-RC8/mods/Templars/' + rel;
  const buf = fs.readFileSync(p);
  const hasBOM = buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF;
  const t = buf.toString('utf8');
  const hasReplacement = t.includes('\uFFFD');
  console.log(
    (hasBOM ? 'BOM! ' : 'ok ') +
    (hasReplacement ? 'INVALID-UTF8! ' : 'valid ') +
    rel + ' size=' + buf.length
  );
}
