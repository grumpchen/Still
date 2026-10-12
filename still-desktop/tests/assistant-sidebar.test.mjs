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
 assert.match(panel,/aria-label="Gemini assistant"/);
 assert.match(widgets,/still-open-assistant/);
 for(const command of ['assistant_configured','assistant_models','assistant_set_key','assistant_chat','assistant_key_setup']){
  assert.ok(native.includes('assistant::'+command),command+' is registered in Tauri');
  assert.ok(capabilities.includes('allow-'+command.replaceAll('_','-')),command+' is allowed on the local UI capability');
 }
});
