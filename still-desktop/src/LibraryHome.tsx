import {useEffect,useState} from 'react';
import type {Workspace,WidgetInstance} from './domain/workspaces.ts';
import type {WebShortcut} from './domain/webShortcuts.ts';
import {readRecentLibraryFiles,type RecentLibraryFile} from './domain/libraryRecents.ts';
import {widgetRegistry} from './widgets.tsx';
import {Icon} from './Icon.tsx';
import {useLocale,useT} from './localization.tsx';

interface LibraryHomeProps {
 workspace:Workspace;
 update:(id:string,patch:Partial<WidgetInstance>)=>void;
 notify:(message:string)=>void;
 workspaceActive:boolean;
 links:LibrarySavedLink[];
 openLink:(workspaceId:string,link:WebShortcut)=>void;
 addFolder:()=>string|null;
 removeFolder:(id:string)=>void;
}

interface LibrarySavedLink extends WebShortcut {workspaceId:string;workspaceName:string;groupName:string}
type LibrarySection='files'|'notes'|'links';

export default function LibraryHome({workspace,update,notify,workspaceActive,links,openLink,addFolder,removeFolder}:LibraryHomeProps){
 const t=useT(),locale=useLocale(),[section,setSection]=useState<LibrarySection|'recent'>('files'),[recent,setRecent]=useState<RecentLibraryFile[]>(readRecentLibraryFiles),[selectedFolderId,setSelectedFolderId]=useState('');
 const folderWidgets=workspace.widgets.filter(widget=>widget.type==='files'&&!widget.fileKey);
 const files=folderWidgets.find(widget=>widget.id===selectedFolderId)??folderWidgets.find(widget=>widget.folderKey==='still-downloads-inbox')??folderWidgets[0]??workspace.widgets.find(widget=>widget.type==='files');
 const folderIds=folderWidgets.map(widget=>widget.id);
 const folderLabel=(widget:WidgetInstance)=>widget.folderName||(widget.folderKey==='still-downloads-inbox'?t('downloadsInbox'):t('chooseFolder'));
 const notes=workspace.widgets.find(widget=>widget.type==='notes');
 const current=section==='files'?files:section==='notes'?notes:null;
 const title=section==='files'?(files?folderLabel(files):t('libraryFolders')):section==='notes'?t('widget_notes'):section==='links'?t('savedStudyLinks'):t('recentLibraryFiles');
 const description=section==='files'?t('localLibraryStatus'):section==='notes'?t('libraryNotesDescription'):section==='links'?t('savedLinksDescription'):t('recentLibraryDescription');
 const Renderer=current?widgetRegistry[current.type].component:null;

 useEffect(()=>{const opened=(event:Event)=>{const detail=(event as CustomEvent<{widgetId?:string}>).detail;if(detail?.widgetId&&folderIds.includes(detail.widgetId))setRecent(readRecentLibraryFiles())};window.addEventListener('still-library-file-opened',opened);return()=>window.removeEventListener('still-library-file-opened',opened)},[folderIds.join('|')]);

 function openRecentFile(file:RecentLibraryFile){setSelectedFolderId(file.widgetId);setSection('files');requestAnimationFrame(()=>window.setTimeout(()=>window.dispatchEvent(new CustomEvent('still-open-library-recent-file',{detail:{widgetId:file.widgetId,path:file.path}})),0))}
 function createFolder(){const id=addFolder();if(id){setSelectedFolderId(id);setSection('files')}}
 function deleteFolder(id:string){const next=folderWidgets.find(widget=>widget.id!==id);if(id===files?.id&&next)setSelectedFolderId(next.id);removeFolder(id)}
 function openDate(timestamp:number){return new Intl.DateTimeFormat(locale==='zh-CN'?'zh-CN':undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(timestamp)}

 return <section className="library-home" aria-label={t('library')}>
  <aside className="library-rail" aria-label={t('library')}>
   <div className="library-rail-heading"><span className="library-rail-mark"><Icon name="files"/></span><div><strong>{t('library')}</strong><small>{t('libraryPageDescription')}</small></div></div>
   <div className="library-rail-group">
    <span className="library-rail-label library-folder-label">{t('libraryFolders')}</span>
    {folderWidgets.map(folder=><div className="library-folder-nav" key={folder.id}><button type="button" className={section==='files'&&files?.id===folder.id?'active':''} aria-current={section==='files'&&files?.id===folder.id?'page':undefined} onClick={()=>{setSelectedFolderId(folder.id);setSection('files')}}><Icon name="files"/><span>{folderLabel(folder)}</span></button>{folderWidgets.length>1&&<button type="button" className="library-folder-remove" aria-label={t('removeLibraryFolder')} title={t('removeLibraryFolder')} onClick={()=>deleteFolder(folder.id)}><Icon name="trash"/></button>}</div>)}
    <button type="button" className="library-add-folder" onClick={createFolder}><Icon name="add"/><span>{t('addCourseFolder')}</span></button>
    <span className="library-rail-label library-page-nav-label">{t('libraryContents')}</span>
    <button type="button" className={section==='notes'?'active':''} aria-current={section==='notes'?'page':undefined} onClick={()=>setSection('notes')}><Icon name="notes"/><span>{t('widget_notes')}</span></button>
    <button type="button" className={section==='links'?'active':''} aria-current={section==='links'?'page':undefined} onClick={()=>setSection('links')}><Icon name="browser"/><span>{t('savedStudyLinks')}</span></button>
    <button type="button" className={section==='recent'?'active':''} aria-current={section==='recent'?'page':undefined} onClick={()=>setSection('recent')}><Icon name="clock"/><span>{t('recentLibraryFiles')}</span></button>
   </div>
   <p className="library-rail-footnote">{t('filesStayLocal')}</p>
  </aside>
  <main className="library-main">
   <header className="library-page-header"><div><span className="library-page-eyebrow">{t('library')}</span><h2>{title}</h2><p>{description}</p></div></header>
   <section className={'library-work-area library-work-area-'+section} aria-label={title}>
    {section==='links'?<div className="library-recent-list library-link-list" aria-label={t('savedStudyLinks')}>{workspaceActive&&links.length?links.map(link=><button key={link.id} type="button" className="library-recent-item library-link-item" title={link.url} onClick={()=>openLink(link.workspaceId,link)}><span className="library-recent-icon"><Icon name="browser"/></span><span className="library-recent-copy"><strong>{link.name}</strong><small>{link.workspaceName} · {link.groupName} · {link.url}</small></span><span className="library-link-open" aria-hidden="true">↗</span></button>):<div className="library-empty-state"><Icon name="browser"/><p>{t('noSavedStudyLinks')}</p></div>}</div>:section==='recent'?<div className="library-recent-list" aria-label={t('recentLibraryFiles')}>{workspaceActive&&recent.filter(file=>folderIds.includes(file.widgetId)).length?recent.filter(file=>folderIds.includes(file.widgetId)).map(file=><button key={file.widgetId+file.path} type="button" className="library-recent-item" title={file.path} onClick={()=>openRecentFile(file)}><span className="library-recent-icon"><Icon name="files"/></span><span className="library-recent-copy"><strong>{file.name}</strong><small>{file.path}</small></span><time dateTime={new Date(file.openedAt).toISOString()}>{openDate(file.openedAt)}</time></button>):<div className="library-empty-state"><Icon name="clock"/><p>{t('noRecentLibraryFiles')}</p></div>}</div>:workspaceActive&&current&&Renderer?<Renderer widget={current} update={patch=>update(current.id,patch)} obscured={false} workspaceActive={workspaceActive} notify={notify}/>:workspaceActive?<div className="library-empty-state"><Icon name={section==='files'?'files':'notes'}/><p>{section==='files'?t('emptyLibrary'):t('noMatchingNotesText')}</p></div>:null}
   </section>
  </main>
 </section>;
}
