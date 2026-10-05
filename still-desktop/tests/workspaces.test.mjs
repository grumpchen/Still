import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, createWorkspace, duplicateWorkspace, migratePreview, parseState } from '../src/domain/workspaces.ts';
import { normalizeUrl, browserDestination, GOOGLE_URL, AKO_URL } from '../src/domain/browser.ts';
import { folderEntries, programFile } from '../src/platform/files.ts';
test('custom workspace starts with chosen widgets and a unique ID',()=>{
  const a=createWorkspace(' Engineering ',['desmos','browser']);
  const b=createWorkspace('Engineering',['notes']);
  assert.equal(a.name,'Engineering');
  assert.deepEqual(a.widgets.map(w=>w.type),['desmos','browser']);
  assert.notEqual(a.id,b.id);
  assert.notEqual(a.widgets[0].id,b.widgets[0].id);
  assert.throws(()=>createWorkspace('  ',[]));
  assert.throws(()=>createWorkspace('x'.repeat(61),[]));
});
test('duplicates layout and content without sharing widget state',()=>{
  const initial=createInitialState();const original=initial.workspaces[0];
  const copy=duplicateWorkspace(original,'Study copy');
  assert.notEqual(copy.id,original.id);
  assert.notEqual(copy.widgets[0].id,original.widgets[0].id);
  copy.widgets.find(w=>w.type==='notes').text='new note';
  assert.notEqual(original.widgets.find(w=>w.type==='notes').text,'new note');
  assert.deepEqual(copy.widgets.map(w=>w.span),original.widgets.map(w=>w.span));
});
test('round-trips custom workspaces and migrates the original design study',()=>{
  const state=createInitialState();const custom=createWorkspace('My engineering',[]);
  state.workspaces.push(custom);state.activeId=custom.id;
  assert.equal(parseState(JSON.stringify(state)).activeId,custom.id);
  const migrated=migratePreview({active:'Study',theme:'dark',density:'compact',background:'dots',workspaces:{Study:[{id:'old',type:'notes',text:'keep this',wide:false}]}});
  assert.equal(migrated.workspaces[0].widgets.find(w=>w.type==='notes').text,'keep this');
  assert.equal(migrated.theme,'dark');
  assert.throws(()=>parseState('{bad'));
  assert.throws(()=>parseState(JSON.stringify({...state,activeId:'missing'})));
  assert.throws(()=>parseState(JSON.stringify({...state,version:99})));
});
test('browser allows HTTPS navigation and rejects active schemes or credential URLs',()=>{
  assert.equal(normalizeUrl('learn.canterbury.ac.nz'),'https://learn.canterbury.ac.nz/');
  assert.equal(normalizeUrl('https://example.com/a?b=c'),'https://example.com/a?b=c');
  for(const url of ['javascript:alert(1)','file:///c:/secret','data:text/html,test','http://example.com','https://u:p@example.com','https://','https://exam ple.com'])assert.throws(()=>normalizeUrl(url),url);
});
test('legacy lecture data migrates to canvas while preserving old sizing fields',()=>{
  const state=createInitialState(), study=state.workspaces[0];
  assert.equal(study.layout,'canvas');
  assert.equal(study.browserWidth,80);
  study.browserWidth=72;study.browserHeight=85;
  const copy=duplicateWorkspace(study,'Lecture copy');
  assert.equal(copy.browserWidth,72);assert.equal(copy.browserHeight,85);
  assert.equal(parseState(JSON.stringify(state)).workspaces[0].browserWidth,72);
  delete study.layout;delete study.browserWidth;delete study.browserHeight;
  const migrated=parseState(JSON.stringify(state)).workspaces[0];
  assert.equal(migrated.layout,'canvas');assert.equal(migrated.browserWidth,80);assert.equal(migrated.browserHeight,100);
  study.browserWidth=500;study.browserHeight=-1;
  const clamped=parseState(JSON.stringify(state)).workspaces[0];
  assert.equal(clamped.browserWidth,95);assert.equal(clamped.browserHeight,50);
});
test('Google starts new browsers and omnibox separates searches from safe URLs',()=>{
  assert.equal(createWorkspace('Web',['browser']).widgets[0].url,GOOGLE_URL);
  assert.equal(browserDestination('how to integrate x squared'),'https://www.google.com/search?q=how%20to%20integrate%20x%20squared');
  assert.equal(browserDestination('desmos.com/scientific'),'https://desmos.com/scientific');
  assert.equal(browserDestination('google'),'https://www.google.com/search?q=google');
  assert.throws(()=>browserDestination('javascript:alert(1)'));
  const state=createInitialState(),widget=state.workspaces[0].widgets[0];widget.url=AKO_URL;delete widget.homeVersion;
  const migrated=parseState(JSON.stringify(state));assert.equal(migrated.workspaces[0].widgets[0].url,GOOGLE_URL);
  migrated.workspaces[0].widgets[0].url=AKO_URL;
  assert.equal(parseState(JSON.stringify(migrated)).workspaces[0].widgets[0].url,AKO_URL);
});
test('folder browsing lists immediate children with directories first and blocks program launch',()=>{
  const files=[{path:'lectures/week1.txt',size:10},{path:'notes.txt',size:20},{path:'lectures/week2.txt',size:30},{path:'RUN.CMD',size:2}];
  const root=folderEntries(files,'');assert.equal(root[0].name,'lectures');assert.equal(root.filter(f=>f.directory).length,1);
  assert.deepEqual(folderEntries(files,'lectures').map(f=>f.name),['week1.txt','week2.txt']);
  assert.equal(root.find(f=>f.name==='RUN.CMD').blocked,true);assert.equal(programFile('notes.pdf'),false);
});
