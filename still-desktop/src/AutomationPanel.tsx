import {useState} from 'react';
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
 return`Prepare ${workspace?.name??action.workspaceId} with ${layout?.name??action.layoutId}`;
}
function statusLabel(status:string):string{return status.replaceAll('_',' ')}
export interface AutomationPanelProps {runner:AutomationRunnerApi;catalog:RuleCatalog}
/** This view is optional; the app-root runner hook keeps working while this panel is closed. */
export function AutomationPanel({runner,catalog}:AutomationPanelProps){
 const [draft,setDraft]=useState(''),[message,setMessage]=useState<string|null>(null),[busy,setBusy]=useState(false);
 const latestByRule=new Map<string,AutomationRunnerApi['state']['receipts'][number]>();
 for(const receipt of [...runner.state.receipts].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)))if(!latestByRule.has(receipt.ruleId))latestByRule.set(receipt.ruleId,receipt);
 const submit=async(event:React.FormEvent)=>{event.preventDefault();setBusy(true);setMessage(null);try{const result=await runner.createFromText(draft);if(result.kind==='rule'){setDraft('');setMessage('Automation saved.')}else setMessage(result.message)}catch(error){setMessage(error instanceof Error?error.message:String(error))}finally{setBusy(false)}};
 const runDue=async()=>{setBusy(true);setMessage(null);try{await runner.runDueNow();setMessage('Due automation check finished.')}catch(error){setMessage(error instanceof Error?error.message:String(error))}finally{setBusy(false)}};
 return <section className="automation-panel" aria-label="Automation rules">
  <header className="automation-panel-header"><div><p className="eyebrow">Automation</p><h2>Rules</h2></div><button type="button" onClick={()=>void runDue()} disabled={busy}>Run due now</button></header>
  {runner.mode==='native-tray-runtime'&&<p className="automation-runtime-status">Desktop runtime is listening for native tray ticks{runner.runtimeStatus?.hiddenToTray?' while Still is hidden in the tray':''}.</p>}
  {runner.mode==='web-preview-page-open'&&<p className="automation-runtime-status">Web preview only runs rules while this page remains open. Native tray scheduling is available in the desktop app.</p>}
  {runner.mode==='starting'&&<p className="automation-runtime-status">Starting automation runtime…</p>}
  {runner.mode==='runtime-error'&&<p className="automation-error" role="status">{runner.error??'Automation runtime is unavailable.'}</p>}
  {!runner.captureQueueAvailable&&runner.state.rules.some(rule=>rule.trigger.kind==='onCapture')&&<p className="automation-error" role="status">Capture rules are saved, but this app build has no pending QuickCapture event queue. They will not run until a real capture source is connected.</p>}
  {runner.pendingCaptures.length>0&&<div className="automation-pending" role="status">{runner.pendingCaptures.length} pending capture event(s) awaiting a matching rule or acknowledgement.</div>}
  {runner.error&&runner.mode!=='runtime-error'&&<p className="automation-error" role="status">{runner.error}</p>}
  {runner.lastTickAt&&<small className="automation-last-tick">Last native/preview tick: {new Date(runner.lastTickAt).toLocaleString()}</small>}
  <form className="automation-create-form" onSubmit={event=>void submit(event)}>
   <label htmlFor="automation-rule-text">Create a rule in one sentence</label>
   <textarea id="automation-rule-text" rows={3} value={draft} onChange={event=>setDraft(event.target.value)} placeholder={'When I capture links matching “lecture”, file them to Biology course\nEvery day at 09:00 prepare Biology workspace using Lab setup layout'} />
   <button type="submit" disabled={busy||!draft.trim()}>Save rule</button>
   {message&&<p className="automation-form-message" role="status">{message}</p>}
  </form>
  <div className="automation-rules-list">
   <h3>Saved rules</h3>
   {runner.state.rules.length===0?<p className="automation-empty">No automation rules yet.</p>:runner.state.rules.map(rule=>{
    const receipt=latestByRule.get(rule.id);
    return <article className="automation-rule" key={rule.id}>
     <div className="automation-rule-main"><strong>{actionLabel(rule.action,catalog)}</strong><span>{triggerLabel(rule.trigger)}</span>{receipt&&<small className={`automation-receipt automation-receipt-${receipt.status}`}><b>{statusLabel(receipt.status)}</b>{receipt.message?` · ${receipt.message}`:''}{receipt.operationReceiptId?` · receipt ${receipt.operationReceiptId}`:''} · {new Date(receipt.updatedAt).toLocaleString()}</small>}</div>
     <div className="automation-rule-actions"><label><input type="checkbox" checked={rule.enabled} onChange={event=>runner.setEnabled(rule.id,event.target.checked)}/> Enabled</label><button type="button" onClick={()=>runner.deleteRule(rule.id)}>Delete</button></div>
    </article>
   })}
  </div>
 </section>;
}
