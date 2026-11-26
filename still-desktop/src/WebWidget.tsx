import {useCallback,useEffect,useRef,useState} from 'react';
import type {WidgetProps} from './widgets.tsx';
import {browserPanel} from './platform/browserPanel.ts';
import {browserDestination,normalizeUrl} from './domain/browser.ts';
import {shortcut,reorderShortcuts,type WebShortcut} from './domain/webShortcuts.ts';
import {useT} from './localization.tsx';

type Props=WidgetProps&{layoutMode?:string|null};
export default function WebWidget({widget,update,notify,obscured,workspaceActive=true,layoutMode=null}:Props){
 const t=useT(),viewport=useRef<HTMLDivElement>(null),notifyRef=useRef(notify),[editing,setEditing]=useState(false),[draft,setDraft]=useState<WebShortcut|null>(null),[error,setError]=useState(''),[dragged,setDragged]=useState<string|null>(null),[address,setAddress]=useState(widget.browserUrl||'https://www.google.com/'),[showLinks,setShowLinks]=useState(false);notifyRef.current=notify;
 const hidden=obscured||!workspaceActive||!!layoutMode||showLinks;
 const persistUrl=useCallback((value:string)=>{try{const url=normalizeUrl(value);update({browserUrl:url});setAddress(url)}catch{/* Redirects outside HTTPS are rejected by the native child view. */}},[update]);
 const load=useCallback((value:string)=>{try{const url=browserDestination(value);setError('');setAddress(url);update({browserUrl:url});if(browserPanel.native)void browserPanel.navigate(widget.id,url).catch(e=>notify(String(e)))}catch(e){setError(String((e as Error).message))}},[notify,update,widget.id]);
 useEffect(()=>{setAddress(widget.browserUrl||'https://www.google.com/')},[widget.browserUrl]);
 // A real Tauri child view stays alive between routes and is removed with its widget.
 useEffect(()=>()=>{void browserPanel.close(widget.id).catch(e=>notifyRef.current(String(e)))},[widget.id]);
 useEffect(()=>{let active=true,unsubscribe:(()=>void)|undefined;void browserPanel.onLocation(location=>{if(active&&location.widgetId===widget.id)persistUrl(location.url)}).then(stop=>{if(active)unsubscribe=stop;else stop()}).catch(e=>notify(String(e)));return()=>{active=false;unsubscribe?.()}},[notify,persistUrl,widget.id]);
 // Poll while visible so a transformed/scrolled/resized canvas keeps the native surface aligned.
 useEffect(()=>{let alive=true;const sync=()=>{if(!alive||!browserPanel.native)return;const rect=viewport.current?.getBoundingClientRect();if(!rect||rect.width<2||rect.height<2)return;void browserPanel.present(widget.id,widget.browserUrl||'https://www.google.com/',{x:rect.left,y:rect.top,width:rect.width,height:rect.height},!hidden).catch(e=>notify(String(e)))};sync();const timer=window.setInterval(sync,120);const observer=viewport.current?new ResizeObserver(sync):null;if(viewport.current)observer?.observe(viewport.current);window.addEventListener('resize',sync);return()=>{alive=false;clearInterval(timer);observer?.disconnect();window.removeEventListener('resize',sync)}},[hidden,notify,widget.browserUrl,widget.id,widget.placement.x,widget.placement.y,widget.placement.width,widget.placement.height]);
 function edit(item?:WebShortcut){setDraft(item??{id:crypto.randomUUID(),name:'',url:'',icon:'↗'});setError('')}
 function save(){if(!draft)return;try{const checked=shortcut(draft);update({shortcuts:widget.shortcuts.some(s=>s.id===checked.id)?widget.shortcuts.map(s=>s.id===checked.id?checked:s):[...widget.shortcuts,checked]});setDraft(null)}catch(e){setError(String((e as Error).message))}}
 function order(id:string,direction:number){const items=[...widget.shortcuts],i=items.findIndex(s=>s.id===id),target=i+direction;if(target<0||target>=items.length)return;[items[i],items[target]]=[items[target],items[i]];update({shortcuts:items})}
 return <div className="web-widget embedded-browser">
  <form className="browser-toolbar" aria-label="Browser navigation" onSubmit={event=>{event.preventDefault();load(address)}}>
   <button type="button" aria-label="Back" title="Back" onClick={()=>void browserPanel.goBack(widget.id).catch(e=>notify(String(e)))}>‹</button>
   <button type="button" aria-label="Forward" title="Forward" onClick={()=>void browserPanel.goForward(widget.id).catch(e=>notify(String(e)))}>›</button>
   <button type="button" aria-label="Reload" title="Reload" onClick={()=>void browserPanel.reload(widget.id).catch(e=>notify(String(e)))}>↻</button>
   <input aria-label="Website address" value={address} onChange={event=>setAddress(event.target.value)} onFocus={event=>event.currentTarget.select()} />
   <button className="primary" type="submit">Go</button>
   <button type="button" aria-label="Saved links" aria-expanded={showLinks} onClick={()=>setShowLinks(!showLinks)}>☆</button>
  </form>
  {error&&<p role="alert" className="widget-error">{error}</p>}
  {browserPanel.native?<div ref={viewport} className="browser-native-viewport" aria-label="Embedded website"/>:<div className="browser-preview-wrap"><iframe title="Browser preview" src={address} referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms"/><div className="browser-preview-note">Web preview is limited. <button type="button" onClick={()=>window.open(address,'_blank','noopener,noreferrer')}>Open in a new tab ↗</button></div></div>}
  {showLinks&&<section className="browser-links" aria-label="Saved website links">
   <div className="widget-subbar"><span>Saved website links</span><button aria-label={t('editWebShortcuts')} aria-pressed={editing} onClick={()=>{setEditing(!editing);setDraft(null)}}>{editing?t('done'):t('edit')}</button></div>
   {draft?<form className="shortcut-form" onSubmit={event=>{event.preventDefault();save()}}>
    <label>{t('shortcutName')}<input aria-label={t('shortcutName')} value={draft.name} maxLength={60} required onChange={event=>setDraft({...draft,name:event.target.value})}/></label>
    <label>{t('websiteUrl')}<input aria-label={t('shortcutUrl')} value={draft.url} placeholder="https://…" required onChange={event=>setDraft({...draft,url:event.target.value})}/></label>
    <label>{t('iconOrInitials')}<input aria-label={t('shortcutIcon')} value={draft.icon} maxLength={8} onChange={event=>setDraft({...draft,icon:event.target.value})}/></label>
    {error&&<p role="alert" className="widget-error">{error}</p>}<div className="form-actions"><button type="button" onClick={()=>setDraft(null)}>{t('cancel')}</button><button className="primary" type="submit">{t('saveShortcut')}</button></div>
   </form>:<div className="shortcut-grid">{widget.shortcuts.map((item,index)=><div className={`web-tile ${dragged===item.id?'dragging-shortcut':''}`} key={item.id} draggable={editing} onDragStart={event=>{event.stopPropagation();setDragged(item.id);event.dataTransfer.setData('application/x-still-shortcut',item.id);event.dataTransfer.effectAllowed='move'}} onDragEnd={()=>setDragged(null)} onDragOver={event=>{if(dragged){event.preventDefault();event.stopPropagation()}}} onDrop={event=>{event.preventDefault();event.stopPropagation();if(dragged)update({shortcuts:reorderShortcuts(widget.shortcuts,dragged,item.id)});setDragged(null)}}>
    <button className="shortcut-open" aria-label={(editing?t('edit'):t('open'))+' '+item.name} title={item.url} onClick={()=>editing?edit(item):load(item.url)}><span className="shortcut-symbol">{item.icon}</span><span>{item.name}</span></button>
    {editing&&<div className="shortcut-actions"><button aria-label={t('moveEarlier')+' '+item.name} disabled={index===0} onClick={()=>order(item.id,-1)}>←</button><button aria-label={t('moveLater')+' '+item.name} disabled={index===widget.shortcuts.length-1} onClick={()=>order(item.id,1)}>→</button><button aria-label={t('removeShortcut')+' '+item.name} onClick={()=>update({shortcuts:widget.shortcuts.filter(s=>s.id!==item.id)})}>×</button></div>}
   </div>)}<button className="shortcut-add" aria-label={t('addWebShortcut')} onClick={()=>edit()}><span>+</span>{t('add')}</button></div>}
   {!draft&&editing&&<p className="widget-hint">{t('editShortcutHint')}</p>}
  </section>}
 </div>;
}
