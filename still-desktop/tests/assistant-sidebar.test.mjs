import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ASSISTANT_ACTION_TYPES,parseAssistantReply} from '../src/domain/assistant.ts';
import {widgetCatalog,workspaceWidgetTypes} from '../src/domain/widgetCatalog.ts';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const panel=readFileSync(new URL('../src/AssistantPanel.tsx',import.meta.url),'utf8');
const widgets=readFileSync(new URL('../src/widgets.tsx',import.meta.url),'utf8');
const assistantDomain=readFileSync(new URL('../src/domain/assistant.ts',import.meta.url),'utf8');
const native=readFileSync(new URL('../src-tauri/src/main.rs',import.meta.url),'utf8');
const capabilities=readFileSync(new URL('../src-tauri/capabilities/main.json',import.meta.url),'utf8');
const nativeAgent=readFileSync(new URL('../src-tauri/src/assistant_agent_protocol.rs',import.meta.url),'utf8');

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
test('AI assistant preserves the Gemini, OpenAI and OpenCode API routes plus Codex subscription',()=>{
 const protocol=readFileSync(new URL('../src-tauri/src/assistant_protocol.rs',import.meta.url),'utf8');
 const backend=readFileSync(new URL('../src-tauri/src/assistant.rs',import.meta.url),'utf8');
 assert.match(panel,/PROVIDERS:AssistantProvider\[\]=\['gemini','openai','opencode','chatgpt'\]/);
 assert.match(protocol,/pub enum Provider \{ Gemini, Openai, Opencode \}/,'Codex subscription requests use their separate native transport instead of the API-key enum');
 assert.match(protocol,/pub fn openai_body/);
 assert.match(backend,/https:\/\/api\.openai\.com\/v1\/chat\/completions/);
 assert.match(backend,/OPENAI_API_KEY/);
 assert.match(panel,/OpenCode Go/);
 assert.match(backend,/OPENCODE_API_KEY/);
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
 assert.match(protocol,/image alone is not permission to change anything/,'visual context never authorizes workspace edits by itself');
});
test('clear all-widget actions are resolved locally before any model request',()=>{
 assert.match(panel,/directActions=libraryOrganisationContext\?null:resolveDirectAssistantActions\(input,workspace,selectedIds,trayItems,workspaces\)/);
 assert.ok(panel.indexOf('if(localActions){')<panel.indexOf('geminiAssistant.send('),'deterministic workspace actions must not depend on model output');
 assert.match(panel,/!directActions&&!confirmationRequest&&!directTimerRequest&&\(!configured\|\|!currentModels\.includes\(model\)\|\|!geminiAssistant\.available\)/,'local actions remain available without AI credentials');
 assert.match(panel,/result\.layout\.length&&assistantLayoutRequested\(prompt\)/,'only explicit layout requests may show a layout proposal');
 assert.match(panel,/needsConfirmation==='delete_workspace'\?t\('assistantDeleteWorkspaceConfirm'\)/);
 assert.match(panel,/confirmation==='delete_workspace'\?'confirmDeleteWorkspaceTitle'/);
 assert.match(panel,/confirmation==='delete_widgets'\?'confirmDeleteWidgetsTitle'/);
 assert.match(panel,/t\('assistantRemoveWidgetsConfirm'\)/);
 assert.match(panel,/deleteWidgets\(owner\.id\)/);
 assert.match(panel,/history=settleAssistantConfirmation\(base,receipt\)/,'the saved confirmation receipt replaces the pending reply before recovery is cleared');
 assert.match(app,/clearTray=\{clearAssistantTray\}/);
 assert.match(app,/deleteWidgets=\{deleteAssistantWidgets\}/);
 assert.match(app,/deleteWorkspace=\{deleteAssistantWorkspace\}/);
 assert.match(app,/widgets:\[\]/,'bulk widget removal clears canvas cards without clearing saved tray groups');
 assert.match(app,/undo\.current=current;[\s\S]*presets:\[\],workspaces:/,'tray clearing records state for Undo');
});
test('local widget actions always record a nonempty receipt and repair old blank turns',()=>{
 assert.match(assistantDomain,/export function assistantAddedWidgetReceipt\(actions:AssistantAction\[\]\):string/,'adding widgets receives a named completion reply');
 assert.match(panel,/safeAssistantReceipt\(await act\(/,'empty future action replies cannot enter chat history');
 assert.match(panel,/prepareAssistantHistory\(messages\)/,'older blank replies are repaired before the next provider request');
});
test('removing named widgets requires confirmation and applies only the selected IDs',()=>{
 assert.match(panel,/setConfirmation\('remove_widgets'\)/);
 assert.match(app,/action\.type==='remove_widget'/);
 assert.match(app,/removedIds\.includes\(widget\.id\)/);
 assert.match(app,/Undo change restores the widget/);
 const protocol=readFileSync(new URL('../src-tauri/src/assistant_protocol.rs',import.meta.url),'utf8');
 assert.match(protocol,/"remove_widget"/,'providers can return the bounded, ID-based remove action');
});
test('frontend and provider action catalogues agree',()=>{
 const protocol=readFileSync(new URL('../src-tauri/src/assistant_protocol.rs',import.meta.url),'utf8');
 const enums=protocol.match(/"type":\{"type":"STRING","enum":(\[[^\]]+\])/);
 assert.ok(enums,'the provider schema advertises explicit supported actions');
 assert.deepEqual(JSON.parse(enums[1]).sort(),[...ASSISTANT_ACTION_TYPES].sort());
 assert.throws(()=>parseAssistantReply({intent:'workspace_action',reply:'Move the note',layout:[],actions:[{type:'set_widget_geometry',ids:['notes-1'],operation:'move',x:100,y:80}]}),/invalid workspace action/);
});
test('agent add-widget schemas and validation match the workspace catalog',()=>{
 const validator=nativeAgent.match(/fn is_catalog_widget_type\(value: &str\) -> bool \{\s*matches!\(value, ([^)]*)\)/);
 assert.ok(validator,'the native agent validates catalog widget types explicitly');
 const nativeTypes=[...validator[1].matchAll(/"([A-Za-z0-9]+)"/g)].map(match=>match[1]);
 assert.deepEqual(nativeTypes,workspaceWidgetTypes,'native validation rejects no supported widget and adds no unsupported widget');
 const schemas=[...nativeAgent.matchAll(/"widgetType":\{"type":"(?:STRING|string)","enum":(\[[^\]]+\])/g)].map(match=>JSON.parse(match[1]));
 assert.ok(schemas.length>=2,'both provider tool schemas enumerate widget types');
 for(const schemaTypes of schemas)assert.deepEqual(schemaTypes,workspaceWidgetTypes);
 assert.equal(widgetCatalog.notes.name,'Files','the combined Notes and Files widget retains its user-facing name');
 assert.equal(workspaceWidgetTypes.includes('files'),false,'the retired standalone Files type is not offered as a new widget');
});
