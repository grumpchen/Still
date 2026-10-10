import {test} from 'node:test';
import assert from 'node:assert/strict';
import {appPanelFit,appPanelGeometry} from '../src/domain/appPanel.ts';
import {createInitialState,createWidget,parseState,createWidgetFromPreset} from '../src/domain/workspaces.ts';

const rect=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
test('switching away from a workspace sends valid hide geometry even when its DOM resize handle has no size',()=>{
 const result=appPanelGeometry(rect(0,0,0,0),rect(0,0,0,0),false,false,rect(0,0,0,0));
 assert.equal(result.visible,false);
 assert.equal(result.grip,null,'A display:none resize handle must not reject the native hide request');
 for(const bounds of [result.bounds,result.clip]){
  assert.ok(bounds.width>=1&&bounds.height>=1,'Native bounds validation must accept hiding');
 }
 const restored=appPanelGeometry(rect(140,200,800,500),rect(140,180,1000,620),true,false,rect(900,640,32,32));
 assert.equal(restored.visible,true);assert.equal(restored.grip.width,32);assert.equal(restored.viewportRight,1140);
});
test('collapsed or unavailable resize handles are omitted from app presentation',()=>{
 for(const grip of [rect(900,640,0,32),rect(900,640,32,0)]){
  assert.equal(appPanelGeometry(rect(140,200,800,500),rect(140,180,1000,620),true,false,grip).grip,null);
 }
});
test('a delayed native size reply preserves a newer drag and only grows a card to the required app minimum',()=>{
 const widget=createWidget('apps');widget.placement={x:20,y:40,width:720,height:540};
  const info={minWidth:1000,minHeight:800,requiredWidth:600,requiredHeight:400,measured:true,probing:false};
 assert.deepEqual(appPanelFit(widget,info,2,100),{appMinWidth:602,appMinHeight:500});
 widget.placement.width=480;widget.placement.height=380;
 assert.deepEqual(appPanelFit(widget,info,2,100),{placement:{x:20,y:40,width:602,height:500},appMinWidth:602,appMinHeight:500});
});
test('reported app minima can update after a monitor change without retaining an obsolete larger limit',()=>{
 const widget=createWidget('apps');widget.placement={x:20,y:40,width:960,height:680};widget.appMinWidth=900;widget.appMinHeight=620;
  assert.deepEqual(appPanelFit(widget,{minWidth:800,minHeight:580,requiredWidth:600,requiredHeight:400,measured:true,probing:false},2,100),{appMinWidth:602,appMinHeight:500});
});
test('missing or invalid native minima keep a saved safe limit without restoring an old window size',()=>{
 const widget=createWidget('apps');widget.placement={x:20,y:40,width:720,height:540};widget.appMinWidth=602;widget.appMinHeight=500;
  assert.deepEqual(appPanelFit(widget,{minWidth:1400,minHeight:900,requiredWidth:null,requiredHeight:NaN,measured:false,probing:false},2,100),{});
  const fresh=createWidget('apps');assert.deepEqual(appPanelFit(fresh,{minWidth:1400,minHeight:900,requiredWidth:Infinity,requiredHeight:-1,measured:false,probing:false},2,100),{});
});
test('a confirmed no-floor clears the cached app minimum instead of sticking it forever',()=>{
 const widget=createWidget('apps');widget.placement={x:20,y:40,width:720,height:540};widget.appMinWidth=602;widget.appMinHeight=500;
  assert.deepEqual(appPanelFit(widget,{minWidth:1400,minHeight:900,requiredWidth:null,requiredHeight:null,measured:true,probing:false},2,100),{appMinWidth:undefined,appMinHeight:undefined});
 assert.equal(widget.appMinWidth,602,'The cached value is only cleared through the returned patch, never mutated in place');
 // A valid measured floor still wins over the cached limit.
  assert.deepEqual(appPanelFit(widget,{minWidth:1400,minHeight:900,requiredWidth:500,requiredHeight:300,measured:true,probing:false},2,100),{appMinWidth:502,appMinHeight:400});
 });
test('a native refusal probe does not reapply the stale minimum while the window is being remeasured',()=>{
 const widget=createWidget('apps');widget.placement={x:20,y:40,width:320,height:240};widget.appMinWidth=602;widget.appMinHeight=500;
 assert.deepEqual(appPanelFit(widget,{minWidth:900,minHeight:700,requiredWidth:null,requiredHeight:null,measured:true,probing:true},2,100),{});
 });
test('Apps hides only its native content under a higher card and restores it when clear',()=>{
 const panel=rect(140,200,800,500),content=rect(170,250,1000,550),higherContent=rect(300,300,100,100);
 const covered=appPanelGeometry(panel,content,true,false,null,[higherContent]);
 assert.equal(covered.visible,false,'a higher card covering native app content hides the whole attached HWND');
 const headerOnly=appPanelGeometry(panel,content,true,false,null,[rect(200,200,120,40)]);
 assert.equal(headerOnly.visible,true,'overlap outside the native content area does not hide the app');
 const edgeTouch=appPanelGeometry(panel,content,true,false,null,[rect(970,250,100,100)]);
 assert.equal(edgeTouch.visible,true,'zero-area edge touching does not hide the app');
 assert.equal(appPanelGeometry(panel,content,true,false).visible,true,'moving the higher card clear restores the same attached HWND');
 const result=appPanelGeometry(panel,rect(170,180,1000,620),true,false);
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
test('Apps native edge uses the workspace viewport rather than the narrower widget content clip',()=>{
 const workspace=rect(0,0,1200,800),contentClip=rect(300,120,500,500),panel=rect(300,120,500,500);
 const result=appPanelGeometry(panel,contentClip,true,false,null,[],workspace.right);
 assert.equal(result.clip.x,300);assert.equal(result.clip.width,500);
 assert.equal(result.viewportRight,1200);
});
test('native app minimum size persists with its Apps widget and invalid limits are discarded',()=>{
 const state=createInitialState(),app=createWidget('apps');app.appKey='codex';app.appPanelOpen=true;app.appMinWidth=640;app.appMinHeight=460;state.workspaces[0].widgets.push(app);
 const restored=parseState(JSON.stringify(state)).workspaces[0].widgets.at(-1);assert.equal(restored.appMinWidth,640);assert.equal(restored.appMinHeight,460);
 assert.equal(restored.placement.width,640);assert.equal(restored.placement.height,460);
 app.appPanelOpen=false;const detached=parseState(JSON.stringify(state)).workspaces[0].widgets.at(-1);assert.equal(detached.placement.width,360);assert.equal(detached.placement.height,280);
 app.appMinWidth=NaN;app.appMinHeight=-10;
 const invalid=parseState(JSON.stringify(state)).workspaces[0].widgets.at(-1);assert.equal(invalid.appMinWidth,undefined);assert.equal(invalid.appMinHeight,undefined);
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
