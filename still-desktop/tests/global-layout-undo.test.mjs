import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,createGlobalWorkspaceLayout,createWidget} from '../src/domain/workspaces.ts';
import {createGlobalLayoutUndoRecord,undoGlobalLayoutTarget} from '../src/domain/globalLayoutUndo.ts';

test('global layout undo restores only its target and keeps edits in other workspaces',()=>{
 const before=createInitialState(),dashboard=before.workspaces.find(item=>item.role==='dashboard'),study=before.workspaces.find(item=>item.role==='study'),template=createGlobalWorkspaceLayout('Target layout',dashboard,before,{widgetIds:[],widgets:[],dashboardLayout:{order:[],sizes:{}}}),applied={...study,widgets:[createWidget('notes')]};
 const record=createGlobalLayoutUndoRecord(before,study.id,applied,template),current={...before,workspaces:before.workspaces.map(item=>item.id===study.id?applied:item.id===dashboard.id?{...item,name:'Dashboard content changed while layout was active'}:item)};
 const result=undoGlobalLayoutTarget(current,record);assert.equal(result.reason,undefined);assert.deepEqual(result.state.workspaces.find(item=>item.id===study.id),study);assert.equal(result.state.workspaces.find(item=>item.id===dashboard.id).name,'Dashboard content changed while layout was active');
});

test('global layout undo refuses to overwrite later edits to its target workspace',()=>{
 const before=createInitialState(),dashboard=before.workspaces.find(item=>item.role==='dashboard'),study=before.workspaces.find(item=>item.role==='study'),template=createGlobalWorkspaceLayout('Target layout',dashboard,before,{widgetIds:[],widgets:[],dashboardLayout:{order:[],sizes:{}}}),applied={...study,widgets:[createWidget('notes')]},record=createGlobalLayoutUndoRecord(before,study.id,applied,template),edited={...applied,name:'Edited after apply'},current={...before,workspaces:before.workspaces.map(item=>item.id===study.id?edited:item)};
 const result=undoGlobalLayoutTarget(current,record);assert.match(result.reason,/changed after this layout was applied/);assert.equal(result.state.workspaces.find(item=>item.id===study.id).name,'Edited after apply');
});
