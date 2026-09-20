// 抽取 jar 全部类对 starfarer.api.* 的方法/字段引用（javap -c -p），输出扁平 refs.json
// 格式: { "<mod类FQN>": [ "M|<owner>|<name>|<desc>", "F|<owner>|<name>|<desc>", ... ] }
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CLASSES_DIR = process.argv[2] || 'C:\\game\\StarSector.v0.9.8a-RC8\\_work\\_tmp\\fg_jar';
const JAVAP = 'C:\\Program Files\\Android\\Android Studio\\jbr\\bin\\javap.exe';
const OUT = 'C:\\game\\StarSector.v0.9.8a-RC8\\_work\\mod_work\\FlowerGod\\api_refs.json';

function listFqcns(dir, base) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    const bare = e.name.endsWith('.class') ? e.name.replace(/\.class$/, '') : e.name;
    const fq = base ? base + '.' + bare : bare;
    if (e.isDirectory()) out.push(...listFqcns(p, fq));
    else if (e.name.endsWith('.class')) out.push(fq);
  }
  return out;
}

const fqcns = listFqcns(CLASSES_DIR, '');
console.log('classes: ' + fqcns.length);

const result = {};
let cur = null, nm = 0, nf = 0;
const BATCH = 20;
for (let i = 0; i < fqcns.length; i += BATCH) {
  const batch = fqcns.slice(i, i + BATCH);
  const out = execFileSync(JAVAP, ['-c', '-p', '-cp', CLASSES_DIR, ...batch], { maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
  for (const line of out.split('\n')) {
    const cls = line.match(/^(?:public |final |abstract )*(?:class|interface|enum) ([\w.$]+)/);
    if (cls && batch.includes(cls[1])) { cur = cls[1]; result[cur] = result[cur] || []; continue; }
    if (!cur) continue;
    let m = line.match(/\/\/ (?:Method|InterfaceMethod) ([\w/$]+)\.([\w$<>]+):(.+)/);
    if (m) {
      const owner = m[1].replace(/\//g, '.');
      if (owner.startsWith('com.fs.starfarer.api')) { result[cur].push('M|' + owner + '|' + m[2] + '|' + m[3].trim()); nm++; }
      continue;
    }
    m = line.match(/\/\/ Field ([\w/$]+)\.([\w$]+):(.+)/);
    if (m) {
      const owner = m[1].replace(/\//g, '.');
      if (owner.startsWith('com.fs.starfarer.api')) { result[cur].push('F|' + owner + '|' + m[2] + '|' + m[3].trim()); nf++; }
    }
  }
}
// 去重
for (const c of Object.keys(result)) result[c] = [...new Set(result[c])];
fs.writeFileSync(OUT, JSON.stringify(result, null, 1));
console.log('api refs: methods=' + nm + ' fields=' + nf + ' (dedup) from ' + Object.keys(result).length + ' classes');
