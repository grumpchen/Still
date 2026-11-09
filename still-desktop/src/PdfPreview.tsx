import {useEffect,useState} from 'react';
import {localFiles} from './platform/files.ts';
import PdfNumberViewer from './PdfNumberViewer.tsx';
import type {PdfArithmeticOperation} from './domain/pdfCalculations.ts';
import {useT} from './localization.tsx';

type ViewerMode='still'|'system';
const preferenceKey='still.pdf.viewer-mode.v1';
const modeEvent='still-pdf-viewer-mode-changed';

function readMode():ViewerMode{
 try{return localStorage.getItem(preferenceKey)==='system'?'system':'still'}catch{return'still'}
}

interface Props {widgetId:string;path:string;name:string;initialPage?:number;createCalculation?:(values:number[],operation:PdfArithmeticOperation)=>void}

export default function PdfPreview({widgetId,path,name,initialPage,createCalculation}:Props){
 const t=useT(),[mode,setMode]=useState<ViewerMode>(readMode),[hasLoadedStill,setHasLoadedStill]=useState(()=>readMode()==='still'),[page,setPage]=useState(initialPage??1),[url,setUrl]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);

 useEffect(()=>{
  const update=()=>setMode(readMode());
  window.addEventListener(modeEvent,update);
  window.addEventListener('storage',update);
  return()=>{window.removeEventListener(modeEvent,update);window.removeEventListener('storage',update)};
 },[]);

 useEffect(()=>{
  setPage(initialPage??1);
 },[path,initialPage]);

 useEffect(()=>{
  if(mode!=='system'){setUrl('');setError('');setBusy(false);return}
  let live=true,objectUrl='';
  setBusy(true);setError('');setUrl('');
  void localFiles.preview(widgetId,path).then(blob=>{
   if(!live)return;
   objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);
  }).catch(reason=>{if(live)setError(String(reason))}).finally(()=>{if(live)setBusy(false)});
  return()=>{live=false;if(objectUrl)URL.revokeObjectURL(objectUrl)};
 },[mode,widgetId,path]);

 function choose(next:ViewerMode){
  if(next==='still')setHasLoadedStill(true);
  setMode(next);
  try{localStorage.setItem(preferenceKey,next)}catch{/* Keep the selection for this view even if storage is unavailable. */}
  window.dispatchEvent(new CustomEvent(modeEvent));
 }

 return <section className="pdf-preview-shell" aria-label={t('pdfPreviewMode')}>
  <div className="pdf-preview-modes" role="group" aria-label={t('pdfPreviewMode')}>
   <button type="button" aria-pressed={mode==='system'} onClick={()=>choose('system')}>{t('pdfSystemPreview')}</button>
   <button type="button" aria-pressed={mode==='still'} onClick={()=>choose('still')}>{t('pdfStillReader')}</button>
  </div>
  {hasLoadedStill&&<div className="pdf-still-preview" hidden={mode!=='still'}><PdfNumberViewer widgetId={widgetId} path={path} name={name} initialPage={page} onPageChange={setPage} createCalculation={createCalculation}/></div>}
  {mode==='system'&&<div className="pdf-system-preview">
   {busy&&<p className="files-message" role="status">{t('loadingPreview')}</p>}
   {error&&<p className="widget-error" role="alert">{error}</p>}
   {url&&<iframe className="file-preview-frame" title={t('previewTitle').replace('{name}',name)} src={`${url}#page=${page}`}/>}
  </div>}
 </section>;
}
