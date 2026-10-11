import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bookmark,parseBookmarks,saveBookmark} from '../src/domain/bookmarks.ts';
import {toggleLecture} from '../src/domain/lecture.ts';
import {createInitialState,createWorkspace,parseState} from '../src/domain/workspaces.ts';

test('bookmarks normalize website addresses, reject unsafe URLs and update an existing website',()=>{
  const first=bookmark({name:' Course ',url:'example.com/lectures'});
  assert.equal(first.name,'Course');assert.equal(first.url,'https://example.com/lectures');
  let items=saveBookmark([],first);items=saveBookmark(items,{name:'Engineering',url:first.url});
  assert.equal(items.length,1);assert.equal(items[0].id,first.id);assert.equal(items[0].name,'Engineering');
  items=saveBookmark(items,{...items[0],url:'https://example.com/week2'});assert.equal(items.length,1);
  for(const url of ['javascript:alert(1)','file:///c:/secret','http://example.com','https://user:pass@example.com'])assert.throws(()=>bookmark({name:'Bad',url}));
  assert.throws(()=>bookmark({name:' ',url:'https://example.com'}));
  assert.deepEqual(parseBookmarks([],[first]),[]);
  assert.deepEqual(parseBookmarks([first,first,{name:'Bad',url:'data:text/plain,test'}]),[first]);
});
test('launcher links migrate once into independent browser bookmarks without resurrecting removed links',()=>{
  const state=createInitialState(),web=state.workspaces[0].widgets[0];state.version=3;delete web.browserVersion;
  web.bookmarks=[{id:'google',name:'Google',url:'https://www.google.com/'}];
  web.shortcuts=[{id:'course',name:'My course',url:'https://example.com/lectures',icon:'ENG'}];
  const restored=parseState(JSON.stringify(state)),browser=restored.workspaces[0].widgets[0];
  assert.equal(restored.version,6);assert.ok(browser.bookmarks.some(b=>b.id==='course'&&b.name==='My course'));
  assert.equal(browser.id,web.id);assert.deepEqual(browser.placement,web.placement);
  browser.bookmarks=[];browser.bookmarksExpanded=true;
  assert.deepEqual(parseState(JSON.stringify(restored)).workspaces[0].widgets[0].bookmarks,[]);
  assert.equal(parseState(JSON.stringify(restored)).workspaces[0].widgets[0].bookmarksExpanded,true);
  const workspace=createWorkspace('Two',['browser','browser']);workspace.widgets[0].bookmarks[0].name='Different';
  assert.notEqual(workspace.widgets[1].bookmarks[0].name,'Different');
});
test('lecture mode uses eighty percent of visible canvas, allows adjustment and restores exact old geometry',()=>{
  const previous={x:127,y:68,width:560,height:390};
  const expanded=toggleLecture(previous,null,1000,700,12,34);
  assert.deepEqual(expanded.placement,{x:12,y:34,width:800,height:696});assert.deepEqual(expanded.lectureRestore,previous);
  const state=createInitialState(),web=state.workspaces[0].widgets[0];Object.assign(web,expanded);
  const saved=parseState(JSON.stringify(state)).workspaces[0].widgets[0];assert.deepEqual(saved.lectureRestore,previous);
  const smaller={...saved.placement,width:740,height:650};
  assert.deepEqual(toggleLecture(smaller,saved.lectureRestore,1000,700),{placement:previous,lectureRestore:null});
});
