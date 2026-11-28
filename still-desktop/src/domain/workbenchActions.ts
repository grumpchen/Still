/**
 * Structured actions for Still features that live outside the active widget
 * canvas. Collection operations mirror the shared collection operation
 * service's request fields; this module validates wire data, not execution.
 */
import {widgetTypes,type WidgetType} from './workspaces.ts';
import {widgetCatalog} from './widgetCatalog.ts';
import type {WorkspaceCommand} from './workspaceCommands.ts';
import type {FilesViewCommand} from '../platform/filesViewCommands.ts';
import type {CanvasCommand} from '../platform/canvasCommands.ts';
import {snapLayouts} from './snapLayouts.ts';
export const workbenchPanels=['notes-home','settings','shortcuts','gallery','trayEdit','sidebarPlugins','commands','rules'] as const;
export type InterfaceAction={operation:'view.open';panel:typeof workbenchPanels[number]};
export type WorkbenchAction = InterfaceAction| WorkspaceCommand|FilesViewCommand|CanvasCommand
 | {operation:'layout.list'}
 | {operation:'layout.find';query:string}
 | {operation:'layout.save';name:string;sourceWorkspaceId?:string}
 | {operation:'layout.apply';layoutId:string;targetWorkspaceId:string;mode:'append'|'replace'}
 | {operation:'layout.rename';layoutId:string;name:string}
 | {operation:'layout.duplicate';layoutId:string}
 | {operation:'layout.delete';layoutId:string}
 | {operation:'dashboard.list'}
 | {operation:'dashboard.module.add';widgetType:Exclude<WidgetType,'group'>}
 | {operation:'dashboard.module.remove';widgetId:string}
 | {operation:'dashboard.module.reorder';widgetId:string;targetWidgetId:string;position:'before'|'after'}
 | {operation:'dashboard.module.resize';widgetId:string;width:number;height:number}
 | {operation:'group.list';workspaceId:string}
 | {operation:'group.create';workspaceId:string;name:string}
 | {operation:'group.rename';workspaceId:string;groupId:string;name:string}
 | {operation:'group.delete';workspaceId:string;groupId:string;removeContents:boolean}
 | {operation:'resource.find';query:string}
 | {operation:'link.create';workspaceId:string;groupId?:string;name:string;url:string}
 | {operation:'link.rename';origin:LinkOrigin;linkId:string;name:string}
 | {operation:'link.editUrl';origin:LinkOrigin;linkId:string;url:string}
 | {operation:'link.move';origin:LinkOrigin;linkId:string;destinationWorkspaceId:string;destinationGroupId?:string}
 | {operation:'link.delete';origin:LinkOrigin;linkId:string}
 | {operation:'file.annotation';widgetId:string;path:string;text:string}
 | {operation:'file.moveReference';widgetId:string;destinationWorkspaceId:string}
 | {operation:'file.renameReference';widgetId:string;name:string}
 | {operation:'file.deleteReference';widgetId:string}
 | {operation:'file.rename';widgetId:string;path:string;name:string}
 | {operation:'file.move';widgetId:string;path:string;destinationFolder:string}
 | {operation:'file.delete';widgetId:string;path:string}
 | {operation:'file.editText';widgetId:string;path:string;text:string;expectedText:string}
 | {operation:'file.createText';widgetId:string;path:string;text:string}
 | {operation:'note.quickCapture';workspaceId:string;notesWidgetId?:string;title:string;text:string}
 | {operation:'rule.save';text:string}
 | {operation:'rule.list'}
 | {operation:'rule.enable';ruleId:string;enabled:boolean}
 | {operation:'rule.layoutMode';ruleId:string;mode:'append'|'replace'}
 | {operation:'rule.delete';ruleId:string}
 | {operation:'rule.runDue'};
export type LinkOrigin={kind:'group';workspaceId:string;groupId:string}|{kind:'browser';workspaceId:string;widgetId:string};

export const MAX_WORKBENCH_ACTIONS=10;
const ID_RE=/^[A-Za-z0-9_-]{1,120}$/;
const invalid=():never=>{throw new Error('The AI returned an invalid Still action. Nothing was changed. Try again.')};
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
function fields(value:Record<string,unknown>,required:string[],optional:string[]=[]):void{
 const allowed=new Set([...required,...optional]);
 if(required.some(key=>!(key in value))||Object.keys(value).some(key=>!allowed.has(key)))invalid();
}
function text(value:unknown,min:number,max:number):string{
 if(typeof value!=='string'||value.length<min||value.length>max||value.includes('\0'))return invalid();
 const trimmed=value.trim();if(trimmed.length<min)return invalid();return trimmed;
}
function content(value:unknown,max:number,allowEmpty=false):string{
 if(typeof value!=='string'||value.length>max||value.includes('\0')||!allowEmpty&&!value.trim())return invalid();return value;
}
function createTextContent(value:unknown):string{
 const result=content(value,1_000_000,true);if(new TextEncoder().encode(result).byteLength>1_000_000)return invalid();return result;
}
function id(value:unknown):string{
 if(typeof value!=='string'||!ID_RE.test(value))return invalid();return value;
}
function relativePath(value:unknown,allowEmpty=false):string{
 if(typeof value!=='string'||value.length>1000||(!allowEmpty&&!value)||value.startsWith('/')||/^[a-z]:/i.test(value)||value.includes(':')||value.includes('\\'))return invalid();
 if(value&&value.split('/').some(part=>!part||part==='.'||part==='..'))return invalid();
 return value;
}
function origin(value:unknown):LinkOrigin{
 if(!object(value))return invalid();
 if(value.kind==='group'){fields(value,['kind','workspaceId','groupId']);return{kind:'group',workspaceId:id(value.workspaceId),groupId:id(value.groupId)}}
 if(value.kind==='browser'){fields(value,['kind','workspaceId','widgetId']);return{kind:'browser',workspaceId:id(value.workspaceId),widgetId:id(value.widgetId)}}
 return invalid();
}
function fileName(value:unknown):string{
 const name=text(value,1,255);
 if(name==='.'||name==='..'||/[\\/:<>|?*"\u0000-\u001f]/.test(name)||/[ .]$/.test(name))return invalid();
 const device=name.split('.')[0].replace(/[ .]+$/,'').toUpperCase();
 if(/^(CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])$/.test(device))return invalid();
 return name;
}
function createTextPath(value:unknown):string{
 const path=relativePath(value),name=path.split('/').at(-1)??'';
 if(!/^.+\.(?:md|txt)$/i.test(name)||name==='.'||name==='..')return invalid();
 if(fileName(name)!==name)return invalid();return path;
}
function httpsUrl(value:unknown):string{
 if(typeof value!=='string'||value.length>4096)return invalid();
 let parsed:URL;try{parsed=new URL(value.trim())}catch{return invalid()}
 if(parsed.protocol!=='https:'||!parsed.hostname||parsed.username||parsed.password)return invalid();
 return parsed.href;
}
function parseOne(raw:unknown):WorkbenchAction{
 if(!object(raw)||typeof raw.operation!=='string')return invalid();
 switch(raw.operation){
  case 'view.open':{
   fields(raw,['operation','panel']);const panel=workbenchPanels.find(item=>item===raw.panel);
   if(!panel)return invalid();return {operation:raw.operation,panel};
  }
  case 'canvas.exportPng':case 'canvas.copyImage':case 'canvas.raise':fields(raw,['operation','workspaceId','widgetId']);return {operation:raw.operation,workspaceId:id(raw.workspaceId),widgetId:id(raw.widgetId)};
  case 'canvas.overview':fields(raw,['operation','workspaceId','enabled']);if(typeof raw.enabled!=='boolean')return invalid();return {operation:raw.operation,workspaceId:id(raw.workspaceId),enabled:raw.enabled};
  case 'canvas.filter':fields(raw,['operation','workspaceId','status']);if(raw.status!=='all'&&raw.status!=='unset'&&raw.status!=='todo'&&raw.status!=='in-progress'&&raw.status!=='done')return invalid();return {operation:raw.operation,workspaceId:id(raw.workspaceId),status:raw.status};
  case 'canvas.snap':{
   fields(raw,['operation','workspaceId','widgetId','layout','zone']);const layout=snapLayouts.find(item=>item.id===raw.layout);
   if(!layout||typeof raw.zone!=='number'||!Number.isInteger(raw.zone)||raw.zone<1||raw.zone>layout.zones.length)return invalid();
   return {operation:raw.operation,workspaceId:id(raw.workspaceId),widgetId:id(raw.widgetId),layout:layout.id,zone:raw.zone};
  }
  case 'filesView.search':fields(raw,['operation','widgetId','query']);return {operation:raw.operation,widgetId:id(raw.widgetId),query:text(raw.query,1,300)};
  case 'filesView.open':fields(raw,['operation','widgetId','path']);return {operation:raw.operation,widgetId:id(raw.widgetId),path:relativePath(raw.path,true)};
  case 'filesView.closePreview':case 'filesView.exitSearch':fields(raw,['operation','widgetId']);return {operation:raw.operation,widgetId:id(raw.widgetId)};
  case 'filesView.filter':fields(raw,['operation','widgetId','status']);if(raw.status!=='all'&&raw.status!=='unread'&&raw.status!=='in-progress'&&raw.status!=='done')return invalid();return {operation:raw.operation,widgetId:id(raw.widgetId),status:raw.status};
  case 'filesView.readingStatus':fields(raw,['operation','widgetId','path','status']);if(raw.status!=='unread'&&raw.status!=='in-progress'&&raw.status!=='done')return invalid();return {operation:raw.operation,widgetId:id(raw.widgetId),path:relativePath(raw.path),status:raw.status};
  case 'workspace.duplicate':fields(raw,['operation','workspaceId'],['name']);return {operation:raw.operation,workspaceId:id(raw.workspaceId),...(raw.name===undefined?{}:{name:text(raw.name,1,60)})};
  case 'workspace.stack':fields(raw,['operation','workspaceId']);return {operation:raw.operation,workspaceId:id(raw.workspaceId)};
  case 'preset.rename':fields(raw,['operation','presetId','name']);return {operation:raw.operation,presetId:id(raw.presetId),name:text(raw.name,1,60)};
  case 'preset.delete':fields(raw,['operation','presetId']);return {operation:raw.operation,presetId:id(raw.presetId)};
  case 'appearance.reset':fields(raw,['operation']);return {operation:raw.operation};
  case 'relaunch.applyAll':fields(raw,['operation','value']);if(raw.value!=='manual'&&raw.value!=='automatic')return invalid();return {operation:raw.operation,value:raw.value};
  case 'layout.find':fields(raw,['operation','query']);return{operation:raw.operation,query:text(raw.query,1,300)};
  case 'layout.list':fields(raw,['operation']);return{operation:raw.operation};
  case 'layout.save':fields(raw,['operation','name'],['sourceWorkspaceId']);return{operation:raw.operation,name:text(raw.name,1,60),...(raw.sourceWorkspaceId!==undefined?{sourceWorkspaceId:id(raw.sourceWorkspaceId)}:{})};
  case 'layout.apply':fields(raw,['operation','layoutId','targetWorkspaceId','mode']);if(raw.mode!=='append'&&raw.mode!=='replace')return invalid();return{operation:raw.operation,layoutId:id(raw.layoutId),targetWorkspaceId:id(raw.targetWorkspaceId),mode:raw.mode};
  case 'layout.rename':fields(raw,['operation','layoutId','name']);return{operation:raw.operation,layoutId:id(raw.layoutId),name:text(raw.name,1,60)};
  case 'layout.duplicate':fields(raw,['operation','layoutId']);return{operation:raw.operation,layoutId:id(raw.layoutId)};
  case 'layout.delete':fields(raw,['operation','layoutId']);return{operation:raw.operation,layoutId:id(raw.layoutId)};
  case 'dashboard.list':fields(raw,['operation']);return{operation:raw.operation};
  case 'dashboard.module.add':fields(raw,['operation','widgetType']);if(typeof raw.widgetType!=='string'||!widgetTypes.includes(raw.widgetType as WidgetType)||raw.widgetType==='group')return invalid();return{operation:raw.operation,widgetType:raw.widgetType as Exclude<WidgetType,'group'>};
  case 'dashboard.module.remove':fields(raw,['operation','widgetId']);return{operation:raw.operation,widgetId:id(raw.widgetId)};
  case 'dashboard.module.reorder':fields(raw,['operation','widgetId','targetWidgetId','position']);if(raw.position!=='before'&&raw.position!=='after'||raw.widgetId===raw.targetWidgetId)return invalid();return{operation:raw.operation,widgetId:id(raw.widgetId),targetWidgetId:id(raw.targetWidgetId),position:raw.position};
  case 'dashboard.module.resize':fields(raw,['operation','widgetId','width','height']);if(!Number.isInteger(raw.width)||!Number.isInteger(raw.height)||typeof raw.width!=='number'||typeof raw.height!=='number'||raw.width<1||raw.height<1||raw.width>3000||raw.height>3000)return invalid();return{operation:raw.operation,widgetId:id(raw.widgetId),width:raw.width,height:raw.height};
  case 'group.list':fields(raw,['operation','workspaceId']);return{operation:raw.operation,workspaceId:id(raw.workspaceId)};
  case 'group.create':fields(raw,['operation','workspaceId','name']);return{operation:raw.operation,workspaceId:id(raw.workspaceId),name:text(raw.name,1,60)};
  case 'group.rename':fields(raw,['operation','workspaceId','groupId','name']);return{operation:raw.operation,workspaceId:id(raw.workspaceId),groupId:id(raw.groupId),name:text(raw.name,1,60)};
  case 'group.delete':fields(raw,['operation','workspaceId','groupId','removeContents']);if(typeof raw.removeContents!=='boolean')return invalid();return{operation:raw.operation,workspaceId:id(raw.workspaceId),groupId:id(raw.groupId),removeContents:raw.removeContents};
  case 'resource.find':fields(raw,['operation','query']);return{operation:raw.operation,query:text(raw.query,1,300)};
  case 'link.create':fields(raw,['operation','workspaceId','name','url'],['groupId']);return{operation:raw.operation,workspaceId:id(raw.workspaceId),...(raw.groupId!==undefined?{groupId:id(raw.groupId)}:{}),name:text(raw.name,1,60),url:httpsUrl(raw.url)};
  case 'link.rename':fields(raw,['operation','origin','linkId','name']);return{operation:raw.operation,origin:origin(raw.origin),linkId:id(raw.linkId),name:text(raw.name,1,60)};
  case 'link.editUrl':fields(raw,['operation','origin','linkId','url']);return{operation:raw.operation,origin:origin(raw.origin),linkId:id(raw.linkId),url:httpsUrl(raw.url)};
  case 'link.move':fields(raw,['operation','origin','linkId','destinationWorkspaceId'],['destinationGroupId']);return{operation:raw.operation,origin:origin(raw.origin),linkId:id(raw.linkId),destinationWorkspaceId:id(raw.destinationWorkspaceId),...(raw.destinationGroupId!==undefined?{destinationGroupId:id(raw.destinationGroupId)}:{})};
  case 'link.delete':fields(raw,['operation','origin','linkId']);return{operation:raw.operation,origin:origin(raw.origin),linkId:id(raw.linkId)};
  case 'file.annotation':fields(raw,['operation','widgetId','path','text']);return{operation:raw.operation,widgetId:id(raw.widgetId),path:relativePath(raw.path),text:content(raw.text,4000,true)};
  case 'file.moveReference':fields(raw,['operation','widgetId','destinationWorkspaceId']);return{operation:raw.operation,widgetId:id(raw.widgetId),destinationWorkspaceId:id(raw.destinationWorkspaceId)};
  case 'file.renameReference':fields(raw,['operation','widgetId','name']);return{operation:raw.operation,widgetId:id(raw.widgetId),name:text(raw.name,1,60)};
  case 'file.deleteReference':fields(raw,['operation','widgetId']);return{operation:raw.operation,widgetId:id(raw.widgetId)};
  case 'file.rename':fields(raw,['operation','widgetId','path','name']);return{operation:raw.operation,widgetId:id(raw.widgetId),path:relativePath(raw.path),name:fileName(raw.name)};
  case 'file.move':fields(raw,['operation','widgetId','path','destinationFolder']);return{operation:raw.operation,widgetId:id(raw.widgetId),path:relativePath(raw.path),destinationFolder:relativePath(raw.destinationFolder,true)};
  case 'file.delete':fields(raw,['operation','widgetId','path']);return{operation:raw.operation,widgetId:id(raw.widgetId),path:relativePath(raw.path)};
  case 'file.editText':fields(raw,['operation','widgetId','path','text','expectedText']);return{operation:raw.operation,widgetId:id(raw.widgetId),path:relativePath(raw.path),text:content(raw.text,1_000_000,true),expectedText:content(raw.expectedText,1_000_000,true)};
  case 'file.createText':fields(raw,['operation','widgetId','path','text']);return{operation:raw.operation,widgetId:id(raw.widgetId),path:createTextPath(raw.path),text:createTextContent(raw.text)};
  case 'note.quickCapture':fields(raw,['operation','workspaceId','title','text'],['notesWidgetId']);return{operation:raw.operation,workspaceId:id(raw.workspaceId),...(raw.notesWidgetId!==undefined?{notesWidgetId:id(raw.notesWidgetId)}:{}),title:text(raw.title,1,60),text:content(raw.text,12_000)};
  case 'rule.save':fields(raw,['operation','text']);return{operation:raw.operation,text:content(raw.text,2000)};
  case 'rule.list':fields(raw,['operation']);return{operation:raw.operation};
  case 'rule.enable':fields(raw,['operation','ruleId','enabled']);if(typeof raw.enabled!=='boolean')return invalid();return{operation:raw.operation,ruleId:id(raw.ruleId),enabled:raw.enabled};
  case 'rule.layoutMode':fields(raw,['operation','ruleId','mode']);if(raw.mode!=='append'&&raw.mode!=='replace')return invalid();return{operation:raw.operation,ruleId:id(raw.ruleId),mode:raw.mode};
  case 'rule.delete':fields(raw,['operation','ruleId']);return{operation:raw.operation,ruleId:id(raw.ruleId)};
  case 'rule.runDue':fields(raw,['operation']);return{operation:raw.operation};
  default:return invalid();
 }
}

/** Strictly parse the provider's optional workbenchActions field. */
export function parseWorkbenchActions(value:unknown):WorkbenchAction[]{
 if(value===undefined)return [];
 if(!Array.isArray(value)||value.length>MAX_WORKBENCH_ACTIONS)return invalid();
 return value.map(parseOne);
}

/** Mutations must be uniquely targeted; query-only workbench calls may batch. */
export function validateWorkbenchActionBatch(actions:WorkbenchAction[]):void{
 if(actions.length>MAX_WORKBENCH_ACTIONS)return invalid();
 const mutations=actions.filter(action=>action.operation!=='layout.list'&&action.operation!=='layout.find'&&action.operation!=='resource.find'&&action.operation!=='dashboard.list'&&action.operation!=='group.list'&&action.operation!=='rule.list');
 if(mutations.length&&actions.length!==1)return invalid();
}
