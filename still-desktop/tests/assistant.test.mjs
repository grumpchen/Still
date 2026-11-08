import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assistantEditTargetsUnchanged,assistantWidgetPluginClarification,assistantCourseAutoOpenClarification,assistantCourseEnvironmentClarification,assistantRemovedControlReply} from '../src/domain/assistant.ts';
import {assistantResizeClarification,validateAssistantLayoutIntent} from '../src/domain/assistant.ts';
import {createWidget,createWorkspace} from '../src/domain/workspaces.ts';
import {workspaceWidgetTypes} from '../src/domain/widgetCatalog.ts';
import {assistantActionRequest,assistantCreationClarification,assistantEditClarification,assistantMoveClarification,assistantNoteDocumentClarification,assistantNoteStyleClarification,assistantNoteTagClarification,assistantShortcutClarification,assistantTimerControlClarification,assistantReplyNeedsClarification,assistantLayoutRequested,assistantRequestLimitError,assistantTrayItems,unsupportedAssistantRequest,extractAssistantTimerSeconds,resolveAssistantSetting,assistantWorkspaceClarification,resolveDirectAssistantActions,resolveAcceptedNotesOffer,addFocusForAssistantTimer,settleAssistantConfirmation,assistantKeyError,assistantWorkspaceContext,preferredModel,widgetContext,layoutContext,layoutFingerprint,parseAssistantReply,validateAssistantActionIntent,validateAssistantActions,applyAssistantWidgetActions,updateAssistantShortcut,validateLayout,applyLayoutPlan,prepareAssistantHistory,assistantAddedWidgetReceipt,safeAssistantReceipt,MAX_ASSISTANT_BATCH,MAX_ASSISTANT_WIDGETS} from '../src/domain/assistant.ts';

function fixture(){
  const workspace=createWorkspace('Study',[]),note=createWidget('notes'),timer=createWidget('focus');
  note.placement={x:0,y:0,width:300,height:250};timer.placement={x:330,y:0,width:300,height:350};workspace.widgets=[note,timer];
  const items=workspace.widgets.map(w=>({id:w.id,...w.placement}));
  return {workspace,items};
}
test('Still AI can show or hide only the sidebar or bottom Apps bar',()=>{
 const {workspace}=fixture();
 for(const [prompt,id,enabled] of [['hide the sidebar','sidebar',false],['show the sidebar','sidebar',true],['hide the bottom Apps bar','apps-bar',false],['show the Apps bar','apps-bar',true]]){
  const expected=[{type:'set_ui_visibility',ids:[id],enabled}];
  assert.deepEqual(assistantActionRequest(prompt),['set_ui_visibility']);
  assert.deepEqual(resolveDirectAssistantActions(prompt,workspace,[]),expected);
  validateAssistantActions(workspace,expected);validateAssistantActionIntent(prompt,workspace,expected);
  assert.equal(applyAssistantWidgetActions(workspace,expected,900,700),workspace);
 }
 assert.deepEqual(assistantActionRequest('hide the Windows taskbar'),[]);
 assert.throws(()=>validateAssistantActionIntent('hide the sidebar',workspace,[{type:'set_ui_visibility',ids:['apps-bar'],enabled:false}]),/did not match your request/);
 assert.throws(()=>validateAssistantActions(workspace,[{type:'set_ui_visibility',ids:['sidebar','apps-bar'],enabled:false}]),/Choose the Still sidebar or Apps bar/);
});
test('reviewed widget geometry changes one current regular widget and respects limits and fixed pages',()=>{
 const {workspace}=fixture(),note=workspace.widgets[0],move={type:'set_widget_geometry',ids:[note.id],operation:'move',x:120,y:90};
 validateAssistantActions(workspace,[move]);
 const moved=applyAssistantWidgetActions(workspace,[move],900,700).widgets.find(widget=>widget.id===note.id);
 assert.deepEqual(moved.placement,{x:120,y:90,width:300,height:250});
 const resize={type:'set_widget_geometry',ids:[note.id],operation:'resize',width:500,height:400};
 validateAssistantActions(workspace,[resize]);
 assert.deepEqual(applyAssistantWidgetActions(workspace,[resize],900,700).widgets.find(widget=>widget.id===note.id).placement,{x:0,y:0,width:500,height:400});
 assert.throws(()=>validateAssistantActions(workspace,[{...resize,width:100}]),/supported size limits/);
 assert.throws(()=>validateAssistantActions(workspace,[{...move,x:note.placement.x,y:note.placement.y}]),/matches the current widget geometry/);
 assert.throws(()=>validateAssistantActions(workspace,[{...move,ids:['missing-widget']}]),/current, regular canvas widget/);
 const dashboard=createWorkspace('Dashboard',[]);dashboard.role='dashboard';
 assert.throws(()=>validateAssistantActions(dashboard,[move]),/fixed widgets/);
});
test('minimize and restore requests resolve named, selected, and single unambiguous widgets locally',()=>{
 const {workspace}=fixture(),note=workspace.widgets[0],timer=workspace.widgets[1];
 const minimize=resolveDirectAssistantActions('minimize Notes',workspace,[]);
 assert.deepEqual(minimize,[{type:'minimize',ids:[note.id]}]);
 validateAssistantActions(workspace,minimize);validateAssistantActionIntent('minimize Notes',workspace,minimize);
 const minimized=applyAssistantWidgetActions(workspace,minimize,900,700),updated=minimized.widgets.find(widget=>widget.id===note.id);
 assert.equal(updated.minimized,true);
 const restore=resolveDirectAssistantActions('restore it',minimized,[note.id]);
 assert.deepEqual(restore,[{type:'restore',ids:[note.id]}]);
 validateAssistantActions(minimized,restore);validateAssistantActionIntent('restore it',minimized,restore,[],[],[note.id]);
 assert.equal(applyAssistantWidgetActions(minimized,restore,900,700).widgets.find(widget=>widget.id===note.id).minimized,false);
 assert.deepEqual(resolveDirectAssistantActions('minimize it',workspace,[note.id]),[{type:'minimize',ids:[note.id]}]);
 const only=createWorkspace('One widget',[]);only.widgets=[timer];assert.deepEqual(resolveDirectAssistantActions('minimize the widget',only,[]),[{type:'minimize',ids:[timer.id]}]);
 assert.throws(()=>validateAssistantActionIntent('minimize Notes',workspace,[{type:'minimize',ids:[timer.id]}]),/did not match your request/);
});
test('accepting an offer to create a Notes widget adds the exact previous user text locally',()=>{
  const {workspace}=fixture(),messages=[{role:'user',text:'I love chicken'},{role:'model',text:'I cannot add text to a Group widget. Would you like me to add a new Notes widget with that text instead?'}];
  const accepted=resolveAcceptedNotesOffer('yes',messages);
  assert.deepEqual(accepted,{action:{type:'add_widget',ids:['notes'],text:'I love chicken'},intent:'Add a Notes widget with the previous message text.'});
  assert.equal(resolveAcceptedNotesOffer('yes',[{role:'model',text:'Would you like to arrange the widgets?'}]),null);
  assert.equal(resolveAcceptedNotesOffer('tell me more',messages),null);
  validateAssistantActions(workspace,[accepted.action]);
  validateAssistantActionIntent(accepted.intent,workspace,[accepted.action]);
  assert.equal(applyAssistantWidgetActions(workspace,[accepted.action],900,700).widgets.at(-1).text,'I love chicken');
});
test('Still AI note edits update the active page so changes survive a workspace reload',()=>{
 const {workspace}=fixture(),note=workspace.widgets[0];
 const edited=applyAssistantWidgetActions(workspace,[{type:'edit_widget',ids:[note.id],title:'Kinetics',text:'Rate laws'}],900,700).widgets[0];
 assert.equal(edited.noteDocuments[0].title,'Kinetics');assert.equal(edited.noteDocuments[0].text,'Rate laws');
 const added=applyAssistantWidgetActions(workspace,[{type:'add_widget',ids:['notes'],title:'Equilibrium',text:'Le Chatelier'}],900,700).widgets.at(-1);
 assert.equal(added.noteDocuments[0].title,'Equilibrium');assert.equal(added.noteDocuments[0].text,'Le Chatelier');
});
test('Still AI can create bounded note documents inside a clearly targeted Notes widget',()=>{
 const {workspace}=fixture(),note=workspace.widgets[0],prompt='make two note files in Notes';
 assert.deepEqual(assistantActionRequest(prompt),['create_note_document']);
 assert.equal(assistantNoteDocumentClarification(prompt,workspace),null);
 const actions=[{type:'create_note_document',ids:[note.id],title:'Kinetics',text:'Reaction rates'},{type:'create_note_document',ids:[note.id],title:'Equilibrium',text:'Dynamic balance'}];
 validateAssistantActions(workspace,actions);validateAssistantActionIntent(prompt,workspace,actions);
 const next=applyAssistantWidgetActions(workspace,actions,900,700),updated=next.widgets.find(widget=>widget.id===note.id);
 assert.equal(updated.noteDocuments.length,3);assert.equal(updated.title,'Equilibrium');assert.equal(updated.text,'Dynamic balance');
 const openPrompt='open Kinetics note',openAction={type:'open_note_document',ids:[note.id,updated.noteDocuments.find(document=>document.title==='Kinetics').id]};
 assert.deepEqual(assistantActionRequest(openPrompt),['open_note_document']);assert.equal(assistantNoteDocumentClarification(openPrompt,next),null);
 validateAssistantActions(next,[openAction]);validateAssistantActionIntent(openPrompt,next,[openAction]);
 const reopened=applyAssistantWidgetActions(next,[openAction],900,700).widgets.find(widget=>widget.id===note.id);assert.equal(reopened.title,'Kinetics');assert.equal(reopened.text,'Reaction rates');
 assert.equal(assistantActionRequest('open the Notes widget').includes('open_note_document'),false);assert.equal(assistantActionRequest('open Notes library').includes('open_note_document'),false);
 assert.match(assistantNoteDocumentClarification('open Algebra note',next),/Which note should I open/);
 assert.match(assistantNoteDocumentClarification('open a note',next),/Which note should I open/);
 const combinedPrompt='make two note files in Notes and add a Focus widget',combined=[{type:'create_note_document',ids:[note.id],title:'One'},{type:'create_note_document',ids:[note.id],title:'Two'},{type:'add_widget',ids:['focus']}];
 assert.deepEqual(assistantActionRequest(combinedPrompt),['create_note_document','add_widget']);validateAssistantActionIntent(combinedPrompt,workspace,combined);
 assert.equal(assistantNoteDocumentClarification('make a note file in Notes',workspace,[note.id]),null);
 const second=createWidget('notes');second.title='Notes 2';workspace.widgets.push(second);
 assert.match(assistantNoteDocumentClarification('make a note file in Notes',workspace),/Which Notes widget/);
 assert.equal(assistantNoteDocumentClarification('make a note file in Notes',workspace,[second.id]),null);
 assert.throws(()=>validateAssistantActions(workspace,[{type:'create_note_document',ids:[workspace.widgets[1].id],title:'Bad target'}]),/inside a Notes widget/);
 const full=createWidget('notes');full.noteDocuments=Array.from({length:40},(_,index)=>({...full.noteDocuments[0],id:`doc-${index}`}));workspace.widgets.push(full);
 assert.match(assistantNoteDocumentClarification('make a note file in Notes 3',workspace,[full.id]),/already has 40 open documents/);
 assert.equal(assistantRequestLimitError('make eleven note files in Notes'), 'Still AI can create at most 10 note documents in one request. Nothing was changed.');
});
test('Still AI distinguishes a blank note document from a new Notes widget',()=>{
 const {workspace}=fixture(),note=workspace.widgets[0];
 const prompt='Create a blank note named Practice Plan in my Notes widget.';
 const action={type:'create_note_document',ids:[note.id],title:'Practice Plan'};
 assert.deepEqual(assistantActionRequest(prompt),['create_note_document']);
 validateAssistantActionIntent(prompt,workspace,[action]);
 assert.throws(()=>validateAssistantActionIntent(prompt,workspace,[{type:'add_widget',ids:['notes']}]),/every requested workspace action/);
 assert.deepEqual(assistantActionRequest('Create a blank Notes widget.'),['add_widget']);
});
test('Still AI closes only a clearly identified note tab and asks before an ambiguous close',()=>{
 const {workspace}=fixture(),note=workspace.widgets[0],created=applyAssistantWidgetActions(workspace,[
  {type:'create_note_document',ids:[note.id],title:'Kinetics',text:'Reaction rates'},
  {type:'create_note_document',ids:[note.id],title:'Equilibrium',text:'Dynamic balance'},
 ],900,700),kinetics=created.widgets[0].noteDocuments.find(document=>document.title==='Kinetics');
 const prompt='close Kinetics note',action={type:'close_note_document',ids:[note.id,kinetics.id]};
 assert.deepEqual(assistantActionRequest(prompt),['close_note_document'],'closing a note tab is never mistaken for deleting its widget');
 assert.equal(assistantNoteDocumentClarification(prompt,created),null);
 assert.deepEqual(resolveDirectAssistantActions(prompt,created,[]),[action]);
 validateAssistantActions(created,[action]);validateAssistantActionIntent(prompt,created,[action]);
 const next=applyAssistantWidgetActions(created,[action],900,700),updated=next.widgets[0];
 assert.equal(updated.noteDocuments.some(document=>document.id===kinetics.id),false);
 assert.equal(updated.noteDocuments.length,2);
 assert.equal(updated.title,'Equilibrium','closing an inactive tab leaves the selected tab untouched');
 assert.match(assistantNoteDocumentClarification('close a note tab',created),/Which note tab should I close/);
 assert.deepEqual(assistantActionRequest('close the current note'),['close_note_document']);
 const current=resolveDirectAssistantActions('close the current note',created,[]);
 assert.equal(current[0].ids[1],created.widgets[0].activeNoteDocumentId);
 validateAssistantActions(created,current);validateAssistantActionIntent('close the current note',created,current);
 assert.throws(()=>validateAssistantActionIntent('close the current note',created,[action]),/did not match your request/,'an inactive tab cannot stand in for the current tab');
 const other=createWidget('notes'),both={...created,widgets:[...created.widgets,other]};
 assert.throws(()=>validateAssistantActionIntent('close the current note',both,[current[0]]),/did not match your request/,'multiple Notes widgets need a target');
 validateAssistantActionIntent('close the current note',both,current,[],[],[note.id]);
 const second=createWidget('notes');second.title='Notes 2';workspace.widgets.push(second);
 assert.match(assistantNoteDocumentClarification(prompt,workspace),/Which Notes widget contains/);
 assert.throws(()=>validateAssistantActions(created,[{type:'close_note_document',ids:[note.id]}]),/one Notes widget and one existing note document/);
});
test('sharing a selected widget omits grants, URLs, bookmarks, and unrelated content',()=>{
  const note=createWidget('notes');note.text='Only this note';note.fileKey='secret-grant';note.url='https://example.org/private';
  assert.deepEqual(widgetContext(note),{type:'notes',title:'Files 1',tagColor:null,text:'Only this note',noteDocuments:[{id:note.noteDocuments[0].id,title:'',tags:[],active:true,libraryFile:false}]});
  const app=createWidget('apps');app.appKey='secret-app';assert.ok(!JSON.stringify(widgetContext(app)).includes('secret-app'));
  const {workspace}=fixture();workspace.widgets[0].text='private note';assert.ok(!JSON.stringify(layoutContext(workspace,900,700)).includes('private note'));
});
test('workspace context exposes current widget data; @ only marks quick selections',()=>{
  const {workspace}=fixture(),note=workspace.widgets[0],timer=workspace.widgets[1];note.text='private note';timer.remaining=88;
  note.tagColor='blue';timer.tagColor='green';
  const context=assistantWorkspaceContext(workspace,900,700,[note.id]);
  assert.equal(context.canvasAndWidgets.widgets.length,2);
  assert.deepEqual(context.canvasAndWidgets.widgets.map(widget=>widget.tagColor),['blue','green']);
  assert.deepEqual(context.widgetData,[{id:note.id,...widgetContext(note),quickSelected:true},{id:timer.id,...widgetContext(timer),quickSelected:false}]);
  assert.deepEqual(context.widgetData.map(widget=>widget.tagColor),['blue','green']);
  assert.equal(JSON.stringify(context.widgetData).includes('private note'),true);
  assert.ok(JSON.stringify(context.widgetData).includes(String(timer.remaining)));
  assert.equal(context.capabilities.contentEditingRequiresWidgetSelection,false);
  assert.ok(context.capabilities.plugins.tagStatus.includes('screenshot.settings'),'Still AI must be told about screenshot controls already supported by Tag Color Status');
  assert.equal(assistantWorkspaceContext(workspace,900,700,[note.id,note.id]).widgetData.filter(item=>item.quickSelected).length,1);
  assert.equal(assistantWorkspaceContext(workspace,900,700,workspace.widgets.map(widget=>widget.id)).widgetData.filter(item=>item.quickSelected).length,2);
});
test('large workspace context keeps the @-pointed data within the request budget',()=>{
  const {workspace}=fixture(),notes=Array.from({length:8},()=>{const note=createWidget('notes');note.text='n'.repeat(12000);return note;});
  workspace.widgets=notes;
  const context=assistantWorkspaceContext(workspace,900,700,[notes.at(-1).id]);
  assert.ok(JSON.stringify(context).length<=60000);
  assert.equal(context.widgetData.find(item=>item.id===notes.at(-1).id).text,'n'.repeat(12000));
  assert.ok(context.widgetData.some(item=>item.contentOmitted),'less relevant note bodies are trimmed when the provider context budget is tight');
});
test('widget content edits work from workspace data without an @ selection',()=>{
  const {workspace}=fixture(),note=workspace.widgets[0],action={type:'edit_widget',ids:[note.id],text:'Updated without an explicit selection'};
  validateAssistantActions(workspace,[action]);
  assert.doesNotThrow(()=>validateAssistantActionIntent('edit the Notes widget',workspace,[action]));
  assert.equal(applyAssistantWidgetActions(workspace,[action],900,700).widgets[0].text,action.text);
});
test('underspecified edits get a clarifying question before any widget action',()=>{
  assert.match(assistantEditClarification('edit the timetable'),/what.*change.*timetable/i);
  assert.match(assistantEditClarification('can you edit it?'),/what exact.*change/i);
  assert.match(assistantEditClarification('make the notes better'),/what.*change/i);
  assert.equal(assistantEditClarification('edit the timetable to add Chemistry on Monday at 9'),null);
  assert.equal(assistantEditClarification('change the Notes title to Revision'),null);
  assert.equal(assistantEditClarification('make a Notes widget'),null,'clear creation requests are not treated as vague edits');
  assert.equal(assistantEditClarification('how do I edit a timetable?'),null,'how-to questions stay ordinary chat');
  assert.equal(assistantReplyNeedsClarification('Which class should I add?'),true);
  assert.equal(assistantReplyNeedsClarification('I updated the timetable.'),false);
});
test('assistant receives only safe saved tray names and IDs and opens the actual selected items',()=>{
  const {workspace}=fixture(),presets=[{id:'preset-1',type:'notes',name:'Lecture notes'}],groups=[{id:'group-1',name:'Study set',shortcuts:[],widgets:[],expanded:false}];
  const tray=assistantTrayItems(presets,groups),context=assistantWorkspaceContext(workspace,900,700,[],tray);
  assert.deepEqual(tray,[{id:'preset-preset-1',name:'Lecture notes',type:'notes',kind:'preset'},{id:'group-group-1',name:'Study set',type:'group',kind:'group'}]);
  assert.deepEqual(context.savedTrayItems,tray);
  assert.deepEqual(resolveDirectAssistantActions('open all saved widgets',workspace,[],tray),[{type:'open_saved',ids:tray.map(item=>item.id)}]);
  assert.deepEqual(resolveDirectAssistantActions('open Lecture notes',workspace,[],tray),[{type:'open_saved',ids:['preset-preset-1']}]);
  assert.doesNotThrow(()=>validateAssistantActionIntent('open all saved widgets',workspace,[{type:'open_saved',ids:tray.map(item=>item.id)}],tray));
  assert.throws(()=>validateAssistantActionIntent('open 2 saved widgets',workspace,[{type:'open_saved',ids:['preset-preset-1']}],tray),/requested number/);
  assert.equal(applyAssistantWidgetActions(workspace,[{type:'open_saved',ids:['preset-preset-1']}],900,700,Date.now(),tray),workspace);
});
test('the assistant can rename the current workspace and manage built-in sidebar plugins safely',()=>{
  const {workspace}=fixture();
  const rename=resolveDirectAssistantActions('rename workspace to Revision',workspace,[]);
  assert.deepEqual(rename,[{type:'rename_workspace',ids:[workspace.id],title:'Revision'}]);
  assert.doesNotThrow(()=>validateAssistantActions(workspace,rename));
  assert.doesNotThrow(()=>validateAssistantActionIntent('rename workspace to Revision',workspace,rename));
  const plugin=resolveDirectAssistantActions('add Layout plugin',workspace,[]);
  assert.deepEqual(plugin,[{type:'set_sidebar_plugin',ids:['layout'],enabled:true}]);
  assert.doesNotThrow(()=>validateAssistantActions(workspace,plugin));
  assert.doesNotThrow(()=>validateAssistantActionIntent('add Layout plugin',workspace,plugin));
  const settings=resolveDirectAssistantActions('open plugin settings',workspace,[]);
  assert.deepEqual(settings,[{type:'open_settings',ids:['plugins']}]);
  assert.doesNotThrow(()=>validateAssistantActions(workspace,settings));
  assert.doesNotThrow(()=>validateAssistantActionIntent('open plugin settings',workspace,settings));
  const clock=resolveDirectAssistantActions('add Clock plugin to Notes',workspace,[workspace.widgets[0].id]);
  assert.deepEqual(clock,[{type:'set_widget_plugin',ids:[workspace.widgets[0].id],plugin:'clock-timer',enabled:true}]);
  assert.doesNotThrow(()=>validateAssistantActionIntent('add Clock plugin to Notes',workspace,clock));
  assert.equal(applyAssistantWidgetActions(workspace,clock,900,700).widgets[0].clockPluginEnabled,true);
  const lock=resolveDirectAssistantActions('add Lock plugin to Notes',workspace,[]);
  assert.deepEqual(lock,[{type:'set_widget_plugin',ids:[workspace.widgets[0].id],plugin:'lock',enabled:true,locked:true}]);
  assert.doesNotThrow(()=>validateAssistantActions(workspace,lock));
  assert.doesNotThrow(()=>validateAssistantActionIntent('add Lock plugin to Notes',workspace,lock));
  const locked=applyAssistantWidgetActions(workspace,lock,900,700).widgets[0];
  const another=createWidget('notes');another.instanceNumber=2;const multiple={...workspace,widgets:[...workspace.widgets,another]};
  assert.match(assistantWidgetPluginClarification('add Lock plugin to Notes',multiple,[]),/Which widget/);
  const second=resolveDirectAssistantActions('add Lock plugin to Notes 2',multiple,[]);assert.deepEqual(second[0].ids,[another.id]);
  validateAssistantActionIntent('add Lock plugin to Notes 2',multiple,second);
  assert.throws(()=>validateAssistantActionIntent('add Lock plugin to Notes 2',multiple,[{...second[0],ids:[another.id,workspace.widgets[1].id]}]),/did not match/);
  const selected=resolveDirectAssistantActions('add Lock plugin to Notes',multiple,[another.id]);assert.deepEqual(selected[0].ids,[another.id]);
  validateAssistantActionIntent('add Lock plugin to Notes',multiple,selected,[],[],[another.id]);
  assert.equal(resolveDirectAssistantActions('add Lock plugin to all widgets',multiple,[])[0].ids.length,multiple.widgets.length);
  const allNotes=resolveDirectAssistantActions('add Lock plugin to all Notes widgets',multiple,[]);assert.deepEqual(allNotes[0].ids,[workspace.widgets[0].id,another.id]);
  validateAssistantActionIntent('add Lock plugin to all Notes widgets',multiple,allNotes);
  assert.equal(locked.lockPluginEnabled,true);assert.equal(locked.locked,true);
  const unlock=resolveDirectAssistantActions('unlock Notes widget',workspace,[]);
  assert.deepEqual(unlock,[{type:'set_widget_plugin',ids:[workspace.widgets[0].id],plugin:'lock',enabled:true,locked:false}]);
  assert.doesNotThrow(()=>validateAssistantActionIntent('unlock Notes widget',workspace,unlock));
  assert.equal(applyAssistantWidgetActions({...workspace,widgets:[locked,workspace.widgets[1]]},unlock,900,700).widgets[0].locked,false);
  const removeLock=resolveDirectAssistantActions('remove Lock plugin from Notes',workspace,[]);
  assert.deepEqual(removeLock,[{type:'set_widget_plugin',ids:[workspace.widgets[0].id],plugin:'lock',enabled:false}]);
  assert.equal(applyAssistantWidgetActions({...workspace,widgets:[locked,workspace.widgets[1]]},removeLock,900,700).widgets[0].lockPluginEnabled,false);
  const parsedLock=parseAssistantReply({reply:'Locked Notes.',intent:'workspace_action',layout:[],actions:[{type:'set_widget_plugin',ids:[workspace.widgets[0].id],plugin:'lock',enabled:true,locked:true}]});
  assert.equal(parsedLock.actions[0].locked,true);
  assert.deepEqual(parseAssistantReply({reply:'',layout:[],actions:[{type:'set_sidebar_plugin',ids:['stack'],enabled:true}]}).actions,[{type:'set_sidebar_plugin',ids:['stack'],enabled:true}]);
  assert.throws(()=>validateAssistantActions(workspace,[{type:'set_sidebar_plugin',ids:['third-party-code'],enabled:true}]),/Stack or Layout/);
  assert.equal(unsupportedAssistantRequest('delete this workspace'),'delete_workspace');
});
test('Still AI controls one existing Focus or Clock timer and clarifies ambiguous targets',()=>{
 const {workspace}=fixture(),focus=workspace.widgets[1],pausePrompt='pause the timer',pause=[{type:'control_timer',ids:[focus.id],operation:'pause'}];
 focus.end=Date.now()+90_000;focus.remaining=150;
 assert.deepEqual(assistantActionRequest(pausePrompt),['control_timer']);
 assert.equal(assistantTimerControlClarification(pausePrompt,workspace),null);
 assert.deepEqual(resolveDirectAssistantActions(pausePrompt,workspace,[]),pause);
 validateAssistantActions(workspace,pause);validateAssistantActionIntent(pausePrompt,workspace,pause);
 const paused=applyAssistantWidgetActions(workspace,pause,900,700,Date.now()).widgets.find(widget=>widget.id===focus.id);
 assert.equal(paused.end,null);assert.ok(paused.remaining>=89&&paused.remaining<=90);
 const resumePrompt='resume Focus 1',resume=[{type:'control_timer',ids:[focus.id],operation:'resume'}];
 assert.deepEqual(resolveDirectAssistantActions(resumePrompt,{...workspace,widgets:[workspace.widgets[0],paused]},[]),resume);
 const resumed=applyAssistantWidgetActions({...workspace,widgets:[workspace.widgets[0],paused]},resume,900,700,1000).widgets.find(widget=>widget.id===focus.id);
 assert.equal(resumed.end,1000+paused.remaining*1000);
 const resetPrompt='reset the focus timer',reset=[{type:'control_timer',ids:[focus.id],operation:'reset'}];
 assert.deepEqual(resolveDirectAssistantActions(resetPrompt,workspace,[]),reset);
 const resetWidget=applyAssistantWidgetActions(workspace,reset,900,700,1000).widgets.find(widget=>widget.id===focus.id);
 assert.equal(resetWidget.end,null);assert.equal(resetWidget.remaining,1500);
 const second=createWidget('notes');second.title='Clock study';second.clockPluginEnabled=true;
 const multiple={...workspace,widgets:[...workspace.widgets,second]};
 assert.match(assistantTimerControlClarification('pause timer',multiple),/Which timer/);
 assert.deepEqual(resolveDirectAssistantActions('pause Clock study timer',multiple,[]),[{type:'control_timer',ids:[second.id],operation:'pause'}]);
 assert.throws(()=>validateAssistantActions(workspace,[{type:'control_timer',ids:[workspace.widgets[0].id],operation:'pause'}]),/Focus widget/);
 assert.throws(()=>validateAssistantActions(workspace,[{type:'control_timer',ids:[focus.id],operation:'launch'}]),/pause, resume, or reset/);
 assert.throws(()=>validateAssistantActionIntent('pause the timer',workspace,[{type:'control_timer',ids:[focus.id],operation:'resume'}]),/did not match/);
 const parsed=parseAssistantReply({reply:'Paused.',intent:'workspace_action',layout:[],actions:pause});assert.equal(parsed.actions[0].operation,'pause');
});
test('Still AI can change Notes font and size through the same bounded edit action',()=>{
 const {workspace}=fixture(),note=workspace.widgets[0],fontPrompt='change Notes font to serif',font=[{type:'edit_widget',ids:[note.id],noteFont:'serif'}];
 assert.deepEqual(assistantActionRequest(fontPrompt),['edit_widget']);assert.equal(assistantNoteStyleClarification(fontPrompt,workspace),null);
 assert.deepEqual(resolveDirectAssistantActions(fontPrompt,workspace,[]),font);validateAssistantActions(workspace,font);validateAssistantActionIntent(fontPrompt,workspace,font);
 const fontChanged=applyAssistantWidgetActions(workspace,font,900,700).widgets[0];assert.equal(fontChanged.noteFont,'serif');assert.equal(fontChanged.text,note.text);
 const sizePrompt='set Notes text size to 20px',size=[{type:'edit_widget',ids:[note.id],noteFontSize:20}];
 assert.deepEqual(resolveDirectAssistantActions(sizePrompt,workspace,[]),size);validateAssistantActionIntent(sizePrompt,workspace,size);
 const sizeChanged=applyAssistantWidgetActions(workspace,size,900,700).widgets[0];assert.equal(sizeChanged.noteFontSize,20);
 const relative=resolveDirectAssistantActions('make Notes text bigger',workspace,[]);assert.deepEqual(relative,[{type:'edit_widget',ids:[note.id],noteFontSize:16}]);
 assert.throws(()=>validateAssistantActions(workspace,[{type:'edit_widget',ids:[note.id],noteFontSize:22}]),/12px to 28px/);
 const second=createWidget('notes');second.title='Lecture notes';const multiple={...workspace,widgets:[...workspace.widgets,second]};assert.match(assistantNoteStyleClarification(fontPrompt,multiple),/Which Notes widget/);
 assert.throws(()=>validateAssistantActionIntent(fontPrompt,workspace,[{type:'edit_widget',ids:[note.id],noteFont:'mono'}]),/did not match/);
 const context=assistantWorkspaceContext(workspace,900,700,[]);assert.ok(context.capabilities.editableFields.notes.includes('noteFontSize'));
});
test('Still AI can add and remove tags on one exact Notes document',()=>{
 const {workspace}=fixture(),note=workspace.widgets[0],document=note.noteDocuments[0],addPrompt='add tag exam to Notes',add=[{type:'edit_widget',ids:[note.id],noteDocumentId:document.id,noteTags:['exam']}];
 assert.deepEqual(assistantActionRequest(addPrompt),['edit_widget']);assert.equal(assistantNoteTagClarification(addPrompt,workspace),null);
 assert.deepEqual(resolveDirectAssistantActions(addPrompt,workspace,[]),add);validateAssistantActions(workspace,add);validateAssistantActionIntent(addPrompt,workspace,add);
 const tagged=applyAssistantWidgetActions(workspace,add,900,700).widgets[0];assert.deepEqual(tagged.noteDocuments[0].tags,['exam']);
 const removePrompt='remove tag exam from Notes',remove=[{type:'edit_widget',ids:[note.id],noteDocumentId:document.id,noteTags:[]}];
 assert.deepEqual(resolveDirectAssistantActions(removePrompt,{...workspace,widgets:[tagged,workspace.widgets[1]]},[]),remove);
 const cleared=applyAssistantWidgetActions({...workspace,widgets:[tagged,workspace.widgets[1]]},remove,900,700).widgets[0];assert.deepEqual(cleared.noteDocuments[0].tags,[]);
 const multi=structuredClone(tagged);multi.noteDocuments[0].tags=['exam','lecture'];const withMultiple={...workspace,widgets:[multi,workspace.widgets[1]]};
 const removeOne=resolveDirectAssistantActions(removePrompt,withMultiple,[]);assert.deepEqual(removeOne[0].noteTags,['lecture']);
 validateAssistantActionIntent(removePrompt,withMultiple,removeOne);
 assert.deepEqual(applyAssistantWidgetActions(withMultiple,removeOne,900,700).widgets[0].noteDocuments[0].tags,['lecture']);
 assert.deepEqual(resolveDirectAssistantActions('clear all tags from Notes',withMultiple,[])[0].noteTags,[]);
 assert.throws(()=>validateAssistantActions(workspace,[{...add[0],noteDocumentId:'missing-note'}]),/no longer open/);
 assert.throws(()=>validateAssistantActions(workspace,[{...add[0],noteTags:Array.from({length:13},(_,i)=>`tag-${i}`)}]),/valid note tag/);
 const context=assistantWorkspaceContext(workspace,900,700,[]);assert.ok(context.capabilities.editableFields.notes.includes('noteTags'));
});
test('Still AI changes a bounded set of reversible app preferences and rejects unsupported settings',()=>{
 const {workspace}=fixture();
 for(const [prompt,value] of [['disable automatic course environments','off'],['turn on automatic course environments','on']]){
  const action=resolveDirectAssistantActions(prompt,workspace,[]);assert.deepEqual(action,[{type:'set_setting',ids:['autoOpenCourseEnvironments'],settingValue:value}]);validateAssistantActions(workspace,action);validateAssistantActionIntent(prompt,workspace,action);
 }
 assert.equal(resolveAssistantSetting('disable automatic course environments for Chemistry'),null,'a per-course request must not change the global setting');
 assert.deepEqual(assistantActionRequest("don't enable automatic course environments"),[]);
 assert.equal(resolveDirectAssistantActions("don't enable automatic course environments",workspace,[]),null);
 for(const [prompt,expected] of [['change theme to dark',{key:'theme',value:'dark'}],['set appearance to liquid glass',{key:'appearance',value:'liquid-glass'}],['make background transparent',{key:'background',value:'transparent'}],['set motion rate to 60 fps',{key:'canvasFrameRate',value:'60'}],['change language to English',{key:'locale',value:'en'}],['set glass opacity to 72 percent',{key:'glassOpacity',value:'72'}],['set the background effect to line waves',{key:'glassBackgroundEffect',value:'line-waves'}],['close attached apps when Still closes',{key:'appShutdownBehavior',value:'close'}],['enable launch at sign in',{key:'launchAtSignIn',value:'on'}],['disable launch at sign in',{key:'launchAtSignIn',value:'off'}],['set red screenshot plugin override to off',{key:'screenshotPluginOverride-red',value:'off'}],['set blue clock plugin to on',{key:'clockPluginColor-blue',value:'on'}],['disable the widget relaunch plugin',{key:'widgetRelaunchPluginStatus',value:'disabled'}]]){
  assert.deepEqual(resolveAssistantSetting(prompt),expected);
  const action=resolveDirectAssistantActions(prompt,workspace,[]);
  assert.deepEqual(action,[{type:'set_setting',ids:[expected.key],settingValue:expected.value}]);
  assert.doesNotThrow(()=>validateAssistantActions(workspace,action));
  assert.doesNotThrow(()=>validateAssistantActionIntent(prompt,workspace,action));
  assert.deepEqual(parseAssistantReply({reply:'Updated.',intent:'workspace_action',layout:[],actions:action}).actions,action);
 }
 assert.equal(resolveAssistantSetting('set the theme to neon'),null);
 assert.equal(resolveAssistantSetting('enable the relaunch button'),null);
 assert.match(assistantRemovedControlReply('enable the relaunch button'),/has been removed/);
 assert.throws(()=>validateAssistantActions(workspace,[{type:'set_setting',ids:['showWidgetRelaunchAction'],settingValue:'on'}]),/supported Still setting/);
 assert.equal(resolveDirectAssistantActions('change theme to dark and add a Notes widget',workspace,[]),null,'mixed operations are sent through the complete typed action path');
 assert.throws(()=>validateAssistantActions(workspace,[{type:'set_setting',ids:['startAtSignIn'],settingValue:'on'}]),/supported Still setting/);
 assert.throws(()=>validateAssistantActions(workspace,[{type:'set_setting',ids:['theme'],settingValue:'neon'}]),/supported Still setting/);
 assert.throws(()=>validateAssistantActionIntent('change theme to dark',workspace,[{type:'set_setting',ids:['theme'],settingValue:'light'}]),/did not match/);
 assert.deepEqual(assistantActionRequest('change theme to dark'),['set_setting']);
});
test('Still AI can create a named workspace with bounded starting widgets and asks when its name is missing',()=>{
 const {workspace}=fixture(),create=resolveDirectAssistantActions('create a workspace named Chemistry with Notes and Files',workspace,[]);
  assert.deepEqual(create,[{type:'create_workspace',ids:['notes'],title:'Chemistry'}]);
 assert.doesNotThrow(()=>validateAssistantActions(workspace,create));
 assert.doesNotThrow(()=>validateAssistantActionIntent('create a workspace named Chemistry with Notes and Files',workspace,create));
 assert.deepEqual(resolveDirectAssistantActions('create a blank workspace called Research',workspace,[]),[{type:'create_workspace',ids:[],title:'Research'}]);
 const blankWithWidgetWord=resolveDirectAssistantActions('create a blank workspace called Course Focus',workspace,[]);
 assert.deepEqual(blankWithWidgetWord,[{type:'create_workspace',ids:[],title:'Course Focus'}]);
 assert.doesNotThrow(()=>validateAssistantActionIntent('create a blank workspace called Course Focus',workspace,blankWithWidgetWord));
 assert.equal(assistantWorkspaceClarification('create a workspace'), 'What would you like to name the new workspace? I will leave it unchanged until you tell me.');
 assert.equal(assistantWorkspaceClarification('create a workspace named Chemistry'),null);
 assert.throws(()=>validateAssistantActions(workspace,[{type:'create_workspace',ids:['powershell'],title:'Chemistry'}]),/valid starting widgets/);
 assert.throws(()=>validateAssistantActionIntent('create a workspace named Chemistry',workspace,[{type:'create_workspace',ids:['notes'],title:'Physics'}]),/did not match/);
 const parsed=parseAssistantReply({reply:'Created.',intent:'workspace_action',layout:[],actions:[{type:'create_workspace',ids:[],title:'Research'}]});
 assert.deepEqual(parsed.actions,[{type:'create_workspace',ids:[],title:'Research'}]);
});
test('timetable assistant edits preserve linked environments and reject unknown links',()=>{
 const workspace=createWorkspace('Dashboard',[]),timetable=createWidget('timetable'),linked=createWorkspace('Course environment',[]);
 timetable.schedule=[{id:'chem-1',day:3,time:'13:00',title:'CHEM111',location:'Room 1',workspaceId:linked.id,autoOpen:false}];workspace.widgets.push(timetable);
 const replacement=[{id:'chem-1',day:3,time:'13:00',title:'CHEM111 lecture',location:'Room 2'}],action={type:'edit_widget',ids:[timetable.id],schedule:replacement};
 assert.doesNotThrow(()=>validateAssistantActions(workspace,[action],[],[{id:linked.id,name:linked.name}]));
 assert.throws(()=>validateAssistantActions(workspace,[{...action,schedule:[{...replacement[0],workspaceId:'missing-workspace'}]}],[],[{id:linked.id,name:linked.name}]),/existing Still workspace/);
 const edited=applyAssistantWidgetActions(workspace,[action],1200,800).widgets.find(widget=>widget.id===timetable.id).schedule[0];assert.equal(edited.workspaceId,linked.id);assert.equal(edited.autoOpen,false);
 const attemptedToggle={...action,schedule:[{...replacement[0],autoOpen:true}]};assert.equal(applyAssistantWidgetActions(workspace,[attemptedToggle],1200,800).widgets.find(widget=>widget.id===timetable.id).schedule[0].autoOpen,false);
 assert.throws(()=>validateAssistantActions(workspace,[{...action,schedule:[{...replacement[0],autoOpen:'false'}]}]),/Timetable edits/);
});
test('assistant links and unlinks one exact course environment without changing other courses',()=>{
 const workspace=createWorkspace('Study',[]),timetable=createWidget('timetable'),destination=createWorkspace('Chemistry',[]);workspace.widgets=[timetable];
 timetable.schedule=[{id:'chem-1',day:3,time:'13:00',title:'CHEM111',location:'Room 1'},{id:'math-1',day:4,time:'10:00',title:'MATH120',location:'Room 2'}];
 const choices=[{id:workspace.id,name:workspace.name},{id:destination.id,name:destination.name}],prompt='link CHEM111 to Chemistry workspace',action=resolveDirectAssistantActions(prompt,workspace,[],[],choices);
 assert.deepEqual(action,[{type:'set_course_environment',ids:[timetable.id,'chem-1'],enabled:true,workspaceId:destination.id}]);
 assert.deepEqual(assistantActionRequest(prompt,[],choices),['set_course_environment']);
 validateAssistantActions(workspace,action,[],choices);validateAssistantActionIntent(prompt,workspace,action,[],choices);
 assert.deepEqual(parseAssistantReply({intent:'workspace_action',reply:'Ready.',layout:[],actions:action}).actions,action);
 const linked=applyAssistantWidgetActions(workspace,action,900,700);assert.equal(linked.widgets[0].schedule[0].workspaceId,destination.id);assert.equal(linked.widgets[0].schedule[1].workspaceId,undefined);
 const unlinkPrompt='unlink CHEM111 from its environment',unlink=resolveDirectAssistantActions(unlinkPrompt,linked,[],[],choices);validateAssistantActionIntent(unlinkPrompt,linked,unlink,[],choices);
 const unlinked=applyAssistantWidgetActions(linked,unlink,900,700);assert.equal(unlinked.widgets[0].schedule[0].workspaceId,undefined);assert.equal(unlinked.widgets[0].schedule[0].autoOpen,undefined);
 const duplicate=structuredClone(workspace);duplicate.widgets[0].schedule.push({...duplicate.widgets[0].schedule[0],id:'chem-2'});assert.match(assistantCourseEnvironmentClarification(prompt,duplicate,[],choices),/Which course/);
 assert.throws(()=>validateAssistantActions(workspace,[{...action[0],workspaceId:'missing'}],[],choices),/no longer available/);
});
test('assistant changes automatic opening only for the uniquely named linked course',()=>{
 const workspace=createWorkspace('Study',[]),timetable=createWidget('timetable'),linked=createWorkspace('Chemistry environment',[]);workspace.widgets=[timetable];
 timetable.schedule=[{id:'chem-1',day:3,time:'13:00',title:'CHEM111',location:'Room 1',workspaceId:linked.id,autoOpen:true},{id:'math-1',day:4,time:'10:00',title:'MATH120',location:'Room 2',workspaceId:linked.id,autoOpen:true}];
 const prompt='disable automatic course environments for CHEM111',action=resolveDirectAssistantActions(prompt,workspace,[]);
 assert.deepEqual(action,[{type:'set_course_auto_open',ids:[timetable.id,'chem-1'],enabled:false}]);
 for(const alternative of ['turn off automatic opening for CHEM111','please disable auto-open for "CHEM111"','could you switch off auto opening for CHEM111?']){
  assert.deepEqual(resolveDirectAssistantActions(alternative,workspace,[]),action);validateAssistantActionIntent(alternative,workspace,action);
 }
 assert.deepEqual(resolveDirectAssistantActions('enable automatic opening for CHEM111',workspace,[]),[{...action[0],enabled:true}]);
 assert.deepEqual(parseAssistantReply({intent:'workspace_action',reply:'Ready.',layout:[],actions:action}).actions,action);
 validateAssistantActions(workspace,action,[],[{id:linked.id,name:linked.name}]);validateAssistantActionIntent(prompt,workspace,action);
 const edited=applyAssistantWidgetActions(workspace,action,900,700);assert.equal(edited.widgets[0].schedule[0].autoOpen,false);assert.equal(edited.widgets[0].schedule[1].autoOpen,true);
 const duplicate=structuredClone(workspace);duplicate.widgets[0].schedule.push({...duplicate.widgets[0].schedule[0],id:'chem-2'});
 assert.match(assistantCourseAutoOpenClarification(prompt,duplicate,[]),/Which linked course/);
 assert.throws(()=>validateAssistantActionIntent(prompt,duplicate,action),/did not match/);
 const secondTimetable=createWidget('timetable');secondTimetable.schedule=[{...timetable.schedule[0],id:'other-chem'}];const twoTimetables={...workspace,widgets:[timetable,secondTimetable]};
 assert.match(assistantCourseAutoOpenClarification(prompt,twoTimetables,[]),/Which linked course/);
 const selectedPrompt='@Timetable 1 turn off automatic opening for CHEM111';assert.deepEqual(resolveDirectAssistantActions(selectedPrompt,twoTimetables,[timetable.id]),action);
 validateAssistantActionIntent(selectedPrompt,twoTimetables,action,[],[],[timetable.id]);
 assert.deepEqual(assistantActionRequest("don't disable automatic course environments for CHEM111"),[]);
 assert.throws(()=>validateAssistantActions(workspace,[{...action[0],ids:[timetable.id,'missing']}]),/linked environment/);
});
test('Still AI switches only to an exact existing workspace and clarifies unknown targets',()=>{
 const {workspace}=fixture(),workspaces=[{id:workspace.id,name:'Study'},{id:'workspace-chemistry',name:'Chemistry'}];
 const action=resolveDirectAssistantActions('switch to Chemistry workspace',workspace,[],[],workspaces);
 assert.deepEqual(action,[{type:'switch_workspace',ids:['workspace-chemistry']}]);
 assert.doesNotThrow(()=>validateAssistantActions(workspace,action,[],workspaces));
 assert.doesNotThrow(()=>validateAssistantActionIntent('switch to Chemistry workspace',workspace,action,[],workspaces));
 assert.equal(assistantWorkspaceClarification('switch to Chemistry workspace',workspaces),null);
 assert.match(assistantWorkspaceClarification('switch workspace',workspaces),/Which workspace/);
 assert.match(assistantWorkspaceClarification('switch to Chem workspace',workspaces),/Which workspace/);
 assert.throws(()=>validateAssistantActions(workspace,[{type:'switch_workspace',ids:['missing']}],[],workspaces),/no longer exists/);
 assert.throws(()=>validateAssistantActionIntent('switch to Chemistry workspace',workspace,[{type:'switch_workspace',ids:['workspace-chemistry']}],[],[{id:workspace.id,name:'Study'}]),/did not match/);
 const parsed=parseAssistantReply({reply:'Switching.',intent:'workspace_action',layout:[],actions:[{type:'switch_workspace',ids:['workspace-chemistry']}]});
 assert.deepEqual(parsed.actions,action);
});
test('Still AI routes direct undo requests through the reversible in-app undo action',()=>{
 const {workspace}=fixture(),actions=resolveDirectAssistantActions('undo the last change',workspace,[]);
 assert.deepEqual(actions,[{type:'undo',ids:[workspace.id]}]);
 assert.deepEqual(resolveDirectAssistantActions('can you undo',workspace,[]),actions);
 assert.doesNotThrow(()=>validateAssistantActions(workspace,actions));
 assert.doesNotThrow(()=>validateAssistantActionIntent('undo the last change',workspace,actions));
 assert.throws(()=>validateAssistantActionIntent('undo the last change',workspace,[{type:'undo',ids:['another-workspace']}]),/current workspace/);
 assert.equal(resolveDirectAssistantActions('How do I undo the last change?',workspace,[]),null);
});
test('Still AI can replay the tutorial and change one safe keyboard shortcut',()=>{
 const {workspace}=fixture();
 assert.deepEqual(resolveDirectAssistantActions('run the tutorial again',workspace,[]),[{type:'run_tutorial',ids:['tutorial']}]);
 const action=resolveDirectAssistantActions('set the shortcut for workspace 2 to Ctrl+Alt+K',workspace,[]);
 assert.deepEqual(action,[{type:'set_shortcut',ids:['workspace-2'],shortcut:{key:'K',ctrl:true,alt:true,shift:false}}]);
 validateAssistantActions(workspace,action);validateAssistantActionIntent('set the shortcut for workspace 2 to Ctrl+Alt+K',workspace,action);
 assert.match(assistantShortcutClarification('change shortcut'),/Which Still shortcut/);
 assert.equal(assistantShortcutClarification('set the shortcut for workspace 2 to Ctrl+Alt+K'),null);
 assert.throws(()=>updateAssistantShortcut({up:{key:'U',ctrl:true,alt:false,shift:false},down:{key:'D',ctrl:true,alt:false,shift:false},overview:{key:'M',ctrl:true,alt:false,shift:false},clickThrough:{key:'P',ctrl:true,alt:false,shift:true},commandPalette:{key:'K',ctrl:true,alt:false,shift:false},undo:{key:'Z',ctrl:true,alt:false,shift:false},numbered:Array.from({length:9},(_,i)=>({key:String(i+1),ctrl:true,alt:false,shift:false})),minimizeModifiers:{ctrl:true,alt:false,shift:true}},'workspace-2',{key:'K',ctrl:true,alt:false,shift:false}),/reserved|different shortcut/);
 assert.throws(()=>validateAssistantActions(workspace,[...action,{type:'run_tutorial',ids:['tutorial']}]),/one at a time/);
});
test('Still AI can safely move one workspace widget to an exact other workspace',()=>{
 const {workspace}=fixture(),destination={id:'workspace-chemistry',name:'Chemistry'},workspaces=[{id:workspace.id,name:workspace.name},destination],prompt='move Notes widget to Chemistry workspace';
 assert.deepEqual(assistantActionRequest(prompt,[],workspaces),['move_widget']);
 const action=resolveDirectAssistantActions(prompt,workspace,[],[],workspaces);
 assert.deepEqual(action,[{type:'move_widget',ids:[workspace.widgets[0].id],workspaceId:destination.id}]);
 validateAssistantActions(workspace,action,[],workspaces);validateAssistantActionIntent(prompt,workspace,action,[],workspaces);
 assert.match(assistantMoveClarification('move Notes widget to another workspace',workspace,[],workspaces),/Which workspace/);
 assert.match(assistantMoveClarification('move widget to Chemistry workspace',workspace,[],workspaces),/Which widget/);
 assert.throws(()=>validateAssistantActions(workspace,[{type:'move_widget',ids:[workspace.widgets[0].id],workspaceId:'missing'}],[],workspaces),/another existing workspace/);
 assert.throws(()=>validateAssistantActions(workspace,[...action,{type:'undo',ids:[workspace.id]}],[],workspaces),/one at a time/);
});
test('assistant edits detect changes to the content they would replace',()=>{
 const {workspace}=fixture(),note=workspace.widgets[0],action={type:'edit_widget',ids:[note.id],text:'AI draft'};
 const moved=structuredClone(workspace);moved.widgets[0].placement.x+=10;
 assert.equal(assistantEditTargetsUnchanged(workspace,moved,[action]),true,'moving a widget does not change its note');
 const edited=structuredClone(workspace);edited.widgets[0].text='newer user text';edited.widgets[0].noteDocuments[0].text='newer user text';
 assert.equal(assistantEditTargetsUnchanged(workspace,edited,[action]),false);
 const switched=structuredClone(workspace);switched.widgets[0].activeNoteDocumentId='other';
 assert.equal(assistantEditTargetsUnchanged(workspace,switched,[action]),false);
 const tags={type:'edit_widget',ids:[note.id],noteDocumentId:note.activeNoteDocumentId,noteTags:['exam']},retagged=structuredClone(workspace);retagged.widgets[0].noteDocuments[0].tags=['lecture'];
 assert.equal(assistantEditTargetsUnchanged(workspace,retagged,[tags]),false);
 assert.equal(assistantEditTargetsUnchanged(workspace,retagged,[{...tags,text:'AI draft'}]),false,'combined content and tag edits must check both');
});
test('repeated action types cannot bypass the requested widget count or target',()=>{
 const {workspace}=fixture();
 assert.throws(()=>validateAssistantActionIntent('make one notes widget',workspace,[{type:'add_widget',ids:['notes']},{type:'add_widget',ids:['notes']}]),/repeated changes/);
 assert.throws(()=>validateAssistantActionIntent('hide the sidebar',workspace,[{type:'set_ui_visibility',ids:['sidebar'],enabled:false},{type:'set_ui_visibility',ids:['apps-bar'],enabled:false}]),/repeated changes/);
});
test('assistant rejects enormous batches before any model or workspace action and bounds workspace size',()=>{
  const {workspace}=fixture(),prompt='add 100000 widgets to current workspace';
  assert.match(assistantRequestLimitError(prompt),/at most 10 widgets/);
  assert.equal(resolveDirectAssistantActions(prompt,workspace,[]),null);
  const addThree=resolveDirectAssistantActions('add 3 notes widgets',workspace,[]);
  assert.deepEqual(addThree,[{type:'add_widget',ids:['notes','notes','notes']}]);
  assert.equal(applyAssistantWidgetActions(workspace,addThree,900,700).widgets.length,workspace.widgets.length+3);
  assert.equal(parseAssistantReply({reply:'Adding notes',layout:[],actions:[{type:'add_widget',ids:['notes','notes']}]}).actions[0].ids.length,2);
  const crowded=createWorkspace('Crowded',[]);for(let i=0;i<MAX_ASSISTANT_WIDGETS-1;i++)crowded.widgets.push(createWidget('notes'));
  assert.throws(()=>applyAssistantWidgetActions(crowded,[{type:'add_widget',ids:['focus','notes']}],2000,1400),/limited to 100 widgets/);
  assert.equal(crowded.widgets.length,MAX_ASSISTANT_WIDGETS-1,'rejected operation leaves original state unchanged');
  assert.equal(MAX_ASSISTANT_BATCH,10);
  assert.match(assistantRequestLimitError('open 100000 saved widgets'),/at most 10 saved items/);
  assert.throws(()=>validateAssistantActions(workspace,[{type:'add_widget',ids:Array(6).fill('notes')},{type:'open_saved',ids:Array.from({length:5},(_,i)=>`preset-id${i}`)}],Array.from({length:5},(_,i)=>({id:`preset-id${i}`,name:`Item ${i}`,type:'notes',kind:'preset'}))),/at most 10 items/);
});
test('ambiguous note-file creation asks before acting and spelled-out counts obey limits',()=>{
  const {workspace}=fixture();
  const prompt='make three notes files';
  assert.deepEqual(assistantActionRequest(prompt),['create_note_document']);
  assert.equal(assistantNoteDocumentClarification(prompt,workspace),null);
  workspace.widgets.push(createWidget('notes'));
  assert.match(assistantNoteDocumentClarification(prompt,workspace),/Which Notes widget/);
  assert.match(assistantRequestLimitError('make eleven note documents in Notes'),/at most 10 note documents/i);
  assert.match(assistantRequestLimitError('make one hundred thousand notes widgets'),/at most 10 widgets/i);
  assert.match(assistantRequestLimitError('add ten thousand saved widgets'),/at most 10 saved items/i);
  assert.throws(()=>validateAssistantActionIntent('make three notes widgets',workspace,[{type:'add_widget',ids:['notes','notes']}]),/requested number/i);
  assert.doesNotThrow(()=>validateAssistantActionIntent('make one Files widget',workspace,[{type:'add_widget',ids:['notes']}]),'Files is now the combined Notes widget');
  assert.deepEqual(resolveDirectAssistantActions('make Notes and Files widgets',workspace,[]),[{type:'add_widget',ids:['notes']}]);
});
test('resize requests use a reviewed layout and preserve other widgets',()=>{
 const {workspace,items}=fixture(),prompt='make Notes 1 taller',target=workspace.widgets[0];
 assert.equal(assistantLayoutRequested(prompt),true);assert.equal(assistantResizeClarification(prompt,workspace,[]),null);
 const resized=items.map(item=>item.id===target.id?{...item,height:item.height+40}:item);
 assert.doesNotThrow(()=>validateAssistantLayoutIntent(prompt,workspace,resized,[]));
 assert.throws(()=>validateAssistantLayoutIntent(prompt,workspace,items,[]),/did not resize/);
 assert.throws(()=>validateAssistantLayoutIntent(prompt,workspace,resized.map((item,index)=>index===1?{...item,x:item.x+5}:item),[]),/another placement/);
 assert.throws(()=>validateAssistantLayoutIntent('make Notes 1 wider',workspace,resized,[]),/requested dimension/);
 assert.throws(()=>validateAssistantLayoutIntent('resize Notes 1 to 500 x 400',workspace,resized,[]),/dimensions do not match/);
 const another=createWidget('notes');another.instanceNumber=2;const multiple={...workspace,widgets:[...workspace.widgets,another]};
 assert.match(assistantResizeClarification('make Notes bigger',multiple,[]),/Which expanded widget/);
 assert.equal(assistantResizeClarification('make Notes bigger',multiple,[another.id]),null);
 assert.equal(assistantLayoutRequested('@Notes 2 make it taller'),true);
 assert.equal(assistantResizeClarification('@Notes 2 make it taller',multiple,[another.id]),null);
 assert.equal(assistantResizeClarification('make Notes text bigger',multiple,[]),null);
 assert.deepEqual(assistantActionRequest('make Notes bigger'),[]);
 assert.equal(assistantEditClarification('make Notes 1 taller'),null);
 assert.equal(assistantLayoutRequested('The universe is bigger than Earth.'),false);
 assert.equal(assistantResizeClarification('The universe is bigger than Earth.',multiple,[]),null);
 assert.throws(()=>validateAssistantLayoutIntent('arrange the widgets',workspace,resized,[]),/changed widget sizes/);
 assert.doesNotThrow(()=>validateAssistantLayoutIntent('arrange the widgets',workspace,items,[]));
});
test('layout applies atomically and preserves contents and unrelated widget state',()=>{
  const {workspace,items}=fixture(),before=structuredClone(workspace);items[0].y=300;
  const plan={workspaceId:workspace.id,fingerprint:layoutFingerprint(workspace),width:900,height:700,items};
  const next=applyLayoutPlan(workspace,plan,900,700);
  assert.equal(next.widgets[0].placement.y,300);assert.equal(next.widgets[0].text,workspace.widgets[0].text);
  assert.deepEqual(workspace,before);assert.equal(next.widgets[1].id,workspace.widgets[1].id);
});
test('rejects stale workspace, canvas resize, duplicate IDs, missing widgets, overlap, and nonfinite geometry',()=>{
  const {workspace,items}=fixture(),plan={workspaceId:workspace.id,fingerprint:layoutFingerprint(workspace),width:900,height:700,items};
  const moved=structuredClone(workspace);moved.widgets[0].placement.x++;
  assert.throws(()=>applyLayoutPlan(moved,plan,900,700),/changed/);
  assert.throws(()=>applyLayoutPlan(workspace,plan,850,700),/changed/);
  assert.throws(()=>validateLayout(workspace,[items[0],items[0]],900,700),/duplicate/);
  assert.throws(()=>validateLayout(workspace,[items[0]],900,700),/every/);
  assert.throws(()=>validateLayout(workspace,[items[0],{...items[1],x:0}],900,700),/overlap/);
  assert.throws(()=>validateLayout(workspace,[{...items[0],x:Infinity},items[1]],900,700),/fit/);
  assert.throws(()=>validateLayout(workspace,[{...items[0],x:850},items[1]],900,700),/fit/);
});
test('preserves minimized cards and obeys native app minimum dimensions',()=>{
  const {workspace,items}=fixture();const app=createWidget('apps');app.appPanelOpen=true;app.appMinWidth=650;app.placement={x:0,y:300,width:650,height:230};workspace.widgets.push(app);
  assert.throws(()=>validateLayout(workspace,[...items,{id:app.id,x:0,y:300,width:400,height:230}],900,700),/minimum/);
  app.minimized=true;app.placement={x:700,y:0,width:136,height:42};const before=structuredClone(app);
  const plan={workspaceId:workspace.id,fingerprint:layoutFingerprint(workspace),width:900,height:700,items};
  assert.deepEqual(applyLayoutPlan(workspace,plan,900,700).widgets[2],before);
  assert.throws(()=>validateLayout(workspace,[items[0],{...items[1],x:580}],900,700),/overlap/);
});
test('model responses are parsed without trusting arbitrary fields or geometry',()=>{
  assert.deepEqual(parseAssistantReply({reply:'Hello',layout:[],actions:[],execute:'untrusted'}),{reply:'Hello',layout:[],actions:[]});
  assert.throws(()=>parseAssistantReply({reply:'',layout:[]}));
  assert.throws(()=>parseAssistantReply({reply:'Hello',layout:[{id:'a',x:0.1,y:0,width:100,height:100}]}));
  assert.throws(()=>parseAssistantReply({reply:'Hello',layout:[null]}));
});
test('AI file filing proposals identify selected sources and never mix with workspace actions',()=>{
  const proposal={sourceWidgetId:'files-1',sourcePath:'CHEM111/handout.pdf',destinationFolder:'Courses/CHEM111',reason:'The selected handout covers chemistry.'};
  assert.deepEqual(parseAssistantReply({reply:'This is a chemistry handout.',layout:[],actions:[],fileProposals:[proposal]}).fileProposals,[proposal]);
  const another={...proposal,sourceWidgetId:'files-2',sourcePath:'MATH120/notes.md',destinationFolder:'Courses/MATH120'};
  assert.equal(parseAssistantReply({reply:'Two files are useful.',layout:[],actions:[],fileProposals:[proposal,another]}).fileProposals.length,2);
 const bulk=Array.from({length:6},(_,index)=>({...proposal,sourcePath:'Course-'+(index+1)+'/notes.md'}));
 assert.equal(parseAssistantReply({reply:'Review these moves.',layout:[],actions:[],fileProposals:bulk}).fileProposals.length,6);
  assert.throws(()=>parseAssistantReply({reply:'Move it',layout:[],actions:[],fileProposals:[{...proposal,destinationFolder:'../outside'}]}),/unsafe file filing proposal/);
  assert.throws(()=>parseAssistantReply({reply:'Move it',layout:[],actions:[],fileProposals:[{...proposal,sourcePath:'../outside.pdf'}]}),/unsafe file filing proposal/);
  assert.throws(()=>parseAssistantReply({reply:'Move it',layout:[],actions:[],fileProposals:[proposal,{...proposal}]}),/duplicate filing proposals/);
  assert.throws(()=>parseAssistantReply({reply:'Move it',layout:[],actions:[{type:'remove_widget',ids:['notes-1']}],fileProposals:[proposal]}),/mixed a file filing proposal/);
  assert.deepEqual(parseAssistantReply({intent:'clarification',reply:'Which course?',layout:[],actions:[],fileProposals:[proposal]}).fileProposals,undefined);
});
test('assistant response intent separates freeform conversation from workspace operations',()=>{
  const layout=[{id:'notes-1',x:0,y:0,width:300,height:250}],actions=[{type:'edit_widget',ids:['notes-1'],title:'Unexpected edit'}];
  assert.deepEqual(parseAssistantReply({intent:'chat',reply:'A black hole has an event horizon.',layout,actions}),{intent:'chat',reply:'A black hole has an event horizon.',layout:[],actions:[]});
  assert.deepEqual(parseAssistantReply({intent:'clarification',reply:'Which note should I update?',layout,actions}),{intent:'clarification',reply:'Which note should I update?',layout:[],actions:[]});
  assert.deepEqual(parseAssistantReply({intent:'workspace_action',reply:'I can update that note.',layout,actions}),{intent:'workspace_action',reply:'I can update that note.',layout:[],actions});
  assert.deepEqual(parseAssistantReply({intent:'layout',reply:'Here is a layout proposal.',layout,actions}),{intent:'layout',reply:'Here is a layout proposal.',layout,actions:[]});
  assert.throws(()=>parseAssistantReply({intent:'unrecognized',reply:'Hello',layout:[],actions:[]}));
  assert.deepEqual(parseAssistantReply({reply:'Done',layout,actions}),{
    intent:'clarification',reply:'I received conflicting workspace suggestions, so I did not change anything. What would you like me to do?',layout:[],actions:[],
  },'legacy mixed proposals become a safe follow-up instead of a provider-format error');
});
test('assistant workspace operations are parsed as explicit, exclusive actions',()=>{
  assert.deepEqual(parseAssistantReply({reply:'Done',layout:[],actions:[{type:'minimize',ids:['notes-1','focus-1']},{type:'save_to_tray',ids:['notes-1']}]}),{
    reply:'Done',layout:[],actions:[{type:'minimize',ids:['notes-1','focus-1']},{type:'save_to_tray',ids:['notes-1']}],
  });
  assert.throws(()=>parseAssistantReply({reply:'Done',layout:[],actions:[{type:'delete',ids:['notes-1']}]}),/action/);
  assert.throws(()=>parseAssistantReply({reply:'Done',layout:[],actions:[{type:'restore',ids:[]}]}),/action/);
  assert.throws(()=>parseAssistantReply({reply:'Done',layout:[],actions:[{type:'minimize',ids:['bad id']}]}),/action/);
  assert.deepEqual(parseAssistantReply({reply:'Starting timer',layout:[],actions:[{type:'set_timer',ids:['focus-1'],seconds:300}]}).actions,[{type:'set_timer',ids:['focus-1'],seconds:300}]);
  assert.throws(()=>parseAssistantReply({reply:'Starting timer',layout:[],actions:[{type:'set_timer',ids:['focus-1'],seconds:0}]}),/action/);
  assert.throws(()=>parseAssistantReply({reply:'Starting timer',layout:[],actions:[{type:'minimize',ids:['focus-1'],seconds:300}]}),/action/);
  const conflicting=parseAssistantReply({reply:'Done',layout:[{id:'notes-1',x:0,y:0,width:200,height:200}],actions:[{type:'minimize',ids:['notes-1']}]});
  assert.equal(conflicting.intent,'clarification');assert.deepEqual(conflicting.layout,[]);assert.deepEqual(conflicting.actions,[]);
  assert.deepEqual(parseAssistantReply({reply:'Added Notes',layout:[],actions:[{type:'add_widget',ids:['notes']}]}).actions,[{type:'add_widget',ids:['notes']}]);
  assert.deepEqual(parseAssistantReply({reply:'Opened shortcut',layout:[],actions:[{type:'open_saved',ids:['preset-123']}]}).actions,[{type:'open_saved',ids:['preset-123']}]);
  assert.deepEqual(parseAssistantReply({reply:'Removing Focus',layout:[],actions:[{type:'remove_widget',ids:['focus-1']}]}).actions,[{type:'remove_widget',ids:['focus-1']}]);
  assert.throws(()=>parseAssistantReply({reply:'Too much',layout:[],actions:[{type:'add_widget',ids:Array(11).fill('notes')}]}),/action|too many/i);
  assert.throws(()=>parseAssistantReply({reply:'Invented type',layout:[],actions:[{type:'add_widget',ids:['powershell']}]}),/action/i);
  assert.throws(()=>parseAssistantReply({reply:'Invented id',layout:[],actions:[{type:'open_saved',ids:['appdata-secret']}]}),/action/i);
});
test('minimize and restore actions change widget state instead of layout geometry',()=>{
  const {workspace}=fixture(),note=workspace.widgets[0],before=structuredClone(note.placement);
  const minimized=applyAssistantWidgetActions(workspace,[{type:'minimize',ids:[note.id]}],900,700);
  assert.equal(minimized.widgets[0].minimized,true);
  assert.deepEqual(minimized.widgets[0].restorePlacement,before);
  assert.equal(minimized.widgets[0].placement.width,136);
  assert.equal(workspace.widgets[0].minimized,false,'the original workspace stays immutable');
  const restored=applyAssistantWidgetActions(minimized,[{type:'restore',ids:[note.id]}],900,700);
  assert.equal(restored.widgets[0].minimized,false);
  assert.deepEqual(restored.widgets[0].placement,before);
  assert.equal(applyAssistantWidgetActions(workspace,[{type:'restore',ids:[note.id]}],900,700),workspace,'a no-op restore preserves state identity');
});
test('assistant action requests require matching actions and every target for all-widget commands',()=>{
  const {workspace}=fixture();
  const prompt='minimize all widgets and save all widgets to the widget tray';
  const actions=[{type:'minimize',ids:workspace.widgets.map(widget=>widget.id)},{type:'save_to_tray',ids:workspace.widgets.map(widget=>widget.id)}];
  assert.deepEqual(assistantActionRequest(prompt),['minimize','save_to_tray']);
  assert.doesNotThrow(()=>validateAssistantActionIntent(prompt,workspace,actions));
  const incomplete=[{type:'minimize',ids:workspace.widgets.map(widget=>widget.id)},{type:'save_to_tray',ids:[workspace.widgets[0].id]}];
  assert.throws(()=>validateAssistantActionIntent(prompt,workspace,incomplete),/every widget/);
  assert.throws(()=>validateAssistantActions(workspace,[{type:'restore',ids:['unknown-widget']}]),/changed/);
});
test('assistant keeps ordinary questions as chat and only marks direct workspace requests as actions',()=>{
  assert.deepEqual(assistantActionRequest('How do I minimize a widget?'),[]);
  assert.deepEqual(assistantActionRequest('Can you explain how to save a widget to the tray?'),[]);
  assert.deepEqual(assistantActionRequest('I want to know why my widget is minimized.'),[]);
  assert.deepEqual(assistantActionRequest('Minimize all widgets.'),['minimize']);
  assert.deepEqual(assistantActionRequest('Can you save all widgets to the tray?'),['save_to_tray']);
  assert.deepEqual(assistantActionRequest('Restore the Notes widget.'),['restore']);
  assert.deepEqual(assistantActionRequest('add note'),['add_widget']);
  assert.deepEqual(assistantActionRequest('remove focus'),['remove_widget']);
});
test('make notes widget is a permitted local creation command instead of a provider-dependent chat',()=>{
  const {workspace}=fixture();
  assert.deepEqual(assistantActionRequest('make notes widget'),['add_widget']);
  assert.deepEqual(resolveDirectAssistantActions('make notes widget',workspace,[]),[{type:'add_widget',ids:['notes']}]);
  assert.deepEqual(assistantActionRequest('could you make me a focus widget?'),['add_widget']);
  assert.match(assistantRequestLimitError('make 100000 notes widgets'),/at most 10/);
  assert.match(assistantRequestLimitError('make 100000 notes'),/at most 10/);
  assert.deepEqual(resolveDirectAssistantActions('make 3 notes',workspace,[]),[{type:'add_widget',ids:['notes','notes','notes']}]);
  for(const verb of ['make','build','spawn','create','add','open','new'])assert.deepEqual(resolveDirectAssistantActions(`${verb} notes widget`,workspace,[]),[{type:'add_widget',ids:['notes']}]);
  assert.deepEqual(assistantActionRequest('open focus with details'),[],'opening a named widget without asking for a new widget must not be misclassified as widget creation');
  for(const type of workspaceWidgetTypes)assert.deepEqual(resolveDirectAssistantActions(`make ${type} widget`,workspace,[]),[{type:'add_widget',ids:[type]}]);
  assert.deepEqual(resolveDirectAssistantActions('make files widget',workspace,[]),[{type:'add_widget',ids:['notes']}]);
  assert.throws(()=>validateAssistantActions(workspace,[{type:'add_widget',ids:['files']}]),/widget type/i);
  assert.equal(resolveDirectAssistantActions('How do I make notes widgets?',workspace,[]),null);
  assert.equal(resolveDirectAssistantActions("don't make a notes widget",workspace,[]),null);
  assert.equal(resolveDirectAssistantActions('Write an email saying make notes widget',workspace,[]),null,'writing and explanation requests remain general chat');
  assert.deepEqual(assistantActionRequest('make all widgets smaller'),[],'make can request a change without meaning creation');
});
test('asking whether Still can edit a timetable must not create a timetable',()=>{
  const {workspace}=fixture();
  assert.deepEqual(assistantActionRequest('can you make edit to the timetable'),[]);
  assert.equal(resolveDirectAssistantActions('can you make edit to the timetable',workspace,[]),null);
  assert.deepEqual(assistantActionRequest('make edits to the timetable'),[]);
});
test('valid action-only responses do not require invented assistant prose',()=>{
  assert.deepEqual(parseAssistantReply({reply:'',layout:[],actions:[{type:'add_widget',ids:['notes']}]}),{
    reply:'Workspace actions requested.',layout:[],actions:[{type:'add_widget',ids:['notes']}],
  });
  assert.throws(()=>parseAssistantReply({reply:'',layout:[],actions:[]}));
});
test('the model receives the full creation catalogue and can create named Notes with content',()=>{
  const workspace=createWorkspace('Empty',[]),context=assistantWorkspaceContext(workspace,900,700,[]);
  assert.ok(context.capabilities.creatableWidgets.some(item=>item.id==='notes'));
  assert.equal(context.capabilities.creatableWidgets.some(item=>item.id==='files'),false,'the legacy Files type must not be offered as a second widget');
  assert.ok(context.capabilities.creatableWidgets.some(item=>item.id==='apps'));
  assert.ok(context.capabilities.actions.includes('remove_widget'));
  assert.equal(context.capabilities.maxAddOrOpenItems,10);
  const actions=parseAssistantReply({reply:'',layout:[],actions:[{type:'add_widget',ids:['notes'],title:'Revision',text:'Key ideas'}]}).actions;
  const next=applyAssistantWidgetActions(workspace,actions,900,700);
  assert.equal(next.widgets[0].title,'Revision');assert.equal(next.widgets[0].text,'Key ideas');
  assert.equal(workspace.widgets.length,0,'creation is immutable and Undo can retain the previous state');
  assert.equal(resolveDirectAssistantActions('make notes with content about chemistry',workspace,[]),null,'rich requests go to the model rather than dropping their details');
  assert.throws(()=>parseAssistantReply({reply:'Ready',layout:[],actions:[{type:'add_widget',ids:['apps'],text:'unexpected'}]}),/only for Notes/);
  assert.throws(()=>applyAssistantWidgetActions(workspace,[{type:'add_widget',ids:['notes'],text:'x'.repeat(12001)}],900,700),/12,000/);
  assert.throws(()=>parseAssistantReply({reply:'Ready',layout:[],actions:[{type:'minimize',ids:['notes-1'],title:'unexpected'}]}),/names/);
});
test('named Notes requests with explicit writing instructions resolve without model-generated workspace actions',()=>{
  const workspace=createWorkspace('Empty',[]),prompt='can make note named chem11, and write notes about kinetics and equilllibrium';
  const actions=resolveDirectAssistantActions(prompt,workspace,[]);
  assert.deepEqual(actions,[{type:'add_widget',ids:['notes'],title:'chem11',text:'kinetics and equilllibrium'}]);
  validateAssistantActions(workspace,actions);
  validateAssistantActionIntent(prompt,workspace,actions);
  const next=applyAssistantWidgetActions(workspace,actions,900,700);
  assert.equal(next.widgets[0].title,'chem11');
  assert.equal(next.widgets[0].text,'kinetics and equilllibrium');
});
test('explicit all-widget tray requests resolve to real workspace IDs without relying on the model',()=>{
  const {workspace}=fixture();
  assert.deepEqual(resolveDirectAssistantActions('add note',workspace,[]),[{type:'add_widget',ids:['notes']}]);
  assert.deepEqual(resolveDirectAssistantActions('remove focus',workspace,[]),[{type:'remove_widget',ids:[workspace.widgets.find(widget=>widget.type==='focus').id]}]);
  assert.equal(unsupportedAssistantRequest('remove all focus widgets'),null,'a type-specific removal must not be treated as removing every widget');
  assert.equal(unsupportedAssistantRequest('remove all widgets from this workspace'),'delete_widgets');
  const actions=resolveDirectAssistantActions('save all widget in this workspace into widget tray',workspace,[]);
  assert.deepEqual(actions,[{type:'save_to_tray',ids:workspace.widgets.map(widget=>widget.id)}]);
  assert.deepEqual(resolveDirectAssistantActions('save the selected widget to the tray',workspace,[workspace.widgets[1].id]),[
    {type:'save_to_tray',ids:[workspace.widgets[1].id]},
  ]);
  assert.equal(resolveDirectAssistantActions('How do I save all widgets to the tray?',workspace,[]),null);
  assert.equal(resolveDirectAssistantActions('save a widget to the tray',workspace,[]),null,'ambiguous requests still go through chat');
});
test('the assistant only shows a layout proposal when layout was requested',()=>{
  assert.equal(assistantLayoutRequested('delete all items in widget tray'),false);
  assert.equal(assistantLayoutRequested('How do I arrange widgets?'),false);
  assert.equal(assistantLayoutRequested('Arrange these widgets side by side.'),true);
  assert.equal(assistantLayoutRequested('Move Notes next to Focus.'),true);
  assert.equal(unsupportedAssistantRequest('delete all items in widget tray'),'clear_tray');
  assert.equal(unsupportedAssistantRequest('delete all widget on the workspace'),'delete_widgets');
  assert.equal(unsupportedAssistantRequest('remove every widget from this workspace'),'delete_widgets');
  assert.equal(unsupportedAssistantRequest('How do I delete all widgets on the workspace?'),null);
  assert.equal(assistantLayoutRequested('delete all widget on the workspace'),false);
  assert.equal(unsupportedAssistantRequest('How do I delete a saved tray item?'),null);
});
test('settling a destructive-action confirmation preserves valid provider chat history',()=>{
  const pending=[{role:'user',text:'delete all items in widget tray'},{role:'model',text:'Confirm below to continue.'}];
  const settled=settleAssistantConfirmation(pending,'Removed saved items.');
  assert.deepEqual(settled,[{role:'user',text:'delete all items in widget tray'},{role:'model',text:'Removed saved items.'}]);
  assert.deepEqual([...settled,{role:'user',text:'hi'}].map(message=>message.role),['user','model','user']);
  assert.deepEqual(settleAssistantConfirmation(pending.slice(0,1),'Canceled.'),[pending[0],{role:'model',text:'Canceled.'}]);
});
test('added widgets get a real reply and a prior blank reply cannot poison provider history',()=>{
  const {workspace}=fixture(),actions=[{type:'add_widget',ids:['focus','notes']}];
  const receipt=assistantAddedWidgetReceipt(actions);
  assert.equal(receipt,'Added a Focus widget and a Files widget.');
  assert.equal(assistantAddedWidgetReceipt([{type:'add_widget',ids:['notes','notes']}]),'Added 2 Files widgets.');
  assert.equal(safeAssistantReceipt('  '),'Still could not confirm whether that action completed. Check the workspace before trying again.');
  const history=prepareAssistantHistory([
    {role:'user',text:'hi'},
    {role:'model',text:'Hello!'},
    {role:'user',text:'add focus widget'},
    {role:'model',text:''},
  ]);
  assert.deepEqual(history.map(message=>message.role),['user','model','user','model']);
  assert.ok(history.every(message=>message.text.trim().length>0));
  assert.equal(history.at(-1)?.text,'No response was recorded for the previous message.');
  assert.equal(prepareAssistantHistory([{role:'user',text:'hi'},{role:'model',text:'   '}]).at(-1)?.text,'No response was recorded for the previous message.');
});
test('provider history starts with a user turn after trimming a long chat',()=>{
  const turns=Array.from({length:6},(_,index)=>[
    {role:'user',text:`Question ${index+1}`},
    {role:'model',text:`Answer ${index+1}`},
  ]).flat();
  turns.push({role:'model',text:'Follow-up after an action'});
  const history=prepareAssistantHistory(turns);
  assert.equal(history[0]?.role,'user','Agent history must begin with a user message.');
  assert.equal(history[0].text,'Question 2');
  assert.equal(history.at(-1)?.text,'Follow-up after an action');
  assert.equal(turns.length,13,'the visible transcript is preserved');
  assert.deepEqual(prepareAssistantHistory([{role:'model',text:'Older orphaned reply'}]),[]);
});
test('explicit timer commands set a timer on a selected or unambiguous timer widget',()=>{
  const {workspace}=fixture(),focus=workspace.widgets.find(widget=>widget.type==='focus');
  assert.equal(extractAssistantTimerSeconds('set a timer for 5 mins'),300);
  assert.equal(extractAssistantTimerSeconds('start a 1.5 hour timer'),5400);
  assert.deepEqual(assistantActionRequest('set a timer for 5 mins'),['set_timer']);
  assert.deepEqual(resolveDirectAssistantActions('set a timer for 5 mins',workspace,[]),[{type:'set_timer',ids:[focus.id],seconds:300}]);
  const next=createWidget('focus');workspace.widgets.push(next);
  assert.equal(resolveDirectAssistantActions('set timer for 5 minutes',workspace,[]),null,'ask the model when target is ambiguous');
  assert.equal(resolveDirectAssistantActions('set timer for 5 minutes',workspace,[focus.id,next.id]),null,'never start timers on multiple widgets implicitly');
  assert.deepEqual(resolveDirectAssistantActions('set timer for 5 minutes',workspace,[next.id]),[{type:'set_timer',ids:[next.id],seconds:300}]);
  const changed=applyAssistantWidgetActions(workspace,[{type:'set_timer',ids:[next.id],seconds:300}],900,700,1000);
  assert.equal(changed.widgets.find(widget=>widget.id===next.id).remaining,300);
  assert.equal(changed.widgets.find(widget=>widget.id===next.id).end,301000);
  assert.throws(()=>applyAssistantWidgetActions(workspace,[{type:'set_timer',ids:[workspace.widgets[0].id],seconds:300}],900,700,1000),/Clock|Focus/,'non-timer widgets cannot receive timers');
});
test('a timer request creates and starts a Focus widget when the workspace has no timer control',()=>{
  const workspace=createWorkspace('Timer',[]),next=addFocusForAssistantTimer(workspace,900,700,60,5000);
  assert.equal(next.widgets.length,1);
  assert.equal(next.widgets[0].type,'focus');
  assert.equal(next.widgets[0].remaining,60);
  assert.equal(next.widgets[0].end,65000);
  assert.deepEqual(workspace.widgets,[],'the original workspace remains unchanged');
  assert.throws(()=>addFocusForAssistantTimer(next,900,700,60,5000),/already exists/);
  assert.throws(()=>addFocusForAssistantTimer(workspace,900,700,0,5000),/duration/);
});
test('Gemini key setup shows the verification reason instead of masking it',()=>{
  assert.equal(assistantKeyError(new Error('Gemini could not authorize this key. Check it in Google AI Studio and reconnect.')),'Gemini could not authorize this key. Check it in Google AI Studio and reconnect.');
  assert.equal(assistantKeyError('Google Gemini is temporarily unavailable.'),'Google Gemini is temporarily unavailable.');
  assert.equal(assistantKeyError({unexpected:true}),'Could not verify the API key.');
});
test('model selection prefers the configured default only when the project exposes it',()=>{
  assert.equal(preferredModel(['gemini-3.8-flash','gemini-2.5-flash']),'gemini-2.5-flash');
  assert.equal(preferredModel(['gemini-3.8-flash']),'gemini-3.8-flash');
  assert.equal(preferredModel([]),'gemini-2.5-flash');
  assert.equal(preferredModel(['gpt-4.1-mini','gpt-4o-mini'],'openai'),'gpt-4o-mini');
  assert.equal(preferredModel(['gpt-4.1-mini'],'openai'),'gpt-4.1-mini');
});
