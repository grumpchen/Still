import {useEffect,useRef,useState} from 'react';
import {useLocale} from './localization.tsx';
import {executeLibraryProposal,reviewLibraryProposal,type LibrarySnapshot,type LibraryProposal,type LibraryReceipt,type LibraryNativeOperation,type LibraryUndoResult} from './domain/libraryOrganisation.ts';
import {libraryOrganisation} from './platform/libraryOrganisation.ts';
export interface AssignedLibraryRoot {widgetId:string;name:string}
export interface LibraryOrganisationContext {widgetId:string;snapshot:LibrarySnapshot}
type Props={roots:AssignedLibraryRoot[];proposal:LibraryProposal|null;busy:boolean;reviewUncertain:boolean;acknowledgeReview:()=>void;startReview:()=>string;markReviewUncertain:()=>void;finishReview:(runId:string,text:string)=>void;cancelReview:(text:string)=>void;contextChanged:(value:LibraryOrganisationContext|null)=>void;clearProposal:()=>void;workingChanged:(value:boolean)=>void;apply:(widgetId:string,rootId:string,operation:LibraryNativeOperation)=>Promise<LibraryReceipt>;undo:(widgetId:string,rootId:string,token:string)=>Promise<LibraryUndoResult>};

/** Explicit names-only sharing and review. No operation is run on model response or folder selection. */
export default function AssistantLibraryTools({roots,proposal,busy,reviewUncertain,acknowledgeReview,startReview,markReviewUncertain,finishReview,cancelReview,contextChanged,clearProposal,workingChanged,apply,undo}:Props){
 const zh=useLocale()==='zh-CN',copy=(en:string,cn:string)=>zh?cn:en;
 const [widgetId,setWidgetId]=useState(''),[snapshot,setSnapshot]=useState<LibrarySnapshot|null>(null),[history,setHistory]=useState<LibraryReceipt[]>([]),[selected,setSelected]=useState<string[]>([]),[working,setWorking]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState('');
 const [expanded,setExpanded]=useState(false);
 const lock=useRef(false),alive=useRef(true),currentRoot=useRef(widgetId);currentRoot.current=widgetId;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[]);
 useEffect(()=>{setSelected(proposal?.operations.map(operation=>operation.id)??[]);if(proposal)setExpanded(true)},[proposal]);
 useEffect(()=>{if(widgetId&&!roots.some(root=>root.widgetId===widgetId)){if(proposal)cancelReview(copy('Cancelled Library proposal because its folder is no longer available.','资料库文件夹已不可用，已取消提案。'));setWidgetId('');setSnapshot(null);setHistory([]);contextChanged(null);clearProposal()}},[roots.map(root=>root.widgetId).join('|'),widgetId]);
 function choose(id:string){if(proposal)cancelReview(copy('Cancelled Library proposal because its folder changed.','资料库文件夹已更改，已取消提案。'));setWidgetId(id);setSnapshot(null);setHistory([]);setError('');setStatus('');contextChanged(null);clearProposal()}
 function begin(){lock.current=true;setWorking(true);workingChanged(true);setError('')}
 function end(){lock.current=false;if(alive.current){setWorking(false);workingChanged(false)}}
 async function scan(){if(!widgetId||lock.current)return;begin();const id=widgetId;try{
  const next=await libraryOrganisation.snapshot(id),receipts=await libraryOrganisation.history(id,next.rootId);
  if(!alive.current||currentRoot.current!==id)return;
  if(next.version!==1||next.entries.length>1000)throw new Error('The Library snapshot exceeds the review limit.');
  setSnapshot(next);setHistory(receipts);contextChanged({widgetId:id,snapshot:next});clearProposal();setStatus(copy('Folder names are ready to share with your selected AI provider. File contents and screenshots are excluded in this mode.','文件名已准备好分享给所选 AI 服务。此模式不分享文件内容或截图。'));
 }catch(reason){if(alive.current){setError(String(reason));setSnapshot(null);contextChanged(null)}}finally{end()}}
 let rows:ReturnType<typeof reviewLibraryProposal>=[],reviewError='';
 if(proposal&&snapshot)try{rows=reviewLibraryProposal(snapshot,proposal)}catch(reason){reviewError=reason instanceof Error?reason.message:String(reason)}
 async function run(){if(!snapshot||!proposal||lock.current||!selected.length||reviewUncertain)return;begin();const id=widgetId,reviewed={...proposal,operations:proposal.operations.filter(operation=>selected.includes(operation.id))};try{
  // Validate the selected dependency graph before making the first native call.
  reviewLibraryProposal(snapshot,reviewed);
  const recoveryId=startReview();
  const result=await executeLibraryProposal(snapshot,reviewed,operation=>apply(id,snapshot.rootId,operation),async()=>{});
  const message=result.error?copy(`${result.receipts.length} operation(s) completed; ${result.remaining} not completed. ${result.error}`,`已完成 ${result.receipts.length} 项；${result.remaining} 项未完成。${result.error}`):copy(`Completed ${result.receipts.length} reviewed Library operation(s).`,`已完成 ${result.receipts.length} 项已审核的资料库操作。`);
  if(alive.current){setStatus(message);if(result.error)setError(result.error);finishReview(recoveryId,message);clearProposal();setSnapshot(null);contextChanged(null)}
  // Read durable native receipts even after a partial failure. A failed refresh must not hide completed work.
  const receipts=await libraryOrganisation.history(id,snapshot.rootId);if(alive.current)setHistory(receipts);
 }catch(reason){if(alive.current){markReviewUncertain();setError(String(reason))}}finally{end()}}
 async function undoReceipt(item:LibraryReceipt){if(lock.current||reviewUncertain)return;begin();try{
  const recoveryId=startReview();
  const result=await undo(widgetId,item.rootId,item.undoToken);
  const message=result.removedFolder?copy(`Removed unchanged empty folder ${result.sourcePath}.`,`已移除未更改的空文件夹 ${result.sourcePath}。`):copy(`Restored ${result.sourcePath} → ${result.destinationPath}.`,`已还原 ${result.sourcePath} → ${result.destinationPath}。`);
  if(alive.current){setStatus(message);finishReview(recoveryId,message);setSnapshot(null);contextChanged(null);clearProposal()}
  const receipts=await libraryOrganisation.history(widgetId,item.rootId);if(alive.current)setHistory(receipts);
 }catch(reason){if(alive.current){markReviewUncertain();setError(String(reason))}}finally{end()}}
 const disabled=busy||working;
 return <details className="assistant-library-tools" open={expanded} onToggle={event=>setExpanded(event.currentTarget.open)}><summary>{copy('Organise Library with AI','用 AI 整理资料库')}</summary>
  <p>{copy('Choose only a folder already assigned to Still. Share its relative names, then ask for moves, renames or new folders. Every change requires Apply.','仅选择已授权给 Still 的文件夹。分享相对文件名后，可请求移动、重命名或新建文件夹。每项更改都需点击应用。')}</p>
  {!libraryOrganisation.available&&<p>{copy('File organisation requires the native desktop app.','文件整理需要桌面应用。')}</p>}
  <label>{copy('Assigned Library folder','已授权的资料库文件夹')}<select aria-label={copy('Assigned Library folder','已授权的资料库文件夹')} value={widgetId} disabled={disabled||!libraryOrganisation.available} onChange={event=>choose(event.target.value)}><option value="">{copy('Choose a folder…','选择文件夹…')}</option>{roots.map(root=><option key={root.widgetId} value={root.widgetId}>{root.name}</option>)}</select></label>
  <button type="button" disabled={disabled||!widgetId||!libraryOrganisation.available} onClick={()=>void scan()}>{copy('Share folder names / Refresh','分享文件名 / 刷新')}</button>
  {snapshot&&<p className="assistant-library-scope"><strong>{snapshot.rootName}</strong> · {snapshot.entries.length} {copy('entries · names only','项 · 仅文件名')}{snapshot.truncated?' · '+copy('partial listing','部分列表'):''}</p>}
  {snapshot&&<button type="button" disabled={disabled} onClick={()=>{setSnapshot(null);contextChanged(null);clearProposal();setStatus('')}}>{copy('Stop sharing folder names','停止分享文件名')}</button>}
  {proposal&&snapshot&&<section className="assistant-proposal" aria-label={copy('Review Library changes','审核资料库更改')}><strong>{copy('Review Library changes','审核资料库更改')}</strong><p>{copy('Nothing has changed. No overwrite, deletion or content editing. Undo is available only when safe.','尚未更改任何文件。不覆盖、不删除、不修改内容。仅在安全时允许撤销。')}</p>{reviewError?<p role="alert">{reviewError}</p>:<ol>{rows.map(row=><li key={row.operation.id}><label><input type="checkbox" checked={selected.includes(row.operation.id)} disabled={disabled||reviewUncertain} onChange={event=>setSelected(ids=>event.target.checked?[...ids,row.operation.id]:ids.filter(id=>id!==row.operation.id))}/><span>{row.operation.type}<br/><code>{row.sourcePath??copy('(new folder)','（新文件夹）')} → {row.destinationPath}</code></span></label><p>{row.operation.reason}</p>{row.descendants.length>0&&<details><summary>{row.descendants.length} {copy('affected descendants','个受影响的子项')}</summary><ul>{row.descendants.map(path=><li key={path}><code>{path}</code></li>)}</ul></details>}</li>)}</ol>}{reviewUncertain&&<><p role="status">{copy('Still could not verify whether this change finished. It will not be applied again automatically.','Still 无法确认此更改是否已完成，不会自动重复应用。')}</p><button type="button" onClick={acknowledgeReview}>{copy('I inspected the workspace','我已检查工作区')}</button></>}<div className="assistant-row"><button type="button" disabled={disabled||reviewUncertain} onClick={()=>{cancelReview(copy('Cancelled Library proposal. Nothing changed.','已取消资料库提案，未更改文件。'));clearProposal()}}>{copy('Cancel','取消')}</button><button type="button" className="primary" disabled={disabled||reviewUncertain||!!reviewError||!selected.length} onClick={()=>void run()}>{working?copy('Working…','处理中…'):copy('Apply selected changes','应用所选更改')}</button></div></section>}
  {status&&<p role="status">{status}</p>}{error&&<p className="assistant-error" role="alert">{error}</p>}
  {history.length>0&&<details><summary>{copy('Recent operations / safe Undo','最近操作 / 安全撤销')}</summary><ol>{history.slice().reverse().map(item=><li key={item.id}><code>{item.sourcePath??'(new)'} → {item.destinationPath}</code><button type="button" disabled={disabled} onClick={()=>void undoReceipt(item)}>{copy('Undo','撤销')}</button></li>)}</ol></details>}
 </details>;
}
