import {useEffect,useMemo,useRef,useState} from 'react';
import {folderEntries,localFiles,type FileEntry} from './platform/files.ts';
import {notesLibrary,type NotesLibraryEntry} from './platform/notesLibrary.ts';
import {useT} from './localization.tsx';

interface Props {
 widgetId:string;
 connected:boolean;
 libraryName:string;
 entries:NotesLibraryEntry[];
 busy:boolean;
 error:string;
 newName:string;
 onNewName:(value:string)=>void;
 onRefresh:()=>void;
 onChoose:()=>void;
 onCreate:(location:string)=>void;
 onOpenNote:(file:NotesLibraryEntry)=>void;
}
interface Preview {url:string|null;mimeType:string;text:string|null}
function editableNote(name:string){return /\.(md|markdown|txt)$/i.test(name)}
function fileSize(bytes:number){return bytes<1024?`${bytes} B`:bytes<1024*1024?`${Math.ceil(bytes/1024)} KB`:`${(bytes/1024/1024).toFixed(1)} MB`}
function icon(file:FileEntry){if(file.directory)return'▰';const extension=file.name.split('.').pop()?.toLowerCase();return extension==='pdf'?'PDF':extension==='md'||extension==='markdown'?'MD':extension==='txt'||extension==='csv'||extension==='log'?'TXT':extension==='png'||extension==='jpg'||extension==='jpeg'||extension==='gif'||extension==='webp'||extension==='bmp'?'IMG':extension==='mp3'||extension==='wav'||extension==='ogg'?'AUD':extension==='mp4'||extension==='m4v'||extension==='webm'?'VID':'FILE'}

export default function NotesLibraryExplorer({widgetId,connected,libraryName,entries,busy,error,newName,onNewName,onRefresh,onChoose,onCreate,onOpenNote}:Props){
 const t=useT();
 const [location,setLocation]=useState(''),[filter,setFilter]=useState(''),[searchAll,setSearchAll]=useState(false),[selected,setSelected]=useState<FileEntry|null>(null),[preview,setPreview]=useState<Preview|null>(null),[previewError,setPreviewError]=useState(''),[previewBusy,setPreviewBusy]=useState(false);
 const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[]);
 useEffect(()=>()=>{if(preview?.url)URL.revokeObjectURL(preview.url)},[preview?.url]);
 const rows=useMemo(()=>{const needle=filter.trim().toLocaleLowerCase(),source=searchAll?entries.map(entry=>({...entry,directory:false,blocked:false})):folderEntries(entries,location);return source.filter(file=>!needle||`${file.name} ${file.path}`.toLocaleLowerCase().includes(needle))},[entries,location,filter,searchAll]);
 const parts=location?location.split('/'):[];
 function navigate(next:string){setLocation(next);setFilter('');setSelected(null);setPreview(null);setPreviewError('')}
 async function selectFile(file:FileEntry){
  if(file.directory){navigate(file.path);return}
  setSelected(file);setPreview(null);setPreviewError('');setPreviewBusy(true);
  try{
   if(editableNote(file.name)){
    const text=await notesLibrary.read(widgetId,file.path);if(mounted.current)setPreview({url:null,mimeType:'text/plain',text});
   }else{
    const blob=await localFiles.preview(widgetId,file.path),url=URL.createObjectURL(blob),mimeType=blob.type||'application/octet-stream',text=mimeType==='text/plain'?await blob.text():null;
    if(mounted.current)setPreview({url,mimeType,text});else URL.revokeObjectURL(url);
   }
  }catch(reason){if(mounted.current)setPreviewError(String(reason))}finally{if(mounted.current)setPreviewBusy(false)}
 }
 async function openExternal(){if(!selected)return;try{await localFiles.open(widgetId,selected.path)}catch(reason){setPreviewError(String(reason))}}
 const crumbPaths=parts.map((part,index)=>({name:part,path:parts.slice(0,index+1).join('/')}));
 if(!connected)return <section className="note-library" aria-label="Choose notes folder"><div className="note-library-heading"><strong>Choose a notes folder</strong><button type="button" disabled={busy} onClick={onChoose}>Choose folder…</button></div><div className="note-library-preview-empty"><span>▤</span><p>Open a folder to browse Markdown notes and attachments.</p><small>Your files stay on this device.</small></div>{error&&<p className="widget-error" role="alert">{error}</p>}</section>;
 return <section className="note-library" aria-label="Notes file explorer">
  <div className="note-library-heading"><strong title={libraryName}>{libraryName} · Files</strong><div><button type="button" disabled={busy} onClick={onRefresh} aria-label="Refresh notes library">↻</button><button type="button" disabled={busy} onClick={onChoose}>Change folder</button></div></div>
  <form className="note-library-new" onSubmit={event=>{event.preventDefault();onCreate(location)}}><input aria-label="New note name" maxLength={80} placeholder="New note name" value={newName} onChange={event=>onNewName(event.target.value)}/><button disabled={busy||!newName.trim()}>New .md</button></form>
  <div className="note-library-navigation"><div className="note-library-location" aria-label="Folder path"><button type="button" aria-label="Notes library root" onClick={()=>navigate('')}>{libraryName}</button>{crumbPaths.map(part=><span key={part.path}><i>›</i><button type="button" onClick={()=>navigate(part.path)}>{part.name}</button></span>)}</div><div className="note-library-search-tools"><input className="note-library-search" aria-label={searchAll?t('searchAllFolders'):t('searchCurrentFolder')} placeholder={searchAll?t('searchFolders'):t('filterCurrentFolder')} value={filter} onChange={event=>setFilter(event.target.value)}/><label className="note-library-search-all"><input type="checkbox" checked={searchAll} onChange={event=>setSearchAll(event.target.checked)}/>{t('searchSubfolders')}</label></div></div>
  <div className="note-library-explorer">
   <div className="note-library-files" aria-label="Folder contents">{rows.map(file=><button type="button" className={'note-library-file'+(selected?.path===file.path?' is-selected':'')} key={file.path} disabled={busy} onClick={()=>void selectFile(file)} title={file.path} aria-label={(file.directory?'Open folder ':'Preview file ')+file.name}><span className={'note-library-icon'+(file.directory?' is-folder':'')}>{icon(file)}</span><span className="note-library-file-name">{file.name}</span><small>{searchAll?file.path.includes('/')?file.path.slice(0,file.path.lastIndexOf('/')):libraryName:file.directory?'Folder':fileSize(file.size)}</small></button>)}{!rows.length&&<p>{busy?'Loading files…':filter?t('noSearchMatches'):t('emptyLibrary')}</p>}</div>
   <div className="note-library-preview" aria-label={selected?'Preview '+selected.name:'File preview'}>
    {selected?<><div className="note-library-preview-head"><strong title={selected.name}>{selected.name}</strong><div>{editableNote(selected.name)&&<button type="button" onClick={()=>onOpenNote({path:selected.path,name:selected.name,size:selected.size})}>Open note</button>}<button type="button" onClick={()=>void openExternal()}>Open externally</button></div></div>{previewBusy?<p className="files-message" role="status">Loading preview…</p>:previewError?<p className="widget-error" role="alert">{previewError}</p>:preview&&<div className="document-preview">{preview.mimeType==='application/pdf'&&preview.url?<iframe className="file-preview-frame" title={'PDF preview: '+selected.name} src={preview.url}/>:preview.mimeType.startsWith('image/')&&preview.url?<img className="file-preview-image" src={preview.url} alt={selected.name}/>:preview.mimeType.startsWith('video/')&&preview.url?<video className="file-preview-media" src={preview.url} controls/>:preview.mimeType.startsWith('audio/')&&preview.url?<audio className="file-preview-media" src={preview.url} controls/>:preview.mimeType==='text/plain'?<pre className="file-preview-text">{preview.text}</pre>:<p className="files-message">Preview is not available for this file.</p>}</div>}</>:<div className="note-library-preview-empty"><span>▤</span><p>Select a file to preview it here.</p><small>PDFs, images, text, audio and video stay inside Still.</small></div>}
   </div>
  </div>
  {error&&<p className="widget-error" role="alert">{error}</p>}
  <div className="note-status">LOCAL LIBRARY · PREVIEWS STAY ON THIS DEVICE</div>
 </section>
}
