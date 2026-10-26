import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';

test('installed icons load in bounded batches and share concurrent requests',async()=>{
 const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,entries:[]}});
 try{
  const {appPanel}=await vite.ssrLoadModule('/src/platform/appPanel.ts');
  const {loadInstalledAppIcon}=await vite.ssrLoadModule('/src/platform/installedAppIcons.ts');
  const old=appPanel.installedIcon;let active=0,maxActive=0,calls=0;const pending=[];
  appPanel.installedIcon=()=>{calls++;active++;maxActive=Math.max(maxActive,active);return new Promise(resolve=>pending.push(()=>{active--;resolve([137,80,78,71,13,10,26,10,1])}))};
  try{
   const first=loadInstalledAppIcon('one');assert.equal(loadInstalledAppIcon('one'),first);
   const requests=[first,...['two','three','four','five'].map(loadInstalledAppIcon)];
   await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,3);assert.equal(maxActive,3);
   while(pending.length){pending.shift()();await new Promise(resolve=>setImmediate(resolve))}
   const icons=await Promise.all(requests);assert.equal(calls,5);assert.equal(maxActive,3);assert.ok(icons.every(icon=>icon.url?.startsWith('data:image/png;base64,')));
  }finally{appPanel.installedIcon=old}
 }finally{await vite.close()}
});
