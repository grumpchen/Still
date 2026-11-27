import {useEffect,useState} from 'react';
import type {RuleCatalog} from './domain/automationRules.ts';
import type {AutomationRunnerApi} from './useAutomationRunner.ts';
import './automationPanel.css';

function triggerLabel(trigger:AutomationRunnerApi['state']['rules'][number]['trigger']):string{
 if(trigger.kind==='onCapture')return'When a matching item is captured';
 if(trigger.kind==='once')return`Once · ${new Date(trigger.at).toLocaleString()}`;
 if(trigger.kind==='daily')return`Daily · ${trigger.time} (${trigger.timeZone})`;
 return`Weekly · ${trigger.weekdays.join(', ')} · ${trigger.time} (${trigger.timeZone})`;
}
function actionLabel(action:AutomationRunnerApi['state']['rules'][number]['action'],catalog:RuleCatalog):string{
 if(action.kind==='fileResourcesToCourse'){
  const course=catalog.courses.find(item=>item.id===action.courseId),workspace=catalog.workspaces.find(item=>item.id===action.workspaceId);
  return`File ${action.resourceKinds.join(' and ')} matching “${action.queryPattern}” into ${course?.title??action.courseId} · ${workspace?.name??action.workspaceId}`;
 }
 const workspace=catalog.workspaces.find(item=>item.id===action.workspaceId),layout=catalog.layouts.find(item=>item.id===action.layoutId);
 return`${action.mode?`${action.mode==='append'?'Append':'Replace'} · `:''}${action.mode?'Prepare':'Choose append or replace'} ${workspace?.name??action.workspaceId} with ${layout?.name??action.layoutId}`;
}
function statusLabel(status:string):string{return status.replaceAll('_',' ')}
export interface AutomationPanelProps {runner:AutomationRunnerApi;catalog:RuleCatalog;initialDraft?:string;requireLayoutMode?:boolean}
/** This view is optional; the app-root runner hook keeps working while this panel is closed. */
export function AutomationPanel({runner,catalog,initialDraft='',requireLayoutMode=false}:AutomationPanelProps){
 const [draft,setDraft]=useState(''),[message,setMessage]=useState<string|null>(null),[messageIsError,setMessageIsError]=useState(false),[busy,setBusy]=useState(false),[modeChoicePending,setModeChoicePending]=useState(false),[createLayoutMode,setCreateLayoutMode]=useState<'append'|'replace'|''>(''),[legacyModes,setLegacyModes]=useState<Record<string,'append'|'replace'|''>>({});
 useEffect(()=>{if(initialDraft){setDraft(initialDraft);setModeChoicePending(requireLayoutMode)}},[initialDraft,requireLayoutMode]);
 const latestByRule=new Map<string,AutomationRunnerApi['state']['receipts'][number]>();
 for(const receipt of [...runner.state.receipts].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)))if(!latestByRule.has(receipt.ruleId))latestByRule.set(receipt.ruleId,receipt);
 const submit=async(event:React.FormEvent)=>{event.preventDefault();setBusy(true);setMessage(null);setMessageIsError(false);try{const existingIds=new Set(runner.state.rules.map(rule=>rule.id)),result=await runner.createFromText(draft,createLayoutMode||undefined);if(result.kind==='rule'){setDraft('');setModeChoicePending(false);setCreateLayoutMode('');setMessage(existingIds.has(result.rule.id)?'This rule already exists; the existing rule was kept.':'Automation saved.')}else{if(result.kind==='clarification'&&result.code==='layout-mode-required')setModeChoicePending(true);setMessage(result.message);setMessageIsError(true)}}catch(error){setMessage(error instanceof Error?error.message:String(error));setMessageIsError(true)}finally{setBusy(false)}};
 const runDue=async()=>{setBusy(true);setMessage(null);setMessageIsError(false);try{const result=await runner.runDueNow();if(!result.ok){setMessage(result.message??'Could not check automations.');setMessageIsError(true)}else if(result.dueCount===0)setMessage(runner.captureQueueAvailable?'No scheduled rules were due. Pending capture events were also checked.':'No scheduled rules were due, and no pending capture queue is connected.');else if(result.attentionCount>0||result.notConfirmedCount>0)setMessage(`Run check finished: ${result.succeededCount} succeeded, ${result.attentionCount} need attention, ${result.notConfirmedCount} not confirmed. See each rule receipt below.`);else setMessage(`${result.succeededCount} due rule(s) ran successfully.`)}catch(error){setMessage(error instanceof Error?error.message:String(error));setMessageIsError(true)}finally{setBusy(false)}};
 return <section className="automation-panel" aria-label="Automation rules">
  <header className="automation-panel-header"><div><p className="eyebrow">Automation</p><h2>Rules</h2></div><button type="button" onClick={()=>void runDue()} disabled={busy}>{busy?'Working…':'Run due now'}</button></header>
  {runner.mode==='native-tray-runtime'&&<p className="automation-runtime-status">Rules keep running in the system tray{runner.runtimeStatus?.hiddenToTray?' while Still is hidden in the tray':''}.</p>}
  {runner.mode==='web-preview-page-open'&&<p className="automation-runtime-status">Web preview only runs rules while this page remains open. Native tray scheduling is available in the desktop app.</p>}
  {runner.mode==='starting'&&<p className="automation-runtime-status">Starting automation runtime…</p>}
  {runner.mode==='runtime-error'&&<p className="automation-error" role="status">{runner.error??'Automation runtime is unavailable.'}</p>}
  {!runner.captureQueueAvailable&&runner.state.rules.some(rule=>rule.trigger.kind==='onCapture')&&<p className="automation-error" role="status">Capture rules are saved, but this app build has no pending QuickCapture event queue. They will not run until a real capture source is connected.</p>}
  {runner.pendingCaptures.length>0&&<div className="automation-pending" role="status">{runner.pendingCaptures.length} pending capture event(s) awaiting a matching rule or acknowledgement.</div>}
  {runner.ignoredCaptures>0&&<div className="automation-pending" role="status">{runner.ignoredCaptures} capture event(s) are terminally ignored because they had no matching rule, were idea captures, or came from an unrecognized legacy link origin.</div>}
  {runner.error&&runner.mode!=='runtime-error'&&<p className="automation-error" role="status">{runner.error}</p>}
  {runner.lastTickAt&&<small className="automation-last-tick">Last native/preview tick: {new Date(runner.lastTickAt).toLocaleString()}</small>}
  <form className="automation-create-form" onSubmit={event=>void submit(event)}>
   <label htmlFor="automation-rule-text">Create a rule in one sentence</label>
   <textarea id="automation-rule-text" rows={3} value={draft} onChange={event=>{setDraft(event.target.value);setModeChoicePending(false);setCreateLayoutMode('')}} placeholder={'When I capture links matching “lecture”, file them to Biology course\nEvery day at 09:00 append Lab setup layout to Biology workspace'} />
   <details className="automation-examples"><summary>Supported rule examples</summary><p>Rules use exact course, workspace, and saved layout names. Unsupported wording or ambiguous names will ask for clarification.</p><ul><li>When I capture links matching “lecture”, file them to Biology course</li><li>Every day at 09:00 append Lab layout to Biology workspace</li><li>At 2026-11-27 09:00 append Lab layout to Biology workspace</li></ul><p>Capture rules need a real QuickCapture event queue. Scheduled rules run in the desktop tray; web preview runs only while this page is open.</p></details>
   {modeChoicePending&&<label>Layout application mode<select aria-label="Layout application mode" value={createLayoutMode} onChange={event=>setCreateLayoutMode(event.target.value as 'append'|'replace'|'')}><option value="">Choose append or replace</option><option value="append">Append · keep existing widgets</option><option value="replace">Replace · replace workspace layout</option></select></label>}
   <button type="submit" disabled={busy||!draft.trim()||(modeChoicePending&&!createLayoutMode)}>{busy?'Saving…':modeChoicePending?'Save with selected mode':'Save rule'}</button>
   {message&&<p className={`automation-form-message${messageIsError?' automation-error':''}`} role={messageIsError?'alert':'status'}>{message}</p>}
  </form>
  <div className="automation-rules-list">
   <h3>Saved rules</h3>
   {runner.state.rules.length===0?<p className="automation-empty">No automation rules yet.</p>:runner.state.rules.map(rule=>{
    const receipt=latestByRule.get(rule.id);
    return <article className="automation-rule" key={rule.id}>
     <div className="automation-rule-main"><strong>{actionLabel(rule.action,catalog)}</strong><span>{triggerLabel(rule.trigger)}</span>{receipt&&<small className={`automation-receipt automation-receipt-${receipt.status}`}><b>{statusLabel(receipt.status)}</b>{receipt.message?` · ${receipt.message}`:''} · {new Date(receipt.updatedAt).toLocaleString()}</small>}</div>
     <div className="automation-rule-actions">{rule.requiresModeChoice&&<label>Layout mode<select aria-label={`Layout mode for ${rule.id}`} value={legacyModes[rule.id]??''} onChange={event=>setLegacyModes(value=>({...value,[rule.id]:event.target.value as 'append'|'replace'|''}))}><option value="">Choose</option><option value="append">Append</option><option value="replace">Replace</option></select><button type="button" disabled={!legacyModes[rule.id]} onClick={()=>{const mode=legacyModes[rule.id];if(mode){runner.setLayoutMode(rule.id,mode);setLegacyModes(value=>({...value,[rule.id]:''}))}}}>Save mode</button></label>}<label><input type="checkbox" checked={rule.enabled} disabled={rule.requiresModeChoice} onChange={event=>runner.setEnabled(rule.id,event.target.checked)}/> Enabled</label><button type="button" onClick={()=>runner.deleteRule(rule.id)}>Delete</button></div>
    </article>
   })}
  </div>
 </section>;
}
