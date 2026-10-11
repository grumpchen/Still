import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,parseState,stackWorkspaceWidgets} from '../src/domain/workspaces.ts';

function widget(id,type,x,y,width,height,extra={}){
 return {id,type,placement:{x,y,width,height},minimized:false,restorePlacement:null,groupCollapsed:false,groupExpandedPlacement:null,appPanelOpen:false,...extra};
}

test('Stack cascades open widgets and keeps Groups and minimized widgets in a separate pile',()=>{
 const items=[
  widget('notes-1','notes',240,180,320,260),
  widget('browser-1','browser',520,240,500,360),
  widget('group-1','group',70,60,204,43,{groupCollapsed:true,groupExpandedPlacement:{x:70,y:60,width:340,height:280}}),
  widget('notes-2','notes',20,20,136,42,{minimized:true,restorePlacement:{x:20,y:20,width:320,height:260}}),
  widget('group-2','group',10,10,136,42,{minimized:true,restorePlacement:{x:10,y:10,width:340,height:280},groupCollapsed:true,groupExpandedPlacement:{x:10,y:10,width:340,height:280}}),
 ];
 const stacked=stackWorkspaceWidgets(items,1500,900),byId=Object.fromEntries(stacked.map(item=>[item.id,item]));
 assert.deepEqual([byId['notes-1'].placement.x,byId['notes-1'].placement.y],[16,16]);
 assert.deepEqual([byId['browser-1'].placement.x,byId['browser-1'].placement.y],[44,50]);
 assert.ok(byId['group-1'].placement.x>byId['browser-1'].placement.x+byId['browser-1'].placement.width,'the Group pile is separate from open widgets');
 assert.deepEqual([byId['notes-2'].placement.x,byId['notes-2'].placement.y],[byId['group-1'].placement.x+28,byId['group-1'].placement.y+34]);
 assert.equal(byId['notes-2'].restorePlacement.x,byId['notes-2'].placement.x,'minimized restore geometry follows its new position');
 assert.equal(byId['group-1'].groupExpandedPlacement.x,byId['group-1'].placement.x,'a collapsed Group expands at its stacked position');
 assert.equal(byId['group-2'].groupExpandedPlacement.x,byId['group-2'].placement.x,'a minimized Group expands at its stacked position');
});

test('installed sidebar plugins persist and old workspace data defaults to none',()=>{
 const state=createInitialState();state.sidebarPlugins=['stack'];
 assert.deepEqual(parseState(JSON.stringify(state)).sidebarPlugins,['stack']);
 const old={...state};delete old.sidebarPlugins;
 assert.deepEqual(parseState(JSON.stringify(old)).sidebarPlugins,[]);
});
