import {useEffect,useRef,useState} from 'react';
import type {WidgetProps} from './widgets.tsx';
import {localDocuments,previewFileDrop,presetForDroppedResource,type DroppedResource} from './platform/resourceDrop.ts';
import {mimeFor} from './platform/files.ts';
import {checkedFileNotes,FILE_NOTE_LIMIT} from './domain/fileNotes.ts';

function Preview({url,mimeType,text}:{url:string;mimeType:string;text:string|null}){
 if(mimeType==='application/pdf')return <iframe className="file-preview-frame" title="PDF preview" src={url}/>;
 if(mimeType.startsWith('image/'))return <img className="file-preview-image" src={url} alt="File preview"/>;
 if(mimeType.startsWith('video/'))return <video className="file-preview-media" src={url} controls/>;
 if(mimeType.startsWith('audio/'))return <audio className="file-preview-media" src={url} controls/>;
 if(mimeType==='text/plain')return <pre className="file-preview-text">{text??'Loading text preview…'}</pre>;
 return <p className="files-message">This file type can’t be previewed here.</p>;
}

export default function DocumentWidget({widget,update,notify}:WidgetProps){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[preview,setPreview]=useState<{url:string;mimeType:string;text:string|null}|null>(null);const picker=useRef<HTMLInputElement>(null);
 const label=widget.fileKind==='pdf'?'PDF':widget.fileKind==='image'?'Image':widget.fileKind==='media'?'Media':'Document';
 useEffect(()=>{let active=true;let url='';setPreview(null);setError('');if(!widget.fileKey)return()=>{};setBusy(true);void localDocuments.preview(widget.fileKey).then(async blob=>{url=URL.createObjectURL(blob);const mimeType=blob.type||mimeFor(widget.fileName||'');const text=mimeType==='text/plain'?await blob.text():null;if(active)setPreview({url,mimeType,text});else URL.revokeObjectURL(url)}).catch(reason=>{if(active)setError(String(reason))}).finally(()=>{if(active)setBusy(false)});return()=>{active=false;if(url)URL.revokeObjectURL(url)}},[widget.fileKey,widget.fileName]);
 async function open(){if(!widget.fileKey)return;setBusy(true);setError('');try{await localDocuments.open(widget.fileKey);notify('Opened '+(widget.fileName||widget.title)+' in your default app.')}catch(e){setError(String(e))}finally{setBusy(false)}}
 function selected(file:DroppedResource){const preset=presetForDroppedResource(file);if(preset.type!=='files'||preset.resourceKind!=='document')throw new Error('Choose a document for this Files widget.');update({fileKey:preset.fileSourceId,fileName:preset.fileName,fileKind:preset.fileKind});setError('')}
 async function choose(){setError('');if(!localDocuments.native){picker.current?.click();return}setBusy(true);try{const file=await localDocuments.choose(widget.fileKey??undefined);if(file)selected(file)}catch(e){setError(String(e))}finally{setBusy(false)}}
 const noteKey=widget.fileKey??widget.fileName??'file';
 return <div className="document-widget">
  <input ref={picker} aria-label="Reconnect file shortcut" type="file" hidden onChange={e=>{try{const result=previewFileDrop(Array.from(e.target.files??[])),file=result.entries[0];if(file)selected(file);else if(result.errors.length)setError(result.errors.join(' '))}catch(reason){setError(String(reason))}e.target.value=''}}/>
  <div className="document-toolbar"><span className={'document-type-symbol type-'+label.toLowerCase()}>{label}</span><strong title={widget.fileName||widget.title}>{widget.fileName||widget.title}</strong><button disabled={busy} onClick={()=>void choose()}>Choose another</button><button disabled={busy||!widget.fileKey} onClick={()=>void open()}>{busy?'Loading…':'Open externally'}</button></div>
  {preview&&<div className="document-preview"><Preview url={preview.url} mimeType={preview.mimeType} text={preview.text}/></div>}
  {!preview&&<div className="document-preview document-preview-empty"><p>{busy?'Loading preview…':'Preview unavailable.'}</p>{!busy&&<p>Reconnect the file or open it in your default app.</p>}</div>}
  <label className="file-note"><span>Notes for this file</span><textarea aria-label="Notes for this file" maxLength={4000} disabled={!Object.hasOwn(widget.fileNotes,noteKey)&&Object.keys(widget.fileNotes).length>=FILE_NOTE_LIMIT} placeholder="Add your notes…" value={widget.fileNotes[noteKey]??''} onChange={event=>update({fileNotes:checkedFileNotes({...widget.fileNotes,[noteKey]:event.target.value})})}/>{!Object.hasOwn(widget.fileNotes,noteKey)&&Object.keys(widget.fileNotes).length>=FILE_NOTE_LIMIT&&<small>Maximum of {FILE_NOTE_LIMIT} file notes reached.</small>}</label>
  {error&&<p className="widget-error" role="alert">{error}</p>}<div className="files-status">{label.toUpperCase()} · previewed locally · saved notes stay on this device</div>
 </div>;
}
