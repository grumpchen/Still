import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWidget,createWorkspace} from '../src/domain/workspaces.ts';
import {assistantActionRequest,assistantLayoutRequested,assistantRequestLimitError,assistantTrayItems,unsupportedAssistantRequest,extractAssistantTimerSeconds,resolveDirectAssistantActions,addFocusForAssistantTimer,settleAssistantConfirmation,assistantKeyError,assistantWorkspaceContext,preferredModel,widgetContext,layoutContext,layoutFingerprint,parseAssistantReply,validateAssistantActionIntent,validateAssistantActions,applyAssistantWidgetActions,validateLayout,applyLayoutPlan,MAX_ASSISTANT_BATCH,MAX_ASSISTANT_WIDGETS} from '../src/domain/assistant.ts';

function fixture(){
  const workspace=createWorkspace('Study',[]),note=createWidget('notes'),timer=createWidget('focus');
  note.placement={x:0,y:0,width:300,height:250};timer.placement={x:330,y:0,width:300,height:350};workspace.widgets=[note,timer];
  const items=workspace.widgets.map(w=>({id:w.id,...w.placement}));
  return {workspace,items};
}
test('sharing a selected widget omits grants, URLs, bookmarks, and unrelated content',()=>{
  const note=createWidget('notes');note.text='Only this note';note.fileKey='secret-grant';note.url='https://example.org/private';
  assert.deepEqual(widgetContext(note),{type:'notes',title:'Notes 1',text:'Only this note'});
  const app=createWidget('apps');app.appKey='secret-app';assert.ok(!JSON.stringify(widgetContext(app)).includes('secret-app'));
  const {workspace}=fixture();workspace.widgets[0].text='private note';assert.ok(!JSON.stringify(layoutContext(workspace,900,700)).includes('private note'));
});
test('workspace context always exposes layout metadata and reads only @-selected widgets',()=>{
  const {workspace}=fixture(),note=workspace.widgets[0],timer=workspace.widgets[1];note.text='private note';timer.remaining=88;
  const context=assistantWorkspaceContext(workspace,900,700,[note.id]);
  assert.equal(context.canvasAndWidgets.widgets.length,2);
  assert.deepEqual(context.selectedWidgets,[widgetContext(note)]);
  assert.equal(JSON.stringify(context.selectedWidgets).includes('private note'),true);
  assert.ok(!JSON.stringify(context.selectedWidgets).includes(String(timer.remaining)));
  assert.deepEqual(assistantWorkspaceContext(workspace,900,700,[note.id,note.id]).selectedWidgets,[widgetContext(note)]);
  assert.equal(assistantWorkspaceContext(workspace,900,700,workspace.widgets.map(widget=>widget.id)).selectedWidgets.length,2);
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
});
test('explicit all-widget tray requests resolve to real workspace IDs without relying on the model',()=>{
  const {workspace}=fixture();
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
