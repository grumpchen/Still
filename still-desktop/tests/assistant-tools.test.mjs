import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStillWorkspaceToolRegistry,validateReviewedGeometryIntent} from '../src/domain/assistantTools.ts';
import {createWidget} from '../src/domain/workspaces.ts';

function snapshot(revision='rev-1'){
  const notes=createWidget('notes');
  notes.title='Research';
  notes.text='private note body';
  notes.noteDocuments[0].title='Draft';
  notes.noteDocuments[0].text='private document body';
  notes.noteDocuments[0].sourcePath='C:/private/notes.md';
  const timetable=createWidget('timetable');
  timetable.schedule=[{id:'class-1',day:2,time:'10:00',title:'Chemistry',location:'Room 1'}];
  return {
    revision,
    workspace:{id:'workspace-1',name:'Study',widgets:[notes,timetable],groups:[],layout:'canvas',role:'study'},
    savedTrayItems:[{id:'preset-p1',name:'Saved Notes',type:'notes',kind:'preset'}],
    workspaces:[{id:'workspace-1',name:'Study'},{id:'workspace-2',name:'Library'}],
    preferences:{theme:'light'},
    canvasSize:{width:1000,height:700},
  };
}

test('inspection is read-only and omits note bodies and local paths',async()=>{
  const registry=createStillWorkspaceToolRegistry({getSnapshot:()=>snapshot(),validate(){throw new Error('not used')},validateIntent(){throw new Error('not used')},execute(){throw new Error('not used')}});
  const result=await registry.tools.inspect_workspace({});
  assert.equal(result.status,'succeeded');
  assert.equal(result.mutation,'none');
  const json=JSON.stringify(result.result);
  assert.match(json,/Chemistry/);
  assert.match(json,/"theme":"light"/);
  assert.match(json,/"placement"/);
  assert.match(json,/Draft/);
  assert.doesNotMatch(json,/private note body|private document body|C:\/private/);
});

test('theme preference action is reviewed with exact before and after values and executes through the app action',async()=>{
  let current=snapshot(),executed;
  const registry=createStillWorkspaceToolRegistry({getSnapshot:()=>current,validate(){},validateIntent(){},execute:(_snapshot,actions)=>{executed=actions;current={...current,preferences:{theme:'dark'}};return 'Theme preference is dark.'}});
  const prepared=await registry.tools.propose_workspace_action({snapshotRevision:'rev-1',action:{type:'set_setting',ids:['theme'],settingValue:'dark'}});
  assert.equal(prepared.status,'requires_confirmation');
  assert.deepEqual(prepared.proposal.preferenceChange,{key:'theme',before:'light',after:'dark'});
  assert.equal(executed,undefined,'proposal does not mutate');
  const done=await registry.executeConfirmedAction(prepared.proposal);
  assert.equal(done.status,'succeeded');
  assert.equal(done.result.receipt,'Theme preference is dark.');
  assert.deepEqual(executed,[{type:'set_setting',ids:['theme'],settingValue:'dark'}]);
  assert.equal(current.preferences.theme,'dark');
});

test('geometry action proposal carries exact before and after placement and rejects malformed geometry',async()=>{
  const state=snapshot(),target=state.workspace.widgets[0];
  const registry=createStillWorkspaceToolRegistry({getSnapshot:()=>state,validate(){},validateIntent(){},execute(){return 'Applied'}});
  const prepared=await registry.tools.propose_workspace_action({snapshotRevision:'rev-1',action:{type:'set_widget_geometry',ids:[target.id],operation:'move',x:320,y:140}});
  assert.equal(prepared.status,'requires_confirmation');
  assert.deepEqual(prepared.proposal.geometryChange,{widgetId:target.id,operation:'move',before:target.placement,after:{...target.placement,x:320,y:140}});
  for(const action of [
    {type:'set_widget_geometry',ids:[target.id],operation:'move',x:320,y:140,width:600},
    {type:'set_widget_geometry',ids:[target.id],operation:'resize',width:640,height:480,x:0},
    {type:'set_widget_geometry',ids:[target.id],operation:'resize',width:99999,height:480},
  ]) assert.equal((await registry.tools.propose_workspace_action({snapshotRevision:'rev-1',action})).status,'failed');
  const move=prepared.proposal.action;
  assert.throws(()=>validateReviewedGeometryIntent('move the selected widget to x=320 y=140',move,['other-widget']),/Select exactly one widget/);
  assert.throws(()=>validateReviewedGeometryIntent('move the selected widget to x=321 y=140',move,[target.id]),/match an explicit request/);
  assert.doesNotThrow(()=>validateReviewedGeometryIntent('move the selected widget to x=320 y=140',move,[target.id]));
});

test('add_widget accepts catalog types with a fresh revision and stops at a proposal',async()=>{
  let validations=0,executions=0;
  const registry=createStillWorkspaceToolRegistry({getSnapshot:()=>snapshot(),validate(_state,actions){validations++;assert.deepEqual(actions,[{type:'add_widget',ids:['files']}])},validateIntent(){},execute(){executions++;return 'Added.'}});
  assert.equal((await registry.tools.add_widget({widgetType:'not-a-widget',snapshotRevision:'rev-1'})).status,'failed');
  assert.equal((await registry.tools.add_widget({widgetType:'notes',snapshotRevision:'stale'})).status,'failed');
  assert.equal(validations,0);
  const prepared=await registry.tools.add_widget({widgetType:'files',snapshotRevision:'rev-1'});
  assert.equal(prepared.status,'requires_confirmation');
  assert.equal(validations,1);
  assert.equal(executions,0,'model tool dispatch never executes a mutation');
  assert.equal(Object.isFrozen(prepared.proposal),true);
  assert.equal(prepared.proposal.widgetType,'files');
});

test('approval is bound to the exact proposal object and returns the exact executor receipt',async()=>{
  let validations=0,executed;
  const receipt='Added a Notes widget. (instance 3)';
  const registry=createStillWorkspaceToolRegistry({getSnapshot:()=>snapshot(),validate(){validations++},validateIntent(){},execute:(state,actions)=>{executed={revision:state.revision,actions};return receipt}});
  const prepared=await registry.tools.add_widget({widgetType:'files',snapshotRevision:'rev-1'});
  assert.equal(prepared.status,'requires_confirmation');
  const proposal=prepared.proposal;
  const copied={...proposal};
  assert.deepEqual(await registry.executeConfirmed(copied),{status:'failed',mutation:'none',error:'This proposal is no longer available for approval. Nothing was changed.'});
  const result=await registry.executeConfirmed(proposal);
  assert.deepEqual(executed,{revision:'rev-1',actions:[{type:'add_widget',ids:['files']}]});
  assert.deepEqual(result,{status:'succeeded',mutation:'applied',result:{receipt}});
  assert.equal(validations,2,'the app validator is rerun at approval time');
  assert.equal((await registry.executeConfirmed(proposal)).status,'failed','approval is single-use');
});

test('approval rejects changed state before execution and never reuses approval',async()=>{
  let revision='rev-1',executions=0;
  const registry=createStillWorkspaceToolRegistry({getSnapshot:()=>snapshot(revision),validate(){},validateIntent(){},execute(){executions++;return 'Added.'}});
  const prepared=await registry.tools.add_widget({widgetType:'notes',snapshotRevision:'rev-1'});
  revision='rev-2';
  const result=await registry.executeConfirmed(prepared.proposal);
  assert.equal(result.status,'failed');
  assert.match(result.error,/changed while you reviewed/i);
  assert.equal(executions,0);
  assert.equal((await registry.executeConfirmed(prepared.proposal)).status,'failed');
});

test('validation failure is known non-mutation; executor failure is uncertain',async()=>{
  const invalid=createStillWorkspaceToolRegistry({getSnapshot:()=>snapshot(),validate(){throw new Error('Target unavailable.')},validateIntent(){},execute(){return 'Never'}});
  const proposal=await invalid.tools.add_widget({widgetType:'notes',snapshotRevision:'rev-1'});
  assert.deepEqual(proposal,{status:'failed',mutation:'none',error:'Target unavailable.'});
  let after;
  const uncertain=createStillWorkspaceToolRegistry({getSnapshot:()=>snapshot(),validate(){},validateIntent(){},execute(){throw new Error('UI operation interrupted')}});
  after=await uncertain.tools.add_widget({widgetType:'notes',snapshotRevision:'rev-1'});
  assert.deepEqual(await uncertain.executeConfirmed(after.proposal),{status:'failed',mutation:'unknown',error:'UI operation interrupted'});
});

test('safe workspace actions are one-action proposals with intent and revision rechecks',async()=>{
  let validations=0,intentValidations=0,executions=0,received;
  const receipt='Timer paused.';
  const registry=createStillWorkspaceToolRegistry({
    getSnapshot:()=>snapshot(),
    validate(_state,actions){validations++;assert.deepEqual(actions,[{type:'control_timer',ids:['timer-1'],operation:'pause'}])},
    validateIntent(_state,actions){intentValidations++;assert.equal(actions[0].type,'control_timer')},
    execute:(state,actions)=>{executions++;received={revision:state.revision,actions};return receipt},
  });
  const prepared=await registry.tools.propose_workspace_action({snapshotRevision:'rev-1',action:{type:'control_timer',ids:['timer-1'],operation:'pause'}});
  assert.equal(prepared.status,'requires_confirmation');
  assert.equal(executions,0);
  assert.equal(validations,1);
  assert.equal(intentValidations,1);
  const completed=await registry.executeConfirmedAction(prepared.proposal);
  assert.deepEqual(completed,{status:'succeeded',mutation:'applied',result:{receipt}});
  assert.deepEqual(received,{revision:'rev-1',actions:[{type:'control_timer',ids:['timer-1'],operation:'pause'}]});
  assert.equal(validations,2);
  assert.equal(intentValidations,2);
  assert.equal(executions,1);
});

test('safe workspace action parser rejects arbitrary edits, extra fields, and malformed visibility',async()=>{
  const registry=createStillWorkspaceToolRegistry({getSnapshot:()=>snapshot(),validate(){},validateIntent(){},execute(){return 'Applied'}});
  for(const action of [
    {type:'edit_widget',ids:['notes-1'],text:'overwritten'},
    {type:'control_timer',ids:['timer-1'],operation:'launch'},
    {type:'set_ui_visibility',ids:['taskbar'],enabled:false},
    {type:'set_timer',ids:['timer-1'],seconds:60,confirmationToken:'forged'},
    {type:'create_note_document',ids:['notes-1'],title:'',text:null},
    {type:'create_note_document',ids:['notes-1'],title:'Draft'},
    {type:'set_setting',ids:['theme'],settingValue:['dark']},
  ]){
    assert.equal((await registry.tools.propose_workspace_action({snapshotRevision:'rev-1',action})).status,'failed');
  }
});

test('create note tool args require text as an explicit nullable field',async()=>{
  const registry=createStillWorkspaceToolRegistry({getSnapshot:()=>snapshot(),validate(){},validateIntent(){},execute(){return 'Created.'}});
  const noText=await registry.tools.propose_workspace_action({snapshotRevision:'rev-1',action:{type:'create_note_document',ids:['notes-1'],title:'Draft'}});
  assert.equal(noText.status,'failed','omitted text does not match the strict provider schema');
  const emptyText=await registry.tools.propose_workspace_action({snapshotRevision:'rev-1',action:{type:'create_note_document',ids:['notes-1'],title:'Draft',text:null}});
  assert.equal(emptyText.status,'requires_confirmation');
  assert.equal(Object.hasOwn(emptyText.proposal.action,'text'),false,'null means no initial note text in the app action');
  const withText=await registry.tools.propose_workspace_action({snapshotRevision:'rev-1',action:{type:'create_note_document',ids:['notes-1'],title:'Draft',text:'Review chapter 2'}});
  assert.equal(withText.status,'requires_confirmation');
  assert.equal(withText.proposal.action.text,'Review chapter 2');
});

test('safe action preparation refuses stale state and failed user intent validation',async()=>{
  const stale=createStillWorkspaceToolRegistry({getSnapshot:()=>snapshot('rev-2'),validate(){throw new Error('must not validate')},validateIntent(){},execute(){return 'Applied'}});
  const action={type:'set_ui_visibility',ids:['sidebar'],enabled:false};
  assert.match((await stale.tools.propose_workspace_action({snapshotRevision:'rev-1',action})).error,/state changed/i);
  const unclear=createStillWorkspaceToolRegistry({getSnapshot:()=>snapshot(),validate(){},validateIntent(){throw new Error("Action does not match the user's request.")},execute(){return 'Applied'}});
  const result=await unclear.tools.propose_workspace_action({snapshotRevision:'rev-1',action});
  assert.deepEqual(result,{status:'failed',mutation:'none',error:"Action does not match the user's request."});
});

test('assistant memory proposal is gated, reviewed, saved once, and returns the exact saved entry',async()=>{
  const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  const checks=[];
  const registry=createStillWorkspaceToolRegistry({getSnapshot:()=>snapshot(),validate(){},validateIntent(){},execute(){return 'unused'},memoryStorage:storage,validateMemoryIntent:text=>checks.push(text),enableAssistantMemoryTool:true});
  const args={text:'  I prefer   concise answers.  '};
  const prepared=await registry.tools.propose_assistant_memory(args);
  assert.equal(prepared.status,'requires_confirmation');
  assert.deepEqual(prepared.proposal,{kind:'assistant_memory',text:'I prefer concise answers.'});
  assert.equal(Object.isFrozen(prepared.proposal),true);
  assert.equal(storage.getItem('still-assistant-memory-v1'),null,'model proposal does not write');
  assert.deepEqual(checks,['I prefer concise answers.']);

  const copied={...prepared.proposal};
  assert.equal((await registry.executeConfirmedMemory(copied)).status,'failed','approval is bound to exact proposal object');
  const result=await registry.executeConfirmedMemory(prepared.proposal);
  assert.equal(result.status,'succeeded');
  assert.equal(result.mutation,'applied');
  assert.equal(result.result.receipt,'Saved this item to local assistant memory.');
  assert.deepEqual(JSON.parse(storage.getItem('still-assistant-memory-v1')),[result.result.entry]);
  assert.equal(result.result.entry.text,'I prefer concise answers.');
  assert.deepEqual(checks,['I prefer concise answers.','I prefer concise answers.'],'intent is checked again at approval');
  assert.equal((await registry.executeConfirmedMemory(prepared.proposal)).status,'failed','approval is single-use');
});

test('assistant memory tool fails closed without explicit intent validation and rejects unsafe input',async()=>{
  const unavailable=createStillWorkspaceToolRegistry({getSnapshot:()=>snapshot(),validate(){},validateIntent(){},execute(){return 'unused'}});
  assert.equal(Object.hasOwn(unavailable.tools,'propose_assistant_memory'),false,'memory tool is absent by default');
  const errors=[];
  const registry=createStillWorkspaceToolRegistry({getSnapshot:()=>snapshot(),validate(){},validateIntent(){},execute(){return 'unused'},validateMemoryIntent:text=>{if(text==='invented model claim')throw new Error('Memory text must come from the original user request.');errors.push(text)},enableAssistantMemoryTool:true});
  for(const input of [null,{}, {text:' '}, {text:'x'.repeat(1001)}, {text:'line\u0000break'}, {text:'remember',id:'forged'}, {text:'invented model claim'}]) {
    assert.equal((await registry.tools.propose_assistant_memory(input)).status,'failed');
  }
  assert.equal((await registry.tools.propose_assistant_memory({text:'remember'})).status,'requires_confirmation');
  assert.deepEqual(errors,['remember']);
});

test('assistant memory approval reports limits and uncertain storage writes without claiming success',async()=>{
  const values=new Map();
  const full={getItem:key=>JSON.stringify(Array.from({length:100},(_,index)=>({id:`memory-${index}`,text:`Memory ${index}`,createdAt:index}))),setItem(){throw new Error('must not write')}};
  const registry=createStillWorkspaceToolRegistry({getSnapshot:()=>snapshot(),validate(){},validateIntent(){},execute(){return 'unused'},memoryStorage:full,validateMemoryIntent(){},enableAssistantMemoryTool:true});
  const limited=await registry.tools.propose_assistant_memory({text:'One more memory'});
  assert.equal((await registry.executeConfirmedMemory(limited.proposal)).status,'failed');
  assert.match((await registry.executeConfirmedMemory(limited.proposal)).error,/no longer available/i);

  const failing={getItem:()=>null,setItem(){throw new Error('quota')}};
  const uncertain=createStillWorkspaceToolRegistry({getSnapshot:()=>snapshot(),validate(){},validateIntent(){},execute(){return 'unused'},memoryStorage:failing,validateMemoryIntent(){},enableAssistantMemoryTool:true});
  const proposal=await uncertain.tools.propose_assistant_memory({text:'Another memory'});
  assert.deepEqual(await uncertain.executeConfirmedMemory(proposal.proposal),{status:'failed',mutation:'unknown',error:'Still could not confirm whether the memory was saved. Check local assistant memory before retrying.'});
});
