import {checkedNoteDocuments,createNoteDocument,type NoteDocument} from './noteDocuments.ts';
import type {WidgetInstance,WorkspaceState} from './workspaces.ts';

export interface NoteHistoryEntry {
 document:NoteDocument;
 workspaceId?:string;
 widgetId?:string;
 workspaceName?:string;
 markdownName?:string;
}
export interface NoteHistoryIdentity {documentId:string;workspaceId?:string;widgetId?:string}
export function noteHistoryIdentity(entry:NoteHistoryEntry):NoteHistoryIdentity{return{documentId:entry.document.id,...(entry.workspaceId?{workspaceId:entry.workspaceId}:{}),...(entry.widgetId?{widgetId:entry.widgetId}:{})}}
export function noteHistoryKey(entry:NoteHistoryEntry):string{return JSON.stringify([entry.widgetId??'',entry.widgetId?'':entry.workspaceId??'',entry.document.id])}
export async function noteRevision(document:NoteDocument):Promise<string>{
 const bytes=new TextEncoder().encode(JSON.stringify([document.id,document.title,document.text]));
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('');
}

function keep(document:NoteDocument){
 return !!(document.historyCreated||document.title||document.text||document.sourcePath||document.tags?.length||document.sources?.length);
}

function liveNotes(workspaces:WorkspaceState['workspaces']){
 const notes=new Map<string,NoteHistoryEntry>();
 for(const workspace of workspaces){
  const collected=workspace.groups.flatMap(group=>group.widgets.flatMap(entry=>entry.instance?[entry.instance]:[]));
  for(const widget of [...workspace.widgets,...collected]){
   if(widget.type!=='notes')continue;
   for(const document of widget.noteDocuments){const entry={document,workspaceId:workspace.id,widgetId:widget.id,workspaceName:workspace.name};notes.set(noteHistoryKey(entry),entry)}
  }
 }
 return notes;
}

export function allSavedNotes(state:WorkspaceState):NoteHistoryEntry[]{
 const notes=new Map((state.noteHistory??[]).map(entry=>[noteHistoryKey(entry),entry]));
 for(const [key,entry] of liveNotes(state.workspaces))if(keep(entry.document))notes.set(key,{...notes.get(key),...entry});
 return [...notes.values()].reverse();
}

export function retainNoteHistory(previous:WorkspaceState,next:WorkspaceState):WorkspaceState{
 if(previous===next)return next;
 const previousHistory=previous.noteHistory??next.noteHistory;
 if(previous.workspaces===next.workspaces)return previousHistory===next.noteHistory?next:{...next,noteHistory:previousHistory};
 const present=liveNotes(next.workspaces);
 let history=previousHistory;
 for(const [id,entry] of liveNotes(previous.workspaces)){
  if(!present.has(id)&&keep(entry.document))history=[...(history??[]).filter(item=>noteHistoryKey(item)!==id),entry];
 }
 return history===next.noteHistory?next:{...next,noteHistory:history};
}

function matchesIdentity(widget:WidgetInstance,identity:NoteHistoryIdentity,workspaceId?:string):boolean{return widget.type==='notes'&&widget.noteDocuments.some(document=>document.id===identity.documentId)&&(!identity.widgetId||widget.id===identity.widgetId)&&(!identity.workspaceId||!workspaceId||workspaceId===identity.workspaceId)}
function editWidget(widget:WidgetInstance,identity:NoteHistoryIdentity,edit:(document:NoteDocument)=>NoteDocument|null,workspaceId?:string){
 if(!matchesIdentity(widget,identity,workspaceId))return widget;
  const noteDocuments=widget.noteDocuments.flatMap(document=>{
   if(document.id!==identity.documentId)return document;
   const changed=edit(document);
   return changed?{...changed,historyCreated:true}:[];
  });
  const active=noteDocuments.find(document=>document.id===widget.activeNoteDocumentId)??noteDocuments[0]??createNoteDocument();
  return {...widget,noteDocuments:noteDocuments.length?noteDocuments:[active],activeNoteDocumentId:active.id,title:active.title,text:active.text};
}
function entryMatches(entry:NoteHistoryEntry,identity:NoteHistoryIdentity):boolean{return entry.document.id===identity.documentId&&(!identity.widgetId?entry.widgetId===undefined:entry.widgetId===identity.widgetId)&&(!identity.workspaceId||!entry.workspaceId||entry.workspaceId===identity.workspaceId)}
function editWidgetList(widgets:WidgetInstance[],identity:NoteHistoryIdentity,edit:(document:NoteDocument)=>NoteDocument|null,workspaceId?:string){return widgets.map(widget=>editWidget(widget,identity,edit,workspaceId))}
export function editSavedNote(state:WorkspaceState,identity:NoteHistoryIdentity,edit:(document:NoteDocument)=>NoteDocument|null):WorkspaceState{
 const noteHistory=state.noteHistory?.flatMap(entry=>{
  if(!entryMatches(entry,identity))return entry;
  const document=edit(entry.document);
  return document?{...entry,document}:[];
 });
 const workspaces=state.workspaces.map(workspace=>{
  const widgets=editWidgetList(workspace.widgets,identity,edit,workspace.id);
  const groups=workspace.groups.map(group=>{
   const entries=group.widgets.map(entry=>{
    if(!entry.instance)return entry;
    const instance=editWidget(entry.instance,identity,edit,workspace.id);
    return instance===entry.instance?entry:{...entry,instance};
   });
   return entries.every((entry,index)=>entry===group.widgets[index])?group:{...group,widgets:entries};
  });
  return widgets.every((widget,index)=>widget===workspace.widgets[index])&&groups.every((group,index)=>group===workspace.groups[index])
   ?workspace:{...workspace,widgets,groups};
 });
 // Layouts and presets are independent saved copies. Even matching widget IDs do
 // not prove that a delete should erase their copied note content.
 return {...state,noteHistory,workspaces};
}

export function parseNoteHistory(value:unknown):NoteHistoryEntry[]|undefined{
 if(!Array.isArray(value))return undefined;
 const result:NoteHistoryEntry[]=[],seen=new Set<string>();
 for(const raw of value){
  if(!raw||typeof raw!=='object'||!raw.document||typeof raw.document.id!=='string')continue;
  const [document]=checkedNoteDocuments([raw.document],{id:'invalid-note-history',title:'',text:''});
  if(document.id!==raw.document.id)continue;
  const workspaceId=typeof raw.workspaceId==='string'&&/^[A-Za-z0-9_-]{1,120}$/.test(raw.workspaceId)?raw.workspaceId:undefined;
  const widgetId=typeof raw.widgetId==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(raw.widgetId)?raw.widgetId:undefined;
  const entry={document,...(workspaceId?{workspaceId}:{}),...(widgetId?{widgetId}:{}),...(typeof raw.workspaceName==='string'?{workspaceName:raw.workspaceName.slice(0,100)}:{}),...(typeof raw.markdownName==='string'?{markdownName:raw.markdownName.slice(0,255)}:{})};
  const key=noteHistoryKey(entry);if(seen.has(key))continue;seen.add(key);
  result.push(entry);
 }
 return result;
}
