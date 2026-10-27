import {useRef,useState} from 'react';
import {widgetPreset,type WidgetPreset,type PresetType} from './domain/presets.ts';
import {localFiles,type FolderListing} from './platform/files.ts';
import {localDocuments,localApps,presetForDroppedResource,previewFileDrop,type DroppedResource} from './platform/resourceDrop.ts';
import {widgetRegistry} from './widgets.tsx';
import {useT} from './localization.tsx';

interface Props {type:PresetType;preset?:WidgetPreset;save:(preset:WidgetPreset)=>void;close:()=>void}
export default function PresetEditor({type,preset,save,close}:Props){
 const t=useT();
 const [id]=useState(()=>preset?.id??crypto.randomUUID()),[name,setName]=useState(preset?.name??'');
 const [folder,setFolder]=useState(preset?.type==='files'&&preset.resourceKind!=='document'?{sourceId:preset.folderSourceId,name:preset.folderName}:null);
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
  const value:WidgetPreset=type==='apps'?app?.type==='apps'?{...app,id,name}:{id,type,name,appSourceId:'',appName:''}:type==='files'?resourceKind==='folder'?{id,type,name,folderSourceId:folder?.sourceId??'',folderName:folder?.name??''}:file?.type==='files'&&file.resourceKind==='document'?{...file,id,name}:{id,type,name,resourceKind:'document',fileSourceId:'',fileName:'',fileKind:'document'}:{...preset,id,type,name};
  save(widgetPreset(value));
 }catch(e){setError(String((e as Error).message))}}
 return <form className="preset-editor" onSubmit={e=>{e.preventDefault();submit()}}>
  <label>{t('name')}<input aria-label={t('savedWidgetName')} autoFocus required maxLength={60} placeholder={t('savedWidgetExample').replace('{widget}',t('widget_'+type))} value={name} onChange={e=>setName(e.target.value)}/></label>
  {type==='files'?<>
   <label>{t('shortcutType')}<select aria-label={t('fileShortcutType')} value={resourceKind} onChange={e=>setResourceKind(e.target.value as 'folder'|'document')}><option value="folder">{t('folder')}</option><option value="document">{t('file')}</option></select></label>
   <input ref={picker} aria-label={t('selectPresetFolder')} type="file" multiple {...{webkitdirectory:'',directory:''}} hidden onChange={e=>{try{if(e.target.files?.length)selected(pickerKey.current,localFiles.select(pickerKey.current,Array.from(e.target.files)))}catch(reason){setError(String(reason))}e.target.value=''}}/>
   <input ref={filePicker} aria-label={t('selectPresetFile')} type="file" hidden onChange={e=>{try{const result=previewFileDrop(Array.from(e.target.files??[]));if(result.entries[0])selectedFile(result.entries[0]);else if(result.errors.length)setError(result.errors.join(' '))}catch(reason){setError(String(reason))}e.target.value=''}}/>
   {resourceKind==='folder'?<div className="preset-folder-choice"><button type="button" disabled={busy} onClick={()=>void choose()}>{busy?t('choosing'):folder?t('changeSavedFolder'):t('chooseSavedFolder')}</button><span>{folder?.name??t('chooseFolderForWidget')}</span></div>:<div className="preset-folder-choice"><button type="button" disabled={busy} onClick={()=>void chooseFile()}>{busy?t('choosing'):file?t('changeSavedFile'):t('chooseSavedFile')}</button><span>{file?.type==='files'&&file.resourceKind==='document'?file.fileName:t('chooseFileOrDropOnFiles')}</span></div>}
  </>:type==='apps'?<><input ref={filePicker} aria-label={t('selectPresetApp')} type="file" accept=".exe,.lnk" hidden onChange={e=>{try{const result=previewFileDrop(Array.from(e.target.files??[]));if(result.entries[0])selectedApp(result.entries[0]);else setError(result.errors.join(' '))}catch(reason){setError(String(reason))}e.target.value=''}}/><div className="preset-folder-choice"><button type="button" disabled={busy} onClick={()=>void chooseApp()}>{busy?t('choosing'):app?t('changeSavedApp'):t('chooseSavedApp')}</button><span>{app?.type==='apps'?app.appName:t('chooseAppOrDropOnApps')}</span></div></>:<p className="notice">{t('savedContentKept')}</p>}
  <p className="notice">{t('eachUseAddsWidget').replace('{widget}',t('widget_'+type))}</p>
  {error&&<p className="widget-error" role="alert">{error}</p>}
  <div className="form-actions"><button type="button" disabled={busy} onClick={close}>{t('cancel')}</button><button type="submit" disabled={busy} className="primary">{t('saveCustomWidget')}</button></div>
 </form>;
}
