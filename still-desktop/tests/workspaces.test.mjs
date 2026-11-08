import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, createWorkspace, createWidgetFromPreset, duplicateWorkspace, migratePreview, parseState } from '../src/domain/workspaces.ts';
import { normalizeUrl, browserDestination, GOOGLE_URL, AKO_URL } from '../src/domain/browser.ts';
import { folderEntries, programFile } from '../src/platform/files.ts';
import {encodePdfCalculation} from '../src/domain/pdfCalculations.ts';
import {presetFromWidget} from '../src/domain/presets.ts';
test('custom workspace starts with chosen widgets and a unique ID',()=>{
  const a=createWorkspace(' Engineering ',['desmos','apps']);
  const b=createWorkspace('Engineering',['notes']);
  assert.equal(a.name,'Engineering');
  assert.deepEqual(a.widgets.map(w=>w.type),['desmos','apps']);
  assert.notEqual(a.id,b.id);
  assert.notEqual(a.widgets[0].id,b.widgets[0].id);
  assert.throws(()=>createWorkspace('  ',[]));
  assert.throws(()=>createWorkspace('x'.repeat(61),[]));
});
test('PDF calculation widget state survives workspace parsing and tray reuse',()=>{
 const state=createInitialState(),workspace=createWorkspace('Calculations',['calculation']),widget=workspace.widgets[0];
 widget.text=encodePdfCalculation([1200,.5,2],'+');state.workspaces.push(workspace);
 const parsed=parseState(state),saved=parsed.workspaces.find(item=>item.id===workspace.id).widgets[0];
 assert.equal(saved.text,widget.text);
 const preset=presetFromWidget(saved),reopened=createWidgetFromPreset(preset,[]);
 assert.equal(reopened.type,'calculation');assert.equal(reopened.text,widget.text);
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
  assert.equal(migrated.workspaces.find(workspace=>workspace.role==='study').widgets.find(w=>w.type==='notes').text,'keep this');
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
test('legacy lecture data migrates to canvas while preserving and bounding widget placements',()=>{
  const state=createInitialState(), study=state.workspaces[0],note=study.widgets.find(widget=>widget.type==='notes');
  assert.equal(study.layout,'canvas');
  note.placement={x:72,y:85,width:400,height:340};
  const copy=duplicateWorkspace(study,'Lecture copy');
  assert.deepEqual(copy.widgets.find(widget=>widget.type==='notes').placement,note.placement);
  assert.deepEqual(parseState(JSON.stringify(state)).workspaces[0].widgets.find(widget=>widget.type==='notes').placement,note.placement);
  delete study.layout;
  const migrated=parseState(JSON.stringify(state)).workspaces[0];
  assert.equal(migrated.layout,'canvas');assert.deepEqual(migrated.widgets.find(widget=>widget.type==='notes').placement,note.placement);
  note.placement={x:500,y:-1,width:5000,height:5000};
  const clamped=parseState(JSON.stringify(state)).workspaces[0].widgets.find(widget=>widget.type==='notes').placement;
  assert.deepEqual(clamped,{x:500,y:0,width:3000,height:3000});
});
test('timetable course environment links survive persistence and reject malformed workspace IDs',()=>{
  const state=createInitialState(),scheduleWidget=state.workspaces.find(workspace=>workspace.role==='dashboard').widgets.find(widget=>widget.type==='timetable');
  const environment=createWorkspace('EMTH118',[]);state.workspaces.push(environment);
  scheduleWidget.schedule=[{id:'course-1',day:3,time:'13:00',title:'EMTH118',location:'',workspaceId:environment.id}];
  const restored=parseState(JSON.stringify(state)),restoredEntry=restored.workspaces.find(workspace=>workspace.role==='dashboard').widgets.find(widget=>widget.type==='timetable').schedule[0];
  assert.equal(restoredEntry.workspaceId,environment.id);
  scheduleWidget.schedule[0].workspaceId='bad id with spaces';
  const malformed=parseState(JSON.stringify(state)).workspaces.find(workspace=>workspace.role==='dashboard').widgets.find(widget=>widget.type==='timetable').schedule[0];
  assert.equal(malformed.workspaceId,undefined);
  scheduleWidget.schedule[0].workspaceId='deleted-workspace';
  const stale=parseState(JSON.stringify(state)).workspaces.find(workspace=>workspace.role==='dashboard').widgets.find(widget=>widget.type==='timetable').schedule[0];
  assert.equal(stale.workspaceId,undefined);
});
test('omnibox URL normalization separates searches from safe web addresses',()=>{
  assert.equal(browserDestination('how to integrate x squared'),'https://www.google.com/search?q=how%20to%20integrate%20x%20squared');
  assert.equal(browserDestination('desmos.com/scientific'),'https://desmos.com/scientific');
  assert.equal(browserDestination('google'),'https://www.google.com/search?q=google');
  assert.throws(()=>browserDestination('javascript:alert(1)'));
});
test('folder browsing lists immediate children with directories first and blocks program launch',()=>{
  const files=[{path:'lectures/week1.txt',size:10},{path:'notes.txt',size:20},{path:'lectures/week2.txt',size:30},{path:'RUN.CMD',size:2}];
  const root=folderEntries(files,'');assert.equal(root[0].name,'lectures');assert.equal(root.filter(f=>f.directory).length,1);
  assert.deepEqual(folderEntries(files,'lectures').map(f=>f.name),['week1.txt','week2.txt']);
  assert.equal(root.find(f=>f.name==='RUN.CMD').blocked,true);assert.equal(programFile('notes.pdf'),false);
});
