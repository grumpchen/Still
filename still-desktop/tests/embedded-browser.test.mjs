import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserPanel} from '../src/platform/browserPanel.ts';
import {browserDestination,normalizeUrl} from '../src/domain/browser.ts';
import {browserPanelFullyVisible} from '../src/domain/browserPanelGeometry.ts';

test('embedded Browser accepts HTTPS destinations and rejects unsafe schemes or credentials',()=>{
 assert.equal(browserDestination('example.com/course'),'https://example.com/course');
 assert.equal(browserDestination('lecture notes'),'https://www.google.com/search?q=lecture%20notes');
 for(const url of ['http://example.com','file:///c:/secret','javascript:alert(1)','https://user:pass@example.com','https://'])assert.throws(()=>normalizeUrl(url));
});

test('native Browser hides outside the app window or a clipping ancestor',()=>{
 const box={left:30,top:70,right:630,bottom:470},windowBox={left:0,top:0,right:1000,bottom:800};
 assert.equal(browserPanelFullyVisible(box,windowBox,[{left:0,top:40,right:900,bottom:750}]),true);
 assert.equal(browserPanelFullyVisible({...box,top:-20},windowBox,[]),false);
 assert.equal(browserPanelFullyVisible(box,windowBox,[{left:30,top:70,right:600,bottom:470}]),false);
});

test('Browser panel adapter invokes create, navigate, history, reload, close, and URL subscription',async()=>{
 const calls=[],listeners=[];
 const panel=createBrowserPanel({native:true,invoke:async(command,args)=>{calls.push({command,args})},listen:async(event,handler)=>{listeners.push({event,handler});return()=>calls.push({command:'unlisten',event})}});
 const bounds={x:24,y:68,width:620,height:440};
 await panel.present('widget-123','https://example.com/',bounds,true);
 await panel.navigate('widget-123','https://example.com/next');
 await panel.goBack('widget-123');await panel.goForward('widget-123');await panel.reload('widget-123');
 let current;const stop=await panel.onLocation(location=>current=location);listeners[0].handler({payload:{widgetId:'widget-123',url:'https://example.com/next'}});assert.deepEqual(current,{widgetId:'widget-123',url:'https://example.com/next'});
 await panel.close('widget-123');stop();
 assert.deepEqual(calls.map(call=>call.command),['browser_panel_present','browser_panel_navigate','browser_panel_go_back','browser_panel_go_forward','browser_panel_reload','browser_panel_close','unlisten']);
 assert.deepEqual(calls[0].args,{widgetId:'widget-123',url:'https://example.com/',bounds,visible:true});
 assert.equal(listeners[0].event,'still-browser-url');
});

test('unmount close waits for an in-flight delayed child-view creation',async()=>{
 const calls=[];let releaseCreate,markStarted;
 const started=new Promise(resolve=>markStarted=resolve);
 const panel=createBrowserPanel({native:true,listen:async()=>()=>{},invoke:(command,args)=>{
  calls.push(command);
  if(command==='browser_panel_present')return new Promise(resolve=>{releaseCreate=resolve;markStarted()});
  return Promise.resolve();
 }});
 const created=panel.present('widget-456','https://example.com/',{x:4,y:5,width:600,height:400},true);
 await started;
 const closed=panel.close('widget-456');
 await Promise.resolve();
 assert.deepEqual(calls,['browser_panel_present'],'close must stay queued while the native creation command is pending');
 releaseCreate();
 await Promise.all([created,closed]);
 assert.deepEqual(calls,['browser_panel_present','browser_panel_close'],'close runs after creation so it cannot miss and leak the child view');
});
