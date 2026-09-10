const fs=require('fs'), path=require('path');
function readUtf8s(buf){
  let p=10; const cpCount=buf.readUInt16BE(8); const utf8=[]; const strIdx=[];
  let i=1;
  while(i<cpCount){
    const tag=buf[p++];
    if(tag===1){ const len=buf.readUInt16BE(p); p+=2; utf8[i]=buf.toString('utf8',p,p+len); p+=len; }
    else if(tag===7||tag===16||tag===19||tag===20){ p+=2; }
    else if(tag===8){ strIdx.push(buf.readUInt16BE(p)); p+=2; }
    else if(tag===15){ p+=3; }
    else if(tag===3||tag===4||tag===9||tag===10||tag===11||tag===12||tag===17||tag===18){ p+=4; }
    else if(tag===5||tag===6){ p+=8; i++; }
    else throw new Error('unknown tag '+tag);
    i++;
  }
  return {all:utf8.filter(x=>x!==undefined), strs:strIdx.map(x=>utf8[x]).filter(x=>x!==undefined)};
}
const dirA=process.argv[2], dirB=process.argv[3];
function walk(d,o=[]){ for(const e of fs.readdirSync(d,{withFileTypes:true})){ const p=path.join(d,e.name); e.isDirectory()?walk(p,o):(p.endsWith('.class')&&o.push(p)); } return o; }
const A=walk(dirA), Bset=new Set(walk(dirB).map(f=>path.relative(dirB,f)));
let diffClasses=0, missingStrings=0, checked=0;
for(const fa of A){
  const rel=path.relative(dirA,fa);
  if(!Bset.has(rel)){ console.log('仅存在于原 jar（编译器产物）: '+rel); continue; }
  checked++;
  const ra=readUtf8s(fs.readFileSync(fa));
  const rb=readUtf8s(fs.readFileSync(path.join(dirB,rel)));
  const blobB = rb.strs.join('\u0000') + '\u0000' + rb.all.join('\u0000');
  const missing = ra.strs.filter(s => s.length>=3 && !blobB.includes(s));
  if(missing.length){ diffClasses++; missingStrings+=missing.length;
    console.log('DIFF '+rel+' ('+missing.length+' 条):');
    missing.slice(0,8).forEach(m=>console.log('   "'+m.replace(/\n/g,'\\n').slice(0,110)+'"')); }
}
console.log(`\n比对 class 数: ${checked}；有字符串缺失的类: ${diffClasses}；缺失字符串总数: ${missingStrings}`);