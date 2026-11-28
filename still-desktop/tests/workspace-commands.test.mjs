import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,createWorkspace} from '../src/domain/workspaces.ts';
import {createWorkbenchService} from '../src/platform/workbenchOperations.ts';

test('assistant duplicates the real course and mutates only the targeted tray shortcut',async()=>{
 let state=createInitialState();
 const course=createWorkspace('Physics',['notes','focus']);
 course.widgets[0].text='Conservation of momentum';
 const source={id:'sample',type:'focus',name:'Exam timer',remaining:320};
 state={...state,presets:[source],workspaces:[...state.workspaces,course],activeId:course.id};
 const service=createWorkbenchService({getState:()=>state,commitState:next=>{state=next},viewport:()=>({width:1400,height:800})});
 const run=async action=>(await service.executeWorkbenchActions([action]))[0];
 assert.equal((await run({operation:'workspace.duplicate',workspaceId:course.id,name:'Revision'})).status,'succeeded');
 const copy=state.workspaces.at(-1);
 assert.equal(copy.widgets[0].text,course.widgets[0].text);
 assert.notEqual(copy.widgets[0].activeNoteDocumentId,course.widgets[0].activeNoteDocumentId);
 assert.notEqual(copy.widgets[0].id,course.widgets[0].id);
 assert.equal((await run({operation:'preset.rename',presetId:'preset-sample',name:'Short timer'})).status,'succeeded');
 assert.equal(state.presets[0].remaining,320);
 assert.equal((await run({operation:'preset.delete',presetId:'group-sample'})).status,'needs_clarification');
 assert.equal(state.presets.length,1);
 assert.equal((await run({operation:'preset.delete',presetId:'preset-sample'})).status,'succeeded');
 assert.equal(state.presets.length,0);
 assert.equal((await run({operation:'workspace.stack',workspaceId:copy.id})).status,'needs_clarification');
 assert.equal((await run({operation:'workspace.stack',workspaceId:course.id})).status,'succeeded');
});
