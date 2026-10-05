import {useRef,useState} from 'react';
import type {WidgetProps} from './widgets.tsx';
import {localDocuments,previewFileDrop,presetForDroppedResource,type DroppedResource} from './platform/resourceDrop.ts';
export default function DocumentWidget({widget,update,notify}:WidgetProps){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const picker=useRef<HTMLInputElement>(null);
 const label=widget.fileKind==='pdf'?'PDF':widget.fileKind==='image'?'Image':widget.fileKind==='media'?'Media':'Document';
 async function open(){if(!widget.fileKey)return;setBusy(true);setError('');try{await localDocuments.open(widget.fileKey);notify('Opened '+(widget.fileName||widget.title)+' in your default app.')}catch(e){setError(String(e))}finally{setBusy(false)}}
 function selected(file:DroppedResource){const preset=presetForDroppedResource(file);if(preset.type!=='files'||preset.resourceKind!=='document')throw new Error('Choose a document for this Files widget.');update({fileKey:preset.fileSourceId,fileName:preset.fileName,fileKind:preset.fileKind});setError('')}
 async function choose(){setError('');if(!localDocuments.native){picker.current?.click();return}setBusy(true);try{const file=await localDocuments.choose();if(file)selected(file)}catch(e){setError(String(e))}finally{setBusy(false)}}
 return <div className="document-widget">
  <input ref={picker} aria-label="Reconnect file shortcut" type="file" hidden onChange={e=>{try{const result=previewFileDrop(Array.from(e.target.files??[])),file=result.entries[0];if(file)selected(file);else if(result.errors.length)setError(result.errors.join(' '))}catch(reason){setError(String(reason))}e.target.value=''}}/>
  <div className="document-shortcut-body"><span className={'document-type-symbol type-'+label.toLowerCase()}>{label}</span><h2>{widget.fileName||widget.title}</h2><p>A shortcut to your original file.</p><button className="primary" disabled={busy} onClick={()=>void open()}>{busy?'Opening…':widget.fileKind==='pdf'?'Open in PDF viewer':'Open in default app'}</button><button className="document-reconnect" disabled={busy} onClick={()=>void choose()}>Choose another file</button></div>
  {error&&<p className="widget-error" role="alert">{error}</p>}<div className="files-status">{label.toUpperCase()} · opens in your default app</div>
 </div>;
}
