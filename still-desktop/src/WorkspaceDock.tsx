import {useEffect,useRef,useState,type ReactNode, type RefObject} from 'react';
import {Icon} from './Icon.tsx';
import {appPanel} from './platform/appPanel.ts';
import {InstalledAppIcon} from './InstalledAppIcon.tsx';
import {loadInstalledAppIcon} from './platform/installedAppIcons.ts';
import type {InstalledAppChoice} from './domain/appPicker.ts';
import type {DroppedResource} from './platform/resourceDrop.ts';
import {useT} from './localization.tsx';

type DockPage='apps'|'shortcuts';
interface Props {
 trayRef:RefObject<HTMLDivElement|null>;
 shortcuts:ReactNode;
 status:ReactNode;
 expanded:boolean;
 onExpandedChange:(expanded:boolean)=>void;
 onOpenInstalledApp:(app:InstalledAppChoice,source:DroppedResource)=>void;
 onEditShortcuts:()=>void;
 onRemoveDrop:boolean;
}

/** The bottom dock keeps saved widget shortcuts, while its Apps page lists Start Menu apps. */
export default function WorkspaceDock({trayRef,shortcuts,status,expanded,onExpandedChange,onOpenInstalledApp,onEditShortcuts,onRemoveDrop}:Props){
 const t=useT();
 const [page,setPage]=useState<DockPage>('apps'),[apps,setApps]=useState<InstalledAppChoice[]>([]),[query,setQuery]=useState(''),[loading,setLoading]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState<string|null>(null);
 const mounted=useRef(true),request=useRef(0),loaded=useRef(false),shell=useRef<HTMLDivElement>(null);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;request.current++}},[]);
 useEffect(()=>{if(!expanded||page!=='apps'||loaded.current||!appPanel.available)return;const ticket=++request.current;setLoading(true);setError('');void appPanel.installed().then(items=>{if(mounted.current&&ticket===request.current){setApps(items);loaded.current=true}}).catch(reason=>{if(mounted.current&&ticket===request.current)setError(String(reason))}).finally(()=>{if(mounted.current&&ticket===request.current)setLoading(false)});},[expanded,page]);
 const matches=apps.filter(app=>app.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
 async function launch(app:InstalledAppChoice){if(busy)return;setBusy(app.id);setError('');try{const [source,picture]=await Promise.all([appPanel.selectInstalled(app.id),loadInstalledAppIcon(app.id)]);if(mounted.current)onOpenInstalledApp({...app,iconData:picture.url},source)}catch(reason){if(mounted.current){setError(String(reason));loaded.current=false}}finally{if(mounted.current)setBusy(null)}}
 return <div ref={shell} className={'widget-tray-shell workspace-dock-shell '+(expanded?'dock-expanded':'')} onMouseEnter={()=>onExpandedChange(true)} onMouseLeave={()=>{if(!shell.current?.contains(document.activeElement))onExpandedChange(false)}} onFocusCapture={()=>onExpandedChange(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null)&&!shell.current?.matches(':hover'))onExpandedChange(false)}}>
  <section id="workspace-tray" ref={trayRef} role="group" className={'widget-tray workspace-dock '+(onRemoveDrop?'tray-remove':'')} aria-label={t('dockTitle')} aria-describedby="widget-tray-help" data-expanded={expanded}>
   <button type="button" className="dock-reveal-rail" aria-label={expanded?t('dockExpandedAria'):t('dockShowApps')} aria-expanded={expanded} title={t('dockTitle')} onClick={()=>onExpandedChange(!expanded)} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();onExpandedChange(false)}}}><span/></button>
   {expanded&&<>
    <div className="dock-page-tabs" role="tablist" aria-label={t('dockPages')}>
     <button role="tab" aria-selected={page==='apps'} onClick={()=>{setPage('apps');onExpandedChange(true)}}>{t('dockAppsPage')}{apps.length>0&&<small>{apps.length}</small>}</button>
     <button role="tab" aria-selected={page==='shortcuts'} onClick={()=>{setPage('shortcuts');onExpandedChange(true)}}>{t('dockShortcutsPage')}</button>
     <span className="dock-tab-spacer"/>
     <button type="button" className={'tray-control tray-trash '+(onRemoveDrop?'trash-active':'')} data-trash-target="" aria-label={t('dockRemoveWidget')} title={t('dockRemoveTooltip')} onClick={onEditShortcuts}><Icon name="trash"/></button>
     <button type="button" className="tray-control" aria-label={t('dockManageShortcuts')} title={t('dockManageShortcuts')} onClick={onEditShortcuts}><Icon name="edit"/></button>
    </div>
    <div className="dock-page-content" hidden={page!=='apps'}>
     <div className="dock-search-row"><span>{t('dockApplications')}</span><input aria-label={t('dockSearchInstalledApps')} placeholder={t('dockSearchAppsPlaceholder')} value={query} onChange={event=>setQuery(event.target.value)}/><button type="button" onClick={()=>{loaded.current=false;setQuery('');setError('');onExpandedChange(true);setPage('apps');request.current++;setLoading(true);const ticket=request.current;void appPanel.installed().then(items=>{if(mounted.current&&ticket===request.current){setApps(items);loaded.current=true}}).catch(reason=>{if(mounted.current&&ticket===request.current)setError(String(reason))}).finally(()=>{if(mounted.current&&ticket===request.current)setLoading(false)})}} disabled={!appPanel.available||loading} aria-label={t('dockRefreshInstalledApps')} title={t('dockRefreshAppsTooltip')}><Icon name="restart"/></button></div>
     {!appPanel.available?<p className="dock-message">{t('dockAppsWindowsOnly')}</p>:loading&&!apps.length?<p className="dock-message" role="status">{t('dockLoadingApps')}</p>:error?<p className="dock-message dock-error" role="alert">{error}</p>:<div className="dock-app-grid" data-trash-target="" aria-label={t('dockInstalledAppsRemoveHint')}>
      {matches.map(app=><button type="button" key={app.id} className="dock-app" title={t('dockOpenAppTitle')+' '+app.name} aria-label={t('dockOpenAppAria')+' '+app.name} disabled={busy!==null} onClick={()=>void launch(app)}><InstalledAppIcon id={app.id} className="dock-app-fallback"/><span>{busy===app.id?t('dockOpening'):app.name}</span></button>)}
      {!matches.length&&<p className="dock-message">{query?t('dockNoMatchingApps'):t('dockNoStartShortcuts')}</p>}
     </div>}
    </div>
    <div className="dock-page-content dock-shortcuts-page" hidden={page!=='shortcuts'}>
     <div className="tray-main-row"><span className="tray-status" role="status">{status}</span><div className="tray-items dock-shortcuts-items">{shortcuts}</div><button className="tray-control saved-plus" data-saved-target="" aria-label={t('dockSaveWidgetShortcut')} title={t('dockSaveTooltip')} onClick={onEditShortcuts}>+</button></div>
     <p className="dock-shortcuts-hint">{t('dockShortcutHint')}</p>
    </div>
   </>}
   <span id="widget-tray-help" className="tray-help-text">{t('dockHelp')}</span>
  </section>
 </div>
}
