import test from 'node:test';
import assert from 'node:assert/strict';
import {assignSnapZone,nextSnapZone,snapLayout,snapLayouts,snapPlacement,snapZoneAtPoint} from '../src/domain/snapLayouts.ts';
import {createInitialState,parseState} from '../src/domain/workspaces.ts';

test('Snap layouts expose familiar Windows-style zone arrangements',()=>{
 assert.deepEqual(snapLayouts.map(layout=>layout.id),['halves','focus-left','thirds','quadrants']);
 assert.equal(snapLayout('focus-left').zones.length,3);
 assert.equal(snapLayout('quadrants').zones.length,4);
});

test('snap placement maps visible viewport zones into scrolled canvas coordinates',()=>{
 const layout=snapLayout('quadrants'),placement=snapPlacement('notes',layout,3,{width:1200,height:800},{x:240,y:90});
 assert.deepEqual(placement,{x:846,y:496,width:588,height:388});
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
