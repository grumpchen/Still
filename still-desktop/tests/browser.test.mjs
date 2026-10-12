import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,parseState,widgetTypes} from '../src/domain/workspaces.ts';
import {shortcut,parseWebShortcuts} from '../src/domain/webShortcuts.ts';
import {widgetPreset,parsePresets} from '../src/domain/presets.ts';
import {normalizeUrl} from '../src/domain/browser.ts';

test('standalone Browser widget and saved presets are removed while Apps stays available',()=>{
  const state=createInitialState();
  assert.equal(widgetTypes.includes('browser'),false);
  assert.equal(state.workspaces.flatMap(workspace=>workspace.widgets).some(widget=>widget.type==='browser'),false);
  const old={...state,version:6,workspaces:state.workspaces.map((workspace,index)=>index?workspace:{...workspace,widgets:[...workspace.widgets,{id:'old-browser',type:'browser',url:'https://example.com',placement:{x:0,y:0,width:600,height:460}}]}),presets:[{id:'old-browser-preset',type:'browser',name:'Old site',url:'https://example.com'}]};
  const restored=parseState(old);
  assert.equal(restored.workspaces[0].widgets.some(widget=>widget.id==='old-browser'),false);
  assert.equal(restored.presets.some(preset=>preset.id==='old-browser-preset'),false);
  assert.equal(widgetTypes.includes('apps'),true);
  assert.equal(widgetPreset({id:'app',type:'apps',name:'App',appSourceId:'app-id',appName:'App.exe'}).type,'apps');
  assert.deepEqual(parsePresets(old.presets),[]);
});

test('saved Group links remain valid external website shortcuts',()=>{
  const item=shortcut({name:' Course ',url:'example.com/lectures'});
  assert.equal(item.name,'Course');assert.equal(item.url,'https://example.com/lectures');
  assert.deepEqual(parseWebShortcuts([item]),[item]);
  for(const url of ['javascript:alert(1)','file:///c:/secret','http://example.com','https://user:pass@example.com'])assert.throws(()=>normalizeUrl(url));
});
