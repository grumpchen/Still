import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseGeneratedWidgetDefinition,parseGeneratedWidgetReply} from '../src/domain/generatedWidget.ts';
import {collectWidgetIntoGroup,createInitialState,createWidget,createWidgetFromGroupEntry,createWidgetFromPreset,duplicateWorkspace,parseState,restoreCollectedWidget,saveWidgetToGroup} from '../src/domain/workspaces.ts';
import {presetFromWidget} from '../src/domain/presets.ts';
import {addGeneratedResultNote} from '../src/domain/generatedWidgetNotes.ts';
import {widgetCatalog,widgetTypes} from '../src/domain/widgetCatalog.ts';
import {readFile} from 'node:fs/promises';

const definition={schemaVersion:1,title:'Lecture review',input:'text-file',action:{kind:'askAI',instruction:'Create five questions and an answer key from the supplied material.'},output:'review-note'};

test('generated component schema accepts the supported action and rejects unsafe or unknown definitions',()=>{
 assert.deepEqual(parseGeneratedWidgetDefinition(definition),definition);
 assert.deepEqual(parseGeneratedWidgetReply('```json\n'+JSON.stringify(definition)+'\n```'),definition);
 assert.throws(()=>parseGeneratedWidgetDefinition({...definition,schemaVersion:2}),/unsupported version/);
 assert.throws(()=>parseGeneratedWidgetDefinition({...definition,action:{kind:'runCommand',command:'whoami'}}),/supported input or output|supported AI instruction/);
 assert.throws(()=>parseGeneratedWidgetDefinition({...definition,action:{kind:'askAI',instruction:'x'.repeat(8001)}}),/8,000/);
 assert.throws(()=>parseGeneratedWidgetReply('not json'),/valid component/);
});

test('generated component definition survives workspace reload and workspace duplication independently',()=>{
 const state=createInitialState(),workspace=state.workspaces.find(item=>item.role==='dashboard'),widget=createWidget('generated');
 widget.title=definition.title;widget.generatedDefinition=definition;workspace.widgets.push(widget);
 const restored=parseState(JSON.stringify(state)).workspaces.find(item=>item.role==='dashboard').widgets.find(item=>item.id===widget.id);
 assert.deepEqual(restored.generatedDefinition,definition);
 const copy=duplicateWorkspace(workspace,'Generated copy'),copied=copy.widgets.find(item=>item.type==='generated');
 copied.generatedDefinition.action.instruction='Updated only in the copy';
 assert.equal(widget.generatedDefinition.action.instruction,definition.action.instruction);
});

test('generated component definitions survive Group shortcut and collected-widget round trips',()=>{
 const state=createInitialState(),workspace=state.workspaces.find(item=>item.role==='dashboard'),widget=createWidget('generated');
 widget.title=definition.title;widget.generatedDefinition=definition;workspace.widgets.push(widget);
 let saved=saveWidgetToGroup(workspace,widget);let restored=parseState(JSON.stringify({...state,workspaces:state.workspaces.map(item=>item.id===workspace.id?saved:item)})).workspaces.find(item=>item.id===workspace.id);
 let shortcut=createWidgetFromGroupEntry(restored.groups[0].widgets[0],[]);assert.deepEqual(shortcut.generatedDefinition,definition);
 const collected=collectWidgetIntoGroup(restored,widget.id);const entry=collected.groups.flatMap(group=>group.widgets).find(item=>item.kind==='collected');
 const returned=restoreCollectedWidget(collected,entry.id);assert.deepEqual(returned.widgets.find(item=>item.id===widget.id).generatedDefinition,definition);
});

test('generated component definition survives a tray preset round trip',()=>{
 const widget=createWidget('generated');widget.title=definition.title;widget.generatedDefinition=definition;widget.text='A reusable lecture processing component';
 const preset=presetFromWidget(widget),restored=createWidgetFromPreset(preset,[]);
 assert.deepEqual(restored.generatedDefinition,definition);assert.equal(restored.text,widget.text);
});

test('malformed generated definition leaves its card editable instead of discarding the workspace',()=>{
 const state=createInitialState(),workspace=state.workspaces.find(item=>item.role==='dashboard'),widget=createWidget('generated');
 widget.generatedDefinition={...definition,schemaVersion:999};workspace.widgets.push(widget);
 const restored=parseState(JSON.stringify(state)).workspaces.find(item=>item.id===workspace.id);
 assert.ok(restored);assert.equal(restored.widgets.find(item=>item.id===widget.id).generatedDefinition,undefined);
});

test('AI Component is in the gallery and generation and execution use the selected provider transport',async()=>{
 assert.ok(widgetTypes.includes('generated'));assert.equal(widgetCatalog.generated.name,'AI Component');
 const widgetSource=await readFile(new URL('../src/GeneratedWidget.tsx',import.meta.url),'utf8');
 const assistantSource=await readFile(new URL('../src/AssistantPanel.tsx',import.meta.url),'utf8'),transportSource=await readFile(new URL('../src/platform/assistant.ts',import.meta.url),'utf8');
 assert.match(widgetSource,/still-generate-widget-definition/);assert.match(widgetSource,/still-run-generated-widget/);assert.match(widgetSource,/MAX_SOURCE_CHARS=12000/);
 assert.match(assistantSource,/addEventListener\('still-generate-widget-definition'/);assert.match(assistantSource,/addEventListener\('still-run-generated-widget'/);assert.match(transportSource,/geminiAssistant\.send\(\{provider,model/);
});

test('saving a generated result creates a new local Notes document without overwriting existing notes',()=>{
 const state=createInitialState(),workspace=state.workspaces.find(item=>item.role==='dashboard'),generated=createWidget('generated'),notes=workspace.widgets.find(item=>item.type==='notes'),oldText=notes.noteDocuments[0].text;
 generated.title=definition.title;workspace.widgets.push(generated);
 const saved=addGeneratedResultNote(workspace,generated.id,notes.id,'Lecture review result','Five questions and answers.');
 const target=saved.workspace.widgets.find(item=>item.id===notes.id);
 assert.equal(target.noteDocuments.length,notes.noteDocuments.length+1);assert.equal(target.noteDocuments.find(item=>item.id===saved.noteId).text,'Five questions and answers.');
 assert.equal(target.noteDocuments[0].text,oldText);assert.equal(target.activeNoteDocumentId,saved.noteId);assert.equal(notes.noteDocuments.length+1,target.noteDocuments.length);
 const nextState={...state,workspaces:state.workspaces.map(item=>item.id===workspace.id?saved.workspace:item)},roundTrip=parseState(JSON.stringify(nextState)).workspaces.find(item=>item.id===workspace.id).widgets.find(item=>item.id===notes.id);
 assert.equal(roundTrip.noteDocuments.find(item=>item.id===saved.noteId).text,'Five questions and answers.');
});

test('generated result saving rejects stale targets, folder-connected Notes, and full note widgets',()=>{
 const state=createInitialState(),workspace=state.workspaces.find(item=>item.role==='dashboard'),generated=createWidget('generated'),notes=workspace.widgets.find(item=>item.type==='notes');workspace.widgets.push(generated);
 assert.throws(()=>addGeneratedResultNote(workspace,generated.id,'missing','Result','Text'),/generatedWidgetSaveTargetMissing/);
 const libraryNotes={...notes,notesLibraryKey:'folder-grant'};workspace.widgets=workspace.widgets.map(item=>item.id===notes.id?libraryNotes:item);
 assert.throws(()=>addGeneratedResultNote(workspace,generated.id,notes.id,'Result','Text'),/generatedWidgetSaveFolderNotes/);
 const fullNotes={...libraryNotes,notesLibraryKey:null,noteDocuments:Array.from({length:40},(_,index)=>({id:`note-${index}`,title:'Note',text:''}))};workspace.widgets=workspace.widgets.map(item=>item.id===notes.id?fullNotes:item);
 assert.throws(()=>addGeneratedResultNote(workspace,generated.id,notes.id,'Result','Text'),/generatedWidgetSaveNoteLimit/);
});

test('the app validates the active workspace and persists the note before showing the save result',async()=>{
 const appSource=await readFile(new URL('../src/App.tsx',import.meta.url),'utf8');
 assert.match(appSource,/current\.activeId!==workspaceId/);
 assert.match(appSource,/if\(!persistNow\.current\(next\)\)throw new Error\(translate\(current\.locale,'generatedWidgetSaveStorageFailed'\)\)/);
 assert.ok(appSource.indexOf('if(!persistNow.current(next))')<appSource.indexOf('setState(next)'));
});
