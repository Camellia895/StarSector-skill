// Text-based migration for comment-JSON files. Files restored from backup first.
const fs = require('fs');
const N = 'C:/game/StarSector.v0.9.8a-RC8/mods/Templars/data';

function replaceOnce(path, find, repl) {
  let t = fs.readFileSync(path, 'utf8');
  const idx = t.indexOf(find);
  if (idx < 0) { console.log('NOT FOUND in', path, ':', JSON.stringify(find)); return false; }
  t = t.slice(0, idx) + repl + t.slice(idx + find.length);
  fs.writeFileSync(path, t, 'utf8');
  console.log('OK', path);
  return true;
}

// channels.json: name -> 圣殿骑士简讯
replaceOnce(N + '/campaign/channels.json',
  '"name":"Knights Templar Informare"',
  '"name":"圣殿骑士简讯"');

// custom_entities.json: defaultName -> 圣言
replaceOnce(N + '/config/custom_entities.json',
  '"defaultName":"Sacred Word"',
  '"defaultName":"圣言"');

// settings.json: insert 圣殿骑士团 color key right after Knights Templar key
{
  const p = N + '/config/settings.json';
  let t = fs.readFileSync(p, 'utf8');
  const find = '"Knights Templar":[0,255,255,255],';
  if (t.includes(find)) {
    t = t.replace(find, find + '\n        "圣殿骑士团":[0,255,255,255],');
    fs.writeFileSync(p, t, 'utf8');
    console.log('OK settings.json');
  } else {
    console.log('settings pattern not found; head:', t.slice(0, 120));
  }
}
