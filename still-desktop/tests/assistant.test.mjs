import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWidget,createWorkspace} from '../src/domain/workspaces.ts';
import {widgetTypes} from '../src/domain/widgetCatalog.ts';
import {assistantActionRequest,assistantEditClarification,assistantReplyNeedsClarification,assistantLayoutRequested,assistantRequestLimitError,assistantTrayItems,unsupportedAssistantRequest,extractAssistantTimerSeconds,resolveDirectAssistantActions,resolveAcceptedNotesOffer,addFocusForAssistantTimer,settleAssistantConfirmation,assistantKeyError,assistantWorkspaceContext,preferredModel,widgetContext,layoutContext,layoutFingerprint,parseAssistantReply,validateAssistantActionIntent,validateAssistantActions,applyAssistantWidgetActions,validateLayout,applyLayoutPlan,prepareAssistantHistory,assistantAddedWidgetReceipt,safeAssistantReceipt,MAX_ASSISTANT_BATCH,MAX_ASSISTANT_WIDGETS} from '../src/domain/assistant.ts';

function fixture(){
  const workspace=createWorkspace('Study',[]),note=createWidget('notes'),timer=createWidget('focus');
  note.placement={x:0,y:0,width:300,height:250};timer.placement={x:330,y:0,width:300,height:350};workspace.widgets=[note,timer];
  const items=workspace.widgets.map(w=>({id:w.id,...w.placement}));
  return {workspace,items};
}
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
test('sharing a selected widget omits grants, URLs, bookmarks, and unrelated content',()=>{
  const note=createWidget('notes');note.text='Only this note';note.fileKey='secret-grant';note.url='https://example.org/private';
  assert.deepEqual(widgetContext(note),{type:'notes',title:'Notes 1',tagColor:null,text:'Only this note'});
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
  const clock=resolveDirectAssistantActions('add Clock plugin to Notes',workspace,[workspace.widgets[0].id]);
  assert.deepEqual(clock,[{type:'set_widget_plugin',ids:[workspace.widgets[0].id],plugin:'clock-timer',enabled:true}]);
  assert.doesNotThrow(()=>validateAssistantActionIntent('add Clock plugin to Notes',workspace,clock));
  assert.equal(applyAssistantWidgetActions(workspace,clock,900,700).widgets[0].clockPluginEnabled,true);
  assert.deepEqual(parseAssistantReply({reply:'',layout:[],actions:[{type:'set_sidebar_plugin',ids:['stack'],enabled:true}]}).actions,[{type:'set_sidebar_plugin',ids:['stack'],enabled:true}]);
  assert.throws(()=>validateAssistantActions(workspace,[{type:'set_sidebar_plugin',ids:['third-party-code'],enabled:true}]),/Stack or Layout/);
  assert.equal(unsupportedAssistantRequest('delete this workspace'),'delete_workspace');
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
test('assistant response intent separates freeform conversation from workspace operations',()=>{
  const layout=[{id:'notes-1',x:0,y:0,width:300,height:250}],actions=[{type:'edit_widget',ids:['notes-1'],title:'Unexpected edit'}];
  assert.deepEqual(parseAssistantReply({intent:'chat',reply:'A black hole has an event horizon.',layout,actions}),{intent:'chat',reply:'A black hole has an event horizon.',layout:[],actions:[]});
  assert.deepEqual(parseAssistantReply({intent:'clarification',reply:'Which note should I update?',layout,actions}),{intent:'clarification',reply:'Which note should I update?',layout:[],actions:[]});
  assert.deepEqual(parseAssistantReply({intent:'workspace_action',reply:'I can update that note.',layout,actions}),{intent:'workspace_action',reply:'I can update that note.',layout:[],actions});
  assert.deepEqual(parseAssistantReply({intent:'layout',reply:'Here is a layout proposal.',layout,actions}),{intent:'layout',reply:'Here is a layout proposal.',layout,actions:[]});
  assert.throws(()=>parseAssistantReply({intent:'unrecognized',reply:'Hello',layout:[],actions:[]}));
  assert.throws(()=>parseAssistantReply({reply:'Done',layout,actions}),/mixed a layout proposal/,'legacy replies without an intent remain guarded');
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
  assert.throws(()=>parseAssistantReply({reply:'Done',layout:[{id:'notes-1',x:0,y:0,width:200,height:200}],actions:[{type:'minimize',ids:['notes-1']}]}),/layout|action/i);
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
  for(const type of widgetTypes)assert.deepEqual(resolveDirectAssistantActions(`make ${type} widget`,workspace,[]),[{type:'add_widget',ids:[type]}]);
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
  assert.equal(receipt,'Added a Focus widget and a Notes widget.');
  assert.equal(assistantAddedWidgetReceipt([{type:'add_widget',ids:['notes','notes']}]),'Added 2 Notes widgets.');
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
