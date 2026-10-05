import {normalizeUrl, AKO_URL, GOOGLE_URL} from './browser.ts';
export interface WebShortcut {id:string; name:string; url:string; icon:string}
export function shortcut(value:{id?:string;name:string;url:string;icon?:string}):WebShortcut {
  const name=value.name.trim();if(!name || name.length>60)throw new Error('Use a name from 1 to 60 characters.');
  return {id:value.id??crypto.randomUUID(),name,url:normalizeUrl(value.url),icon:(value.icon?.trim()||name.slice(0,2).toUpperCase()).slice(0,8)};
}
export function defaultWebShortcuts():WebShortcut[] {return [
  ['AKO Learn',AKO_URL,'AKO'],['Gmail','https://mail.google.com/','M'],['Drive','https://drive.google.com/','△'],
  ['YouTube','https://www.youtube.com/','▶'],['Desmos','https://www.desmos.com/scientific','∑'],['Google',GOOGLE_URL,'G'],
].map(([name,url,icon])=>shortcut({name,url,icon}));}
export function parseWebShortcuts(value:unknown, fallback:WebShortcut[]):WebShortcut[] {
  if(!Array.isArray(value))return fallback;
  const ids=new Set<string>();return value.slice(0,200).flatMap(v=>{
    try{if(!v || typeof v.name!=='string' || typeof v.url!=='string')return [];
      const result=shortcut({id:typeof v.id==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(v.id)&&!ids.has(v.id)?v.id:undefined,name:v.name,url:v.url,icon:typeof v.icon==='string'?v.icon:undefined});
      ids.add(result.id);return [result];
    }catch{return []}
  });
}
export function reorderShortcuts(items:WebShortcut[],id:string,beforeId:string):WebShortcut[] {
  if(id===beforeId)return items;
  const source=items.find(i=>i.id===id);if(!source || !items.some(i=>i.id===beforeId))return items;
  const remaining=items.filter(i=>i.id!==id);remaining.splice(remaining.findIndex(i=>i.id===beforeId),0,source);return remaining;
}
