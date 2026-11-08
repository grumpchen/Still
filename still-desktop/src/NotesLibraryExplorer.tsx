import {useEffect,useMemo,useRef,useState} from 'react';
import {folderEntries,localFiles,type FileEntry} from './platform/files.ts';
import {notesLibrary,type NotesLibraryEntry,type NotesLibrarySearchResult} from './platform/notesLibrary.ts';
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
 onShowNotes:()=>void;
 onCreate:(location:string)=>void;
 onOpenNote:(file:NotesLibraryEntry)=>void;
}
interface Preview {url:string|null;mimeType:string;text:string|null}
type NoteSearchRow=FileEntry&{snippet?:string};
function editableNote(name:string){return /\.(md|markdown|txt)$/i.test(name)}
function fileSize(bytes:number){return bytes<1024?`${bytes} B`:bytes<1024*1024?`${Math.ceil(bytes/1024)} KB`:`${(bytes/1024/1024).toFixed(1)} MB`}
function icon(file:FileEntry){if(file.directory)return'▰';const extension=file.name.split('.').pop()?.toLowerCase();return extension==='pdf'?'PDF':extension==='md'||extension==='markdown'?'MD':extension==='txt'||extension==='csv'||extension==='log'?'TXT':extension==='png'||extension==='jpg'||extension==='jpeg'||extension==='gif'||extension==='webp'||extension==='bmp'?'IMG':extension==='mp3'||extension==='wav'||extension==='ogg'?'AUD':extension==='mp4'||extension==='m4v'||extension==='webm'?'VID':'FILE'}

export default function NotesLibraryExplorer({widgetId,connected,libraryName,entries,busy,error,newName,onNewName,onRefresh,onChoose,onShowNotes,onCreate,onOpenNote}:Props){
 const t=useT();
 const [location,setLocation]=useState(''),[filter,setFilter]=useState(''),[searchAll,setSearchAll]=useState(false),[searchContents,setSearchContents]=useState(false),[sidebarCollapsed,setSidebarCollapsed]=useState(false),[contentResults,setContentResults]=useState<NotesLibrarySearchResult|null>(null),[contentSearchError,setContentSearchError]=useState(''),[contentSearching,setContentSearching]=useState(false),[selected,setSelected]=useState<FileEntry|null>(null),[preview,setPreview]=useState<Preview|null>(null),[previewError,setPreviewError]=useState(''),[previewBusy,setPreviewBusy]=useState(false);
 const mounted=useRef(true),noteBaseline=useRef(new Map<string,string>()),noteDrafts=useRef(new Map<string,string>());
 const [noteDraft,setNoteDraft]=useState(''),[noteSaving,setNoteSaving]=useState(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[]);
 useEffect(()=>()=>{if(preview?.url)URL.revokeObjectURL(preview.url)},[preview?.url]);
 useEffect(()=>{let cancelled=false;if(!searchContents||!filter.trim()||!connected){setContentResults(null);setContentSearchError('');setContentSearching(false);return}setContentResults(null);setContentSearchError('');setContentSearching(true);const timer=setTimeout(()=>{void notesLibrary.search(widgetId,filter.trim()).then(result=>{if(!cancelled)setContentResults(result)}).catch(reason=>{if(!cancelled){setContentResults(null);setContentSearchError(String(reason))}}).finally(()=>{if(!cancelled)setContentSearching(false)})},300);return()=>{cancelled=true;clearTimeout(timer)}},[searchContents,filter,connected,widgetId]);
 const rows=useMemo<NoteSearchRow[]>(()=>{const needle=filter.trim().toLocaleLowerCase();if(searchContents)return(contentResults?.results??[]).map(file=>({...file,directory:false,blocked:false,snippet:file.snippet}));const source=searchAll?entries.map(entry=>({...entry,directory:false,blocked:false})):folderEntries(entries,location);return source.filter(file=>!needle||`${file.name} ${file.path}`.toLocaleLowerCase().includes(needle))},[entries,location,filter,searchAll,searchContents,contentResults]);
 const parts=location?location.split('/'):[];
 function navigate(next:string){setLocation(next);setFilter('');setSelected(null);setPreview(null);setPreviewError('')}
 async function selectFile(file:FileEntry){
  if(file.directory){navigate(file.path);return}
  setSelected(file);setPreview(null);setNoteDraft('');setPreviewError('');setPreviewBusy(true);
  try{
   if(editableNote(file.name)){
    const text=await notesLibrary.read(widgetId,file.path);if(mounted.current){if(!noteBaseline.current.has(file.path))noteBaseline.current.set(file.path,text);setNoteDraft(noteDrafts.current.get(file.path)??text);setPreview({url:null,mimeType:'text/plain',text})};
   }else{
    const blob=await localFiles.preview(widgetId,file.path),url=URL.createObjectURL(blob),mimeType=blob.type||'application/octet-stream',text=mimeType==='text/plain'?await blob.text():null;
    if(mounted.current)setPreview({url,mimeType,text});else URL.revokeObjectURL(url);
   }
  }catch(reason){if(mounted.current)setPreviewError(String(reason))}finally{if(mounted.current)setPreviewBusy(false)}
 }
 async function openExternal(){if(!selected)return;try{await localFiles.open(widgetId,selected.path)}catch(reason){setPreviewError(String(reason))}}

 async function saveSelectedNote(){if(!selected||!editableNote(selected.name)||noteSaving)return;const expected=noteBaseline.current.get(selected.path);if(expected===undefined){setPreviewError(t('noteDraftSaveFailed'));return}setNoteSaving(true);setPreviewError('');try{await notesLibrary.write(widgetId,selected.path,noteDraft,expected);noteBaseline.current.set(selected.path,noteDraft);noteDrafts.current.delete(selected.path);setPreview({url:null,mimeType:'text/plain',text:noteDraft})}catch(reason){setPreviewError(String(reason))}finally{if(mounted.current)setNoteSaving(false)}}
 async function reloadSelectedNote(){if(!selected||!editableNote(selected.name)||noteSaving)return;setNoteSaving(true);setPreviewError('');try{const text=await notesLibrary.read(widgetId,selected.path);noteBaseline.current.set(selected.path,text);noteDrafts.current.delete(selected.path);setNoteDraft(text);setPreview({url:null,mimeType:'text/plain',text})}catch(reason){setPreviewError(String(reason))}finally{if(mounted.current)setNoteSaving(false)}}

 const crumbPaths=parts.map((part,index)=>({name:part,path:parts.slice(0,index+1).join('/')}));
 if(!connected)return <section className="note-library" aria-label={t('chooseNotesFolder')}><div className="note-library-heading"><strong>{t('chooseNotesFolder')}</strong><div><button type="button" onClick={onShowNotes}>{t('showNotes')}</button><button type="button" disabled={busy} onClick={onChoose}>{t('chooseFolder')}…</button></div></div><div className="note-library-preview-empty"><span>▤</span><p>{t('openNotesFolderHelp')}</p><small>{t('filesStayLocal')}</small></div>{error&&<p className="widget-error" role="alert">{error}</p>}</section>;
 return <section className="note-library" aria-label={t('notesFileExplorer')}>
  <div className="note-library-heading"><button className="note-library-sidebar-toggle" type="button" aria-label={sidebarCollapsed?t('expandFilesSidebar'):t('collapseFilesSidebar')} title={sidebarCollapsed?t('expandFilesSidebar'):t('collapseFilesSidebar')} aria-expanded={!sidebarCollapsed} aria-controls={`files-sidebar-${widgetId}`} onClick={()=>setSidebarCollapsed(value=>!value)}>{sidebarCollapsed?'›':'‹'}</button><strong title={libraryName}>{libraryName} · {t('files')}</strong><div><button type="button" onClick={onShowNotes}>{t('showNotes')}</button><button type="button" disabled={busy} onClick={onRefresh} aria-label={t('refreshNotesLibrary')}>↻</button><button type="button" disabled={busy} onClick={onChoose}>{t('changeFolder')}</button></div></div>
  <form className="note-library-new" onSubmit={event=>{event.preventDefault();onCreate(location)}}><input aria-label={t('newNoteName')} maxLength={80} placeholder={t('newNoteName')} value={newName} onChange={event=>onNewName(event.target.value)}/><button disabled={busy||!newName.trim()}>{t('newMarkdown')}</button></form>
  <div className="note-library-navigation"><div className="note-library-location" aria-label={t('folderPath')}><button type="button" aria-label={t('rootNotes')} onClick={()=>navigate('')}>{libraryName}</button>{crumbPaths.map(part=><span key={part.path}><i>›</i><button type="button" onClick={()=>navigate(part.path)}>{part.name}</button></span>)}</div><div className="note-library-search-tools"><input className="note-library-search" aria-label={searchContents?t('searchNoteContents'):searchAll?t('searchAllFolders'):t('searchCurrentFolder')} placeholder={searchContents?t('searchNoteContents'):searchAll?t('searchFolders'):t('filterCurrentFolder')} value={filter} onChange={event=>setFilter(event.target.value)}/>{!searchContents&&<label className="note-library-search-all"><input type="checkbox" checked={searchAll} onChange={event=>setSearchAll(event.target.checked)}/>{t('searchSubfolders')}</label>}<label className="note-library-search-all"><input type="checkbox" checked={searchContents} onChange={event=>setSearchContents(event.target.checked)}/>{t('searchNoteContents')}</label></div></div>
  <div className={'note-library-explorer'+(sidebarCollapsed?' is-sidebar-collapsed':'')}>
   <div className="note-library-files" id={`files-sidebar-${widgetId}`} aria-label={t('folderContents')}>{rows.map(file=><button type="button" className={'note-library-file'+(selected?.path===file.path?' is-selected':'')+(file.snippet?' has-snippet':'')} key={file.path} disabled={busy||contentSearching} onClick={()=>void selectFile(file)} title={file.path} aria-label={(file.directory?t('openFolder')+' ':t('previewFile')+' ')+file.name}><span className={'note-library-icon'+(file.directory?' is-folder':'')}>{icon(file)}</span><span className="note-library-file-label"><span className="note-library-file-name">{file.name}</span>{file.snippet&&<small className="note-library-file-snippet">{file.snippet}</small>}</span><small className="note-library-file-meta">{searchContents?file.path.includes('/')?file.path.slice(0,file.path.lastIndexOf('/')):libraryName:searchAll?file.path.includes('/')?file.path.slice(0,file.path.lastIndexOf('/')):libraryName:file.directory?t('folder'):fileSize(file.size)}</small></button>)}{contentSearchError&&<p className="widget-error" role="alert">{contentSearchError}</p>}{!rows.length&&<p>{contentSearching?t('searchingLibrary'):searchContents&&!filter.trim()?t('enterSearchText'):searchContents&&contentResults&&!contentResults.results.length?t('noMatchingNotesText'):busy?t('loadingFiles'):filter?t('noMatchingFolderFiles'):t('noSupportedFiles')}</p>}{contentResults?.truncated&&<small className="note-library-search-limited">{t('searchWasLimited')}</small>}</div>
   <div className="note-library-preview" aria-label={selected?t('previewTitle').replace('{name}',selected.name):t('previewFile')}>
    {selected?<><div className="note-library-preview-head"><strong title={selected.name}>{selected.name}</strong><div><button type="button" onClick={()=>void openExternal()}>{t('openExternally')}</button></div></div>{previewBusy?<p className="files-message" role="status">{t('loadingFiles')}</p>:previewError&&!preview?<p className="widget-error" role="alert">{previewError}</p>:preview&&<div className="document-preview">{preview.mimeType==='application/pdf'&&preview.url?<iframe className="file-preview-frame" title={t('previewTitle').replace('{name}',selected.name)} src={preview.url}/>:preview.mimeType.startsWith('image/')&&preview.url?<img className="file-preview-image" src={preview.url} alt={selected.name}/>:preview.mimeType.startsWith('video/')&&preview.url?<video className="file-preview-media" src={preview.url} controls/>:preview.mimeType.startsWith('audio/')&&preview.url?<audio className="file-preview-media" src={preview.url} controls/>:preview.mimeType==='text/plain'&&editableNote(selected.name)?<div className="note-library-edit-area">{previewError&&<p className="widget-error" role="alert">{previewError}</p>}<textarea className="note-library-editor" aria-label={t('noteText')} value={noteDraft} onChange={event=>{setNoteDraft(event.target.value);noteDrafts.current.set(selected.path,event.target.value)}}/><div className="note-library-edit-actions"><span>{noteDraft===noteBaseline.current.get(selected.path)?t('savedToLibrary'):t('unsavedChanges')}</span><div>{previewError.includes('changed outside Still')&&<button type="button" disabled={noteSaving} onClick={()=>void reloadSelectedNote()}>{t('reloadFromFile')}</button>}<button type="button" disabled={noteSaving||noteDraft===noteBaseline.current.get(selected.path)} onClick={()=>void saveSelectedNote()}>{noteSaving?t('savingStatus'):t('save')}</button></div></div></div>:preview.mimeType==='text/plain'?<pre className="file-preview-text">{preview.text}</pre>:<p className="files-message">{t('previewUnavailable')}</p>}</div>}</>:<div className="note-library-preview-empty"><span>▤</span><p>{t('selectFilePreview')}</p><small>{t('previewTypesStayLocal')}</small></div>}
   </div>
  </div>
  {error&&<p className="widget-error" role="alert">{error}</p>}
  <div className="note-status">{t('localLibraryStatus')}</div>
 </section>
}
