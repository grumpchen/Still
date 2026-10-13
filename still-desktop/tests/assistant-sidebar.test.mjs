import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const panel=readFileSync(new URL('../src/AssistantPanel.tsx',import.meta.url),'utf8');
const widgets=readFileSync(new URL('../src/widgets.tsx',import.meta.url),'utf8');
const native=readFileSync(new URL('../src-tauri/src/main.rs',import.meta.url),'utf8');
const capabilities=readFileSync(new URL('../src-tauri/capabilities/main.json',import.meta.url),'utf8');

test('Gemini assistant is reachable from the sidebar and native commands are registered',()=>{
 assert.match(app,/title="AI assistant" aria-label="AI assistant"[\s\S]*?setAssistantOpen/);
 assert.match(app,/<AssistantPanel[\s\S]*?open=\{assistantOpen\}[\s\S]*?apply=\{applyAssistantLayout\}/);
 assert.match(panel,/aria-label="Still AI assistant"/);
 assert.match(panel,/assistant-mention-picker/);
 assert.match(panel,/assistantWorkspaceContext\(/);
 assert.match(panel,/assistantRequestLimitError\(input,trayItems\)/);
 assert.match(panel,/This will open saved app shortcuts in Still/);
 assert.match(app,/trayItems=\{assistantTrayItems\(state\.presets,workspace\.groups\)\}/);
 assert.match(panel,/aria-label="AI model"/);
 assert.doesNotMatch(panel,/assistant-modes|Read widget|Arrange layout/);
 assert.match(widgets,/still-open-assistant/);
 for(const command of ['assistant_configured','assistant_models','assistant_set_key','assistant_chat','assistant_key_setup']){
  assert.ok(native.includes('assistant::'+command),command+' is registered in Tauri');
  assert.ok(capabilities.includes('allow-'+command.replaceAll('_','-')),command+' is allowed on the local UI capability');
 }
});
test('AI assistant has one chat flow with Gemini and OpenAI providers',()=>{
 const protocol=readFileSync(new URL('../src-tauri/src/assistant_protocol.rs',import.meta.url),'utf8');
 const backend=readFileSync(new URL('../src-tauri/src/assistant.rs',import.meta.url),'utf8');
 assert.match(panel,/PROVIDERS:AssistantProvider\[\]=\['gemini','openai'\]/);
 assert.match(protocol,/pub enum Provider \{ Gemini, Openai \}/);
 assert.match(protocol,/pub fn openai_body/);
 assert.match(backend,/https:\/\/api\.openai\.com\/v1\/chat\/completions/);
 assert.match(backend,/OPENAI_API_KEY/);
 assert.match(backend,/credential_store::load\(provider\)/,'saved keys load when Still starts');
 assert.match(backend,/credential_store::save\(provider,&key\)/,'connecting a key persists it');
 assert.match(backend,/credential_store::delete\(provider\)/,'Forget deletes the saved key');
 assert.match(panel,/stored securely in Windows Credential Manager/);
});
test('clear all-widget actions are resolved locally before any model request',()=>{
 assert.match(panel,/resolveDirectAssistantActions\(input,workspace,selectedIds,trayItems\)/);
 assert.ok(panel.indexOf('if(localActions){')<panel.indexOf('geminiAssistant.send('),'deterministic workspace actions must not depend on model output');
 assert.match(panel,/!directActions&&!confirmationRequest&&!directTimerRequest&&\(!configured\|\|!currentModels\.includes\(model\)\|\|!geminiAssistant\.available\)/,'local actions remain available without AI credentials');
 assert.match(panel,/result\.layout\.length&&assistantLayoutRequested\(prompt\)/,'only explicit layout requests may show a layout proposal');
 assert.match(panel,/confirmation==='clear_tray'\?'Clear saved tray items\?':confirmation==='delete_widgets'\?'Remove all workspace widgets\?':confirmation==='remove_widgets'\?'Remove selected widgets\?':'Open saved app shortcuts\?'/);
 assert.match(panel,/confirmation==='open_saved_apps'\?'Confirm open':'Confirm remove'/);
 assert.match(panel,/Confirm removing workspace widgets/);
 assert.match(panel,/deleteWidgets\(owner\.id\)/);
 assert.match(panel,/settleAssistantConfirmation\(current,receipt\)/,'confirmation result replaces the pending reply instead of breaking chat turn order');
 assert.match(app,/clearTray=\{clearAssistantTray\}/);
 assert.match(app,/deleteWidgets=\{deleteAssistantWidgets\}/);
 assert.match(app,/widgets:\[\]/,'bulk widget removal clears canvas cards without clearing saved tray groups');
 assert.match(app,/undo\.current=current;[\s\S]*presets:\[\],workspaces:/,'tray clearing records state for Undo');
});
test('local widget actions always record a nonempty receipt and repair old blank turns',()=>{
 assert.match(app,/assistantAddedWidgetReceipt\(actions\)/,'adding widgets receives a named completion reply');
 assert.match(panel,/safeAssistantReceipt\(await act\(/,'empty future action replies cannot enter chat history');
 assert.match(panel,/prepareAssistantHistory\(messages\)/,'older blank replies are repaired before the next provider request');
});
test('removing named widgets requires confirmation and applies only the selected IDs',()=>{
 assert.match(panel,/setConfirmation\('remove_widgets'\)/);
 assert.match(panel,/confirmation==='open_saved_apps'\|\|confirmation==='remove_widgets'\)\&\&pendingActions\.current/);
 assert.match(app,/action\.type==='remove_widget'/);
 assert.match(app,/removedIds\.includes\(widget\.id\)/);
 assert.match(app,/Undo change restores the widget/);
 const protocol=readFileSync(new URL('../src-tauri/src/assistant_protocol.rs',import.meta.url),'utf8');
 assert.match(protocol,/"remove_widget"/,'providers can return the bounded, ID-based remove action');
});
