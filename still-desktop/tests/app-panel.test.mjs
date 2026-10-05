import {test} from 'node:test';
import assert from 'node:assert/strict';
import {appPanelGeometry} from '../src/domain/appPanel.ts';
import {createInitialState,createWidget,parseState,createWidgetFromPreset} from '../src/domain/workspaces.ts';

const rect=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
test('app panels keep their full coordinates and clip only the visible area instead of going blank on overlap',()=>{
 const result=appPanelGeometry(rect(140,200,800,500),rect(170,180,1000,620),true,false);
 assert.equal(result.visible,true);
 assert.deepEqual(result.bounds,{x:140,y:200,width:800,height:500});
 assert.deepEqual(result.clip,{x:170,y:200,width:770,height:500});
 assert.equal(appPanelGeometry(rect(140,200,800,500),rect(170,180,1000,620),false,false).visible,false);
 assert.equal(appPanelGeometry(rect(140,200,800,500),rect(170,180,1000,620),true,true).visible,false);
 assert.equal(appPanelGeometry(rect(-900,200,800,500),rect(170,180,1000,620),true,false).visible,false);
});
test('app panel geometry preserves the resize grip bounds for native-region exclusion',()=>{
 const result=appPanelGeometry(rect(140,200,800,500),rect(170,180,1000,620),true,false,rect(900,640,32,32));
 assert.deepEqual(result.grip,{x:900,y:640,width:32,height:32});
 assert.equal(appPanelGeometry(rect(140,200,800,500),rect(170,180,1000,620),true,false,null).grip,null);
});
test('Apps remember an open panel across reopening while older launchers and fresh presets remain closed',()=>{
 const state=createInitialState(),app=createWidget('apps');assert.equal(app.appPanelOpen,false);
 app.appKey='app-word';app.appName='Word';app.appPanelOpen=true;state.workspaces[0].widgets.push(app);
 assert.equal(parseState(JSON.stringify(state)).workspaces[0].widgets.at(-1).appPanelOpen,true);
 const old=structuredClone(state);delete old.workspaces[0].widgets.at(-1).appPanelOpen;
 assert.equal(parseState(JSON.stringify(old)).workspaces[0].widgets.at(-1).appPanelOpen,false);
 const fresh=createWidgetFromPreset({id:'word-preset',type:'apps',name:'Word',appSourceId:'app-word',appName:'Word'},[]);
 assert.equal(fresh.appPanelOpen,false);assert.notEqual(fresh.id,app.id);
});
