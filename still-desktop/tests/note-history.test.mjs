import test from 'node:test';
import assert from 'node:assert/strict';
import {allSavedNotes,editSavedNote,noteHistoryIdentity,retainNoteHistory} from '../src/domain/noteHistory.ts';
import {createGlobalWorkspaceLayout,createInitialState,createWidget,parseState} from '../src/domain/workspaces.ts';
import {presetFromWidget} from '../src/domain/presets.ts';

test('removing a Notes widget retains its notes and linked Markdown, while deleting the note removes it',()=>{
 const original=createInitialState(),widget=createWidget('notes');
 const note={...widget.noteDocuments[0],title:'Chapter.md',text:'Reading notes',sourcePath:'Course/Chapter.md'};
 widget.noteDocuments=[note];widget.activeNoteDocumentId=note.id;
 const workspace=original.workspaces.find(item=>item.name==='Study');
 const before={...original,workspaces:original.workspaces.map(item=>item===workspace?{...item,widgets:[widget]}:item)};
 const after=retainNoteHistory(before,{...before,workspaces:before.workspaces.map(item=>item.id===workspace.id?{...item,widgets:[]}:item)});
 const reloaded=parseState(JSON.parse(JSON.stringify(after)));
 const entry=allSavedNotes(reloaded).find(item=>item.document.id===note.id);
 assert.equal(entry.document.text,'Reading notes');
 assert.equal(entry.document.sourcePath,'Course/Chapter.md');
 assert.equal(entry.widgetId,widget.id);
 const deleted=editSavedNote(reloaded,noteHistoryIdentity(entry),()=>null);
 assert.equal(allSavedNotes(deleted).some(item=>item.document.id===note.id),false);
});

test('shared Notes identity distinguishes duplicate document IDs across workspaces',()=>{
 const state=createInitialState(),design=state.workspaces.find(item=>item.name==='Design'),study=state.workspaces.find(item=>item.name==='Study');
 const first=createWidget('notes'),second=createWidget('notes'),sharedId='same-legacy-note-id';
 first.noteDocuments=[{id:sharedId,title:'Design copy',text:'Design text'}];first.activeNoteDocumentId=sharedId;
 second.noteDocuments=[{id:sharedId,title:'Study copy',text:'Study text'}];second.activeNoteDocumentId=sharedId;
 design.widgets=[first];study.widgets=[second];
 const entries=allSavedNotes(state).filter(item=>item.document.id===sharedId);
 assert.equal(entries.length,2);
 const designEntry=entries.find(item=>item.workspaceId===design.id);
 const edited=editSavedNote(state,noteHistoryIdentity(designEntry),document=>({...document,title:'Edited design copy'}));
 assert.equal(edited.workspaces.find(item=>item.id===design.id).widgets[0].noteDocuments[0].title,'Edited design copy');
 assert.equal(edited.workspaces.find(item=>item.id===study.id).widgets[0].noteDocuments[0].title,'Study copy');
});

test('permanent Notes Home deletion removes only the exact live and history note, preserving saved copies',()=>{
 const state=createInitialState(),owner=state.workspaces.find(item=>item.name==='Study'),notes=createWidget('notes'),other=createWidget('notes'),id='same-legacy-note-id';
 notes.noteDocuments=[{id,title:'Delete me',text:'Private note'}];notes.activeNoteDocumentId=id;
 other.noteDocuments=[{id,title:'Keep this copy',text:'Separate workspace copy'}];other.activeNoteDocumentId=id;
 owner.widgets.push(notes);state.workspaces.find(item=>item.name==='Design').widgets.push(other);
 state.noteHistory=[{document:{id,title:'Delete me',text:'Private note'},workspaceId:owner.id,widgetId:notes.id,workspaceName:owner.name}];
 state.globalLayouts=[createGlobalWorkspaceLayout('Study backup',owner,state)];
 state.presets=[presetFromWidget(notes)];
 const identity={documentId:id,workspaceId:owner.id,widgetId:notes.id};
 const deleted=editSavedNote(state,identity,()=>null),restored=parseState(JSON.stringify(deleted));
 assert.equal(allSavedNotes(restored).some(item=>item.workspaceId===owner.id&&item.widgetId===notes.id&&item.document.id===id),false);
 assert.equal(restored.workspaces.find(item=>item.id===owner.id).widgets.find(item=>item.id===notes.id).noteDocuments.some(item=>item.id===id),false);
 assert.equal(restored.workspaces.find(item=>item.id===state.workspaces.find(x=>x.name==='Design').id).widgets.find(item=>item.id===other.id).noteDocuments[0].text,'Separate workspace copy');
 assert.equal(restored.globalLayouts[0].widgets.find(item=>item.id===notes.id).noteDocuments.some(item=>item.id===id),true);
 assert.equal(restored.presets[0].noteDocuments.some(item=>item.id===id),true);
});
