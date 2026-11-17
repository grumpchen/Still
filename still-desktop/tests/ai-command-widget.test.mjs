import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,createWidget,parseState} from '../src/domain/workspaces.ts';
import {widgetCatalog,widgetTypes} from '../src/domain/widgetCatalog.ts';
import {readFile} from 'node:fs/promises';

test('AI Command is a catalog widget and its saved name and prompt survive workspace reload',()=>{
 assert.ok(widgetTypes.includes('aiCommand'));
 assert.equal(widgetCatalog.aiCommand.name,'AI Command');
 const state=createInitialState(),workspace=state.workspaces.find(item=>item.role==='custom');
 const command=createWidget('aiCommand');command.title='Tidy course folder';command.text='Review this folder and suggest a clear organization plan. Do not move or delete files.';workspace.widgets.push(command);
 const restored=parseState(JSON.stringify(state)).workspaces.find(item=>item.id===workspace.id).widgets.find(item=>item.id===command.id);
 assert.equal(restored.title,'Tidy course folder');
 assert.equal(restored.text,command.text);
});

test('AI Command prompt storage is bounded and running uses the existing assistant submit path',async()=>{
 const state=createInitialState(),workspace=state.workspaces.find(item=>item.role==='custom'),command=createWidget('aiCommand');
 command.text='x'.repeat(9000);workspace.widgets.push(command);
 const restored=parseState(JSON.stringify(state)).workspaces.find(item=>item.id===workspace.id).widgets.find(item=>item.id===command.id);
 assert.equal(restored.text.length,8000);
 const widgetSource=await readFile(new URL('../src/widgets.tsx',import.meta.url),'utf8');
 const assistantSource=await readFile(new URL('../src/AssistantPanel.tsx',import.meta.url),'utf8');
 assert.match(widgetSource,/still-run-ai-command/);
 assert.match(assistantSource,/addEventListener\('still-run-ai-command'/);
 assert.match(assistantSource,/requestSubmit\(\)/);
});
