import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWidget,createWorkspace,duplicateWorkspace,parseState,transferWidgetInstance,minimizeWidgetInstance,moveMinimizedWidgetInstance,restoreWidgetInstance,widgetTypes} from '../src/domain/workspaces.ts';
import {widgetCatalog} from '../src/domain/widgetCatalog.ts';

test('every widget type minimizes as the same instance with validated restore geometry',()=>{
  for(const type of widgetTypes){
    const meta=widgetCatalog[type],placement={x:240,y:180,width:Math.max(420,meta.minWidth),height:Math.max(360,meta.minHeight)};
    const widget=createWidget(type);widget.id='widget-'+type;widget.placement={...placement};
    const compact=minimizeWidgetInstance(widget,1500,1200);
    assert.equal(compact.id,widget.id);assert.equal(compact.type,type);assert.equal(compact.minimized,true);
    assert.deepEqual(compact.restorePlacement,widget.placement);
    assert.ok(compact.placement.width<widget.placement.width&&compact.placement.height<widget.placement.height);
    assert.deepEqual(widget.placement,placement,'the original widget object is not mutated');
  }
});

test('moving a minimized button preserves the component state and restores old dimensions at its new clamped position',()=>{
  const widget=createWidget('notes');widget.id='movable-note';widget.text='keep me';widget.placement={x:120,y:80,width:480,height:360};
  const compact=minimizeWidgetInstance(widget,1500,1200),moved=moveMinimizedWidgetInstance(compact,{x:1400,y:1100},1500,1200);
  assert.equal(moved.id,widget.id);assert.equal(moved.text,'keep me');assert.equal(moved.minimized,true);
  assert.ok(moved.placement.x+moved.placement.width<=1500);assert.ok(moved.placement.y+moved.placement.height<=1200);
  const restored=restoreWidgetInstance(moved,900,700);
  assert.equal(restored.id,widget.id);assert.equal(restored.text,'keep me');assert.equal(restored.minimized,false);
  assert.equal(restored.placement.x,Math.min(moved.placement.x,900-restored.placement.width-20));assert.equal(restored.placement.y,Math.min(moved.placement.y,700-restored.placement.height-20));
  assert.equal(restored.placement.width,480);assert.equal(restored.placement.height,360);assert.equal(restored.restorePlacement,null);
});

test('minimized Apps ignore native minimum while compact and respect it after restore',()=>{
  const app=createWidget('apps');app.appPanelOpen=true;app.appMinWidth=900;app.appMinHeight=700;app.placement={x:100,y:100,width:1000,height:760};
  const compact=minimizeWidgetInstance(app,1500,1200);
  assert.ok(compact.placement.width<app.appMinWidth);assert.ok(compact.placement.height<app.appMinHeight);
  const restored=restoreWidgetInstance(compact,1500,1200);
  assert.ok(restored.placement.width>=app.appMinWidth);assert.ok(restored.placement.height>=app.appMinHeight);
});

test('parseState validates minimized flags and saved restore placement while old layouts default safely',()=>{
  const state={version:4,activeId:'work',workspaces:[{id:'work',name:'Study',layout:'canvas',browserWidth:80,browserHeight:100,groups:[],widgets:[
    {...createWidget('notes'),id:'valid',minimized:true,placement:{x:30,y:40,width:104,height:40},restorePlacement:{x:30,y:40,width:500,height:360}},
    {...createWidget('notes'),id:'bad',minimized:true,placement:{x:40,y:50,width:104,height:40},restorePlacement:{x:Infinity,y:0,width:-2,height:0}},
    {...createWidget('notes'),id:'legacy'}
  ]}],presets:[],theme:'light',density:'comfortable',background:'solid',sidebarCollapsed:false};
  const restored=parseState(JSON.stringify(state)),[valid,bad,legacy]=restored.workspaces.find(workspace=>workspace.id==='work').widgets;
  assert.equal(valid.minimized,true);assert.deepEqual(valid.restorePlacement,{x:30,y:40,width:500,height:360});
  assert.equal(bad.minimized,false);assert.equal(bad.restorePlacement,null);
  assert.equal(legacy.minimized,false);assert.equal(legacy.restorePlacement,null);
  assert.equal(JSON.stringify(parseState(JSON.stringify(restored))),JSON.stringify(restored));
});

test('workspace duplication and transfer retain minimized instance state without changing saved entries',()=>{
  const source=createWorkspace('Source',[]),destination=createWorkspace('Destination',[]),widget=createWidget('notes');
  widget.id='minimized-transfer';widget.text='same notes';widget.placement={x:200,y:150,width:400,height:320};
  const compact=minimizeWidgetInstance(widget,1500,1200);source.widgets=[compact];
  const copy=duplicateWorkspace(source,'Copy');assert.equal(copy.widgets[0].minimized,true);assert.deepEqual(copy.widgets[0].restorePlacement,compact.restorePlacement);
  const moved=transferWidgetInstance(source,destination,compact.id,900,700);
  assert.equal(moved.destination.widgets[0].id,compact.id);assert.equal(moved.destination.widgets[0].minimized,true);
  assert.equal(moved.destination.widgets[0].text,'same notes');assert.ok(moved.destination.widgets[0].placement.width<240);
  assert.deepEqual(source.widgets[0].restorePlacement,compact.restorePlacement);
});
