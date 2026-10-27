import {useState} from 'react';
import type {Workspace,WidgetInstance} from './domain/workspaces.ts';
import {widgetRegistry} from './widgets.tsx';
import {Icon} from './Icon.tsx';
import {useT} from './localization.tsx';

interface LibraryHomeProps {
 workspace:Workspace;
 update:(id:string,patch:Partial<WidgetInstance>)=>void;
 notify:(message:string)=>void;
 workspaceActive:boolean;
}

type LibrarySection='files'|'notes';

export default function LibraryHome({workspace,update,notify,workspaceActive}:LibraryHomeProps){
 const t=useT(),[section,setSection]=useState<LibrarySection>('files');
 const files=workspace.widgets.find(widget=>widget.type==='files'&&!widget.fileKey)??workspace.widgets.find(widget=>widget.type==='files');
 const notes=workspace.widgets.find(widget=>widget.type==='notes');
 const current=section==='files'?files:notes;
 const title=section==='files'?t('files'):t('widget_notes');
 const description=section==='files'?t('localLibraryStatus'):t('libraryNotesDescription');
 const Renderer=current?widgetRegistry[current.type].component:null;

 return <section className="library-home" aria-label={t('library')}>
  <aside className="library-rail" aria-label={t('library')}>
   <div className="library-rail-heading"><span className="library-rail-mark"><Icon name="files"/></span><div><strong>{t('library')}</strong><small>{t('libraryPageDescription')}</small></div></div>
   <div className="library-rail-group">
    <span className="library-rail-label">{t('libraryContents')}</span>
    <button type="button" className={section==='files'?'active':''} aria-current={section==='files'?'page':undefined} onClick={()=>setSection('files')}><Icon name="files"/><span>{t('files')}</span></button>
    <button type="button" className={section==='notes'?'active':''} aria-current={section==='notes'?'page':undefined} onClick={()=>setSection('notes')}><Icon name="notes"/><span>{t('widget_notes')}</span></button>
   </div>
   <p className="library-rail-footnote">{t('filesStayLocal')}</p>
  </aside>
  <main className="library-main">
   <header className="library-page-header"><div><span className="library-page-eyebrow">{t('library')}</span><h2>{title}</h2><p>{description}</p></div></header>
   <section className={'library-work-area library-work-area-'+section} aria-label={title}>
    {workspaceActive&&current&&Renderer?<Renderer widget={current} update={patch=>update(current.id,patch)} obscured={false} workspaceActive={workspaceActive} notify={notify}/>:workspaceActive?<div className="library-empty-state"><Icon name={section==='files'?'files':'notes'}/><p>{section==='files'?t('emptyLibrary'):t('noMatchingNotesText')}</p></div>:null}
   </section>
  </main>
 </section>;
}
