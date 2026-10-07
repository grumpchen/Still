import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filterAppWindows,managedAppWidget,appIconData} from '../src/domain/appPicker.ts';
import {createInitialState,parseState} from '../src/domain/workspaces.ts';

test('open app search distinguishes document windows and keeps attached windows marked after available choices',()=>{
 const windows=[{hwnd:1,pid:10,appName:'Word',title:'CHEM111 notes — Word',attached:false,minimized:false},{hwnd:2,pid:10,appName:'Word',title:'Engineering report — Word',attached:true,minimized:false},{hwnd:3,pid:20,appName:'Excel',title:'Lab results — Excel',attached:false,minimized:true}];
 assert.deepEqual(filterAppWindows(windows,'word chem').map(w=>w.hwnd),[1]);
 assert.deepEqual(filterAppWindows(windows,'WORD').map(w=>w.hwnd),[1,2]);
 assert.equal(filterAppWindows(windows,'report')[0].attached,true);
 assert.equal(filterAppWindows(windows,'excel')[0].minimized,true);
 assert.deepEqual(filterAppWindows(windows,'no match'),[]);
});
test('attaching a chosen app saves its grant and name without persisting native window handles',()=>{
 const selected={sourceId:'app-word',name:'Microsoft Word',hwnd:77,pid:99};
 const widget=managedAppWidget(selected,'Chem notes',[],undefined,1000,false);
 assert.equal(widget.appKey,'app-word');assert.equal(widget.title,'Chem notes');assert.equal(widget.appPanelOpen,true);assert.equal(widget.appReuseExisting,false);
 const second=managedAppWidget(selected,'Word',[widget],undefined,1000,true);
 assert.notEqual(second.id,widget.id);assert.equal(second.appReuseExisting,true);
 const state=createInitialState();state.workspaces[0].widgets.push(widget,second);
 const saved=JSON.stringify(state);assert.ok(!saved.includes('"hwnd"'));assert.ok(!saved.includes('"pid"'));
 const restored=parseState(saved).workspaces[0].widgets;
 assert.equal(restored.at(-1).appReuseExisting,true);assert.equal(restored.at(-2).appReuseExisting,false);
});

test('selected app icon bytes are bounded PNG data and never store native window identity',()=>{
 const bytes=[137,80,78,71,13,10,26,10,1,2,3];
 const icon=appIconData(bytes);assert.ok(icon?.startsWith('data:image/png;base64,iVBORw0KGgo'));
 assert.equal(appIconData([1,2,3]),undefined);
 assert.equal(appIconData([...bytes,...Array(13_000).fill(0)]),undefined);
 const widget=managedAppWidget({sourceId:'app-word',name:'Word'},'Chem notes',[],undefined,undefined,false,bytes);
 assert.equal(widget.appIconData,icon);assert.equal(JSON.stringify(widget).includes('hwnd'),false);assert.equal(JSON.stringify(widget).includes('pid'),false);
});

test('saved Apps presets retain only validated PNG data URLs when reopened',()=>{
 const icon='data:image/png;base64,iVBORw0KGgoBAgM=';
 const widget=managedAppWidget({sourceId:'app-word',name:'Word'},'Chem notes',[],undefined,undefined,true,icon);
 assert.equal(widget.appIconData,icon);
 assert.equal(managedAppWidget({sourceId:'app-word',name:'Word'},'Chem notes',[],undefined,undefined,true,'data:image/svg+xml;base64,AA==').appIconData,undefined);
});
