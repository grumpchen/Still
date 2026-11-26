import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ASSISTANT_ACTION_TYPES,resolveDirectAssistantActions,validateAssistantActions,validateAssistantActionIntent,unsupportedAssistantRequest} from '../src/domain/assistant.ts';
import {assistantBulkRemovalSelection} from '../src/domain/assistantBulkRemoval.ts';
import {createWidget,createWorkspace} from '../src/domain/workspaces.ts';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const panel=readFileSync(new URL('../src/AssistantPanel.tsx',import.meta.url),'utf8');
const widgets=readFileSync(new URL('../src/widgets.tsx',import.meta.url),'utf8');
const assistantDomain=readFileSync(new URL('../src/domain/assistant.ts',import.meta.url),'utf8');
const native=readFileSync(new URL('../src-tauri/src/main.rs',import.meta.url),'utf8');
const capabilities=readFileSync(new URL('../src-tauri/capabilities/main.json',import.meta.url),'utf8');

test('Gemini assistant is reachable from the sidebar and native commands are registered',()=>{
 assert.match(app,/title=\{translate\(state\.locale,'aiAssistant'\)\} aria-label=\{translate\(state\.locale,'aiAssistant'\)\}[\s\S]*?setAssistantOpen/);
 assert.match(app,/<AssistantPanel[\s\S]*?open=\{assistantOpen\}[\s\S]*?apply=\{applyAssistantLayout\}/);
 assert.match(panel,/aria-label=\{t\('aiAssistant'\)\}/);
 assert.match(panel,/assistant-mention-picker/);
 assert.match(panel,/assistantWorkspaceContext\(/);
 assert.match(panel,/assistantRequestLimitError\(input,trayItems\)/);
 assert.match(panel,/t\('assistantOpenSavedAppsConfirm'\)/);
 assert.match(app,/trayItems=\{assistantTrayItems\(state\.presets,workspace\.groups\)\}/);
 assert.match(panel,/aria-label=\{t\('aiModel'\)\}/);
 assert.doesNotMatch(panel,/assistant-modes|Read widget|Arrange layout/);
 assert.match(widgets,/still-open-assistant/);
 for(const command of ['assistant_configured','assistant_models','assistant_set_key','assistant_chat','assistant_key_setup']){
  assert.ok(native.includes('assistant::'+command),command+' is registered in Tauri');
  assert.ok(capabilities.includes('allow-'+command.replaceAll('_','-')),command+' is allowed on the local UI capability');
 }
});
test('AI assistant offers Gemini, OpenAI, OpenCode Go, and DeepSeek providers',()=>{
 const protocol=readFileSync(new URL('../src-tauri/src/assistant_protocol.rs',import.meta.url),'utf8');
 const backend=readFileSync(new URL('../src-tauri/src/assistant.rs',import.meta.url),'utf8');
 assert.match(panel,/PROVIDERS:AssistantProvider\[\]=\['gemini','openai','opencode','deepseek','chatgpt'\]/);
 assert.match(protocol,/pub enum Provider \{ Gemini, Openai, Opencode, Deepseek \}/);
 assert.match(protocol,/pub fn openai_body/);
 assert.match(backend,/https:\/\/api\.openai\.com\/v1\/chat\/completions/);
 assert.match(backend,/OPENAI_API_KEY/);
 assert.match(panel,/OpenCode Go/);
 assert.match(backend,/OPENCODE_API_KEY/);
 assert.match(backend,/DEEPSEEK_API_KEY/);
 assert.ok(backend.includes('https://api.deepseek.com/chat/completions'));
 assert.ok(backend.includes('https://platform.deepseek.com/api_keys'));
 assert.match(panel,/deepseek:'DeepSeek'/);
 assert.match(backend,/https:\/\/opencode\.ai\/zen\/go\/v1\/models/);
 assert.match(backend,/https:\/\/opencode\.ai\/zen\/go\/v1\/chat\/completions/);
 assert.match(backend,/x-opencode-session/);
 assert.match(panel,/session_id:owner\.id/);
 assert.match(backend,/credential_store::load\(provider\)/,'saved keys load when Still starts');
 assert.match(backend,/credential_store::save\(provider,&key\)/,'connecting a key persists it');
 assert.match(backend,/credential_store::delete\(provider\)/,'Forget deletes the saved key');
 assert.match(panel,/t\('aiSecureKeyNotice'\)/);
 assert.match(protocol,/Never guess an edit when the requested change is vague/,'the model is told to clarify underspecified edits instead of inventing a change');
 assert.match(protocol,/visible Still workspace canvas, including visible app panels attached inside it/,'a shared image includes attached app panels but remains scoped to the workspace canvas');
 assert.match(protocol,/The image does not authorize changes by itself/,'visual context never authorizes workspace edits by itself');
});
test('clear-all intent is classified for the local clear callback, and bulk selection protects locked and running widgets',()=>{
 assert.equal(unsupportedAssistantRequest('clear all saved shortcuts from the tray'),'clear_tray');
 const workspace=createWorkspace('Study',[]),locked=createWidget('notes'),running=createWidget('aiCommand'),ordinary=createWidget('focus');
 locked.lockPluginEnabled=true;locked.locked=true;workspace.widgets=[locked,running,ordinary];
 const selection=assistantBulkRemovalSelection(workspace.widgets,running.id);
 assert.deepEqual(selection.preserved.map(widget=>widget.id),[locked.id,running.id]);
 assert.deepEqual(selection.removed.map(widget=>widget.id),[ordinary.id]);
 assert.equal(selection.removed.some(widget=>widget.lockPluginEnabled&&widget.locked),false);
});
test('local widget actions always record a nonempty receipt and repair old blank turns',()=>{
 assert.match(assistantDomain,/export function assistantAddedWidgetReceipt\(actions:AssistantAction\[\]\):string/,'adding widgets receives a named completion reply');
 assert.match(panel,/safeAssistantReceipt\(await act\(/,'empty future action replies cannot enter chat history');
 assert.match(panel,/prepareAssistantHistory\(messages\)/,'older blank replies are repaired before the next provider request');
});
test('a named removal resolves and applies only that widget after intent validation',()=>{
 const workspace=createWorkspace('Study',[]),notes=createWidget('notes'),focus=createWidget('focus');notes.title='Lab notes';workspace.widgets=[notes,focus];
 const prompt='remove Lab notes',actions=resolveDirectAssistantActions(prompt,workspace,[]);
 assert.deepEqual(actions,[{type:'remove_widget',ids:[notes.id]}]);
 validateAssistantActions(workspace,actions);validateAssistantActionIntent(prompt,workspace,actions);
 const removable=assistantBulkRemovalSelection(workspace.widgets).removed;
 const removedIds=new Set(removable.filter(widget=>actions[0].ids.includes(widget.id)).map(widget=>widget.id));
 const updated={...workspace,widgets:workspace.widgets.filter(widget=>!removedIds.has(widget.id))};
 assert.deepEqual(updated.widgets.map(widget=>widget.id),[focus.id]);
 assert.equal(workspace.widgets.length,2,'the original state remains untouched for Undo');
 const protocol=readFileSync(new URL('../src-tauri/src/assistant_protocol.rs',import.meta.url),'utf8');
 assert.match(protocol,/"remove_widget"/,'providers can return the bounded, ID-based remove action');
});
test('frontend and provider action catalogues agree',()=>{
 const protocol=readFileSync(new URL('../src-tauri/src/assistant_protocol.rs',import.meta.url),'utf8');
 const enums=protocol.match(/"type":\{"type":"STRING","enum":(\[[^\]]+\])/);
 assert.ok(enums,'the provider schema advertises explicit supported actions');
 assert.deepEqual(JSON.parse(enums[1]).sort(),[...ASSISTANT_ACTION_TYPES].sort());
});
