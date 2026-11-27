import {useEffect,useRef,useState} from 'react';
import type {Workspace} from './domain/workspaces.ts';
import {executeCollectionOperation} from './platform/collectionOperations.ts';
import type {CollectionOperationResource} from './domain/collectionOperations.ts';
import {localDocuments,previewFileDrop,type DroppedResource} from './platform/resourceDrop.ts';
import {useLocale} from './localization.tsx';

type Props={open:boolean;workspaces:Workspace[];onClose:()=>void;onSaved?:(message:string)=>void;onCaptureSaved?:(captureId:string,resource:CollectionOperationResource)=>void|Promise<void>;onSavePdf:(workspaceId:string,file:DroppedResource,captureId:string)=>Promise<{widgetId:string;name:string;sourceId:string}>};
type Mode='link'|'idea'|'pdf';
type PendingCapture={captureId:string;resource:CollectionOperationResource;summary:string};
const copy=(zh:boolean,en:string,cn:string)=>zh?cn:en;
/** A reusable capture dialog. No destination is preselected: each capture is assigned to a course explicitly. */
export default function QuickCapture({open,workspaces,onClose,onSaved,onCaptureSaved,onSavePdf}:Props){
 const zh=useLocale()==='zh-CN',picker=useRef<HTMLInputElement>(null),captureId=useRef(''),pendingCapture=useRef<PendingCapture|null>(null),[pending,setPending]=useState(false),[mode,setMode]=useState<Mode>('idea'),[workspaceId,setWorkspaceId]=useState(''),[targetId,setTargetId]=useState(''),[name,setName]=useState(''),[url,setUrl]=useState(''),[text,setText]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const courses=workspaces.filter(item=>item.role==='study'||item.role==='custom'),course=courses.find(item=>item.id===workspaceId);
 useEffect(()=>{if(open&&!pendingCapture.current){captureId.current=crypto.randomUUID();setWorkspaceId('');setTargetId('');setName('');setUrl('');setText('');setError('');setMode('idea');setPending(false)}else if(open&&pendingCapture.current){setPending(true)}},[open]);
 async function queuePendingCapture(){const saved=pendingCapture.current;if(!saved)return;await onCaptureSaved?.(saved.captureId,saved.resource);pendingCapture.current=null;setPending(false);onSaved?.(saved.summary);onClose()}
 async function save(){setError('');if(!workspaceId){setError(copy(zh,'Choose a course first.','请先选择课程。'));return}setBusy(true);try{
  if(pendingCapture.current){await queuePendingCapture();return}
  if(mode==='idea'){
   const attemptId=captureId.current,result=await executeCollectionOperation({type:'note.quickCapture',workspaceId,title:name||copy(zh,'Quick capture','快速收集'),text},{source:'manual',idempotencyKey:`capture:${attemptId}`});if(result.status!=='succeeded'||result.resource?.kind!=='note'){if(!result.changed&&result.status==='failed')captureId.current=crypto.randomUUID();throw new Error(result.summary)}pendingCapture.current={captureId:attemptId,resource:result.resource,summary:result.summary};setPending(true);await queuePendingCapture();
  }else if(mode==='link'){
   const attemptId=captureId.current,result=await executeCollectionOperation({type:'link.create',workspaceId,name,url},{source:'manual',idempotencyKey:`capture:${attemptId}`});if(result.status!=='succeeded'||result.resource?.kind!=='link'){if(!result.changed&&result.status==='failed')captureId.current=crypto.randomUUID();throw new Error(result.summary)}pendingCapture.current={captureId:attemptId,resource:result.resource,summary:result.summary};setPending(true);await queuePendingCapture();
  }else{
   if(localDocuments.native){setBusy(true);try{const entry=await localDocuments.choose();if(!entry||entry.kind!=='pdf'||!entry.sourceId)throw new Error(copy(zh,'Choose a PDF document.','请选择 PDF 文档。'));await completePdf(entry)}catch(reason){setError(reason instanceof Error?reason.message:String(reason))}finally{setBusy(false)}return}
   if(!picker.current)throw new Error(copy(zh,'Choose a PDF file.','请选择 PDF 文件。'));picker.current.click();setBusy(false);return;
  }
  onClose();
 }catch(reason){const message=reason instanceof Error?reason.message:String(reason);setError(pendingCapture.current?copy(zh,`Saved successfully, but could not add it to Rules: ${message}. Retry to finish.`,`已保存，但未能加入规则队列：${message}。请重试以完成收集。`):message)}finally{setBusy(false)}}
 async function completePdf(entry:DroppedResource){if(!workspaceId)throw new Error(copy(zh,'Choose a course first.','请先选择课程。'));if(entry.kind!=='pdf'||!entry.sourceId)throw new Error(copy(zh,'Still could not select that PDF. Nothing was saved.','Still 无法选择此 PDF，未保存任何内容。'));
  const attemptId=captureId.current,saved=await onSavePdf(workspaceId,entry,attemptId),resource:CollectionOperationResource={kind:'file',workspaceId,widgetId:saved.widgetId,name:saved.name||entry.name,sourceId:saved.sourceId};pendingCapture.current={captureId:attemptId,resource,summary:copy(zh,`Saved ${saved.name||entry.name} to ${course?.name??'the selected course'}.`,`已将 ${saved.name||entry.name} 保存到${course?.name??'所选课程'}。`)};setPending(true);await queuePendingCapture();
 }
 async function acceptPdf(file:File){setError('');if(!workspaceId){setError(copy(zh,'Choose a course first.','请先选择课程。'));return}if(!file.name.toLowerCase().endsWith('.pdf')){setError(copy(zh,'Choose a PDF document.','请选择 PDF 文档。'));return}setBusy(true);try{const result=previewFileDrop([file]);const entry=result.entries[0];if(result.errors.length)throw new Error(result.errors.join(' '));if(!entry)throw new Error(copy(zh,'Still could not select that PDF. Nothing was saved.','Still 无法选择此 PDF，未保存任何内容。'));await completePdf(entry)}catch(reason){setError(reason instanceof Error?reason.message:String(reason))}finally{setBusy(false)}}
 function close(){if(busy)return;onClose()}
 if(!open)return null;
 return <div className="quick-capture-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="quick-capture-dialog" role="dialog" aria-modal="true" aria-labelledby="quick-capture-title">
  <header><div><span>{copy(zh,'CAPTURE','快速收集')}</span><h2 id="quick-capture-title">{copy(zh,'Save something for later','保存内容以便稍后查看')}</h2></div><button type="button" aria-label={copy(zh,'Close','关闭')} disabled={busy} onClick={close}>×</button></header>
  <nav className="quick-capture-tabs" aria-label={copy(zh,'Capture type','收集类型')}>{(['idea','link','pdf'] as const).map(value=><button key={value} type="button" aria-pressed={mode===value} disabled={pending||busy} onClick={()=>{setMode(value);setTargetId('');setError('')}}>{value==='idea'?copy(zh,'Idea','想法'):value==='link'?copy(zh,'Web link','网页链接'):'PDF'}</button>)}</nav>
  <label>{copy(zh,'Course · choose for every capture','课程 · 每次收集都需选择')}<select aria-label={copy(zh,'Choose course','选择课程')} value={workspaceId} disabled={busy||pending} onChange={event=>{setWorkspaceId(event.target.value);setTargetId('')}}><option value="">{copy(zh,'Choose a course…','选择课程…')}</option>{courses.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
  {mode==='idea'?<><label>{copy(zh,'Title','标题')}<input value={name} disabled={pending||busy} maxLength={60} onChange={event=>setName(event.target.value)} placeholder={copy(zh,'Quick capture','快速收集')}/></label><label>{copy(zh,'Idea','想法')}<textarea value={text} disabled={pending||busy} onChange={event=>setText(event.target.value)} maxLength={12000} placeholder={copy(zh,'Write a thought to keep…','写下想保存的想法…')}/></label><p className="quick-capture-disclosure">{copy(zh,'Still adds this as a note in the selected course, creating a Notes widget there if needed.','Still 会将想法保存到所选课程；如无 Notes 组件，会自动创建。')}</p></>:null}
  {mode==='link'?<><label>{copy(zh,'Link name','链接名称')}<input value={name} disabled={pending||busy} maxLength={60} onChange={event=>setName(event.target.value)} placeholder={copy(zh,'Name this link','为链接命名')}/></label><label>URL<input value={url} disabled={pending||busy} maxLength={2048} onChange={event=>setUrl(event.target.value)} placeholder="https://" inputMode="url"/></label><p className="quick-capture-disclosure">{copy(zh,'Still saves this link in the course’s Saved links Group, creating it if needed.','Still 会将链接保存到课程的“收藏”分组；如不存在，会自动创建。')}</p></>:null}
  {mode==='pdf'?<p className="quick-capture-disclosure">{copy(zh,'Choose a PDF. Still saves a local file shortcut in the selected course; it does not upload or copy the file.','选择 PDF。Still 会在所选课程保存本地文件快捷方式，不会上传或复制文件。')}</p>:null}
  <input ref={picker} type="file" accept="application/pdf,.pdf" hidden onChange={event=>{const file=event.target.files?.[0];if(file)void acceptPdf(file);event.target.value=''}}/>
  {error&&<p role="alert" className="quick-capture-error">{error}</p>}<footer><button type="button" onClick={close} disabled={busy}>{pending?copy(zh,'Close','关闭'):copy(zh,'Cancel','取消')}</button><button type="button" className="primary" disabled={busy||pending&&!pendingCapture.current||!pending&&mode==='idea'&&!text.trim()||!pending&&mode==='link'&&(!name.trim()||!url.trim())} onClick={()=>void save()}>{busy?copy(zh,'Saving…','正在保存…'):pending?copy(zh,'Retry adding to Rules','重试加入规则'):mode==='pdf'?copy(zh,'Choose PDF','选择 PDF'):copy(zh,'Save','保存')}</button></footer>
 </section></div>;
}
