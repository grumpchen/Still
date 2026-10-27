import {useEffect,useState} from 'react';
import type {Workspace,WidgetInstance} from './domain/workspaces.ts';
import {readRecentLibraryFiles,type RecentLibraryFile} from './domain/libraryRecents.ts';
import {widgetRegistry} from './widgets.tsx';
import {Icon} from './Icon.tsx';
import {useLocale,useT} from './localization.tsx';

interface LibraryHomeProps {
 workspace:Workspace;
 update:(id:string,patch:Partial<WidgetInstance>)=>void;
 notify:(message:string)=>void;
 workspaceActive:boolean;
}

type LibrarySection='files'|'notes';

export default function LibraryHome({workspace,update,notify,workspaceActive}:LibraryHomeProps){
 const t=useT(),locale=useLocale(),[section,setSection]=useState<LibrarySection|'recent'>('files'),[recent,setRecent]=useState<RecentLibraryFile[]>(readRecentLibraryFiles);
 const files=workspace.widgets.find(widget=>widget.type==='files'&&!widget.fileKey)??workspace.widgets.find(widget=>widget.type==='files');
 const notes=workspace.widgets.find(widget=>widget.type==='notes');
 const current=section==='files'?files:section==='notes'?notes:null;
 const title=section==='files'?t('files'):section==='notes'?t('widget_notes'):t('recentLibraryFiles');
 const description=section==='files'?t('localLibraryStatus'):section==='notes'?t('libraryNotesDescription'):t('recentLibraryDescription');
 const Renderer=current?widgetRegistry[current.type].component:null;

 useEffect(()=>{const opened=(event:Event)=>{const detail=(event as CustomEvent<{widgetId?:string}>).detail;if(detail?.widgetId===files?.id)setRecent(readRecentLibraryFiles())};window.addEventListener('still-library-file-opened',opened);return()=>window.removeEventListener('still-library-file-opened',opened)},[files?.id]);

 function openRecentFile(file:RecentLibraryFile){setSection('files');requestAnimationFrame(()=>window.setTimeout(()=>window.dispatchEvent(new CustomEvent('still-open-library-recent-file',{detail:{widgetId:file.widgetId,path:file.path}})),0))}
 function openDate(timestamp:number){return new Intl.DateTimeFormat(locale==='zh-CN'?'zh-CN':undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(timestamp)}

 return <section className="library-home" aria-label={t('library')}>
  <aside className="library-rail" aria-label={t('library')}>
   <div className="library-rail-heading"><span className="library-rail-mark"><Icon name="files"/></span><div><strong>{t('library')}</strong><small>{t('libraryPageDescription')}</small></div></div>
   <div className="library-rail-group">
    <span className="library-rail-label">{t('libraryContents')}</span>
    <button type="button" className={section==='files'?'active':''} aria-current={section==='files'?'page':undefined} onClick={()=>setSection('files')}><Icon name="files"/><span>{t('files')}</span></button>
    <button type="button" className={section==='notes'?'active':''} aria-current={section==='notes'?'page':undefined} onClick={()=>setSection('notes')}><Icon name="notes"/><span>{t('widget_notes')}</span></button>
    <button type="button" className={section==='recent'?'active':''} aria-current={section==='recent'?'page':undefined} onClick={()=>setSection('recent')}><Icon name="clock"/><span>{t('recentLibraryFiles')}</span></button>
   </div>
   <p className="library-rail-footnote">{t('filesStayLocal')}</p>
  </aside>
  <main className="library-main">
   <header className="library-page-header"><div><span className="library-page-eyebrow">{t('library')}</span><h2>{title}</h2><p>{description}</p></div></header>
   <section className={'library-work-area library-work-area-'+section} aria-label={title}>
    {section==='recent'?<div className="library-recent-list" aria-label={t('recentLibraryFiles')}>{workspaceActive&&recent.filter(file=>file.widgetId===files?.id).length?recent.filter(file=>file.widgetId===files?.id).map(file=><button key={file.widgetId+file.path} type="button" className="library-recent-item" title={file.path} onClick={()=>openRecentFile(file)}><span className="library-recent-icon"><Icon name="files"/></span><span className="library-recent-copy"><strong>{file.name}</strong><small>{file.path}</small></span><time dateTime={new Date(file.openedAt).toISOString()}>{openDate(file.openedAt)}</time></button>):<div className="library-empty-state"><Icon name="clock"/><p>{t('noRecentLibraryFiles')}</p></div>}</div>:workspaceActive&&current&&Renderer?<Renderer widget={current} update={patch=>update(current.id,patch)} obscured={false} workspaceActive={workspaceActive} notify={notify}/>:workspaceActive?<div className="library-empty-state"><Icon name={section==='files'?'files':'notes'}/><p>{section==='files'?t('emptyLibrary'):t('noMatchingNotesText')}</p></div>:null}
   </section>
  </main>
 </section>;
}
