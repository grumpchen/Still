import {after,test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {mockIPC,clearMocks} from '@tauri-apps/api/mocks';
import {createServer} from 'vite';

const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,entries:[]}});after(()=>vite.close());
const setGlobal=(key,value)=>Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
async function withNativeFiles(run){
 const dom=new JSDOM('',{url:'http://localhost'}),{window}=dom,keys=['window','document','navigator','isTauri'],old=new Map(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const key of keys)setGlobal(key,key==='isTauri'?true:window[key]);
 try{const module=await vite.ssrLoadModule('/src/platform/files.ts');assert.equal(module.localFiles.native,true);await run(module.localFiles,module.MAX_LIBRARY_SEARCH_ROOTS)}
 finally{clearMocks();dom.window.close();for(const[key,descriptor]of old){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}}
}
const hit=(widgetId,index)=>({widgetId,entry:{name:`match-${index}.pdf`,path:`match-${index}.pdf`,directory:false,size:10,blocked:false}});

test('native Library search finds the 41st unique root using a second bounded invoke',async()=>withNativeFiles(async(localFiles)=>{
 const ids=Array.from({length:41},(_,index)=>`root-${index}`);ids.push('root-0');const calls=[];
 mockIPC((command,args)=>{calls.push({command,args});return{results:args.ids.includes('root-40')?[hit('root-40',40)]:[],unavailableWidgetIds:args.ids.includes('root-1')?['root-1']:[],truncated:false}},{shouldMockEvents:true});
 const result=await localFiles.searchLibrary(ids,'match');
 assert.equal(calls.length,2);assert.deepEqual(calls.map(call=>call.args.ids.length),[40,1]);assert.equal(new Set(calls.flatMap(call=>call.args.ids)).size,41);assert.deepEqual(result.results.map(item=>item.widgetId),['root-40']);assert.deepEqual(result.unavailableWidgetIds,['root-1']);assert.equal(result.truncated,false);
}));

test('native Library search caps combined results and stops before later batches',async()=>withNativeFiles(async(localFiles)=>{
 const ids=Array.from({length:80},(_,index)=>`cap-${index}`),calls=[];
 mockIPC((command,args)=>{calls.push({command,args});return{results:Array.from({length:500},(_,index)=>hit(args.ids[0],index)),unavailableWidgetIds:[],truncated:false}},{shouldMockEvents:true});
 const result=await localFiles.searchLibrary(ids,'match');
 assert.equal(calls.length,1);assert.ok(calls.every(call=>call.args.ids.length<=40));assert.equal(result.results.length,500);assert.equal(result.truncated,true,'unsearched later roots make the aggregate partial');
}));

test('native Library search stops and reports partial when one batch is truncated',async()=>withNativeFiles(async(localFiles)=>{
 const ids=Array.from({length:80},(_,index)=>`partial-${index}`),calls=[];
 mockIPC((command,args)=>{calls.push({command,args});return{results:[hit(args.ids[0],0)],unavailableWidgetIds:[],truncated:true}},{shouldMockEvents:true});
 const result=await localFiles.searchLibrary(ids,'match');
 assert.equal(calls.length,1);assert.equal(result.results.length,1);assert.equal(result.truncated,true);
}));

test('native Library search bounds the number of batches and marks omitted roots partial',async()=>withNativeFiles(async(localFiles,maxRoots)=>{
 const ids=Array.from({length:maxRoots+1},(_,index)=>`bounded-${index}`),calls=[];
 mockIPC((command,args)=>{calls.push({command,args});return{results:[],unavailableWidgetIds:[],truncated:false}},{shouldMockEvents:true});
 const result=await localFiles.searchLibrary(ids,'match');
 assert.equal(calls.length,maxRoots/40);assert.ok(calls.every(call=>call.args.ids.length<=40));assert.equal(result.truncated,true);assert.equal(result.results.length,0);
}));

test('browser Library search scans the allowed roots before reporting omitted roots',async()=>withNativeFiles(async(localFiles,maxRoots)=>{
 localFiles.native=false;
 localFiles.select('browser-root-0',[new File(['no match'],'other.txt')]);
 localFiles.select('browser-root-398',[new File(['match'],'needle.pdf')]);
 const ids=Array.from({length:maxRoots+1},(_,index)=>`browser-root-${index}`),result=await localFiles.searchLibrary(ids,'needle');
 assert.deepEqual(result.results.map(item=>item.widgetId),['browser-root-398'],'the 399th root is still scanned inside the 400-root bound');
 assert.equal(result.results[0].entry.name,'needle.pdf');assert.equal(result.truncated,true,'the 401st root is omitted so the aggregate remains marked partial');
}));
