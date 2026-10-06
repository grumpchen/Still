import {normalizeUrl} from './browser.ts';
import type {WidgetType} from './widgetCatalog.ts';

export type TrayDropAction='save'|'save-group'|'create-group'|'remove'|'none';
export type GroupTrayDropTarget={kind:'create'}|{kind:'existing';groupId:string};
export interface TrayDropTarget {
 source:'widget'|'file'|'website'|'app';widgetType?:WidgetType;
 targetType?:WidgetType|null;groupTarget?:GroupTrayDropTarget;insideTray:boolean;overInteractive?:boolean;
}
// Removal applies only to existing canvas widgets over empty tray space.
// A rejected external drop never means deleting anything from the computer.
export function trayDropDecision(target:TrayDropTarget):TrayDropAction {
 if(!target.insideTray)return 'none';
 if(target.source==='widget'){
  if(target.groupTarget){
   if(target.widgetType==='group'||target.groupTarget.kind==='existing'&&!target.groupTarget.groupId)return 'none';
   return target.groupTarget.kind==='create'?'create-group':'save-group';
  }
  if(target.targetType)return target.widgetType!=='group'&&target.targetType===target.widgetType?'save':'none';
  return target.overInteractive?'none':'remove';
 }
 if(target.source==='file')return target.targetType==='files'?'save':'none';
 if(target.source==='app')return target.targetType==='apps'?'save':'none';
 return target.targetType==='browser'?'save':'none';
}

function entities(value:string):string {
 return value.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|quot|apos|lt|gt);/gi,(match,key:string)=>{
  const names:Record<string,string>={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'};
  const lower=key.toLowerCase();if(names[lower])return names[lower];
  const n=lower.startsWith('#x')?parseInt(lower.slice(2),16):parseInt(lower.slice(1),10);
  return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):match;
 });
}
function safeWebsite(value:string):string|null {
 // Dragged prose and filesystem paths are not browser destinations.
 if(!/^https:\/\//i.test(value.trim()))return null;
 try{return normalizeUrl(value)}catch{return null}
}
export function droppedWebsite(text:string,html=''):{url:string;name:string}|null {
 const plain=typeof text==='string'?text.slice(0,16384):'',markup=typeof html==='string'?html.slice(0,65536):'';
 const anchor=/<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a\s*>/i.exec(markup);
 const htmlUrl=anchor?safeWebsite(entities(anchor[1]??anchor[2]??anchor[3]??'')):null;
 const url=plain.split(/\r?\n/).map(line=>line.trim()).filter(line=>line&&!line.startsWith('#')).map(safeWebsite).find(Boolean)??htmlUrl;
 if(!url)return null;
 const title=htmlUrl===url&&anchor?entities(anchor[4].replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim():'';
 return{url,name:(title||new URL(url).hostname.replace(/^www\./i,'')).slice(0,60)};
}
