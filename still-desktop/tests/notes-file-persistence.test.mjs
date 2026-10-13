import test from 'node:test';
import assert from 'node:assert/strict';
import {createWidget,createWidgetFromPreset} from '../src/domain/workspaces.ts';
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

test('file note state has per-note, count, and aggregate bounds',()=>{
 const notes=checkedFileNotes(Object.fromEntries(Array.from({length:FILE_NOTE_LIMIT+2},(_,index)=>['file-'+index,'x'.repeat(5000)])));
 assert.ok(Object.keys(notes).length>0&&Object.keys(notes).length<=FILE_NOTE_LIMIT);
 assert.ok(Object.values(notes).every(value=>value.length<=4000));
 assert.ok(Object.values(notes).reduce((sum,value)=>sum+value.length,0)<=FILE_NOTE_TOTAL_LIMIT);
});
