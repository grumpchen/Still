import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWidget,createWorkspace} from '../src/domain/workspaces.ts';
import {assistantKeyError,widgetContext,layoutContext,layoutFingerprint,parseAssistantReply,validateLayout,applyLayoutPlan} from '../src/domain/assistant.ts';

function fixture(){
  const workspace=createWorkspace('Study',[]),note=createWidget('notes'),timer=createWidget('focus');
  note.placement={x:0,y:0,width:300,height:250};timer.placement={x:330,y:0,width:260,height:250};workspace.widgets=[note,timer];
  const items=workspace.widgets.map(w=>({id:w.id,...w.placement}));
  return {workspace,items};
}
test('sharing a selected widget omits grants, URLs, bookmarks, and unrelated content',()=>{
  const note=createWidget('notes');note.text='Only this note';note.fileKey='secret-grant';note.url='https://example.org/private';
  assert.deepEqual(widgetContext(note),{type:'notes',title:'Notes 1',text:'Only this note'});
  const app=createWidget('apps');app.appKey='secret-app';assert.ok(!JSON.stringify(widgetContext(app)).includes('secret-app'));
  const {workspace}=fixture();workspace.widgets[0].text='private note';assert.ok(!JSON.stringify(layoutContext(workspace,900,700)).includes('private note'));
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
  assert.throws(()=>validateLayout(workspace,[items[0],{...items[1],x:600}],900,700),/overlap/);
});
test('model responses are parsed without trusting arbitrary fields or geometry',()=>{
  assert.deepEqual(parseAssistantReply({reply:'Hello',layout:[],execute:'untrusted'}),{reply:'Hello',layout:[]});
  assert.throws(()=>parseAssistantReply({reply:'',layout:[]}));
  assert.throws(()=>parseAssistantReply({reply:'Hello',layout:[{id:'a',x:0.1,y:0,width:100,height:100}]}));
  assert.throws(()=>parseAssistantReply({reply:'Hello',layout:[null]}));
});
test('Gemini key setup shows the verification reason instead of masking it',()=>{
  assert.equal(assistantKeyError(new Error('Gemini could not authorize this key. Check it in Google AI Studio and reconnect.')),'Gemini could not authorize this key. Check it in Google AI Studio and reconnect.');
  assert.equal(assistantKeyError('Google Gemini is temporarily unavailable.'),'Google Gemini is temporarily unavailable.');
  assert.equal(assistantKeyError({unexpected:true}),'Could not verify the Gemini API key.');
});
