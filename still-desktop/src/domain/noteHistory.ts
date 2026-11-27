import {checkedNoteDocuments,createNoteDocument,type NoteDocument} from './noteDocuments.ts';
import type {WidgetInstance,WorkspaceState} from './workspaces.ts';

export interface NoteHistoryEntry {
 document:NoteDocument;
 widgetId?:string;
 workspaceName?:string;
 markdownName?:string;
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
   for(const document of widget.noteDocuments)notes.set(document.id,{document,widgetId:widget.id,workspaceName:workspace.name});
  }
 }
 return notes;
}

export function allSavedNotes(state:WorkspaceState):NoteHistoryEntry[]{
 const notes=new Map((state.noteHistory??[]).map(entry=>[entry.document.id,entry]));
 for(const [id,entry] of liveNotes(state.workspaces))if(keep(entry.document))notes.set(id,entry);
 return [...notes.values()].reverse();
}

export function retainNoteHistory(previous:WorkspaceState,next:WorkspaceState):WorkspaceState{
 if(previous===next)return next;
 const previousHistory=previous.noteHistory??next.noteHistory;
 if(previous.workspaces===next.workspaces)return previousHistory===next.noteHistory?next:{...next,noteHistory:previousHistory};
 const present=liveNotes(next.workspaces);
 let history=previousHistory;
 for(const [id,entry] of liveNotes(previous.workspaces)){
  if(!present.has(id)&&keep(entry.document))history=[...(history??[]).filter(item=>item.document.id!==id),entry];
 }
 return history===next.noteHistory?next:{...next,noteHistory:history};
}

export function editSavedNote(state:WorkspaceState,id:string,edit:(document:NoteDocument)=>NoteDocument|null):WorkspaceState{
 function editWidget(widget:WidgetInstance){
  if(widget.type!=='notes'||!widget.noteDocuments.some(document=>document.id===id))return widget;
  const noteDocuments=widget.noteDocuments.flatMap(document=>{
   if(document.id!==id)return document;
   const changed=edit(document);
   return changed?{...changed,historyCreated:true}:[];
  });
  const active=noteDocuments.find(document=>document.id===widget.activeNoteDocumentId)??noteDocuments[0]??createNoteDocument();
  return {...widget,noteDocuments:noteDocuments.length?noteDocuments:[active],activeNoteDocumentId:active.id,title:active.title,text:active.text};
 }
 const noteHistory=state.noteHistory?.flatMap(entry=>{
  if(entry.document.id!==id)return entry;
  const document=edit(entry.document);
  return document?{...entry,document}:[];
 });
 const workspaces=state.workspaces.map(workspace=>{
  const widgets=workspace.widgets.map(editWidget);
  const groups=workspace.groups.map(group=>{
   const entries=group.widgets.map(entry=>{
    if(!entry.instance)return entry;
    const instance=editWidget(entry.instance);
    return instance===entry.instance?entry:{...entry,instance};
   });
   return entries.every((entry,index)=>entry===group.widgets[index])?group:{...group,widgets:entries};
  });
  return widgets.every((widget,index)=>widget===workspace.widgets[index])&&groups.every((group,index)=>group===workspace.groups[index])
   ?workspace:{...workspace,widgets,groups};
 });
 return {...state,noteHistory,workspaces};
}

export function parseNoteHistory(value:unknown):NoteHistoryEntry[]|undefined{
 if(!Array.isArray(value))return undefined;
 const result:NoteHistoryEntry[]=[],seen=new Set<string>();
 for(const raw of value){
  if(!raw||typeof raw!=='object'||!raw.document||typeof raw.document.id!=='string')continue;
  const [document]=checkedNoteDocuments([raw.document],{id:'invalid-note-history',title:'',text:''});
  if(document.id!==raw.document.id||seen.has(document.id))continue;
  seen.add(document.id);
  const widgetId=typeof raw.widgetId==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(raw.widgetId)?raw.widgetId:undefined;
  const workspaceName=typeof raw.workspaceName==='string'?raw.workspaceName.slice(0,100):undefined;
  const markdownName=typeof raw.markdownName==='string'?raw.markdownName.slice(0,255):undefined;
  result.push({document,widgetId,workspaceName,markdownName});
 }
 return result;
}
