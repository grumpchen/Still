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
});
