const fs = require('fs');
const jc = JSON.parse(fs.readFileSync('C:/game/StarSector.v0.9.8a-RC8/mods/_rat_work/out/jar_constants.json', 'utf8'));
const tc = JSON.parse(fs.readFileSync('C:/game/StarSector.v0.9.8a-RC8/mods/_rat_work/out/translations_code.json', 'utf8'));

const EX = [
  /^\(\)/, /^\(\[/, /^\[\(/,
  /^Ljava\//, /^Lkotlin\//, /^Llunalib\//, /^Lorg\//, /^Lme\//, /^Lcom\//, /^Lsecond_in_command\//, /^Lexerelin\//, /^Lassortment_of_things\//,
  /^SMAP/, /^SourceFile$/, /^SourceDebugExtension$/, /^BootstrapMethods$/, /^LineNumberTable$/, /^LocalVariableTable$/, /^StackMapTable$/,
  /^ConstantValue$/, /^NestHost$/, /^NestMembers$/, /^InnerClasses$/, /^EnclosingMethod$/, /^MethodParameters$/, /^AnnotationDefault$/,
  /^RuntimeVisible/, /^RuntimeInvisible/, /^Signature$/, /^Code$/, /^Exceptions$/, /^Deprecated$/, /^Synthetic$/, /^Bridge$/, /^Varargs$/,
  /^set[A-Z]/, /^get[A-Z]/, /^load[A-Z]/, /^pick[A-Z]/, /^spawn[A-Z]/, /^should[A-Z]/, /^show[A-Z]/, /^on[A-Z]/, /^update[A-Z]/,
  /^trigger[A-Z]/, /^transfer[A-Z]/, /^populate[A-Z]/, /^notify[A-Z]/, /^add[A-Z]/, /^remove[A-Z]/, /^play[A-Z]/, /^create[A-Z]/, /^init[A-Z]/,
  /^apply[A-Z]/, /^is[A-Z]/, /^has[A-Z]/, /^make[A-Z]/, /^start[A-Z]/, /^stop[A-Z]/, /^toggle[A-Z]/, /^sync[A-Z]/, /^un[A-Z]/,
  /^[a-z][a-zA-Z0-9_]*$/, /^[A-Z][A-Z0-9_]{2,}$/,
  /^rat_/, /^sotf_/, /^theme_/, /^star_/, /^ore_/, /^organics_/, /^volatiles_/, /^system_/, /^station_/, /^weapons_cache/, /^supply_cache/, /^survey_data/, /^pk_/, /^orbital_/,
  /^graphics\//, /^data\//, /^sounds\//, /^assortment_of_things\//, /\.(png|jpg|json|csv|fnt|ttf|ogg|class|java|kt|ini)$/,
  /null cannot be cast/, /@NotNull parameter/, /Super calls with default arguments/,
  /^(Adding|Generating|Setting|Picked|Found|Finished|RAT:|Skipping|Looking for|Adding %d|Adding up|  )/, /^  [A-Z]/, /^    /,
  /\([a-zA-Z_]+=/, /^_PROJ$/,
  /^(tex|texX|texY|arc|fx|dem|emp|map|get|set|ui|x|y|id|svc|gen|mod|iso|raw)$/,
  /^(this|val|value|textPanel)\$/, /^kotlin\//, /^org\//, /^com\//, /^lunalib\//, /^second_in_command\//, /^me\//, /^exerelin\//,
  /^[a-z0-9_]+$/, /^[a-z]+\d+$/, /_glow(_\d)?(\.png)?$/, /_normal$/, /_map$/, /_storm/, /_fragment$/, /_external$/, /_deep$/, /_icon$/, /_market$/, /_Hull$/, /_sil\.png$/, /_refined\.png$/,
];

const out = [];
for (const k of Object.keys(jc)) {
  if (k in tc) continue;
  if (/[\u4e00-\u9fff]/.test(k)) continue;
  if (!/[A-Za-z]{4,}/.test(k)) continue;
  if (/[\u0000\u0002-\u0008\u000b\u000c\u000e-\u001f]/.test(k)) continue;   // binary garbage (keep \t \n \r and \u0001 recipe)
  if (k.length < 14) continue;                      // sentence-like
  if (!/\s/.test(k) && !/^["“]/.test(k)) continue;  // must contain a space or be a quote
  if (EX.some(re => re.test(k))) continue;
  out.push({ c: k, classes: (jc[k] || []).slice(0, 2) });
}
out.sort((a, b) => a.c.localeCompare(b.c));
fs.writeFileSync('C:/game/StarSector.v0.9.8a-RC8/mods/_rat_work/out/sweep_sentences.json', JSON.stringify(out, null, 1), 'utf8');
console.log('sentence-like un-translated candidates:', out.length);
for (const e of out) console.log(JSON.stringify(e.c).slice(0, 150));
