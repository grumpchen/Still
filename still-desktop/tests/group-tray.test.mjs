import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as workspaces from '../src/domain/workspaces.ts';
import {shortcut} from '../src/domain/webShortcuts.ts';
import {setNoteText} from './fixtures.mjs';

test('a saved group stays in the tray when its canvas instance is removed and can be reopened',()=>{
 const state=workspaces.createInitialState();
 state.workspaces[0].widgets.push({...workspaces.createWidget('group'),title:'CHEM111',shortcuts:[shortcut({name:'Lecture',url:'https://example.com/lecture'})]});
 let workspace=workspaces.parseState(JSON.stringify(state)).workspaces[0];
 assert.equal(workspace.groups?.length,1);
 const group=workspace.groups[0];assert.equal(group.name,'CHEM111');assert.equal(group.shortcuts[0].name,'Lecture');
 workspace={...workspace,widgets:workspace.widgets.filter(w=>w.type!=='group')};
 const saved=workspaces.parseState(JSON.stringify({...state,workspaces:[workspace],activeId:workspace.id})).workspaces[0];
 assert.equal(saved.groups.length,1);
 const first=workspaces.openSavedGroup(saved,group.id,{x:10,y:20});
 const second=workspaces.openSavedGroup(first,group.id,{x:30,y:40});
 const instances=second.widgets.filter(w=>w.type==='group');
 assert.equal(instances.length,2);assert.notEqual(instances[0].id,instances[1].id);
 assert.equal(instances[0].groupId,group.id);assert.equal(instances[1].groupId,group.id);
 assert.equal(instances[0].title,'CHEM111');assert.equal(second.groups.length,1);
});

test('group widget entries open fresh instances and keep their catalogue after reopening',()=>{
 const workspace=workspaces.createWorkspace('Chemistry',['group']);
 assert.equal(workspace.groups?.length,1);
 const entry=workspaces.groupWidgetEntry({type:'notes',name:'Lab notes',icon:'N'});
 const group={...workspace.groups[0],name:'CHEM111',expanded:true,widgets:[entry]};
 const saved=workspaces.parseState(JSON.stringify({...workspaces.createInitialState(),workspaces:[{...workspace,groups:[group]}],activeId:workspace.id})).workspaces[0];
 assert.equal(saved.groups[0].expanded,true);assert.equal(saved.groups[0].widgets[0].name,'Lab notes');
 const first=workspaces.createWidgetFromGroupEntry(entry,saved.widgets,{x:0,y:0});
 const second=workspaces.createWidgetFromGroupEntry(entry,[...saved.widgets,first],{x:30,y:40});
 assert.equal(first.type,'notes');assert.equal(first.title,'Lab notes');assert.notEqual(first.id,second.id);
 assert.equal(second.instanceNumber,2);assert.equal(second.placement.x,30);
 first.text='One instance';assert.notEqual(second.text,first.text);assert.equal(saved.groups[0].widgets.length,1);
 assert.throws(()=>workspaces.groupWidgetEntry({type:'unknown'}));
 assert.throws(()=>workspaces.groupWidgetEntry({type:'group'}));
});

test('saving an open widget creates or appends a reusable group entry without changing the source',()=>{
 const workspace=workspaces.createWorkspace('Chemistry',['notes','group']);
 const source=workspace.widgets.find(widget=>widget.type==='notes');source.title='Lab notes';setNoteText(source,'Keep these notes');
 const created=workspaces.saveWidgetToGroup(workspace,source);
 assert.equal(created.groups.length,2);
 const newGroup=created.groups.at(-1);
 assert.equal(newGroup.expanded,true);assert.equal(newGroup.widgets.length,1);
 assert.deepEqual(newGroup.widgets[0],{id:newGroup.widgets[0].id,type:'notes',name:'Lab notes',icon:'LA',kind:'shortcut'});
 assert.equal(created.widgets.find(widget=>widget.id===source.id).text,'Keep these notes');
 assert.deepEqual(workspace.groups.at(-1).widgets,[]);
 const calculator=workspaces.createWidget('desmos');
 const appended=workspaces.saveWidgetToGroup(created,calculator,newGroup.id);
 assert.equal(appended.groups.at(-1).widgets.length,2);
 assert.equal(appended.groups.at(-1).widgets[1].name,'Calculator');
 assert.equal(appended.widgets.find(widget=>widget.id===source.id).text,'Keep these notes');
 const restored=workspaces.parseState(JSON.stringify({...workspaces.createInitialState(),workspaces:[appended],activeId:appended.id}));
 assert.deepEqual(restored.workspaces[0].groups.at(-1).widgets.map(entry=>entry.type),['notes','desmos']);
 assert.throws(()=>workspaces.saveWidgetToGroup(appended,workspaces.createWidget('group')));
 assert.throws(()=>workspaces.saveWidgetToGroup(appended,source,'missing-group'));
});

test('renaming a group updates its instances and duplicate workspaces keep independent group libraries',()=>{
 const original=workspaces.createWorkspace('Chemistry',['group']);assert.equal(original.groups?.length,1);
 const id=original.groups[0].id;
 const renamed=workspaces.updateSavedGroup(original,id,{name:'CHEM111',expanded:true});
 assert.equal(renamed.widgets[0].title,'CHEM111');assert.equal(original.widgets[0].title,'');
 const copy=workspaces.duplicateWorkspace(renamed,'Copy');
 assert.notEqual(copy.groups[0].id,id);assert.equal(copy.widgets[0].groupId,copy.groups[0].id);
 copy.groups[0].name='Other';assert.equal(renamed.groups[0].name,'CHEM111');
 const state={...workspaces.createInitialState(),workspaces:[renamed,copy],activeId:renamed.id};
 const roundtrip=workspaces.parseState(JSON.stringify(state));assert.equal(roundtrip.workspaces[1].groups[0].name,'Other');
 assert.equal(roundtrip.workspaces[0].groups[0].name,'CHEM111');
});

test('collecting a canvas widget moves its full state and restores the same instance from a Group',()=>{
 const workspace=workspaces.createWorkspace('Chemistry',['notes','group']);
 const source=workspace.widgets.find(widget=>widget.type==='notes');source.id='notes-kept';source.title='Lab notes';source.noteDocuments=source.noteDocuments.map(document=>document.id===source.activeNoteDocumentId?{...document,title:'Lab notes'}:document);setNoteText(source,'Moles = mass / molar mass');source.placement={x:310,y:140,width:420,height:330};
 const groupId=workspace.widgets.find(widget=>widget.type==='group').groupId;
 assert.equal(typeof workspaces.collectWidgetIntoGroup,'function');
 assert.equal(typeof workspaces.restoreCollectedWidget,'function');
 const collected=workspaces.collectWidgetIntoGroup(workspace,source.id,groupId);
 assert.equal(collected.widgets.some(widget=>widget.id===source.id),false);
 assert.equal(collected.groups.find(group=>group.id===groupId).widgets[0].kind,'collected');
 assert.equal(collected.groups.find(group=>group.id===groupId).widgets[0].instance.text,source.text);
 assert.equal(collected.groups.find(group=>group.id===groupId).widgets[0].instance.placement.x,310);
 const restored=workspaces.parseState(JSON.stringify({...workspaces.createInitialState(),workspaces:[collected],activeId:collected.id})).workspaces[0];
 assert.equal(restored.groups.find(group=>group.id===groupId).widgets[0].instance.text,source.text);
 const reopened=workspaces.restoreCollectedWidget(restored,source.id,1000,700);
 const same=reopened.widgets.find(widget=>widget.id===source.id);
 assert.equal(same.text,source.text);assert.equal(same.title,'Lab notes');
 assert.equal(same.placement.x,310);assert.equal(reopened.groups.find(group=>group.id===groupId).widgets.length,0);
 assert.equal(workspaces.collectedWidgetCount(reopened.groups.find(group=>group.id===groupId)),0);
 assert.throws(()=>workspaces.restoreCollectedWidget(reopened,source.id,1000,700));
});

test('collected Apps retain safe relaunch configuration without saving transient window identity',()=>{
 const workspace=workspaces.createWorkspace('Apps',['apps','group']),source=workspace.widgets.find(widget=>widget.type==='apps');
 source.id='apps-kept';source.title='My app';source.appName='Editor';source.appKey='grant-123';source.appPanelOpen=true;
 Object.assign(source,{hwnd:12345,pid:67890});
 const collected=workspaces.collectWidgetIntoGroup(workspace,source.id,workspace.widgets.find(widget=>widget.type==='group').groupId);
 const entry=collected.groups[0].widgets[0];
 assert.equal(entry.instance.appKey,'grant-123');assert.equal(entry.instance.appName,'Editor');
 assert.equal(entry.instance.appPanelOpen,false);assert.equal('hwnd' in entry.instance,false);assert.equal('pid' in entry.instance,false);
 assert.equal(entry.instance.appWasCollected,true,'the Group snapshot records recovery intent without HWND/PID');
 const restored=workspaces.parseState(JSON.stringify({...workspaces.createInitialState(),workspaces:[collected],activeId:collected.id})).workspaces[0];
 const snapshot=restored.groups[0].widgets[0].instance;
 assert.equal(snapshot.appKey,'grant-123');assert.equal('hwnd' in snapshot,false);assert.equal('pid' in snapshot,false);
 assert.equal(snapshot.appWasCollected,true);
});

test('collected Ctrl+Shift Apps retain restart recovery intent without requiring an app shortcut',()=>{
 const workspace=workspaces.createWorkspace('Apps',['apps','group']),source=workspace.widgets.find(widget=>widget.type==='apps');
 source.id='capture-kept';source.title='Captured window';source.appName='Editor';source.appKey=null;source.appPanelOpen=true;
 const collected=workspaces.collectWidgetIntoGroup(workspace,source.id,workspace.widgets.find(widget=>widget.type==='group').groupId);
 const saved=collected.groups[0].widgets[0].instance;
 assert.equal(saved.appWasCollected,true);assert.equal(saved.appPanelOpen,false);assert.equal(saved.appKey,null);
 const reopened=workspaces.parseState(JSON.stringify({...workspaces.createInitialState(),workspaces:[collected],activeId:collected.id})).workspaces[0];
 assert.equal(reopened.groups[0].widgets[0].instance.appWasCollected,true);
 assert.equal('hwnd' in reopened.groups[0].widgets[0].instance,false);assert.equal('pid' in reopened.groups[0].widgets[0].instance,false);
});

test('collected widgets cannot be nested, duplicated, or silently removed with their Group',()=>{
 const workspace=workspaces.createWorkspace('Chemistry',['notes','group']),source=workspace.widgets.find(widget=>widget.type==='notes'),groupWidget=workspace.widgets.find(widget=>widget.type==='group');
 assert.throws(()=>workspaces.collectWidgetIntoGroup(workspace,groupWidget.id,groupWidget.groupId));
 const collected=workspaces.collectWidgetIntoGroup(workspace,source.id,groupWidget.groupId);
 assert.throws(()=>workspaces.collectWidgetIntoGroup(collected,source.id,groupWidget.groupId));
 assert.throws(()=>workspaces.createWidgetFromGroupEntry(collected.groups[0].widgets[0],collected.widgets));
 const corrupted=structuredClone(collected);corrupted.widgets.push({...source});
 const repaired=workspaces.parseState(JSON.stringify({...workspaces.createInitialState(),workspaces:[corrupted],activeId:corrupted.id})).workspaces[0];
 assert.equal(repaired.widgets.filter(widget=>widget.id===source.id).length,1);
 assert.equal(repaired.groups[0].widgets.some(entry=>entry.id===source.id),false);
});

test('deleting a saved Group removes its collected state and its canvas cards without touching other Groups',async()=>{
 const workspace=workspaces.createWorkspace('Chemistry',['notes','group','group']);
 const [notes,firstCard,secondCard]=workspace.widgets;const [first,second]=workspace.groups;
 notes.id='delete-notes';setNoteText(notes,'Do not orphan this data');first.id=firstCard.groupId;second.id=secondCard.groupId;
 const populated=workspaces.collectWidgetIntoGroup(workspace,notes.id,first.id);
 assert.equal(typeof workspaces.savedGroupHasContents,'function');
 assert.equal(typeof workspaces.deleteSavedGroup,'function');
 assert.equal(workspaces.savedGroupHasContents(populated.groups[0]),true);
 const deleted=workspaces.deleteSavedGroup(populated,first.id);
 assert.equal(deleted.groups.some(group=>group.id===first.id),false);
 assert.equal(deleted.widgets.some(widget=>widget.groupId===first.id),false);
 assert.equal(deleted.groups.some(group=>group.id===second.id),true);
 assert.equal(workspaces.savedGroupHasContents(second),false);
 const persisted=workspaces.parseState(JSON.stringify({...workspaces.createInitialState(),workspaces:[deleted],activeId:deleted.id})).workspaces[0];
 assert.equal(persisted.groups.some(group=>group.id===first.id),false);
 assert.equal(persisted.groups[0].widgets.length,0);
 const {deleteCanvasWidget}=await import('../src/domain/trayActions.ts');
 const cardOnly=deleteCanvasWidget({...workspaces.createInitialState(),workspaces:[populated],activeId:populated.id},populated.id,firstCard.id).workspaces[0];
 assert.equal(cardOnly.groups.some(group=>group.id===first.id),true);
 assert.equal(cardOnly.groups.find(group=>group.id===first.id).widgets[0].instance.text,'Do not orphan this data');
});

test('Group deletion uses one confirm path and releases collected native panels without closing external apps',()=>{
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 const apps=readFileSync(new URL('../src/platform/appPanel.ts',import.meta.url),'utf8');
 const native=readFileSync(new URL('../src-tauri/src/app_panel.rs',import.meta.url),'utf8');
 const manifest=readFileSync(new URL('../src-tauri/build.rs',import.meta.url),'utf8');
 const capability=readFileSync(new URL('../src-tauri/capabilities/main.json',import.meta.url),'utf8');
 const permission=readFileSync(new URL('../src-tauri/permissions/autogenerated/app_panel_release.toml',import.meta.url),'utf8');
 assert.match(app,/function removeGroup\([\s\S]*?savedGroupHasContents\(group\)[\s\S]*?performRemoval\(target\)/);
 assert.match(app,/Delete All/);assert.match(app,/Cancel/);
 assert.match(app,/deleteSavedGroup\(w,target\.id\)/);
 assert.match(app,/entry\.type==='apps'&&appPanel\.available\?appPanel\.release\(entry\.id\)/);
 assert.match(apps,/release:async\(id:string\)=>\{retainedForDrag\.delete\(id\);retainedForCollection\.delete\(id\);await command<void>\(id,'app_panel_release'\)\}/);
 assert.match(native,/pub async fn app_panel_release[\s\S]*?release\(&app,&id\)/);
 assert.match(manifest,/"app_panel_release"/);assert.match(capability,/"allow-app-panel-release"/);
 assert.match(permission,/commands\.allow = \["app_panel_release"\]/);
 const release=native.slice(native.indexOf('pub async fn app_panel_release'),native.indexOf('pub async fn app_panel_suspend'));
 assert.doesNotMatch(release,/WM_CLOSE|PostMessageW|RemovePropW/);
 assert.match(native,/fn release\(app:&AppHandle,id:&str\)[\s\S]*?clear_collection_marker\(&mut entry\);restore\(&mut entry\)/);
});

test('workspace duplication gives collected widgets independent instance identities',()=>{
 const workspace=workspaces.createWorkspace('Chemistry',['notes','group']),source=workspace.widgets.find(widget=>widget.type==='notes'),groupWidget=workspace.widgets.find(widget=>widget.type==='group');
 setNoteText(source,'Keep this');const collected=workspaces.collectWidgetIntoGroup(workspace,source.id,groupWidget.groupId);
 const copy=workspaces.duplicateWorkspace(collected,'Copy'),originalEntry=collected.groups[0].widgets[0],copyEntry=copy.groups[0].widgets[0];
 assert.notEqual(copyEntry.id,originalEntry.id);assert.equal(copyEntry.instance.id,copyEntry.id);assert.equal(copyEntry.instance.text,'Keep this');
 assert.notEqual(copy.groups[0].id,collected.groups[0].id);
});

test('canvas Groups collapse to a compact standard-height card and expand at their moved position',()=>{
 const workspace=workspaces.createWorkspace('Chemistry',['group']),group=workspace.widgets[0];
 assert.equal(typeof workspaces.toggleGroupCollapsed,'function');
 const expanded={...group,placement:{x:80,y:110,width:460,height:370}};
 const compact=workspaces.toggleGroupCollapsed(expanded,1200,800);
 assert.equal(compact.groupCollapsed,true);assert.equal(compact.placement.height,43);assert.equal(compact.placement.width,204);
 assert.deepEqual(compact.groupExpandedPlacement,expanded.placement);
 const moved={...compact,placement:{...compact.placement,x:520,y:180}};
 const restored=workspaces.toggleGroupCollapsed(moved,1200,800);
 assert.equal(restored.groupCollapsed,false);assert.equal(restored.placement.x,520);assert.equal(restored.placement.y,180);
 assert.equal(restored.placement.width,460);assert.equal(restored.placement.height,370);
 const roundtrip=workspaces.parseState(JSON.stringify({...workspaces.createInitialState(),workspaces:[{...workspace,widgets:[compact]}],activeId:workspace.id})).workspaces[0].widgets[0];
 assert.equal(roundtrip.groupCollapsed,true);assert.equal(roundtrip.placement.height,43);assert.equal(roundtrip.placement.width,204);assert.equal(roundtrip.groupExpandedPlacement.height,370);
 const minimized=workspaces.minimizeWidgetInstance(compact,1200,800),minimizedRoundtrip=workspaces.parseState(JSON.stringify({...workspaces.createInitialState(),workspaces:[{...workspace,widgets:[minimized]}],activeId:workspace.id})).workspaces[0].widgets[0];
 const restoredMinimized=workspaces.restoreWidgetInstance(minimizedRoundtrip,1200,800);
 assert.equal(restoredMinimized.groupCollapsed,true);assert.equal(workspaces.constrainGroupCollapsedPlacement(restoredMinimized.placement,1200,800).height,43);
 const count=workspaces.collectedWidgetCount({id:'g',name:'',shortcuts:[],widgets:[{id:'a',type:'notes',name:'Legacy',icon:'LE',kind:'shortcut'},{id:'b',type:'notes',name:'Collected',icon:'CO',kind:'collected',instance:{...group,type:'notes',id:'b'}}],expanded:false});
 assert.equal(count,1);
 const narrow=workspaces.toggleGroupCollapsed({...group,placement:{x:0,y:0,width:300,height:360}},1200,800);
 assert.equal(narrow.placement.width,204);
 const edge=workspaces.toggleGroupCollapsed({...group,placement:{x:1100,y:780,width:460,height:360}},1200,800);
 assert.equal(edge.placement.x,976);assert.equal(edge.placement.y,737);
});

test('Group header editor saves on Enter or blur, cancels on Escape, and does not start a drag',()=>{
 const header=readFileSync(new URL('../src/GroupHeaderName.tsx',import.meta.url),'utf8');
 const group=readFileSync(new URL('../src/GroupWidget.tsx',import.meta.url),'utf8');
 const editor=readFileSync(new URL('../src/GroupEditor.tsx',import.meta.url),'utf8');
 assert.match(header,/event\.key==='Enter'\)\{event\.preventDefault\(\);commit\(\)\}/);
 assert.match(header,/event\.key==='Escape'\)\{event\.preventDefault\(\);cancel\(\)\}/);
 assert.match(header,/onBlur=.*commit\(\)/);
 assert.match(header,/onPointerDown=\{stopPointer\}/);
 assert.match(group,/showNameField=\{false\}/);
 assert.match(editor,/showNameField&&/);
});

test('canvas widgets can target Group cards while ordinary tray buttons remain non-save targets',()=>{
 const canvas=readFileSync(new URL('../src/WorkspaceCanvas.tsx',import.meta.url),'utf8');
 const styles=readFileSync(new URL('../src/canvas.css',import.meta.url),'utf8');
 assert.match(canvas,/data-group-drop-target=\{w\.type==='group'&&w\.groupId\?'canvas':undefined\}/);
 assert.match(canvas,/function canvasGroupTarget\(/);
 assert.match(canvas,/saveToGroup\(original,canvasTarget,true\)/);
 assert.match(canvas,/trayDropDecision\(\{source:'widget',widgetType:g\.type,\.\.\.target\}\)/);
 assert.match(canvas,/group-collapse-toggle/);assert.match(canvas,/collectedWidgetCount\(group\)/);
 assert.match(canvas,/aria-expanded=\{!groupCollapsed\}/);assert.match(styles,/\.canvas-card\.group-collapsed::before/);assert.match(styles,/\.canvas-card\.group-collapsed \.widget-content/);
});

test('collecting native panels suspends and retains them without closing their windows',()=>{
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 const apps=readFileSync(new URL('../src/AppsWidget.tsx',import.meta.url),'utf8');
 const appNative=readFileSync(new URL('../src-tauri/src/app_panel.rs',import.meta.url),'utf8');
 assert.match(app,/appPanel\.suspendForCollection\(widget\.id\)/);
 assert.match(apps,/appPanel\.resume\(widget\.id\)/);
 assert.match(apps,/isCollectionRetained\(widget\.id\)/);
 assert.match(appNative,/pub async fn app_panel_suspend[\s\S]*?ShowWindow\(handle\(hwnd\),SW_HIDE\)/);
 assert.match(appNative,/pub async fn app_panel_resume[\s\S]*?Ok\(info\(entry,main,false\)\)/);
});

test('failed native hide prevents collecting an attached Apps widget and rollback retains the live attachment',()=>{
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 const native=readFileSync(new URL('../src-tauri/src/app_panel.rs',import.meta.url),'utf8');
 assert.match(app,/const suspended=await appPanel\.suspendForCollection\(widget\.id\);if\(widget\.appPanelOpen&&!suspended\)throw new Error/);
 assert.match(app,/appPanel\.cancelCollection\(widget\.id\)/);
 assert.match(native,/fn mark_collected\([\s\S]*?SetPropW\([\s\S]*?ShowWindow\(hwnd,SW_HIDE\)/);
 assert.match(native,/if cancel_collection==Some\(true\)\{prepare_collection_resume\([\s\S]*?place\(&app,&mut panels\)/);
});

test('a header-saved group name is normalized, updates linked cards, and survives a restart roundtrip',()=>{
 const workspace=workspaces.createWorkspace('Chemistry',['group']);
 const id=workspace.groups[0].id;
 assert.equal(typeof workspaces.saveGroupName,'function');
 const renamed=workspaces.saveGroupName(workspace,id,'  CHEM111  ');
 assert.equal(renamed.groups[0].name,'CHEM111');
 assert.equal(renamed.widgets[0].title,'CHEM111');
 const restored=workspaces.parseState(JSON.stringify({...workspaces.createInitialState(),workspaces:[renamed],activeId:renamed.id}));
 assert.equal(restored.workspaces[0].groups[0].name,'CHEM111');
 assert.equal(restored.workspaces[0].widgets[0].title,'CHEM111');
 assert.throws(()=>workspaces.saveGroupName(workspace,id,'x'.repeat(61)));
});

test('invalid group entries are discarded while valid groups and old notes survive migration',()=>{
 const workspace=workspaces.createWorkspace('Chemistry',['notes','group']);assert.equal(workspace.groups?.length,1);
 setNoteText(workspace.widgets[0],'Keep my notes');
 workspace.groups[0].widgets=[{id:'ok',type:'desmos',name:'Calculator',icon:'∑'},{id:'bad',type:'missing'},null];
 workspace.groups[0].shortcuts=[{id:'safe',name:'Course',url:'https://example.com/'},{id:'bad-url',name:'Unsafe',url:'javascript:alert(1)'}];
 const state={...workspaces.createInitialState(),workspaces:[workspace],activeId:workspace.id};
 const saved=workspaces.parseState(JSON.stringify(state)).workspaces[0];
 assert.deepEqual(saved.groups[0].widgets.map(w=>w.type),['desmos']);assert.equal(saved.groups[0].shortcuts.length,1);
 assert.equal(saved.widgets[0].text,'Keep my notes');
});

test('group app icons persist within size limits and over-budget icons fall back safely',()=>{
 const icon='data:image/png;base64,iVBORw0KGgo=';
 assert.equal(typeof workspaces.checkedAppIconData,'function');
 assert.equal(workspaces.checkedAppIconData(icon),icon);
 assert.equal(workspaces.checkedAppIconData('data:image/png;base64,not-png'),undefined);
 assert.equal(workspaces.checkedAppIconData('data:image/png;base64,'+'A'.repeat(81*1024)),undefined);
 const workspace=workspaces.createWorkspace('Apps',['group']);
 const source=workspaces.createWidget('apps');source.title='Word';source.appIconData=icon;
 const saved=workspaces.saveWidgetToGroup(workspace,source);
 assert.equal(saved.groups.at(-1).widgets[0].iconData,icon);
 const roundtrip=workspaces.parseState(JSON.stringify({...workspaces.createInitialState(),workspaces:[saved],activeId:saved.id})).workspaces[0];
 assert.equal(roundtrip.groups.at(-1).widgets[0].iconData,icon);
 const tooMuch={...source,appIconData:'data:image/png;base64,iVBORw0KGgo='+'.'.repeat(81*1024)};
 const fallback=workspaces.saveWidgetToGroup(workspace,tooMuch);
 assert.equal(fallback.groups.at(-1).widgets[0].iconData,undefined);
 assert.equal(fallback.groups.at(-1).widgets[0].icon,'WO');
});

test('the workspace icon budget is enforced without dropping saved group entries',()=>{
 const icon='data:image/png;base64,iVBORw0KGgo='+'A'.repeat(2000);
 const groups=[{id:'g1',name:'One',shortcuts:[],widgets:[{id:'e1',type:'apps',name:'One',icon:'ON',iconData:icon}],expanded:false}];
 assert.equal(workspaces.groupIconBudget(groups),true);
 assert.equal(workspaces.groupIconBudget(groups,{id:'e2',type:'apps',name:'Two',icon:'TW',iconData:'A'.repeat(512*1024)}),false);
 const workspace=workspaces.createWorkspace('Apps',[]);workspace.groups=groups;
 const source=workspaces.createWidget('apps');source.appIconData='data:image/png;base64,iVBORw0KGgo='+'A'.repeat(90*1024);
 const saved=workspaces.saveWidgetToGroup(workspace,source,'g1');
 assert.equal(saved.groups[0].widgets.length,2);assert.equal(saved.groups[0].widgets[1].iconData,undefined);
 const restored=workspaces.parseState(JSON.stringify({...workspaces.createInitialState(),workspaces:[saved],activeId:saved.id})).workspaces[0];
 assert.equal(restored.groups[0].widgets.length,2);assert.equal(restored.groups[0].widgets[1].iconData,undefined);
});

test('parsing caps app icon data across all groups in one workspace',()=>{
 const prefix='data:image/png;base64,iVBORw0KGgo',icon=prefix+'A'.repeat(16*1024-prefix.length);
 const workspace=workspaces.createWorkspace('Icon library',[]);
 workspace.groups=Array.from({length:33},(_,index)=>({id:'group-'+index,name:'Group '+index,shortcuts:[],widgets:[{id:'entry-'+index,type:'apps',name:'App '+index,icon:'AP',iconData:icon}],expanded:false}));
 const state={...workspaces.createInitialState(),workspaces:[workspace],activeId:workspace.id};
 const restored=workspaces.parseState(JSON.stringify(state)).workspaces[0];
 assert.equal(restored.groups.reduce((count,group)=>count+group.widgets.length,0),33);
 const total=restored.groups.reduce((sum,group)=>sum+(group.widgets[0].iconData?.length??0),0);
 assert.ok(total<=512*1024);assert.ok(restored.groups.some(group=>!group.widgets[0].iconData));
});
