import {useRef,useState} from 'react';
import {widgetPreset,type WidgetPreset,type PresetType} from './domain/presets.ts';
import {localFiles,type FolderListing} from './platform/files.ts';
import {localDocuments,localApps,presetForDroppedResource,previewFileDrop,type DroppedResource} from './platform/resourceDrop.ts';
import {widgetRegistry} from './widgets.tsx';

interface Props {type:PresetType;preset?:WidgetPreset;save:(preset:WidgetPreset)=>void;close:()=>void}
export default function PresetEditor({type,preset,save,close}:Props){
 const [id]=useState(()=>preset?.id??crypto.randomUUID()),[name,setName]=useState(preset?.name??'');
 const [url,setUrl]=useState(preset?.type==='browser'?preset.url:''),[folder,setFolder]=useState(preset?.type==='files'&&preset.resourceKind!=='document'?{sourceId:preset.folderSourceId,name:preset.folderName}:null);
 const [file,setFile]=useState<WidgetPreset|null>(preset?.type==='files'&&preset.resourceKind==='document'?preset:null),[resourceKind,setResourceKind]=useState<'folder'|'document'>(preset?.type==='files'&&preset.resourceKind==='document'?'document':'folder');
 const [app,setApp]=useState<WidgetPreset|null>(preset?.type==='apps'?preset:null);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const picker=useRef<HTMLInputElement>(null),filePicker=useRef<HTMLInputElement>(null),pickerKey=useRef('');
 function selected(key:string,result:FolderListing){setFolder({sourceId:key,name:result.rootName});setName(current=>current.trim()?current:result.rootName);setError('')}
 async function choose(){const key=crypto.randomUUID();pickerKey.current=key;setError('');if(!localFiles.native){picker.current?.click();return}
  setBusy(true);try{const result=await localFiles.choose(key);if(result)selected(key,result)}catch(e){setError(String(e))}finally{setBusy(false)}
 }
 function selectedFile(entry:DroppedResource){const saved=presetForDroppedResource(entry);if(saved.type!=='files'||saved.resourceKind!=='document')throw new Error('Choose a document for this Files shortcut.');setFile(saved);setName(current=>current.trim()?current:saved.name);setError('')}
 async function chooseFile(){setError('');if(!localDocuments.native){filePicker.current?.click();return}setBusy(true);try{const entry=await localDocuments.choose();if(entry)selectedFile(entry)}catch(e){setError(String(e))}finally{setBusy(false)}}
 function selectedApp(entry:DroppedResource){const saved=presetForDroppedResource(entry);if(saved.type!=='apps')throw new Error('Choose an app shortcut or application.');setApp(saved);setName(current=>current.trim()?current:saved.name);setError('')}
 async function chooseApp(){setError('');if(!localApps.native){filePicker.current?.click();return}setBusy(true);try{const entry=await localApps.choose();if(entry)selectedApp(entry)}catch(e){setError(String(e))}finally{setBusy(false)}}
 function submit(){try{
  const value:WidgetPreset=type==='browser'?{id,type,name,url}:type==='apps'?app?.type==='apps'?{...app,id,name}:{id,type,name,appSourceId:'',appName:''}:type==='files'?resourceKind==='folder'?{id,type,name,folderSourceId:folder?.sourceId??'',folderName:folder?.name??''}:file?.type==='files'&&file.resourceKind==='document'?{...file,id,name}:{id,type,name,resourceKind:'document',fileSourceId:'',fileName:'',fileKind:'document'}:{...preset,id,type,name};
  save(widgetPreset(value));
 }catch(e){setError(String((e as Error).message))}}
 return <form className="preset-editor" onSubmit={e=>{e.preventDefault();submit()}}>
  <label>Name<input aria-label="Saved widget name" autoFocus required maxLength={60} placeholder={type==='browser'?'e.g. ChatGPT':'e.g. CHEM111 '+widgetRegistry[type].name} value={name} onChange={e=>setName(e.target.value)}/></label>
  {type==='browser'?<label>Starting website<input aria-label="Saved browser URL" required placeholder="https://chatgpt.com" value={url} onChange={e=>setUrl(e.target.value)}/></label>:type==='files'?<>
   <label>Shortcut type<select aria-label="File shortcut type" value={resourceKind} onChange={e=>setResourceKind(e.target.value as 'folder'|'document')}><option value="folder">Folder</option><option value="document">File</option></select></label>
   <input ref={picker} aria-label="Select preset folder" type="file" multiple {...{webkitdirectory:'',directory:''}} hidden onChange={e=>{try{if(e.target.files?.length)selected(pickerKey.current,localFiles.select(pickerKey.current,Array.from(e.target.files)))}catch(reason){setError(String(reason))}e.target.value=''}}/>
   <input ref={filePicker} aria-label="Select preset file" type="file" hidden onChange={e=>{try{const result=previewFileDrop(Array.from(e.target.files??[]));if(result.entries[0])selectedFile(result.entries[0]);else if(result.errors.length)setError(result.errors.join(' '))}catch(reason){setError(String(reason))}e.target.value=''}}/>
   {resourceKind==='folder'?<div className="preset-folder-choice"><button type="button" disabled={busy} onClick={()=>void choose()}>{busy?'Choosing…':folder?'Change saved folder':'Choose saved folder'}</button><span>{folder?.name??'Choose the folder this widget should open.'}</span></div>:<div className="preset-folder-choice"><button type="button" disabled={busy} onClick={()=>void chooseFile()}>{busy?'Choosing…':file?'Change saved file':'Choose saved file'}</button><span>{file?.type==='files'&&file.resourceKind==='document'?file.fileName:'Choose a file, or drop it onto Files in the tray.'}</span></div>}
  </>:type==='apps'?<><input ref={filePicker} aria-label="Select preset app" type="file" accept=".exe,.lnk" hidden onChange={e=>{try{const result=previewFileDrop(Array.from(e.target.files??[]));if(result.entries[0])selectedApp(result.entries[0]);else setError(result.errors.join(' '))}catch(reason){setError(String(reason))}e.target.value=''}}/><div className="preset-folder-choice"><button type="button" disabled={busy} onClick={()=>void chooseApp()}>{busy?'Choosing…':app?'Change saved app':'Choose saved app'}</button><span>{app?.type==='apps'?app.appName:'Drop an app shortcut onto Apps, or choose one here.'}</span></div></>:<p className="notice">Saved content is kept. Drag a workspace widget onto its tray button to save its current content.</p>}
  <p className="notice">Each use adds a fresh {widgetRegistry[type].name} widget. Your saved button stays available in the tray.</p>
  {error&&<p className="widget-error" role="alert">{error}</p>}
  <div className="form-actions"><button type="button" disabled={busy} onClick={close}>Cancel</button><button type="submit" disabled={busy} className="primary">Save custom widget</button></div>
 </form>;
}
