import {useEffect,useRef,useState,type DragEvent,type FormEvent,type ChangeEvent} from 'react';
import type {WidgetProps} from './widgets.tsx';
import {parseGeneratedWidgetReply,type GeneratedWidgetDefinition} from './domain/generatedWidget.ts';
import {Icon} from './Icon.tsx';
import {useT} from './localization.tsx';

type GenerationRequestDetail={widgetId:string;description:string;complete:(reply:string|null,error?:string)=>void};

const MAX_SOURCE_CHARS=12000,MAX_SOURCE_BYTES=1024*1024;
export default function GeneratedWidget({widget,update,workspaceId='',noteTargets=[],saveGeneratedResult}:WidgetProps){
 const t=useT(),[generating,setGenerating]=useState(false),[running,setRunning]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(''),[source,setSource]=useState<{name:string;text:string;truncated:boolean}|null>(null),[result,setResult]=useState(''),[noteTargetId,setNoteTargetId]=useState(''),[noteTitle,setNoteTitle]=useState(''),[savedNoteTitle,setSavedNoteTitle]=useState(''),operation=useRef(0),saveGuard=useRef(false);
 const definition=widget.generatedDefinition;
 const saveTargets=noteTargets.filter(target=>target.available),selectedTarget=saveTargets.find(target=>target.id===noteTargetId);
 useEffect(()=>()=>{operation.current++},[]);
 function requestGeneration(event:FormEvent){
  event.preventDefault();const description=widget.text.trim();if(!description){setError(t('generatedWidgetDescribeFirst'));return}
  const id=++operation.current;setGenerating(true);setError('');
  const detail:GenerationRequestDetail={widgetId:widget.id,description,complete:(reply,reason)=>{
   if(id!==operation.current)return;setGenerating(false);if(reason){setError(reason);return}
   try{const next=parseGeneratedWidgetReply(reply??'');update({title:next.title,generatedDefinition:next});setNoteTitle(next.title);setError('')}
   catch(cause){setError(cause instanceof Error?cause.message:t('generatedWidgetInvalid'))}
  }};
  window.dispatchEvent(new CustomEvent<GenerationRequestDetail>('still-generate-widget-definition',{detail}));
 }
 async function readSource(file:File){
  const id=++operation.current;setResult('');setError('');const extension=file.name.split('.').pop()?.toLowerCase();
  if(!['txt','md','markdown'].includes(extension??'')){setError(t('generatedWidgetTextFilesOnly'));return}
  if(file.size>MAX_SOURCE_BYTES){setError(t('generatedWidgetFileTooLarge'));return}
  try{const text=await file.text();if(id!==operation.current)return;if(!text.trim()){setError(t('generatedWidgetFileEmpty'));return}setSource({name:file.name,text:text.slice(0,MAX_SOURCE_CHARS),truncated:text.length>MAX_SOURCE_CHARS})}
  catch{if(id===operation.current)setError(t('generatedWidgetFileReadFailed'))}
 }
 function onFileChange(event:ChangeEvent<HTMLInputElement>){const file=event.target.files?.[0];if(file)void readSource(file);event.target.value=''}
 function onDrop(event:DragEvent<HTMLDivElement>){event.preventDefault();event.stopPropagation();const file=event.dataTransfer.files[0];if(file)void readSource(file)}
 function changeTitle(title:string){update({title:title.slice(0,60),...(definition?{generatedDefinition:{...definition,title:title.slice(0,60)}}:{})})}
 function changeInstruction(instruction:string){if(!definition)return;operation.current++;setRunning(false);setResult('');const next:GeneratedWidgetDefinition={...definition,action:{...definition.action,instruction}};update({generatedDefinition:next})}
 function run(){if(!definition||!source)return;const id=++operation.current;setRunning(true);setError('');setResult('');setSavedNoteTitle('');window.dispatchEvent(new CustomEvent('still-run-generated-widget',{detail:{widgetId:widget.id,instruction:definition.action.instruction,fileName:source.name,content:source.text,complete:(reply:string|null,reason?:string)=>{if(id!==operation.current)return;setRunning(false);if(reason){setError(reason);return}setResult(reply??'')}}}))}
 function saveResult(){if(saveGuard.current||!result||!selectedTarget||!saveGeneratedResult)return;saveGuard.current=true;setSaving(true);setError('');try{const saved=saveGeneratedResult(workspaceId,widget.id,selectedTarget.id,noteTitle||definition?.title||widget.title,result);setSavedNoteTitle(saved)}catch(reason){setError(reason instanceof Error?reason.message:t('generatedWidgetSaveFailed'))}finally{saveGuard.current=false;setSaving(false)}}
 return <div className="card-body generated-widget" onDragOver={event=>{event.preventDefault();event.stopPropagation()}} onDrop={onDrop}>
  <div className="assistant-mark"><Icon name="ai"/></div>
  <label className="field-label">{t('generatedWidgetName')}<input aria-label={t('generatedWidgetName')} maxLength={60} value={widget.title} onChange={event=>changeTitle(event.target.value)} placeholder={t('generatedWidgetNamePlaceholder')}/></label>
  {!definition?<form onSubmit={requestGeneration}>
   <label className="field-label">{t('generatedWidgetRequest')}<textarea aria-label={t('generatedWidgetRequest')} maxLength={4000} rows={4} value={widget.text} onChange={event=>update({text:event.target.value})} placeholder={t('generatedWidgetRequestPlaceholder')}/></label>
   <p className="generated-widget-hint">{t('generatedWidgetScope')}</p>
   {error&&<p className="generated-widget-error" role="alert">{error}</p>}
   <button className="primary" type="submit" disabled={generating||!widget.text.trim()}>{generating?t('working'):t('generatedWidgetCreate')}</button>
  </form>:<>
   <div className="generated-widget-preview"><strong>{t('generatedWidgetPreview')}</strong><p>{t('generatedWidgetInputTextFile')}</p></div>
   <label className="field-label">{t('generatedWidgetInstruction')}<textarea aria-label={t('generatedWidgetInstruction')} maxLength={8000} rows={5} value={definition.action.instruction} onChange={event=>changeInstruction(event.target.value)}/></label>
   <label className="generated-widget-file">{t('generatedWidgetSource')}<input type="file" accept=".txt,.md,.markdown,text/plain,text/markdown" aria-label={t('generatedWidgetSource')} onChange={onFileChange}/></label>
   {source&&<div className="generated-widget-source"><span>{source.name}</span><small>{t('generatedWidgetChars').replace('{count}',String(source.text.length))}{source.truncated?` · ${t('generatedWidgetTruncated')}`:''}</small><button type="button" aria-label={t('generatedWidgetRemoveSource')} onClick={()=>{operation.current++;setSource(null);setResult('')}}>×</button></div>}
   <p className="generated-widget-hint">{t('generatedWidgetPrivacy')}</p>
   {error&&<p className="generated-widget-error" role="alert">{error}</p>}
   {result&&<div className="generated-widget-result"><strong>{t('generatedWidgetResult')}</strong><pre>{result}</pre><div className="generated-widget-save"><label className="field-label">{t('generatedWidgetNotesTarget')}<select aria-label={t('generatedWidgetNotesTarget')} value={selectedTarget?.id??''} onChange={event=>{setNoteTargetId(event.target.value);setSavedNoteTitle('')}}><option value="">{t('choose')}</option>{noteTargets.map(target=><option key={target.id} value={target.id} disabled={!target.available}>{target.title}{target.available?'':' · '+t('generatedWidgetNotesUnavailable')}</option>)}</select></label><label className="field-label">{t('generatedWidgetNoteTitle')}<input aria-label={t('generatedWidgetNoteTitle')} maxLength={60} value={noteTitle||definition.title} onChange={event=>{setNoteTitle(event.target.value);setSavedNoteTitle('')}}/></label>{noteTargets.length===0&&<p className="generated-widget-hint">{t('generatedWidgetNoNotes')}</p>}{noteTargets.length>0&&!saveTargets.length&&<p className="generated-widget-hint">{t('generatedWidgetNotesUnavailableHelp')}</p>}<button type="button" className="primary" disabled={saving||!selectedTarget||!noteTitle.trim()&&!definition.title.trim()||!!savedNoteTitle} onClick={saveResult}>{saving?t('working'):savedNoteTitle?t('generatedWidgetSaved').replace('{title}',savedNoteTitle):t('generatedWidgetSaveButton')}</button></div></div>}
   <div className="ai-command-actions"><button type="button" onClick={()=>{operation.current++;setResult('');setSource(null);setError('');update({generatedDefinition:undefined})}}>{t('generatedWidgetRegenerate')}</button><button type="button" className="primary" disabled={running||!source||!definition.action.instruction.trim()} onClick={run}>{running?t('working'):t('generatedWidgetRun')}</button></div>
  </>}
 </div>
}
