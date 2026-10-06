import {test} from 'node:test';
import assert from 'node:assert/strict';
import {placement,nextPlacement,translate,resize,canvasExtent,canvasHeight,constrainPlacement} from '../src/domain/layout.ts';
import {createInitialState,createWorkspace,duplicateWorkspace,parseState,widgetTypes} from '../src/domain/workspaces.ts';
import {shortcut,reorderShortcuts,parseWebShortcuts} from '../src/domain/webShortcuts.ts';

test('canvas geometry normalizes corrupt data and applies free movement/resizing with useful minima',()=>{
  const p=placement('notes',{x:17.2,y:33.4,width:451,height:297});
  assert.deepEqual(translate('notes',p,31,17),{x:48,y:50,width:451,height:297});
  assert.deepEqual(resize('notes',p,23,11),{x:17,y:33,width:474,height:308});
  const clamped=placement('notes',{x:-10,y:Infinity,width:-1,height:NaN});
  assert.equal(clamped.x,0);assert.equal(clamped.y,0);assert.equal(clamped.width,240);assert.equal(clamped.height,340);
  assert.equal(resize('notes',p,-1000,-1000).height,180);
});
test('adding widgets finds free space without rearranging existing cards',()=>{
  const workspace=createWorkspace('Study',widgetTypes);
  const before=structuredClone(workspace.widgets);
  const candidate=nextPlacement('notes',workspace.widgets,700);
  assert.deepEqual(workspace.widgets,before);
  for(const {placement:p} of workspace.widgets)assert.ok(candidate.x+candidate.width<=p.x || candidate.x>=p.x+p.width || candidate.y+candidate.height<=p.y || candidate.y>=p.y+p.height);
});
test('the canvas extends 30% beyond the viewport but never discards content further right',()=>{
  assert.equal(canvasExtent(1000,[{placement:{x:0,y:0,width:900,height:500}}]),1300,'Scroll room is 130% of the visible viewport');
  assert.equal(canvasExtent(1000,[{placement:{x:0,y:0,width:2000,height:500}}]),2020,'Content beyond 130% is preserved, never clamped to the viewport');
  assert.equal(canvasExtent(1000,[]),1300,'An empty canvas still gets the viewport extent');
  assert.equal(canvasExtent(200,[]),390,'A tiny viewport keeps a usable minimum extent');
});
test('canvasHeight includes every widget and a 20px trailing margin',()=>{
  assert.equal(canvasHeight(700,[]),700);
  assert.equal(canvasHeight(600,[{placement:{x:0,y:0,width:240,height:340}},{placement:{x:800,y:920,width:300,height:240}}]),1180);
  assert.equal(canvasHeight(900,[{placement:{x:0,y:0,width:240,height:340}}]),900);
});
test('constrainPlacement keeps move and resize within horizontal bounds',()=>{
  const moved=constrainPlacement('notes',{x:1200,y:240,width:400,height:340},1300);
  assert.deepEqual(moved,{x:880,y:240,width:400,height:340});
  const resized=constrainPlacement('notes',{x:1000,y:240,width:600,height:400},1300);
  assert.deepEqual(resized,{x:1000,y:240,width:280,height:400});
  const atEdge=constrainPlacement('notes',{x:2000,y:240,width:600,height:400},1300);
  assert.ok(atEdge.x+atEdge.width+20<=1300);
});
test('constrainPlacement respects native and catalog minimum sizes',()=>{
  const native=constrainPlacement('apps',{x:1100,y:60,width:600,height:420},1300,{width:680,height:410});
  assert.deepEqual(native,{x:600,y:60,width:680,height:420});
  const catalog=constrainPlacement('notes',{x:1200,y:20,width:5,height:5},1300);
  assert.deepEqual(catalog,{x:1040,y:20,width:240,height:180});
});
test('legacy saved overflow remains part of the canvas extent',()=>{
  const saved=[{placement:{x:2400,y:100,width:500,height:500}}];
  assert.equal(canvasExtent(1000,saved),2920);
  assert.deepEqual(constrainPlacement('notes',saved[0].placement,canvasExtent(1000,saved)),saved[0].placement);
});
test('version 2 browser migration preserves bookmarks, custom URL, notes, appearance and shortcuts',()=>{
  const state=createInitialState();state.version=2;const w=state.workspaces[0];w.layout='lecture';
  const web=w.widgets.find(w=>w.type==='browser');delete web.shortcuts;delete web.placement;
  web.url='https://example.com/course';web.bookmarks=[{id:'course',name:'Course page',url:'https://example.com/lectures'}];
  const note=w.widgets.find(w=>w.type==='notes');note.text='Do not lose this';delete note.placement;
  const restored=parseState(JSON.stringify(state));const browser=restored.workspaces[0].widgets.find(w=>w.type==='browser');
  assert.equal(restored.version,4);assert.equal(restored.workspaces[0].layout,'canvas');assert.equal(browser.id,web.id);
  assert.ok(browser.shortcuts.some(s=>s.name==='Course page'));assert.ok(browser.shortcuts.some(s=>s.url===web.url));
  assert.equal(restored.workspaces[0].widgets.find(w=>w.type==='notes').text,note.text);
  assert.deepEqual(restored.glass,state.glass);assert.deepEqual(restored.shortcuts,state.shortcuts);
  assert.deepEqual(parseState(JSON.stringify(restored)),restored);
});
test('multiple instances and duplicated workspaces retain independent state and geometry',()=>{
  const workspace=createWorkspace('Many',['browser','browser','notes','notes','timetable']);
  assert.equal(new Set(workspace.widgets.map(w=>w.id)).size,5);
  assert.deepEqual(workspace.widgets.slice(0,2).map(w=>w.instanceNumber),[1,2]);
  workspace.widgets[0].shortcuts[0].name='My AKO';assert.equal(workspace.widgets[1].shortcuts[0].name,'AKO Learn');
  workspace.widgets[2].text='One';workspace.widgets[3].text='Two';workspace.widgets[2].placement={x:812,y:77,width:320,height:235};
  workspace.widgets[4].schedule=[{id:'a',day:2,time:'10:30',title:'Engineering',location:'Room 1'}];
  const state=createInitialState();state.workspaces=[workspace];state.activeId=workspace.id;
  const restored=parseState(JSON.stringify(state));assert.deepEqual(JSON.parse(JSON.stringify(restored.workspaces[0])),JSON.parse(JSON.stringify(workspace)));
  const copy=duplicateWorkspace(workspace,'Copy');copy.widgets[0].shortcuts[0].name='Changed';copy.widgets[4].schedule[0].title='Different';
  assert.equal(workspace.widgets[0].shortcuts[0].name,'My AKO');assert.equal(workspace.widgets[4].schedule[0].title,'Engineering');
  assert.deepEqual(copy.widgets[2].placement,workspace.widgets[2].placement);
});
test('shortcut editing and reordering accept only safe links and preserve intentional empty lists',()=>{
  assert.throws(()=>shortcut({name:'',url:'https://example.com'}));assert.throws(()=>shortcut({name:'Bad',url:'javascript:alert(1)'}));
  const items=['A','B','C'].map(name=>shortcut({name,url:'https://example.com/'+name,icon:name}));
  assert.deepEqual(reorderShortcuts(items,items[2].id,items[0].id).map(s=>s.name),['C','A','B']);
  assert.deepEqual(items.map(s=>s.name),['A','B','C']);assert.deepEqual(parseWebShortcuts([],items),[]);
  assert.deepEqual(parseWebShortcuts([{name:'Unsafe',url:'file:///c:/secret'}],items),[]);
  assert.equal(shortcut({name:'Course',url:'example.com',icon:'📚'}).icon,'📚');
});
