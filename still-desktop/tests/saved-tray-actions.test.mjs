import {test} from 'node:test';
import assert from 'node:assert/strict';
import {removeSavedPreset,renameSavedPreset} from '../src/domain/trayActions.ts';
import * as workspaces from '../src/domain/workspaces.ts';

test('renaming a saved app preserves its identity, app data and existing open widgets',()=>{
 const icon='data:image/png;base64,iVBORw0KGgo=';
 const original={id:'saved-editor',type:'apps',name:'Editor',appSourceId:'grant-editor',appName:'Editor.exe',iconData:icon};
 const presets=[original,{id:'saved-notes',type:'notes',name:'Notes',text:'keep this'}];
 const renamed=renameSavedPreset(presets,'saved-editor','Code editor');
 assert.deepEqual(renamed[0],{...original,name:'Code editor'});
 assert.equal(renamed[1],presets[1]);assert.equal(original.name,'Editor');
 assert.throws(()=>renameSavedPreset(presets,'saved-editor','   '));
 assert.throws(()=>renameSavedPreset(presets,'saved-editor','x'.repeat(61)));
});

test('deleting one saved entry leaves other shortcuts and source widget data untouched',()=>{
 const canvasWidget={id:'live-notes',type:'notes',title:'Notes',text:'source stays'};
 const presets=[{id:'saved-notes',type:'notes',name:'Notes',text:'copy'},{id:'saved-browser',type:'browser',name:'Course',url:'https://example.com/'}];
 assert.deepEqual(removeSavedPreset(presets,'saved-notes'),[presets[1]]);
 assert.deepEqual(canvasWidget,{id:'live-notes',type:'notes',title:'Notes',text:'source stays'});
 assert.equal(removeSavedPreset(presets,'missing'),presets);
});

test('renamed and removed shortcuts persist after workspace state reload',()=>{
 const state=workspaces.createInitialState();
 state.presets=[{id:'course-notes',type:'notes',name:'Notes',text:'saved copy'},{id:'course-page',type:'browser',name:'Course page',url:'https://example.com/'}];
 state.workspaces[0].groups=[{id:'course-group',name:'Chemistry',shortcuts:[],widgets:[],expanded:false}];
 state.presets=renameSavedPreset(state.presets,'course-notes','Lecture notes');
 state.presets=removeSavedPreset(state.presets,'course-page');
 state.workspaces[0]=workspaces.saveGroupName(state.workspaces[0],'course-group','CHEM111');
 const reopened=workspaces.parseState(JSON.stringify(state));
 assert.equal(reopened.presets.length,1);assert.equal(reopened.presets[0].name,'Lecture notes');
 assert.equal(reopened.workspaces[0].groups[0].name,'CHEM111');
});
