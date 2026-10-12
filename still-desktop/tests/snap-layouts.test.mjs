import test from 'node:test';
import assert from 'node:assert/strict';
import {assignSnapZone,cascadeSnapZone,nextSnapZone,snapLayout,snapLayouts,snapPlacement,snapZoneAtPoint} from '../src/domain/snapLayouts.ts';
import {createInitialState,parseState} from '../src/domain/workspaces.ts';
const overlap=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;

test('Snap layouts expose familiar Windows-style zone arrangements',()=>{
 assert.deepEqual(snapLayouts.map(layout=>layout.id),['halves','focus-left','thirds','quadrants']);
 assert.equal(snapLayout('focus-left').zones.length,3);
 assert.equal(snapLayout('quadrants').zones.length,4);
});

test('snap placement maps visible viewport zones into scrolled canvas coordinates',()=>{
 const layout=snapLayout('quadrants'),placement=snapPlacement('notes',layout,3,{width:1200,height:800},{x:240,y:90});
 assert.deepEqual(placement,{x:846,y:496,width:588,height:388});
});

test('symmetric layouts give every zone equal widget dimensions while Focus-left keeps its intentional proportions',()=>{
 for(const id of ['halves','thirds','quadrants']){
  const layout=snapLayout(id),placements=layout.zones.map((_,index)=>snapPlacement('notes',layout,index,{width:1200,height:800}));
  assert.ok(placements.every(p=>p.width===placements[0].width&&p.height===placements[0].height),id+' zones should be equal');
 }
 const focus=snapLayout('focus-left'),large=snapPlacement('notes',focus,0,{width:1200,height:800}),small=snapPlacement('notes',focus,1,{width:1200,height:800});
 assert.equal(large.width,small.width);assert.equal(large.height,small.height*2+12,'Focus-left keeps its larger left zone and two half-height right zones');
});

test('placing into an occupied zone cascades the blocker to the next open zone',()=>{
 const layout=snapLayout('halves'),widgets=[
  {id:'notes',type:'notes',placement:{x:20,y:20,width:400,height:300}},
  {id:'apps',type:'apps',placement:{x:80,y:80,width:400,height:300}},
 ];
 const result=cascadeSnapZone(layout,{0:'apps'},widgets,'notes',0,{width:1200,height:800});
 assert.deepEqual(result.assignments,{0:'notes',1:'apps'});
 assert.deepEqual(result.placements.notes,snapPlacement('notes',layout,0,{width:1200,height:800}));
 assert.deepEqual(result.placements.apps,snapPlacement('apps',layout,1,{width:1200,height:800}));
});

test('when all snap zones are occupied, overflow stays inside the currently visible scrolled page',()=>{
 const layout=snapLayout('halves'),size={width:1200,height:700},scroll={x:400,y:0},widgets=[
  {id:'notes',type:'notes',placement:{x:20,y:20,width:400,height:300}},
  {id:'apps',type:'apps',placement:snapPlacement('apps',layout,0,size,scroll)},
  {id:'focus',type:'focus',placement:snapPlacement('focus',layout,1,size,scroll)},
 ];
 const result=cascadeSnapZone(layout,{0:'apps',1:'focus'},widgets,'notes',0,size,scroll,{width:1800,height:800});
 assert.deepEqual(result.assignments,{0:'notes',1:'focus'});
 assert.deepEqual(result.overflowIds,['apps']);
 assert.ok(result.placements.apps.x>=400&&result.placements.apps.x+result.placements.apps.width<=1600,'the displaced widget stays within the visible horizontal page');
 assert.ok(result.placements.apps.y>=0&&result.placements.apps.y+result.placements.apps.height<=700,'the displaced widget stays within the visible vertical page');
});

test('snap zone hit testing excludes edges outside the viewport and identifies each zone',()=>{
 const layout=snapLayout('halves'),size={width:1000,height:700};
 assert.equal(snapZoneAtPoint(layout,{x:100,y:200},size),0);
 assert.equal(snapZoneAtPoint(layout,{x:500,y:200},size),1);
 assert.equal(snapZoneAtPoint(layout,{x:1000,y:200},size),null);
 assert.equal(snapZoneAtPoint(layout,{x:-1,y:200},size),null);
});

test('Snap Assist offers the next empty zone and never places one widget twice',()=>{
 const layout=snapLayout('focus-left'),first=assignSnapZone(layout,{},'notes',0),second=assignSnapZone(layout,first,'browser',1);
 assert.equal(nextSnapZone(layout,second),2);
 assert.deepEqual(assignSnapZone(layout,second,'notes',2),{1:'browser',2:'notes'});
 assert.equal(assignSnapZone(layout,second,'focus',1),second,'an occupied zone cannot be silently overwritten');
});

test('Layout sidebar plugin persists and legacy state still defaults to no plugins',()=>{
 const state=createInitialState();state.sidebarPlugins=['stack','layout'];
 assert.deepEqual(parseState(JSON.stringify(state)).sidebarPlugins,['stack','layout']);
 const legacy={...state};delete legacy.sidebarPlugins;
 assert.deepEqual(parseState(JSON.stringify(legacy)).sidebarPlugins,[]);
});
