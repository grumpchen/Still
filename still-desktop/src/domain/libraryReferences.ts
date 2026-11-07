import type {WorkspaceState,WidgetInstance} from './workspaces.ts';
import {remapLibraryPath} from './libraryOrganisation.ts';
export function libraryWidgets(state:WorkspaceState):WidgetInstance[]{return state.workspaces.flatMap(workspace=>[...workspace.widgets,...workspace.groups.flatMap(group=>group.widgets.flatMap(entry=>entry.kind==='collected'&&entry.instance?[entry.instance]:[]))])}
function affected(path:string,source:string){return path===source||path.startsWith(source+'/')}
function remapNotes(notes:Record<string,string>,source:string,destination:string){
 const next:Record<string,string>={};
 for(const [path,text] of Object.entries(notes)){const key=remapLibraryPath(path,source,destination);if(Object.hasOwn(next,key))throw new Error('Stored file annotations conflict at the destination. Resolve them before organising.');next[key]=text}
 return next;
}
/** Reject referenced file sessions we cannot safely retarget; no timer may later write the old path. */
export async function prepareLibraryReferences(state:WorkspaceState,rootId:string,source:string,destination:string,snapshot:(id:string)=>Promise<{rootId:string}>):Promise<Set<string>>{
 const widgets=libraryWidgets(state),aliases=new Set<string>(),cache=new Map<string,Promise<{rootId:string}>>();
 const rootFor=(id:string)=>{let result=cache.get(id);if(!result){result=snapshot(id);cache.set(id,result)}return result};
 // Standalone native document shortcuts have a separate opaque grant store. Do not risk breaking them.
 if(widgets.some(widget=>!!widget.fileKey)||state.presets.some(preset=>preset.type==='files'&&preset.resourceKind==='document'))throw new Error('Close standalone document widgets and remove saved document shortcuts before renaming or moving Library items. Their separate path grants cannot be safely retargeted yet.');
 for(const widget of widgets){
  if(widget.type==='notes'&&widget.noteDocuments.some(note=>!!note.sourcePath)){
   if(!widget.notesLibraryKey)throw new Error('Close file-backed note tabs with an unavailable folder connection before organising.');
   let root:{rootId:string};try{root=await rootFor(widget.notesLibraryKey)}catch{throw new Error('Close file-backed note tabs whose folder cannot be verified before organising.')}
   if(root.rootId===rootId&&widget.noteDocuments.some(note=>note.sourcePath&&affected(note.sourcePath,source)))throw new Error('Close the affected file-backed note tabs before organising. Pending edits must be saved successfully first.');
  }
  if(widget.type==='files'&&!widget.fileKey){
   try{if((await rootFor(widget.id)).rootId===rootId){remapNotes(widget.fileNotes,source,destination);aliases.add(widget.id);if(widget.folderKey)aliases.add(widget.folderKey)}}
   catch(reason){if(Object.keys(widget.fileNotes).some(path=>affected(path,source)))throw reason}
  }
 }
 for(const preset of state.presets)if(preset.type==='files'&&preset.resourceKind!=='document'){
  try{if((await rootFor(preset.folderSourceId)).rootId===rootId){remapNotes(preset.fileNotes??{},source,destination);aliases.add(preset.folderSourceId)}}catch(reason){if(Object.keys(preset.fileNotes??{}).some(path=>affected(path,source)))throw reason}
 }
 return aliases;
}
export function migrateLibraryReferences(state:WorkspaceState,aliases:Set<string>,source:string,destination:string):WorkspaceState{
 const mapWidget=(widget:WidgetInstance)=>aliases.has(widget.id)||widget.folderKey&&aliases.has(widget.folderKey)?{...widget,fileNotes:remapNotes(widget.fileNotes,source,destination)}:widget;
 return {...state,workspaces:state.workspaces.map(workspace=>({...workspace,widgets:workspace.widgets.map(mapWidget),groups:workspace.groups.map(group=>({...group,widgets:group.widgets.map(entry=>entry.kind==='collected'&&entry.instance?{...entry,instance:mapWidget(entry.instance)}:entry)}))})),presets:state.presets.map(preset=>preset.type==='files'&&preset.resourceKind!=='document'&&aliases.has(preset.folderSourceId)?{...preset,fileNotes:remapNotes(preset.fileNotes??{},source,destination)}:preset)};
}
