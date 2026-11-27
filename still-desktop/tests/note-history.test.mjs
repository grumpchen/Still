import test from 'node:test';
import assert from 'node:assert/strict';
import {allSavedNotes,editSavedNote,retainNoteHistory} from '../src/domain/noteHistory.ts';
import {createInitialState,createWidget,parseState} from '../src/domain/workspaces.ts';

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
 const deleted=editSavedNote(reloaded,note.id,()=>null);
 assert.equal(allSavedNotes(deleted).some(item=>item.document.id===note.id),false);
});
