import {filterInstalledApps,type InstalledAppChoice} from './appPicker.ts';

const aliases:ReadonlyMap<string,string>=new Map([
 ['chrome','google chrome'],['chrome browser','google chrome'],['谷歌浏览器','google chrome'],
 ['edge','microsoft edge'],['word','microsoft word'],['excel','microsoft excel'],
 ['powerpoint','microsoft powerpoint'],['vs code','visual studio code'],['vscode','visual studio code'],
]);

function normalized(name:string){
 return name.trim().normalize('NFKC').toLowerCase().replace(/\s+/g,' ');
}

export function installedAppRequest(prompt:string){
 const text=prompt.trim().replace(/[.!?。！？]+$/u,'').trim();
 const english=text.match(/^(?:(?:please|can you|could you|would you)\s+)*(?:open|launch|start)\s+(?:the\s+)?(?:(app(?:lication)?)\s+)?(.+?)(?:\s+please)?$/iu);
 const chinese=text.match(/^(?:请\s*)?(?:帮我\s*)?(?:打开|启动)\s*(?:(应用(?:程序)?)\s*)?(.+)$/u);
 const match=english??chinese;
 if(!match)return null;
 const name=match[2].trim().replace(/^["“](.+)["”]$/u,'$1');
 if(!/^[\p{L}\p{N}][\p{L}\p{M}\p{N} .+'’&()_-]{0,79}$/u.test(name)||/\.(?:exe|lnk|bat|cmd|ps1)$/i.test(name)||/\s--?[a-z0-9]/i.test(name))return null;
 const alias=aliases.get(normalized(name));
 return {name,alias,explicit:!!match[1]};
}

export function matchInstalledApp(apps:InstalledAppChoice[],query:NonNullable<ReturnType<typeof installedAppRequest>>){
 const name=normalized(query.name);
 const exact=apps.filter(app=>normalized(app.name)===name);
 if(exact.length)return {exact:true,candidates:exact};
 if(query.alias){
  const branded=apps.filter(app=>normalized(app.name)===query.alias);
  if(branded.length)return {exact:true,candidates:branded};
 }
 return {exact:false,candidates:filterInstalledApps(apps,query.name)};
}
