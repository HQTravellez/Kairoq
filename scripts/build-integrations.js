// Rebuilds data/integrations.json (integrations.js) from a checkout of Activepieces:
//   node scripts/build-integrations.js <activepieces>/packages/pieces/community data/integrations.json <commit>
// Reads only packages/pieces/community (MIT), never the ee folders, and keeps facts: each
// service's sign-in, actions and triggers (names, descriptions, fields) and its shared files.
const fs=require('fs'),path=require('path');
const root=process.argv[2],out=process.argv[3];
const str=(src,key)=>{const m=new RegExp(key+"\\s*:\\s*(['\"`])((?:\\\\.|(?!\\1).)*)\\1").exec(src);return m?m[2].replace(/\\(['"`])/g,'$1').trim():''};
const walk=d=>fs.existsSync(d)?fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]):[];
const pieces=[];const stats={OAuth2:0,SecretText:0,BasicAuth:0,CustomAuth:0,None:0};
for(const id of fs.readdirSync(root).sort()){
 const dir=path.join(root,id),src=path.join(dir,'src');if(!fs.existsSync(src))continue;
 const files=walk(src).filter(f=>/\.ts$/.test(f)&&!/i18n|\.spec\./.test(f));
 const all=files.map(f=>fs.readFileSync(f,'utf8')).join('\n');
 const index=fs.existsSync(path.join(src,'index.ts'))?fs.readFileSync(path.join(src,'index.ts'),'utf8'):all;
 const create=index.slice(Math.max(0,index.indexOf('createPiece(')));
 const displayName=str(create,'displayName')||id;
 const authM=/PieceAuth\.(OAuth2|SecretText|BasicAuth|CustomAuth|None)\s*\(\s*\{([\s\S]{0,1500}?)\}\s*\)/.exec(all);
 const authType=authM?authM[1]:'None';stats[authType]=(stats[authType]||0)+1;
 const auth={type:authType};
 if(authM){const b=authM[2];for(const k of ['displayName','description','authUrl','tokenUrl'])if(str(b,k))auth[k]=str(b,k).slice(0,300);
  if(authType==='CustomAuth'){const props=[...b.matchAll(/(\w+)\s*:\s*(?:PieceAuth|Property)\.(\w+)\(\s*\{[\s\S]{0,300}?displayName\s*:\s*['"`]([^'"`]+)/g)].map(m=>({key:m[1],type:m[2],label:m[3]}));if(props.length)auth.fields=props.slice(0,8)}}
 const actions=[],triggers=[];
 for(const f of files){
  const s=fs.readFileSync(f,'utf8'),rel=path.relative(dir,f);
  const isA=/createAction\(/.test(s),isT=/createTrigger\(/.test(s);if(!isA&&!isT)continue;
  const block=s.slice(s.indexOf(isA?'createAction(':'createTrigger('));
  const item={name:str(block,'name'),displayName:str(block,'displayName'),description:str(block,'description').slice(0,240),file:rel};
  if(!item.name)continue;
  const props=[...block.matchAll(/(\w+)\s*:\s*Property\.(\w+)\(\s*\{[\s\S]{0,200}?displayName\s*:\s*['"`]([^'"`]+)['"`][\s\S]{0,200}?required\s*:\s*(true|false)/g)].map(m=>({key:m[1],type:m[2],label:m[3].slice(0,60),required:m[4]==='true'})).slice(0,15);
  if(props.length)item.props=props;
  if(isT){const t=/type\s*:\s*TriggerStrategy\.(\w+)/.exec(block);if(t)item.strategy=t[1]}
  (isA?actions:triggers).push(item);
 }
 const urls=[...new Set((all.match(/https:\/\/[a-z0-9.-]+\.[a-z]{2,}(?:\/[\w./{}-]*)?/gi)||[]).filter(u=>/api|v\d/i.test(u)&&!/activepieces|github\.com|docs\.|cdn\./i.test(u)).map(u=>u.replace(/\$\{[^}]*\}.*$/,'')))].slice(0,6);
 const common=files.map(f=>path.relative(dir,f)).filter(r=>/^src\/lib\/(common|utils?|shared|api|client)[\/.]/i.test(r)).slice(0,6);
 pieces.push({id,displayName,common,description:str(create,'description').slice(0,240),categories:[...create.matchAll(/PieceCategory\.(\w+)/g)].map(m=>m[1]).slice(0,4),auth,api:urls,actions:actions.slice(0,60),triggers:triggers.slice(0,30)});
}
fs.writeFileSync(out,JSON.stringify({source:'https://github.com/activepieces/activepieces',license:'MIT (Copyright (c) 2020-2024 Activepieces Inc.); only packages/pieces/community, never the ee folders',commit:process.argv[4]||'',pieces}));
console.log(pieces.length,'pieces',JSON.stringify(stats),(fs.statSync(out).size/1048576).toFixed(2)+' MB',pieces.reduce((a,p)=>a+p.actions.length,0),'actions');
