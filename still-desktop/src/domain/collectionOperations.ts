import {shortcut} from './webShortcuts.ts';
import {checkedFileNotes} from './fileNotes.ts';
import {createNoteDocument,checkedNoteDocuments,NOTE_DOCUMENT_LIMIT,NOTE_DOCUMENT_TEXT_LIMIT} from './noteDocuments.ts';
import {createWidget,transferWidgetInstance,type WorkspaceState,type WidgetInstance,type SavedGroup} from './workspaces.ts';
import {nextPlacement} from './layout.ts';

/** Typed Library changes. Saved link removal affects Still metadata only; file removal is intentionally unsupported. */
export type CollectionLinkOrigin={kind:'group';workspaceId:string;groupId:string}|{kind:'browser';workspaceId:string;widgetId:string};
export type CollectionOperationRequest=
 |{type:'link.create';workspaceId:string;groupId?:string;name:string;url:string}
 |{type:'link.rename';origin:CollectionLinkOrigin;linkId:string;name:string}
 |{type:'link.editUrl';origin:CollectionLinkOrigin;linkId:string;url:string}
 |{type:'link.move';origin:CollectionLinkOrigin;linkId:string;destinationWorkspaceId:string;destinationGroupId?:string}
 |{type:'link.delete';origin:CollectionLinkOrigin;linkId:string}
 |{type:'file.annotation';widgetId:string;path:string;text:string}
 |{type:'file.renameReference';widgetId:string;name:string}
 |{type:'file.moveReference';widgetId:string;destinationWorkspaceId:string}
 |{type:'file.deleteReference';widgetId:string}
 |{type:'file.rename';widgetId:string;path:string;name:string}
 |{type:'file.move';widgetId:string;path:string;destinationFolder:string}
 |{type:'file.delete';widgetId:string;path:string}
 |{type:'file.editText';widgetId:string;path:string;text:string;expectedText:string}
 |{type:'file.createText';widgetId:string;path:string;text:string}
 |{type:'note.quickCapture';workspaceId:string;notesWidgetId?:string;title:string;text:string};
export type CollectionOperationContext={source:'manual'|'assistant'|'automation';idempotencyKey?:string};
export type CollectionOperationResource={kind:'link';origin:CollectionLinkOrigin;linkId:string;name:string;url:string}|{kind:'note';workspaceId:string;widgetId:string;documentId:string;name:string}|{kind:'file';workspaceId:string;widgetId:string;name:string;sourceId:string};
export type CollectionOperationResult={status:'succeeded'|'failed'|'needs_clarification'|'outcome_unknown';changed:boolean;summary:string;receiptId?:string;resource?:CollectionOperationResource};
export interface CollectionActionResult {state:WorkspaceState;changed:boolean;summary:string;resource?:CollectionOperationResource}

const validRelativePath=(path:string)=>!!path&&path.length<=1000&&!path.startsWith('/')&&!/^[a-z]:/i.test(path)&&!path.split(/[\\/]/).some(part=>!part||part==='.'||part==='..');
function findGroup(state:WorkspaceState,workspaceId:string,groupId:string){const workspace=state.workspaces.find(item=>item.id===workspaceId);return{workspace,group:workspace?.groups.find(item=>item.id===groupId)}}
function isBrowserShortcutWidget(workspace:WorkspaceState['workspaces'][number]|undefined,widgetId:string){const widget=workspace?.widgets.find(item=>item.id===widgetId);if(!workspace||!widget)return false;const kind=String(widget.type);return kind==='browser'||kind==='group'&&!workspace.groups.some(group=>group.id===(widget.groupId??widget.id))}
function findLink(state:WorkspaceState,origin:CollectionLinkOrigin,linkId:string){
 const workspace=state.workspaces.find(item=>item.id===origin.workspaceId);if(origin.kind==='group'){const group=workspace?.groups.find(item=>item.id===origin.groupId);return{workspace,group,widget:undefined,link:group?.shortcuts.find(item=>item.id===linkId)}}
 const widget=workspace?.widgets.find(item=>item.id===origin.widgetId&&isBrowserShortcutWidget(workspace,item.id));return{workspace,group:undefined,widget,link:widget?.shortcuts.find(item=>item.id===linkId)};
}
function editOrigin(workspace:WorkspaceState['workspaces'][number],origin:CollectionLinkOrigin,linkId:string,change:(links:import('./webShortcuts.ts').WebShortcut[])=>import('./webShortcuts.ts').WebShortcut[]){
 return origin.kind==='group'?{...workspace,groups:workspace.groups.map(group=>group.id===origin.groupId?{...group,shortcuts:change(group.shortcuts)}:group)}:{...workspace,widgets:workspace.widgets.map(widget=>widget.id===origin.widgetId?{...widget,shortcuts:change(widget.shortcuts)}:widget)};
}

/** A pure reducer shared by manual controls, assistant actions and automation. */
export function applyCollectionAction(state:WorkspaceState,action:CollectionOperationRequest):CollectionActionResult{
 if(action.type==='file.renameReference'||action.type==='file.moveReference'||action.type==='file.deleteReference'){
  const sourceWorkspace=state.workspaces.find(workspace=>workspace.widgets.some(widget=>widget.id===action.widgetId&&widget.type==='files'&&!!widget.fileKey)),sourceWidget=sourceWorkspace?.widgets.find(widget=>widget.id===action.widgetId&&widget.type==='files'&&!!widget.fileKey);
  if(!sourceWorkspace||!sourceWidget)throw new Error('The Files shortcut is no longer available.');
  if(sourceWidget.lockPluginEnabled&&sourceWidget.locked)throw new Error('Unlock this Files shortcut before changing it.');
  const resource=(workspaceId:string,name=sourceWidget.fileName||sourceWidget.title||'File')=>({kind:'file' as const,workspaceId,widgetId:sourceWidget.id,name,sourceId:sourceWidget.fileKey!});
  if(action.type==='file.renameReference'){
   const name=action.name.trim().slice(0,60);if(!name)throw new Error('Enter a name for this file shortcut.');
   if(name===(sourceWidget.fileName||sourceWidget.title))return{state,changed:false,summary:'The file shortcut name is already current.',resource:resource(sourceWorkspace.id,name)};
   const workspaces=state.workspaces.map(workspace=>workspace.id!==sourceWorkspace.id?workspace:{...workspace,widgets:workspace.widgets.map(widget=>widget.id!==sourceWidget.id?widget:{...widget,fileName:name,title:name})});
   return{state:{...state,workspaces},changed:true,summary:`Renamed the file shortcut to ${name}.`,resource:resource(sourceWorkspace.id,name)};
  }
  if(action.type==='file.deleteReference')return{state:{...state,workspaces:state.workspaces.map(workspace=>workspace.id!==sourceWorkspace.id?workspace:{...workspace,widgets:workspace.widgets.filter(widget=>widget.id!==sourceWidget.id)})},changed:true,summary:'Removed the Still file shortcut. The original file remains on disk.'};
  const destination=state.workspaces.find(workspace=>workspace.id===action.destinationWorkspaceId);if(!destination||destination.role!=='study'&&destination.role!=='custom')throw new Error('Choose an available course as the destination.');
  if(destination.id===sourceWorkspace.id)return{state,changed:false,summary:'The file shortcut is already in this course.',resource:resource(sourceWorkspace.id)};
  const moved=transferWidgetInstance(sourceWorkspace,destination,sourceWidget.id,20000,20000);if(!moved)throw new Error('Still could not move this file shortcut. Check that it is unlocked and try again.');
  return{state:{...state,workspaces:state.workspaces.map(workspace=>workspace.id===sourceWorkspace.id?moved.source:workspace.id===destination.id?moved.destination:workspace)},changed:true,summary:`Moved ${sourceWidget.fileName||sourceWidget.title||'the file shortcut'} to ${destination.name}.`,resource:resource(destination.id)};
 }
 if(action.type==='link.create'){
  const targetWorkspace=state.workspaces.find(item=>item.id===action.workspaceId);if(!targetWorkspace)throw new Error('Choose an available course first.');
  const targetGroup=action.groupId?targetWorkspace.groups.find(item=>item.id===action.groupId):targetWorkspace.groups.find(item=>/^(saved links|bookmarks|favorites|收藏|收藏夹)$/i.test(item.name.trim()));
  const createdGroup:SavedGroup|undefined=targetGroup?undefined:{id:crypto.randomUUID(),name:state.locale==='zh-CN'?'收藏':'Saved links',shortcuts:[],widgets:[],expanded:false};
  const group=targetGroup??createdGroup!;
  const value=shortcut({name:action.name,url:action.url});
  return{state:{...state,workspaces:state.workspaces.map(workspace=>workspace.id!==action.workspaceId?workspace:{...workspace,groups:targetGroup?workspace.groups.map(item=>item.id!==group.id?item:{...item,shortcuts:[...item.shortcuts,value]}):[...workspace.groups,{...group,shortcuts:[...group.shortcuts,value]}]})},changed:true,summary:`Saved ${value.name} in ${targetWorkspace.name} / ${group.name||'Group'}.`,resource:{kind:'link',origin:{kind:'group',workspaceId:action.workspaceId,groupId:group.id},linkId:value.id,name:value.name,url:value.url}};
 }
 if(action.type==='link.rename'||action.type==='link.editUrl'||action.type==='link.move'||action.type==='link.delete'){
  const source=findLink(state,action.origin,action.linkId),link=source.link;
  if(!source.workspace||!link||action.origin.kind==='group'&&!source.group||action.origin.kind==='browser'&&(!source.widget||!isBrowserShortcutWidget(source.workspace,source.widget.id)))throw new Error('The saved link changed or is no longer available.');
  if(action.type==='link.rename'){
   const value=shortcut({...link,name:action.name});
   return{state:{...state,workspaces:state.workspaces.map(workspace=>workspace.id!==action.origin.workspaceId?workspace:editOrigin(workspace,action.origin,action.linkId,items=>items.map(item=>item.id===action.linkId?value:item)))},changed:value.name!==link.name,summary:`Renamed saved link to ${value.name}.`};
  }
  if(action.type==='link.editUrl'){
   const value=shortcut({...link,url:action.url});
   return{state:{...state,workspaces:state.workspaces.map(workspace=>workspace.id!==action.origin.workspaceId?workspace:editOrigin(workspace,action.origin,action.linkId,items=>items.map(item=>item.id===action.linkId?value:item)))},changed:value.url!==link.url,summary:`Updated the saved link ${value.name}.`};
  }
  if(action.type==='link.delete')return{state:{...state,workspaces:state.workspaces.map(workspace=>workspace.id!==action.origin.workspaceId?workspace:editOrigin(workspace,action.origin,action.linkId,items=>items.filter(item=>item.id!==action.linkId)))},changed:true,summary:`Removed ${link.name} from Still's saved shortcuts. The website was not deleted.`};
  const destinationWorkspace=state.workspaces.find(item=>item.id===action.destinationWorkspaceId);if(!destinationWorkspace)throw new Error('Choose an available destination course.');
  const destinationGroup=action.destinationGroupId?destinationWorkspace.groups.find(group=>group.id===action.destinationGroupId):destinationWorkspace.groups.find(group=>/^(saved links|bookmarks|favorites|收藏|收藏夹)$/i.test(group.name.trim()));
  const createdGroup:SavedGroup|undefined=destinationGroup?undefined:{id:crypto.randomUUID(),name:state.locale==='zh-CN'?'收藏':'Saved links',shortcuts:[],widgets:[],expanded:false};
  const destination=destinationGroup??createdGroup!;
  if(destination.shortcuts.some(item=>item.id===link.id))throw new Error('That Group already contains this link.');
  return{state:{...state,workspaces:state.workspaces.map(workspace=>{
   if(workspace.id===action.origin.workspaceId&&workspace.id===action.destinationWorkspaceId){const withDestination=destinationGroup?{...workspace,groups:workspace.groups.map(group=>group.id===destination.id?{...group,shortcuts:[...group.shortcuts,link]}:group)}:{...workspace,groups:[...workspace.groups,{...destination,shortcuts:[link]}]};return editOrigin(withDestination,action.origin,action.linkId,items=>items.filter(item=>item.id!==action.linkId))}
   if(workspace.id===action.origin.workspaceId)return editOrigin(workspace,action.origin,action.linkId,items=>items.filter(item=>item.id!==action.linkId));
   if(workspace.id===action.destinationWorkspaceId)return destinationGroup?{...workspace,groups:workspace.groups.map(group=>group.id===destination.id?{...group,shortcuts:[...group.shortcuts,link]}:group)}:{...workspace,groups:[...workspace.groups,{...destination,shortcuts:[link]}]};
   return workspace;
  })},changed:true,summary:`Moved ${link.name} to ${destinationWorkspace.name} / ${destination.name||'Group'}.`};
 }
 if(action.type==='file.annotation'){
  if(!validRelativePath(action.path)||action.text.length>4000)throw new Error('Choose a file in a connected Library folder and keep the annotation under 4,000 characters.');
  let changed=false;const update=(widget:WidgetInstance)=>{if(widget.id!==action.widgetId||widget.type!=='files')return widget;const prior=widget.fileNotes[action.path]??'';if(prior===action.text){changed=false;return widget}changed=true;const notes={...widget.fileNotes};if(action.text)notes[action.path]=action.text;else delete notes[action.path];return{...widget,fileNotes:checkedFileNotes(notes)}};
  const workspaces=state.workspaces.map(workspace=>({...workspace,widgets:workspace.widgets.map(update)}));
  if(!state.workspaces.some(workspace=>workspace.widgets.some(widget=>widget.id===action.widgetId&&widget.type==='files')))throw new Error('The source Files widget is no longer available.');
  return{state:{...state,workspaces},changed,summary:changed?'Updated the file annotation.':'The file annotation is already current.'};
 }
 if(action.type!=='note.quickCapture')throw new Error('Unsupported Library operation.');
 const workspace=state.workspaces.find(item=>item.id===action.workspaceId);if(!workspace)throw new Error('Choose an available course first.');
 const title=action.title.trim().slice(0,60)||'Quick capture';if(!action.text.trim())throw new Error('Enter an idea to save.');if(action.text.length>NOTE_DOCUMENT_TEXT_LIMIT)throw new Error('The idea is too long to save as one note.');
 let notes=workspace.widgets.find(widget=>widget.type==='notes'&&(!action.notesWidgetId||widget.id===action.notesWidgetId));
 if(action.notesWidgetId&&!notes)throw new Error('The selected Notes widget is no longer available.');
 if(notes&&notes.type==='notes'&&notes.noteDocuments.length>=NOTE_DOCUMENT_LIMIT)throw new Error('This Notes widget has reached its open note limit.');
 const document=createNoteDocument(title);document.text=action.text;
 if(!notes){notes=createWidget('notes');notes.placement=nextPlacement('notes',workspace.widgets);notes.noteDocuments=[document];notes.activeNoteDocumentId=document.id;notes.text=document.text;return{state:{...state,workspaces:state.workspaces.map(item=>item.id!==workspace.id?item:{...item,widgets:[...item.widgets,notes!]})},changed:true,summary:`Created Notes and saved “${title}” to ${workspace.name}.`,resource:{kind:'note',workspaceId:workspace.id,widgetId:notes.id,documentId:document.id,name:title}}}
 const noteDocuments=checkedNoteDocuments([...notes.noteDocuments,document],document);
 return{state:{...state,workspaces:state.workspaces.map(item=>item.id!==workspace.id?item:{...item,widgets:item.widgets.map(widget=>widget.id!==notes!.id?widget:{...widget,noteDocuments,activeNoteDocumentId:document.id,text:document.text})})},changed:true,summary:`Saved “${title}” to ${workspace.name}.`,resource:{kind:'note',workspaceId:workspace.id,widgetId:notes.id,documentId:document.id,name:title}};
}
