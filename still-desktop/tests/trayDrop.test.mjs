import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,parseState,createWidgetFromPreset} from '../src/domain/workspaces.ts';
import * as presets from '../src/domain/presets.ts';
const {parsePresets,widgetPreset}=presets;

test('a saved PDF shortcut persists without a raw path and opens independent Files widgets',()=>{
 const preset={id:'formula-preset',type:'files',resourceKind:'document',name:'CHEM111 formula sheet',fileSourceId:'selected-formula',fileName:'formula.pdf',fileKind:'pdf'};
 const state=createInitialState();state.presets=[preset];
 const saved=parseState(JSON.stringify(state));assert.equal(saved.presets.length,1);assert.deepEqual(saved.presets[0],preset);
 const first=createWidgetFromPreset(saved.presets[0],[]),second=createWidgetFromPreset(saved.presets[0],[first]);
 assert.equal(first.type,'files');assert.equal(first.fileKey,'selected-formula');assert.equal(first.fileName,'formula.pdf');assert.equal(first.fileKind,'pdf');assert.equal(first.folderKey,null);
 assert.notEqual(first.id,second.id);assert.equal(second.instanceNumber,2);
 first.title='My sheet';assert.equal(second.title,preset.name);assert.equal(saved.presets[0].name,preset.name);
 saved.workspaces[0].widgets.push(first);saved.presets=[];
 const reopened=parseState(JSON.stringify(saved));assert.equal(reopened.presets.length,0);assert.equal(reopened.workspaces[0].widgets.find(w=>w.id===first.id).fileKey,'selected-formula');
});

test('document shortcuts reject raw paths and unknown kinds while old folder presets still round-trip',()=>{
 const folder={id:'course-folder',type:'files',name:'Course',folderSourceId:'selected-course',folderName:'CHEM111'};
 const document={id:'document',type:'files',resourceKind:'document',name:'Sheet',fileSourceId:'selected-sheet',fileName:'sheet.pdf',fileKind:'pdf'};
 assert.deepEqual(widgetPreset(folder),folder);assert.deepEqual(parsePresets([document]),[document]);
 assert.deepEqual(parsePresets([{...document,fileSourceId:'C:\\Private\\sheet.pdf'},{...document,fileKind:'program'},{...document,fileName:'../sheet.pdf'}]),[]);
 const state=createInitialState();for(const workspace of state.workspaces)for(const widget of workspace.widgets){delete widget.fileKey;delete widget.fileName;delete widget.fileKind}
 const migrated=parseState(JSON.stringify(state));assert.equal(migrated.workspaces[0].widgets[0].fileKey,null);
});

test('open widgets save only to Groups and only explicit Trash removes them',async()=>{
 const {trayDropDecision}=await import('../src/domain/trayDrop.ts');
 const widget={source:'widget',widgetType:'browser',insideTray:true};
 assert.equal(trayDropDecision({...widget,targetType:'browser',overInteractive:true}),'none');
 assert.equal(trayDropDecision({...widget,targetType:'files'}),'none');
 assert.equal(trayDropDecision({...widget,targetType:'apps'}),'none');
 assert.equal(trayDropDecision({...widget,targetType:'notes'}),'none');
 assert.equal(trayDropDecision({...widget,targetType:'calculator'}),'none');
 assert.equal(trayDropDecision({...widget,targetType:null}),'none');
 assert.equal(trayDropDecision({...widget,targetType:null,overInteractive:true}),'none');
 assert.equal(trayDropDecision({...widget,targetType:null,insideTray:false}),'none');
 assert.equal(trayDropDecision({source:'widget',widgetType:'files',insideTray:true,targetType:'files'}),'none');
 assert.equal(trayDropDecision({source:'widget',widgetType:'group',insideTray:true,targetType:'group'}),'none');
 assert.equal(trayDropDecision({source:'widget',widgetType:'group',insideTray:true,targetType:null}),'none');
});

test('widget drops distinguish creating and adding to Groups from Trash removal',async()=>{
 const {trayDropDecision}=await import('../src/domain/trayDrop.ts');
 const notes={source:'widget',widgetType:'notes',insideTray:true};
 assert.equal(trayDropDecision({...notes,groupTarget:{kind:'create'}}),'create-group');
 assert.equal(trayDropDecision({...notes,groupTarget:{kind:'existing',groupId:'chem111'}}),'save-group');
 assert.equal(trayDropDecision({source:'widget',widgetType:'group',insideTray:true,groupTarget:{kind:'create'}}),'none');
 assert.equal(trayDropDecision({...notes,targetType:null,overInteractive:false}),'none');
 assert.equal(trayDropDecision({...notes,targetType:'notes'}),'none');
 assert.equal(trayDropDecision({source:'file',insideTray:true,groupTarget:{kind:'create'}}),'none');
 assert.equal(trayDropDecision({source:'app',insideTray:true,groupTarget:{kind:'existing',groupId:'chem111'}}),'none');
});

test('saving notes and timetable templates preserves content but gives each opened widget independent state',()=>{
 const state=createInitialState(),note=state.workspaces[0].widgets.find(w=>w.type==='notes');note.title='Chemistry notes';note.text='Keep this formula';
 assert.equal(typeof presets.presetFromWidget,'function');
 const notePreset=presets.presetFromWidget(note);assert.equal(notePreset.type,'notes');assert.equal(notePreset.text,note.text);
 const first=createWidgetFromPreset(notePreset,[]),second=createWidgetFromPreset(notePreset,[first]);first.text='A separate note';
 assert.equal(second.text,'Keep this formula');assert.equal(notePreset.text,'Keep this formula');assert.notEqual(first.id,second.id);
 const template={id:'class-template',type:'timetable',name:'CHEM111',schedule:[{id:'class1',day:1,time:'10:00',title:'Lecture',location:'Room 1'}]};
 state.presets=[notePreset,template];const saved=parseState(JSON.stringify(state));assert.equal(saved.presets.length,2);
 const a=createWidgetFromPreset(saved.presets[1],[]),b=createWidgetFromPreset(saved.presets[1],[a]);a.schedule[0].title='Edited';
 assert.equal(b.schedule[0].title,'Lecture');assert.equal(saved.presets[1].schedule[0].title,'Lecture');
});

test('saved focus timers reopen paused and malformed generic state is filtered',()=>{
 const state=createInitialState(),timer=state.workspaces[0].widgets.find(w=>w.type==='focus');timer.end=Date.now()+90000;
 assert.equal(typeof presets.presetFromWidget,'function');
 const preset=presets.presetFromWidget(timer),opened=createWidgetFromPreset(preset,[]);assert.equal(opened.end,null);assert.ok(opened.remaining>0&&opened.remaining<=90);
 const timetable=widgetPreset({id:'bad-class',type:'timetable',name:'Schedule',schedule:[{id:'class1',day:7,time:'30:00',title:'Bad',location:'Room'},{id:'class2',day:2,time:'12:00',title:'Good',location:'Room'}]});
 assert.equal(timetable.schedule.length,1);assert.equal(timetable.schedule[0].id,'class2');
 assert.deepEqual(parsePresets([{id:'not-a-group',type:'group',name:'Group'}]),[]);
 assert.throws(()=>widgetPreset({id:'negative-timer',type:'focus',name:'Timer',remaining:-1}));
});

test('external files and websites are saved only on their tray type and never removed on blank tray',async()=>{
 const {trayDropDecision}=await import('../src/domain/trayDrop.ts');
 for(const source of ['file','website']){
  assert.equal(trayDropDecision({source,insideTray:true,targetType:null}),'none');
  assert.equal(trayDropDecision({source,insideTray:false,targetType:source==='file'?'files':'browser'}),'none');
 }
 assert.equal(trayDropDecision({source:'file',insideTray:true,targetType:'files'}),'save');
 assert.equal(trayDropDecision({source:'file',insideTray:true,targetType:'browser'}),'none');
 assert.equal(trayDropDecision({source:'website',insideTray:true,targetType:'browser'}),'save');
 assert.equal(trayDropDecision({source:'website',insideTray:true,targetType:'files'}),'none');
});

test('website drops use safe link URLs and available titles without turning plain text into searches',async()=>{
 const {droppedWebsite}=await import('../src/domain/trayDrop.ts');
 assert.deepEqual(droppedWebsite('# bookmark\nhttps://chatgpt.com/\n'),{url:'https://chatgpt.com/',name:'chatgpt.com'});
 assert.deepEqual(droppedWebsite('https://example.com/course?a=1&b=2','<a href="https://example.com/course?a=1&amp;b=2"><b>CHEM111</b> &amp; notes</a>'),{url:'https://example.com/course?a=1&b=2',name:'CHEM111 & notes'});
 assert.deepEqual(droppedWebsite('', '<a href="https://www.desmos.com/scientific">Calculator</a>'),{url:'https://www.desmos.com/scientific',name:'Calculator'});
 for(const unsafe of ['javascript:alert(1)','file:///C:/secret.pdf','http://example.com','https://user:password@example.com','study notes','C:\\Users\\private.pdf'])assert.equal(droppedWebsite(unsafe),null);
});

test('saved Apps shortcuts persist as opaque references and open independent launcher widgets',()=>{
 const preset={id:'pdf-viewer',type:'apps',name:'PDF viewer',appSourceId:'selected-viewer',appName:'My PDF app.lnk'};
 const state=createInitialState();state.presets=[preset];const saved=parseState(JSON.stringify(state));assert.deepEqual(saved.presets[0],preset);
 const first=createWidgetFromPreset(preset,[]),second=createWidgetFromPreset(preset,[first]);
 assert.equal(first.type,'apps');assert.equal(first.appKey,'selected-viewer');assert.equal(first.appName,'My PDF app.lnk');assert.notEqual(first.id,second.id);assert.equal(second.instanceNumber,2);
 const again=presets.presetFromWidget(first);assert.equal(again.type,'apps');assert.equal(again.appSourceId,'selected-viewer');
 saved.workspaces[0].widgets.push(first);saved.presets=[];const reopened=parseState(JSON.stringify(saved));assert.equal(reopened.workspaces[0].widgets.find(w=>w.id===first.id).appKey,'selected-viewer');
 assert.deepEqual(parsePresets([{...preset,appSourceId:'C:\\Apps\\Viewer.exe'}]),[]);
});

test('application drops save only on Apps and never turn website or ordinary file drops into app launchers',async()=>{
 const {trayDropDecision}=await import('../src/domain/trayDrop.ts');
 assert.equal(trayDropDecision({source:'app',insideTray:true,targetType:'apps'}),'save');
 assert.equal(trayDropDecision({source:'app',insideTray:true,targetType:'files'}),'none');
 assert.equal(trayDropDecision({source:'app',insideTray:true,targetType:null}),'none');
 assert.equal(trayDropDecision({source:'file',insideTray:true,targetType:'apps'}),'none');
 assert.equal(trayDropDecision({source:'website',insideTray:true,targetType:'apps'}),'none');
 assert.equal(trayDropDecision({source:'widget',widgetType:'apps',insideTray:true,targetType:'apps'}),'none');
 assert.equal(trayDropDecision({source:'widget',widgetType:'apps',insideTray:true,targetType:'files'}),'none');
});
