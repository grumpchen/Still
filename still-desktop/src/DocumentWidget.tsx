import {useEffect,useRef,useState,type MouseEvent} from 'react';
import {createPortal} from 'react-dom';
import type {WidgetProps} from './widgets.tsx';
import {localDocuments,previewFileDrop,presetForDroppedResource,type DroppedResource} from './platform/resourceDrop.ts';
import {mimeFor} from './platform/files.ts';
import {checkedFileNotes,FILE_NOTE_LIMIT} from './domain/fileNotes.ts';
import {useT} from './localization.tsx';

function Preview({url,mimeType,text,t}:{url:string;mimeType:string;text:string|null;t:(key:string)=>string}){
 if(mimeType==='application/pdf')return <iframe className="file-preview-frame" title={t('pdfPreview')} src={url}/>;
 if(mimeType.startsWith('image/'))return <img className="file-preview-image" src={url} alt={t('filePreview')}/>;
 if(mimeType.startsWith('video/'))return <video className="file-preview-media" src={url} controls/>;
 if(mimeType.startsWith('audio/'))return <audio className="file-preview-media" src={url} controls/>;
 if(mimeType==='text/plain')return <pre className="file-preview-text">{text??t('loadingTextPreview')}</pre>;
 return <p className="files-message">{t('unsupportedPreview')}</p>;
}

export default function DocumentWidget({widget,update,notify}:WidgetProps){
 const t=useT();
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[preview,setPreview]=useState<{url:string;mimeType:string;text:string|null}|null>(null),[contextMenu,setContextMenu]=useState<{x:number;y:number}|null>(null);const picker=useRef<HTMLInputElement>(null),menuRef=useRef<HTMLDivElement>(null);
 const label=widget.fileKind==='pdf'?t('fileKindPdf'):widget.fileKind==='image'?t('fileKindImage'):widget.fileKind==='media'?t('fileKindMedia'):t('fileKindDocument');
 useEffect(()=>{let active=true;let url='';setPreview(null);setError('');if(!widget.fileKey)return()=>{};setBusy(true);void localDocuments.preview(widget.fileKey).then(async blob=>{url=URL.createObjectURL(blob);const mimeType=blob.type||mimeFor(widget.fileName||'');const text=mimeType==='text/plain'?await blob.text():null;if(active)setPreview({url,mimeType,text});else URL.revokeObjectURL(url)}).catch(reason=>{if(active)setError(String(reason))}).finally(()=>{if(active)setBusy(false)});return()=>{active=false;if(url)URL.revokeObjectURL(url)}},[widget.fileKey,widget.fileName]);
 useEffect(()=>{if(!contextMenu)return;const outside=(event:PointerEvent)=>{if(!menuRef.current?.contains(event.target as Node))setContextMenu(null)},key=(event:KeyboardEvent)=>{if(event.key==='Escape')setContextMenu(null)};document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',key);return()=>{document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',key)}},[contextMenu]);
 function showContextMenu(event:MouseEvent<HTMLDivElement>){event.preventDefault();event.stopPropagation();setContextMenu({x:Math.max(12,Math.min(event.clientX,window.innerWidth-220)),y:Math.max(12,Math.min(event.clientY,window.innerHeight-140))})}
 async function open(){if(!widget.fileKey)return;setBusy(true);setError('');try{await localDocuments.open(widget.fileKey);notify(t('openedInDefaultApp')+' '+(widget.fileName||widget.title))}catch(e){setError(String(e))}finally{setBusy(false)}}
 function selected(file:DroppedResource){const preset=presetForDroppedResource(file);if(preset.type!=='files'||preset.resourceKind!=='document')throw new Error(t('chooseDocumentForFiles'));update({fileKey:preset.fileSourceId,fileName:preset.fileName,fileKind:preset.fileKind});setError('')}
 async function choose(){setError('');if(!localDocuments.native){picker.current?.click();return}setBusy(true);try{const file=await localDocuments.choose(widget.fileKey??undefined);if(file)selected(file)}catch(e){setError(String(e))}finally{setBusy(false)}}
 const noteKey=widget.fileKey??widget.fileName??'file';
 return <div className="document-widget">
   <input ref={picker} aria-label={t('reconnectFileShortcut')} type="file" hidden onChange={e=>{try{const result=previewFileDrop(Array.from(e.target.files??[])),file=result.entries[0];if(file)selected(file);else if(result.errors.length)setError(result.errors.join(' '))}catch(reason){setError(String(reason))}e.target.value=''}}/>
  <div className="document-toolbar"><span className={'document-type-symbol type-'+widget.fileKind}>{label}</span><strong title={widget.fileName||widget.title}>{widget.fileName||widget.title}</strong><details className="files-preview-menu"><summary>{t('fileActions')}</summary><div className="files-preview-menu-panel" role="menu"><button role="menuitem" disabled={busy||!widget.fileKey} onClick={()=>void open()}>{t('openExternally')}</button><button role="menuitem" disabled={busy} onClick={()=>void choose()}>{t('chooseAnother')}</button></div></details></div>
  {preview&&<div className="document-preview" onContextMenu={showContextMenu}><Preview url={preview.url} mimeType={preview.mimeType} text={preview.text} t={t}/></div>}
  {!preview&&<div className="document-preview document-preview-empty" onContextMenu={showContextMenu}><p>{busy?t('loadingPreview'):t('previewUnavailable')}</p>{!busy&&<p>{t('reconnectOrOpenDefaultApp')}</p>}</div>}
   {contextMenu&&createPortal(<div ref={menuRef} className="files-preview-context-menu" role="menu" aria-label={t('fileActions')} style={{left:contextMenu.x,top:contextMenu.y}} onContextMenu={event=>event.preventDefault()}><strong>{widget.fileName||widget.title}</strong><button type="button" role="menuitem" disabled={busy||!widget.fileKey} onClick={()=>{setContextMenu(null);void open()}}>{t('openExternally')}</button><button type="button" role="menuitem" disabled={busy} onClick={()=>{setContextMenu(null);void choose()}}>{t('chooseAnother')}</button></div>,document.body)}
   <label className="file-note"><span>{t('notesForFile')}</span><textarea aria-label={t('notesForFile')} maxLength={4000} disabled={!Object.hasOwn(widget.fileNotes,noteKey)&&Object.keys(widget.fileNotes).length>=FILE_NOTE_LIMIT} placeholder={t('addNotes')} value={widget.fileNotes[noteKey]??''} onChange={event=>update({fileNotes:checkedFileNotes({...widget.fileNotes,[noteKey]:event.target.value})})}/>{!Object.hasOwn(widget.fileNotes,noteKey)&&Object.keys(widget.fileNotes).length>=FILE_NOTE_LIMIT&&<small>{t('maxFileNotes').replace('{count}',String(FILE_NOTE_LIMIT))}</small>}</label>
   {error&&<p className="widget-error" role="alert">{error}</p>}<div className="files-status">{t('localDocumentStatus').replace('{type}',label.toUpperCase())}</div>
 </div>;
}
