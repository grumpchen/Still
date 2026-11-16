import {useEffect,useState} from 'react';
import type {WidgetProps} from './widgets.tsx';
import {chromeLauncher} from './platform/chrome.ts';
import {checkedDeepTutorUrl,DEEP_TUTOR_CONTEXT_LIMIT,DEFAULT_DEEP_TUTOR_URL} from './domain/deepTutor.ts';
import {useT} from './localization.tsx';

type TutorContext={targetWidgetIds:string[];sourceFile:string;text:string};
export default function DeepTutorWidget({widget,update,workspaceWidgets=[],notify}:WidgetProps){
 const t=useT();
 const [draft,setDraft]=useState(widget.deepTutorUrl||DEFAULT_DEEP_TUTOR_URL),[context,setContext]=useState(''),[source,setSource]=useState(''),[error,setError]=useState(''),[copied,setCopied]=useState(false);
 useEffect(()=>setDraft(widget.deepTutorUrl||DEFAULT_DEEP_TUTOR_URL),[widget.deepTutorUrl]);
 useEffect(()=>{
  const receive=(event:Event)=>{const detail=(event as CustomEvent<TutorContext>).detail;if(!detail||!detail.targetWidgetIds?.includes(widget.id)||typeof detail.text!=='string')return;setContext(detail.text.slice(0,DEEP_TUTOR_CONTEXT_LIMIT));setSource(String(detail.sourceFile||'').slice(0,240));setCopied(false);setError('')};
  window.addEventListener('still-deeptutor-context',receive);return()=>window.removeEventListener('still-deeptutor-context',receive);
 },[widget.id]);
 function saveUrl():string{const value=checkedDeepTutorUrl(draft);setDraft(value);update({deepTutorUrl:value});setError('');return value}
 async function open(){try{const value=saveUrl();await chromeLauncher.open(value)}catch(reason){setError(reason instanceof Error?reason.message:String(reason))}}
 async function copyAndOpen(){if(!context.trim()){setError(t('deepTutorNoContext'));return}try{const value=saveUrl();await navigator.clipboard.writeText(context);setCopied(true);await chromeLauncher.open(value);notify(t('deepTutorCopied'));setError('')}catch(reason){setError(reason instanceof Error?reason.message:String(reason))}}
 const hasFiles=workspaceWidgets.some(item=>item.type==='files');
 return <div className="deep-tutor-widget">
  <div className="deep-tutor-brand"><span className="deep-tutor-mark">DT</span><div><strong>{t('deepTutorTitle')}</strong><small>{t('deepTutorSubtitle')}</small></div></div>
  <label className="deep-tutor-url"><span>{t('deepTutorInstance')}</span><input aria-label={t('deepTutorInstance')} type="url" value={draft} onChange={event=>setDraft(event.target.value)} onBlur={()=>{try{saveUrl()}catch{/* Keep an invalid draft visible for correction. */}}} placeholder={DEFAULT_DEEP_TUTOR_URL}/></label>
  {context?<section className="deep-tutor-context"><div><strong>{t('deepTutorContextReady')}</strong>{source&&<small>{source}</small>}</div><textarea aria-label={t('deepTutorPrompt')} maxLength={DEEP_TUTOR_CONTEXT_LIMIT} value={context} onChange={event=>{setContext(event.target.value);setCopied(false)}}/><button className="deep-tutor-clear" type="button" onClick={()=>{setContext('');setSource('');setCopied(false)}}>{t('deepTutorClearContext')}</button></section>:<p className="deep-tutor-empty">{hasFiles?t('deepTutorChooseFileHelp'):t('deepTutorAddFilesHelp')}</p>}
  <div className="deep-tutor-actions"><button type="button" onClick={()=>void open()}>{t('deepTutorOpen')}</button><button type="button" className="primary" disabled={!context.trim()} onClick={()=>void copyAndOpen()}>{copied?t('deepTutorCopied'):t('deepTutorCopyOpen')}</button></div>
  <p className="deep-tutor-footnote">{context?t('deepTutorPasteHelp'):t('deepTutorLocalHelp')}</p>
  {error&&<p className="widget-error" role="alert">{error}</p>}
 </div>;
}
