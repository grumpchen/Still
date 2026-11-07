import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState} from '../src/domain/workspaces.ts';
import {libraryWidgets,prepareLibraryReferences,migrateLibraryReferences} from '../src/domain/libraryReferences.ts';

test('affected open file notes block mutation while unrelated same-name paths in another root do not',async()=>{
 const state=createInitialState(),note=libraryWidgets(state).find(widget=>widget.type==='notes');
 note.notesLibraryKey=note.id;note.noteDocuments[0].sourcePath='Old/week.md';
 const snapshot=id=>Promise.resolve({rootId:id===note.id?'root-1':'root-2'});
 await assert.rejects(prepareLibraryReferences(state,'root-1','Old','New',snapshot),/Close.*note/i);
 assert.ok(await prepareLibraryReferences(state,'root-2','Old','New',snapshot));
});
test('reference remapping updates folder annotations in widgets and presets without overwriting unrelated data',()=>{
 const state=createInitialState(),files=libraryWidgets(state).find(widget=>widget.type==='files');
 files.fileNotes={'Old/week.md':'important','Older/week.md':'keep'};
 const aliases=new Set([files.id]);
 state.presets=[{id:'preset-a',type:'files',name:'Course',folderSourceId:files.id,folderName:'Course',fileNotes:{'Old/week.md':'saved'}}];
 const next=migrateLibraryReferences(state,aliases,'Old','New');
 assert.deepEqual(libraryWidgets(next).find(widget=>widget.id===files.id).fileNotes,{'New/week.md':'important','Older/week.md':'keep'});
 assert.equal(next.presets[0].fileNotes['New/week.md'],'saved');
 assert.equal(files.fileNotes['Old/week.md'],'important');
});
