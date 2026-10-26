import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultGlass,parseGlass} from '../src/domain/appearance.ts';
import {createInitialState,parseState} from '../src/domain/workspaces.ts';
import {setNoteText} from './fixtures.mjs';
test('glass choices persist and older profiles gain the appearance without losing existing data',()=>{
  const state=createInitialState();assert.equal(state.appearance,'liquid-glass');assert.deepEqual(state.glass,defaultGlass());
  const study=state.workspaces[0],notes=study.widgets.find(widget=>widget.type==='notes');notes.placement={x:73,y:88,width:400,height:340};
  setNoteText(notes,'My saved notes');
  state.appearance='minimal';state.glass={blur:9,saturation:63,opacity:82,widgetHeaders:false};
  let restored=parseState(JSON.stringify(state));assert.equal(restored.appearance,'minimal');assert.deepEqual(restored.glass,state.glass);
  delete state.appearance;delete state.glass;restored=parseState(JSON.stringify(state));
  assert.equal(restored.appearance,'liquid-glass');assert.deepEqual(restored.glass,defaultGlass());
  assert.deepEqual(restored.workspaces[0].widgets.find(widget=>widget.type==='notes').placement,notes.placement);
  assert.equal(restored.workspaces[0].widgets.find(widget=>widget.type==='notes').text,'My saved notes');assert.deepEqual(restored.shortcuts,state.shortcuts);
  assert.deepEqual(parseGlass({blur:500,saturation:-1,opacity:Infinity}),{blur:18,saturation:40,opacity:68,widgetHeaders:true});
  assert.equal(parseGlass({widgetHeaders:false}).widgetHeaders,false,'the optional widget header material persists');
  assert.deepEqual(parseGlass(null),defaultGlass());
});
