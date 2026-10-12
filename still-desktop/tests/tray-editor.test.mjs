import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createElement,act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';

const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,entries:[]}});
after(()=>vite.close());

test('Saved shortcuts collapse behind an adjacent chevron in the tray editor',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true});
 const old={window:globalThis.window,document:globalThis.document,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const {default:TrayEditor}=await vite.ssrLoadModule('/src/TrayEditor.tsx');
 const root=createRoot(dom.window.document.querySelector('#root'));
 const noop=()=>{};
 try{
  await act(async()=>root.render(createElement(TrayEditor,{widgets:[],groups:[],presets:[],add:noop,editPreset:noop,renamePreset:noop,removePreset:noop,editGroup:noop,renameGroup:noop,openGroup:noop,removeGroup:noop,removeWidget:noop,hideSidebar:noop,hideWidgetTray:noop,arrange:noop,attach:noop})));
  const savedShortcuts=dom.window.document.querySelector('.tray-editor-collapsible');
  assert.ok(savedShortcuts,'Saved shortcuts has a collapsible section');
  assert.equal(savedShortcuts.open,false,'the long saved-shortcut list starts collapsed');
  const summary=savedShortcuts.querySelector('summary');
  assert.equal(summary.textContent.trim(),'Saved shortcuts');
  await act(async()=>summary.click());
  assert.equal(savedShortcuts.open,true,'the chevron expands the saved shortcuts');
  await act(async()=>summary.click());
  assert.equal(savedShortcuts.open,false,'the chevron collapses the saved shortcuts again');
 }finally{
  await act(async()=>root.unmount());dom.window.close();
  if(old.window===undefined)delete globalThis.window;else globalThis.window=old.window;
  if(old.document===undefined)delete globalThis.document;else globalThis.document=old.document;
  if(old.IS_REACT_ACT_ENVIRONMENT===undefined)delete globalThis.IS_REACT_ACT_ENVIRONMENT;else globalThis.IS_REACT_ACT_ENVIRONMENT=old.IS_REACT_ACT_ENVIRONMENT;
 }
});
