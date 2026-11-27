/**
 * Structured actions for Still features that live outside the active widget
 * canvas. Collection operations mirror the shared collection operation
 * service's request fields; this module validates wire data, not execution.
 */
export type WorkbenchAction =
 | {operation:'layout.list'}
 | {operation:'layout.find';query:string}
 | {operation:'layout.save';name:string;sourceWorkspaceId?:string}
 | {operation:'layout.apply';layoutId:string;targetWorkspaceId:string;mode:'append'|'replace'}
 | {operation:'layout.rename';layoutId:string;name:string}
 | {operation:'layout.duplicate';layoutId:string}
 | {operation:'layout.delete';layoutId:string}
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
 | {operation:'rule.save';text:string};
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
  case 'layout.find':fields(raw,['operation','query']);return{operation:raw.operation,query:text(raw.query,1,300)};
  case 'layout.list':fields(raw,['operation']);return{operation:raw.operation};
  case 'layout.save':fields(raw,['operation','name'],['sourceWorkspaceId']);return{operation:raw.operation,name:text(raw.name,1,60),...(raw.sourceWorkspaceId!==undefined?{sourceWorkspaceId:id(raw.sourceWorkspaceId)}:{})};
  case 'layout.apply':fields(raw,['operation','layoutId','targetWorkspaceId','mode']);if(raw.mode!=='append'&&raw.mode!=='replace')return invalid();return{operation:raw.operation,layoutId:id(raw.layoutId),targetWorkspaceId:id(raw.targetWorkspaceId),mode:raw.mode};
  case 'layout.rename':fields(raw,['operation','layoutId','name']);return{operation:raw.operation,layoutId:id(raw.layoutId),name:text(raw.name,1,60)};
  case 'layout.duplicate':fields(raw,['operation','layoutId']);return{operation:raw.operation,layoutId:id(raw.layoutId)};
  case 'layout.delete':fields(raw,['operation','layoutId']);return{operation:raw.operation,layoutId:id(raw.layoutId)};
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
 const mutations=actions.filter(action=>action.operation!=='layout.list'&&action.operation!=='layout.find'&&action.operation!=='resource.find');
 if(mutations.length&&actions.length!==1)return invalid();
}
