import assert from 'node:assert/strict';
import test from 'node:test';
import {JSDOM} from 'jsdom';
import {currentFileRequest,currentFilesView,focusFilesView} from '../src/platform/currentFilesView.ts';

test('the file commands reported by a tester resolve without needing a provider',()=>{
 assert.deepEqual(currentFileRequest('can u add one md file in current page of files widget'),{kind:'create',name:'Untitled.md'});
 assert.deepEqual(currentFileRequest('can u rename this file'),{kind:'rename',name:undefined});
 assert.deepEqual(currentFileRequest('rename this file to lecture notes.txt'),{kind:'rename',name:'lecture notes.txt'});
 assert.equal(currentFileRequest('explain how to rename this file'),undefined);
 assert.equal(currentFileRequest('create a markdown file in another folder'),undefined);
});

test('file context uses only the active workspace and requires focus or a unique Files view',()=>{
 const dom=new JSDOM(`
   <div class="workspace-surface" hidden>
     <article class="canvas-card" data-widget-id="hidden"><div class="files-widget" data-files-location="different"></div></article>
   </div>
   <div class="workspace-surface">
     <article class="canvas-card" data-widget-id="first"><div class="files-widget" data-files-location="" data-files-only="solo.txt"></div></article>
     <article class="canvas-card" data-widget-id="second"><div class="files-widget" data-files-location="Week 1" data-files-selected="Week 1/lecture.txt"></div></article>
   </div>`);
 const previous=globalThis.document;
 globalThis.document=dom.window.document;
 try{
  const workspace={id:'study-fixture',widgets:['hidden','first','second'].map(id=>({id,type:'files'}))};
  assert.equal(currentFilesView(workspace),undefined);
  assert.equal(currentFilesView(workspace,['hidden']),undefined);
  focusFilesView(workspace.id,'second');
  assert.equal(currentFilesView(workspace)?.selectedFile,'Week 1/lecture.txt');
  assert.equal(currentFilesView(workspace,['first'])?.onlyFile,'solo.txt');
  dom.window.document.querySelector('[data-widget-id=second]').classList.add('widget-minimized');
  assert.equal(currentFilesView(workspace)?.widgetId,'first');
 }finally{
  if(previous===undefined)delete globalThis.document;
  else globalThis.document=previous;
  dom.window.close();
 }
});
