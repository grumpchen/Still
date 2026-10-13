import test from 'node:test';
import assert from 'node:assert/strict';
import {collectWidgetIntoGroup,createInitialState,createWidget,parseState,stackWorkspaceWidgets,transferWidgetInstance} from '../src/domain/workspaces.ts';
import {canCloseWidget,canMoveWidget,setWidgetLock} from '../src/domain/widgetLock.ts';
import {validateAssistantActions,validateLayout} from '../src/domain/assistant.ts';

test('Lock add-on disables move and close, and unlocking restores both',()=>{
 const widget=createWidget('notes');
 const locked=setWidgetLock(widget,true);
 assert.equal(locked.lockPluginEnabled,true);
 assert.equal(locked.locked,true);
 assert.equal(canMoveWidget(locked),false);
 assert.equal(canCloseWidget(locked),false);
 const unlocked={...locked,locked:false};
 assert.equal(canMoveWidget(unlocked),true);
 assert.equal(canCloseWidget(unlocked),true);
 assert.deepEqual(setWidgetLock(locked,false),{...locked,lockPluginEnabled:false,locked:false});
});

test('lock state survives workspace persistence and malformed lock flags do not lock a widget',()=>{
 const state=createInitialState(),widget=createWidget('notes');
 widget.id='locked-note';Object.assign(widget,setWidgetLock(widget,true));
 state.workspaces[0].widgets.push(widget);
 const restored=parseState(JSON.stringify(state)).workspaces[0].widgets.find(item=>item.id===widget.id);
 assert.equal(restored.lockPluginEnabled,true);assert.equal(restored.locked,true);
 const malformed=JSON.parse(JSON.stringify(state));malformed.workspaces[0].widgets[0].lockPluginEnabled='yes';malformed.workspaces[0].widgets[0].locked=true;
 const checked=parseState(malformed).workspaces[0].widgets[0];
 assert.equal(checked.lockPluginEnabled,false);assert.equal(checked.locked,false);
});

test('locked widgets cannot be removed by Still AI or moved by a layout proposal',()=>{
 const widget=createWidget('notes');widget.id='locked-note';Object.assign(widget,setWidgetLock(widget,true));
 const workspace={id:'study',name:'Study',widgets:[widget],groups:[]};
 assert.throws(()=>validateAssistantActions(workspace,[{type:'remove_widget',ids:[widget.id]}]),/Unlock a locked widget/);
 assert.throws(()=>validateLayout(workspace,[{id:widget.id,...widget.placement,x:widget.placement.x+20}],1200,800),/Unlock locked widgets/);
 assert.doesNotThrow(()=>validateLayout(workspace,[{id:widget.id,...widget.placement,width:widget.placement.width+20}],1200,800),'a locked widget may still be resized in place');
});

test('other layout and transfer paths also preserve the locked widget position',()=>{
 const widget=createWidget('notes');widget.id='locked-note';widget.placement={x:80,y:90,width:400,height:320};Object.assign(widget,setWidgetLock(widget,true));
 const workspace={id:'study',name:'Study',widgets:[widget],groups:[]};
 assert.deepEqual(stackWorkspaceWidgets([widget],1200,800)[0].placement,widget.placement);
 assert.equal(transferWidgetInstance(workspace,{id:'design',name:'Design',widgets:[],groups:[]},widget.id,1200,800),null);
 assert.throws(()=>collectWidgetIntoGroup(workspace,widget.id),/Unlock this widget/);
});
