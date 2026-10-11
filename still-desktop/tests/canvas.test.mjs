import {test} from 'node:test';
import assert from 'node:assert/strict';
import {placement,nextPlacement,translate,resize,canvasExtent,canvasHeight,constrainPlacement} from '../src/domain/layout.ts';
import {createInitialState,createWidget,createWorkspace,duplicateWorkspace,parseState,transferWidgetInstance,widgetTypes} from '../src/domain/workspaces.ts';
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
test('the canvas stays within a 150% viewport bound regardless of saved placements',()=>{
  assert.equal(canvasExtent(1000,[{placement:{x:0,y:0,width:900,height:500}}]),1500);
  assert.equal(canvasExtent(1000,[{placement:{x:0,y:0,width:2000,height:500}}]),1500,'Legacy overflow cannot grow the canvas');
  assert.equal(canvasExtent(1000,[]),1500);
  assert.equal(canvasExtent(200,[]),300);
});
test('the canvas remains fixed to the viewport height regardless of saved placements',()=>{
  assert.equal(canvasHeight(700,[]),700);
  assert.equal(canvasHeight(600,[{placement:{x:0,y:920,width:300,height:240}}]),600);
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
test('constrainPlacement keeps frames inside both bounded canvas dimensions',()=>{
  assert.deepEqual(constrainPlacement('notes',{x:1400,y:1400,width:600,height:500},300,{},250),{x:0,y:0,width:280,height:230});
  assert.deepEqual(constrainPlacement('apps',{x:1300,y:1300,width:500,height:450},300,{width:900,height:800},260),{x:0,y:0,width:280,height:240});
});
test('constrainPlacement respects native and catalog minimum sizes',()=>{
  const native=constrainPlacement('apps',{x:1100,y:60,width:600,height:420},1300,{width:680,height:410});
  assert.deepEqual(native,{x:600,y:60,width:680,height:420});
  const catalog=constrainPlacement('notes',{x:1200,y:20,width:5,height:5},1300);
  assert.deepEqual(catalog,{x:1040,y:20,width:240,height:180});
});
test('legacy saved overflow is clamped without changing widget content',()=>{
  const saved=[{placement:{x:2400,y:100,width:500,height:500}}];
  const original={id:'note-one',text:'Keep this note',...saved[0]};
  assert.equal(canvasExtent(1000,saved),1500);
  assert.deepEqual(constrainPlacement('notes',saved[0].placement,canvasExtent(1000,saved),{},1500),{x:980,y:100,width:500,height:500});
  assert.equal(original.text,'Keep this note');assert.equal(original.id,'note-one');
});
test('version 2 browser migration preserves bookmarks, custom URL, notes, appearance and shortcuts',()=>{
  const state=createInitialState();state.version=2;const w=state.workspaces[0];w.layout='lecture';
  const web=w.widgets.find(w=>w.type==='browser');delete web.shortcuts;delete web.placement;
  web.url='https://example.com/course';web.bookmarks=[{id:'course',name:'Course page',url:'https://example.com/lectures'}];
  const note=w.widgets.find(w=>w.type==='notes');note.text='Do not lose this';delete note.placement;
  const restored=parseState(JSON.stringify(state));const browser=restored.workspaces[0].widgets.find(w=>w.type==='browser');
  assert.equal(restored.version,6);assert.equal(restored.workspaces[0].layout,'canvas');assert.equal(browser.id,web.id);
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
test('transferring one widget preserves its instance state and clamps it to destination bounds',()=>{
  const source=createWorkspace('Source',[]),destination=createWorkspace('Destination',[]),note=createWidget('notes');
  note.id='transfer-note';note.title='Keep identity';note.text='Keep this content';note.placement={x:800,y:900,width:400,height:300};source.widgets=[note];
  const moved=transferWidgetInstance(source,destination,note.id,300,250);
  assert.ok(moved);assert.equal(moved.source.widgets.length,0);assert.equal(moved.destination.widgets.length,1);
  assert.equal(moved.destination.widgets[0].id,note.id);assert.equal(moved.destination.widgets[0].type,'notes');assert.equal(moved.destination.widgets[0].title,note.title);assert.equal(moved.destination.widgets[0].text,note.text);
  assert.deepEqual(moved.destination.widgets[0].placement,{x:0,y:0,width:280,height:230});
  assert.equal(transferWidgetInstance(source,destination,'missing',300,250),null);
  assert.equal(transferWidgetInstance(source,source,note.id,300,250),null);
});
test('transferring a Group card also preserves its linked collection in the destination',()=>{
  const source=createWorkspace('Source',[]),destination=createWorkspace('Destination',[]),group=createWidget('group');group.id='group-card';group.groupId='group-library';group.placement={x:0,y:0,width:400,height:360};
  source.groups=[{id:'group-library',name:'Research',shortcuts:[{id:'link',name:'Paper',url:'https://example.com',icon:'↗'}],widgets:[],expanded:true}];source.widgets=[group];
  const moved=transferWidgetInstance(source,destination,group.id,1000,900);
  assert.equal(moved.destination.widgets[0].id,group.id);assert.equal(moved.destination.groups[0].id,group.groupId);assert.equal(moved.destination.groups[0].shortcuts[0].name,'Paper');
});
test('shortcut editing and reordering accept only safe links and preserve intentional empty lists',()=>{
  assert.throws(()=>shortcut({name:'',url:'https://example.com'}));assert.throws(()=>shortcut({name:'Bad',url:'javascript:alert(1)'}));
  const items=['A','B','C'].map(name=>shortcut({name,url:'https://example.com/'+name,icon:name}));
  assert.deepEqual(reorderShortcuts(items,items[2].id,items[0].id).map(s=>s.name),['C','A','B']);
  assert.deepEqual(items.map(s=>s.name),['A','B','C']);assert.deepEqual(parseWebShortcuts([],items),[]);
  assert.deepEqual(parseWebShortcuts([{name:'Unsafe',url:'file:///c:/secret'}],items),[]);
  assert.equal(shortcut({name:'Course',url:'example.com',icon:'📚'}).icon,'📚');
});
