import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as workspaces from '../src/domain/workspaces.ts';
import {localFiles} from '../src/platform/files.ts';

test('a ChatGPT browser preset survives reopening and adds fresh independent browsers at its URL',()=>{
 const state=workspaces.createInitialState();assert.deepEqual(state.presets,[]);
 state.presets=[{id:'chatgpt-preset',type:'browser',name:'ChatGPT',url:'https://chatgpt.com/'}];
 const saved=workspaces.parseState(JSON.stringify(state));assert.equal(saved.presets[0].name,'ChatGPT');
 const first=workspaces.createWidgetFromPreset(saved.presets[0],saved.workspaces[0].widgets,{x:12,y:16});
 const second=workspaces.createWidgetFromPreset(saved.presets[0],[...saved.workspaces[0].widgets,first],{x:60,y:20});
 assert.equal(first.type,'browser');assert.equal(first.title,'ChatGPT');assert.equal(first.url,'https://chatgpt.com/');
 assert.notEqual(first.id,second.id);assert.equal(second.instanceNumber,3);assert.equal(first.placement.y,16);
 first.url='https://example.com/';assert.equal(second.url,'https://chatgpt.com/');assert.equal(saved.presets[0].url,'https://chatgpt.com/');
});

test('a custom Files preset saves a selected-folder reference and creates separate Files instances',()=>{
 const state=workspaces.createInitialState();
 state.presets=[{id:'chem-files',type:'files',name:'CHEM111 files',folderSourceId:'chosen-folder',folderName:'CHEM111'}];
 const saved=workspaces.parseState(JSON.stringify(state));assert.equal(saved.presets?.length,1);
 const first=workspaces.createWidgetFromPreset(saved.presets[0],[]),second=workspaces.createWidgetFromPreset(saved.presets[0],[first]);
 assert.equal(first.type,'files');assert.equal(first.title,'CHEM111 files');assert.equal(first.folderKey,'chosen-folder');assert.equal(first.folderName,'CHEM111');
 assert.notEqual(first.id,second.id);assert.equal(second.instanceNumber,2);
 saved.workspaces[0].widgets.push(first);saved.presets=[];
 const reopened=workspaces.parseState(JSON.stringify(saved));assert.equal(reopened.presets.length,0);
 assert.equal(reopened.workspaces[0].widgets.find(w=>w.id===first.id).folderKey,'chosen-folder');
});
test('saved Apps shortcuts retain only bounded validated PNG icon data',()=>{
 const icon='data:image/png;base64,iVBORw0KGgo=';
 const state=workspaces.createInitialState();state.presets=[{id:'app-shortcut',type:'apps',name:'Editor',appSourceId:'grant-1',appName:'Editor.exe',iconData:icon}];
 const saved=workspaces.parseState(JSON.stringify(state)),preset=saved.presets[0];
 assert.equal(preset.iconData,icon);const widget=workspaces.createWidgetFromPreset(preset,[]);assert.equal(widget.appIconData,icon);assert.equal(widget.appKey,'grant-1');
 state.presets=[{...state.presets[0],iconData:'data:image/png;base64,not-a-png'}];assert.equal(workspaces.parseState(JSON.stringify(state)).presets[0].iconData,undefined);
 state.presets=[{...state.presets[0],iconData:'data:image/png;base64,iVBORw0KGgo,'+'A'.repeat(16*1024)}];assert.equal(workspaces.parseState(JSON.stringify(state)).presets[0].iconData,undefined);
});

test('older layouts gain an empty preset list and invalid URLs or folder references are rejected',()=>{
 const state=workspaces.createInitialState();delete state.presets;const browser=state.workspaces[0].widgets[0];
 const older=workspaces.parseState(JSON.stringify(state));assert.deepEqual(older.presets,[]);assert.equal(older.workspaces[0].widgets[0].id,browser.id);
 state.presets=[{id:'valid',type:'browser',name:'Course',url:'example.com/course'},
  {id:'bad-url',type:'browser',name:'Unsafe',url:'javascript:alert(1)'},
  {id:'bad-folder',type:'files',name:'Escape',folderSourceId:'C:\\Users\\private',folderName:'Private'},
  {id:'unknown',type:'unsupported-widget',name:'Other'},null];
 const saved=workspaces.parseState(JSON.stringify(state));assert.equal(saved.presets.length,1);assert.equal(saved.presets[0].url,'https://example.com/course');
 assert.throws(()=>workspaces.createWidgetFromPreset(state.presets[1],[]));
 assert.throws(()=>workspaces.createWidgetFromPreset(state.presets[2],[]));
});

test('saved folder connections can be reused while changing one instance leaves the others alone',async()=>{
 assert.equal(typeof localFiles.reuse,'function');
 function file(folder,name){const value=new File(['test'],name);Object.defineProperty(value,'webkitRelativePath',{value:folder+'/'+name});return value}
 localFiles.select('preset-folder',[file('CHEM111','formula.txt')]);
 const first=await localFiles.reuse('first-files','preset-folder'),second=await localFiles.reuse('second-files','preset-folder');
 assert.equal(first.rootName,'CHEM111');assert.equal(second.entries[0].name,'formula.txt');
 localFiles.select('first-files',[file('Personal','notes.txt')]);
 assert.equal((await localFiles.reuse('first-files','preset-folder')).rootName,'Personal');
 assert.equal((await localFiles.list('second-files','')).rootName,'CHEM111');
 await assert.rejects(localFiles.reuse('missing-files','unselected-folder'));
});
