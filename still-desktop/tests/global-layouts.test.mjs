import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cloneGlobalWorkspaceLayout,createInitialState,createGlobalWorkspaceLayout,createWidget,createWorkspace,parseState} from '../src/domain/workspaces.ts';

test('global layouts preserve complete data and settings, remap cloned identities, reuse Files roots, pause timers, and keep Apps closed',()=>{
 const state=createInitialState(),source=state.workspaces.find(item=>item.role==='study'),target=createWorkspace('Target',['notes']);assert.ok(source);
 const file=createWidget('files');file.folderName='Chemistry';source.widgets.push(file);
 const focus=source.widgets.find(item=>item.type==='focus');assert.ok(focus);focus.end=Date.now()+60_000;focus.remaining=12;
 const notes=source.widgets.find(item=>item.type==='notes');assert.ok(notes);const noteId=notes.activeNoteDocumentId;
 const groupCard=createWidget('group');groupCard.groupId='layout-group';source.widgets.push(groupCard);source.groups.push({id:'layout-group',name:'Resources',shortcuts:[{id:'link',name:'Course',url:'https://example.com',icon:'↗'}],widgets:[],expanded:false});
 state.appearance='minimal';state.theme='dark';state.glass={...state.glass,backgroundEffect:'line-waves'};
 const template=createGlobalWorkspaceLayout('Chemistry setup',source,state),restored=parseState(JSON.stringify({...state,globalLayouts:[template]})),saved=restored.globalLayouts[0];
 assert.equal(saved.settings.appearance,'minimal');assert.equal(saved.settings.theme,'dark');assert.equal(saved.widgets.find(item=>item.id===focus.id).end,null);assert.ok(saved.widgets.find(item=>item.id===focus.id).remaining>=59);
 const apps=createWidget('apps');apps.appKey='app-key';apps.appPanelOpen=true;const sourceWithApp={...source,widgets:[...source.widgets,apps]};const appLayout=createGlobalWorkspaceLayout('Apps',sourceWithApp,state);
 const appended=cloneGlobalWorkspaceLayout(appLayout,target,'append',1440,1000),clonedFile=appended.widgets.find(item=>item.type==='files'),clonedNotes=appended.widgets.find(item=>item.type==='notes'),clonedFocus=appended.widgets.find(item=>item.type==='focus'),clonedApp=appended.widgets.find(item=>item.type==='apps');
 assert.ok(appended.widgets.some(item=>item.id===target.widgets[0].id),'append keeps existing widget instances');assert.notEqual(clonedFile.id,file.id);assert.equal(clonedFile.folderKey,file.id,'folder copies retain the original native grant source');assert.notEqual(clonedNotes.activeNoteDocumentId,noteId);assert.equal(clonedNotes.noteDocuments[0].id,clonedNotes.activeNoteDocumentId);assert.equal(clonedFocus.end,null);assert.equal(clonedApp.appPanelOpen,false);
 const replaced=cloneGlobalWorkspaceLayout(template,target,'replace');assert.equal(replaced.name,target.name);assert.equal(replaced.role,target.role);assert.equal(replaced.widgets.some(item=>item.id===target.widgets[0].id),false);assert.ok(replaced.widgets.length>0);
});

test('state migration defaults global layouts to empty and keeps explicit layout references valid',()=>{
 const state=createInitialState();assert.deepEqual(state.globalLayouts,[]);const parsed=parseState(JSON.stringify({...state,globalLayouts:[{id:'bad',name:'Bad',widgets:[{type:'notes',text:'x'}]}]}));assert.deepEqual(parsed.globalLayouts,[]);
});

test('Dashboard templates capture only visible modules with live geometry and apply that visible layout',()=>{
 const state=createInitialState(),dashboard=state.workspaces.find(item=>item.role==='dashboard'),hidden=createWidget('notes'),visible=dashboard.widgets.find(item=>item.type==='calendar');assert.ok(dashboard&&visible);dashboard.widgets.push(hidden);dashboard.dashboardLayout={order:[visible.id],sizes:{[visible.id]:{width:612,height:434}}};
 const template=createGlobalWorkspaceLayout('Dashboard visible',dashboard,state,{widgetIds:[visible.id],dashboardLayout:dashboard.dashboardLayout,placements:{[visible.id]:{x:31,y:42,width:612,height:434}}});assert.deepEqual(template.widgets.map(item=>item.id),[visible.id]);assert.deepEqual(template.widgets[0].placement,{x:31,y:42,width:612,height:434});assert.equal(dashboard.widgets.some(item=>item.id===hidden.id),true);
 const otherDashboard=createWorkspace('Dashboard copy',['notes'],'dashboard'),preserved=otherDashboard.widgets.find(item=>item.type==='notes'),applied=cloneGlobalWorkspaceLayout(template,otherDashboard,'replace');assert.ok(applied.widgets.some(item=>item.id===preserved.id),'replace preserves hidden Dashboard data');assert.deepEqual(applied.dashboardLayout?.order,[applied.widgets.find(item=>item.type==='calendar')?.id]);assert.deepEqual(applied.dashboardLayout?.sizes[applied.dashboardLayout.order[0]],{width:612,height:434});
});

test('global layout note copies detach external Markdown paths and library grants',()=>{
 const state=createInitialState(),source=state.workspaces.find(item=>item.role==='study'),notes=source.widgets.find(item=>item.type==='notes');assert.ok(notes);notes.notesLibraryKey='notes-root';notes.notesLibraryName='Course notes';notes.noteDocuments=[{...notes.noteDocuments[0],sourcePath:'unit-1.md',text:'Original linked file contents',tags:['exam']}];
 const template=createGlobalWorkspaceLayout('Detached notes',source,state),saved=template.widgets.find(item=>item.id===notes.id);assert.ok(saved);assert.equal(saved.noteDocuments[0].sourcePath,undefined);assert.equal(saved.notesLibraryKey,null);assert.equal(saved.notesLibraryName,undefined);assert.equal(saved.noteDocuments[0].text,'Original linked file contents');assert.equal(notes.noteDocuments[0].sourcePath,'unit-1.md');
});

test('global layout parser retains valid existing layouts above the creation cap',()=>{
 const state=createInitialState(),source=state.workspaces.find(item=>item.role==='study'),layouts=Array.from({length:30},(_,index)=>createGlobalWorkspaceLayout(`Layout ${index}`,source,state));assert.equal(parseState(JSON.stringify({...state,globalLayouts:layouts})).globalLayouts.length,30);
});
