import {after,test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement,act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
import {createWidget,createWorkspace} from '../src/domain/workspaces.ts';

const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,entries:[]}});after(()=>vite.close());
function setGlobal(key,value){Object.defineProperty(globalThis,key,{configurable:true,writable:true,value})}

test('browser Library defaults to collected PDF references and Downloads Inbox shows a useful desktop-only fallback',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true}),{window}=dom,keys=['window','document','navigator','localStorage','HTMLElement','Element','Node','MutationObserver','IS_REACT_ACT_ENVIRONMENT','isTauri'],old=new Map(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));for(const key of keys)setGlobal(key,key==='IS_REACT_ACT_ENVIRONMENT'?true:key==='localStorage'?window.localStorage:key==='isTauri'?false:window[key]);let root;
 try{
  const {default:LibraryHome}=await vite.ssrLoadModule('/src/LibraryHome.tsx'),{localFiles}=await vite.ssrLoadModule('/src/platform/files.ts');
  assert.equal(localFiles.native,false);
  await assert.rejects(localFiles.inbox('web-inbox'),/Downloads Inbox is available in the Still desktop app/,'the platform fallback must not call Tauri invoke in web preview');
  const library=createWorkspace('Library',['files'],'library'),inbox=library.widgets[0];inbox.title='Downloads Inbox';inbox.folderName='Still Downloads';inbox.folderKey='still-downloads-inbox';
  const course=createWorkspace('Biology',[],'study'),pdf=createWidget('files');pdf.fileKey='saved-pdf-source';pdf.fileName='Lecture PDF';pdf.fileKind='pdf';course.widgets.push(pdf);
  const link={id:'web-1',name:'Lecture link',url:'https://example.edu/lecture',icon:'L',workspaceId:course.id,workspaceName:course.name,groupName:'Saved links'};
  root=createRoot(window.document.querySelector('#root'));
  await act(async()=>root.render(createElement(LibraryHome,{workspace:library,workspaces:[library,course],update(){},notify(){},workspaceActive:true,links:[link],openLink(){},addFolder:()=>null,addInbox:()=>null,removeFolder(){}})));
  assert.equal(window.document.querySelector('.library-page-header h2')?.textContent,'Lecture PDF','web preview opens a saved PDF shortcut first');
  assert.ok(window.document.querySelector('.library-reference-toolbar'),'PDF shortcut metadata actions are available');
  assert.ok(window.document.body.textContent.includes('Notes stay in their course'));
  assert.equal(window.document.body.textContent.includes('Cannot read properties of undefined'),false);
  await act(async()=>[...window.document.querySelectorAll('.library-rail button')].find(button=>button.textContent.includes('Downloads Inbox')).click());
  assert.ok(window.document.body.textContent.includes('The Downloads Inbox is available in the Still desktop app.'));
  assert.ok(window.document.body.textContent.includes('manage saved PDF shortcuts and links from the Library sidebar.'));
  assert.equal(window.document.body.textContent.includes('Cannot read properties of undefined'),false);
  assert.equal(window.document.querySelector('.files-toolbar button[aria-pressed]'),null,'browser Inbox does not offer folder searching as if a native download folder were connected');
 }finally{if(root)await act(async()=>root.unmount());dom.window.close();for(const[key,descriptor]of old){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}}
});
