import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWidget,createInitialState,parseState,duplicateWorkspace} from '../src/domain/workspaces.ts';
test('optional URL and bookmark controls start collapsed and retain their per-widget choice',()=>{
 assert.equal(createWidget('browser').browserToolsExpanded,false);
 const state=createInitialState(),web=state.workspaces[0].widgets.find(w=>w.type==='browser');
 web.browserToolsExpanded=true;web.bookmarksExpanded=true;
 assert.equal(parseState(JSON.stringify(state)).workspaces[0].widgets[0].browserToolsExpanded,true);
 const copy=duplicateWorkspace(state.workspaces[0],'Copy');copy.widgets[0].browserToolsExpanded=false;
 assert.equal(web.browserToolsExpanded,true);
 delete web.browserToolsExpanded;
 const restored=parseState(JSON.stringify(state)).workspaces[0].widgets[0];
 assert.equal(restored.browserToolsExpanded,false);assert.equal(restored.bookmarksExpanded,true);
 assert.deepEqual(restored.bookmarks,web.bookmarks);assert.equal(restored.url,web.url);
});
