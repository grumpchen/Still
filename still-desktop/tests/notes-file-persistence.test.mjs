import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,createWidget,createWidgetFromPreset,parseState} from '../src/domain/workspaces.ts';
import {presetFromWidget} from '../src/domain/presets.ts';
import {checkedFileNotes,FILE_NOTE_LIMIT,FILE_NOTE_TOTAL_LIMIT} from '../src/domain/fileNotes.ts';

test('Notes typography and document annotations survive saving and reopening a widget preset',()=>{
 const note=createWidget('notes');note.title='Revision';note.noteFont='serif';note.noteFontSize=24;
 const reopenedNote=createWidgetFromPreset(presetFromWidget(note),[]);
 assert.equal(reopenedNote.noteFont,'serif');assert.equal(reopenedNote.noteFontSize,24);
 const file=createWidget('files');file.id='file-one';file.fileKey='document-one';file.fileName='lecture.pdf';file.fileKind='pdf';file.fileNotes={'document-one':'Kinetics summary'};
 const reopenedFile=createWidgetFromPreset(presetFromWidget(file),[]);
 assert.deepEqual(reopenedFile.fileNotes,{'document-one':'Kinetics summary'});
});

test('multiple Notes pages keep independent titles and text across workspace and tray saves',()=>{
 const state=createInitialState(),workspace=state.workspaces[0],note=workspace.widgets.find(item=>item.type==='notes');
 note.title='Chemistry';note.text='Kinetics overview';note.noteDocuments=[{id:'kinetics',title:'Kinetics',text:'Rate laws'},{id:'equilibrium',title:'Equilibrium',text:'Le Chatelier'}];note.activeNoteDocumentId='equilibrium';
 const reopened=parseState(JSON.parse(JSON.stringify(state))).workspaces[0].widgets.find(item=>item.id===note.id);
 assert.equal(reopened.activeNoteDocumentId,'equilibrium');assert.equal(reopened.title,'Equilibrium');assert.equal(reopened.text,'Le Chatelier');assert.deepEqual(reopened.noteDocuments,note.noteDocuments);
 const fromTray=createWidgetFromPreset(presetFromWidget(note),[]);
 assert.equal(fromTray.activeNoteDocumentId,'equilibrium');assert.equal(fromTray.title,'Equilibrium');assert.deepEqual(fromTray.noteDocuments,note.noteDocuments);
});

test('legacy Notes with only a title and text migrate into one editable page',()=>{
 const state=createInitialState(),workspace=state.workspaces[0],note=workspace.widgets.find(item=>item.type==='notes');
 const legacy={...note,title:'Old note',text:'Saved text'};delete legacy.noteDocuments;delete legacy.activeNoteDocumentId;
 const reopened=parseState(JSON.parse(JSON.stringify({...state,workspaces:[{...workspace,widgets:workspace.widgets.map(item=>item.id===note.id?legacy:item)}]}))).workspaces[0].widgets.find(item=>item.id===note.id);
 assert.equal(reopened.title,'Old note');assert.equal(reopened.text,'Saved text');assert.equal(reopened.noteDocuments.length,1);assert.equal(reopened.noteDocuments[0].title,'Old note');
});

test('file note state has per-note, count, and aggregate bounds',()=>{
 const notes=checkedFileNotes(Object.fromEntries(Array.from({length:FILE_NOTE_LIMIT+2},(_,index)=>['file-'+index,'x'.repeat(5000)])));
 assert.ok(Object.keys(notes).length>0&&Object.keys(notes).length<=FILE_NOTE_LIMIT);
 assert.ok(Object.values(notes).every(value=>value.length<=4000));
 assert.ok(Object.values(notes).reduce((sum,value)=>sum+value.length,0)<=FILE_NOTE_TOTAL_LIMIT);
});
