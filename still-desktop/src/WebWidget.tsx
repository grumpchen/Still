import {useState} from 'react';
import type {WidgetProps} from './widgets.tsx';
import {chromeLauncher} from './platform/chrome.ts';
import {shortcut,reorderShortcuts,type WebShortcut} from './domain/webShortcuts.ts';
import {useT} from './localization.tsx';
export default function WebWidget({widget,update,notify}:WidgetProps){
  const t=useT();
  const [editing,setEditing]=useState(false),[draft,setDraft]=useState<WebShortcut|null>(null),[error,setError]=useState('');
  const [dragged,setDragged]=useState<string|null>(null);
  function edit(item?:WebShortcut){setDraft(item??{id:crypto.randomUUID(),name:'',url:'',icon:'↗'});setError('')}
  function save(){if(!draft)return;try{const checked=shortcut(draft);update({shortcuts:widget.shortcuts.some(s=>s.id===checked.id)?widget.shortcuts.map(s=>s.id===checked.id?checked:s):[...widget.shortcuts,checked]});setDraft(null)}catch(e){setError(String((e as Error).message))}}
  function order(id:string,direction:number){const items=[...widget.shortcuts],i=items.findIndex(s=>s.id===id),target=i+direction;if(target<0||target>=items.length)return;[items[i],items[target]]=[items[target],items[i]];update({shortcuts:items})}
  return <div className="web-widget">
    <div className="widget-subbar"><span>{chromeLauncher.native?t('opensInChromeProfile'):t('browserPreview')}</span><button aria-label={t('editWebShortcuts')} aria-pressed={editing} onClick={()=>{setEditing(!editing);setDraft(null)}}>{editing?t('done'):t('edit')}</button></div>
    {draft?<form className="shortcut-form" onSubmit={e=>{e.preventDefault();save()}}>
      <label>{t('shortcutName')}<input aria-label={t('shortcutName')} value={draft.name} maxLength={60} required onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
      <label>{t('websiteUrl')}<input aria-label={t('shortcutUrl')} value={draft.url} placeholder="https://…" required onChange={e=>setDraft({...draft,url:e.target.value})}/></label>
      <label>{t('iconOrInitials')}<input aria-label={t('shortcutIcon')} value={draft.icon} maxLength={8} onChange={e=>setDraft({...draft,icon:e.target.value})}/></label>
      {error&&<p role="alert" className="widget-error">{error}</p>}<div className="form-actions"><button type="button" onClick={()=>setDraft(null)}>{t('cancel')}</button><button className="primary" type="submit">{t('saveShortcut')}</button></div>
    </form>:<div className="shortcut-grid">{widget.shortcuts.map((item,index)=><div className={`web-tile ${dragged===item.id?'dragging-shortcut':''}`} key={item.id} draggable={editing} onDragStart={e=>{e.stopPropagation();setDragged(item.id);e.dataTransfer.setData('application/x-still-shortcut',item.id);e.dataTransfer.effectAllowed='move'}} onDragEnd={()=>setDragged(null)} onDragOver={e=>{if(dragged){e.preventDefault();e.stopPropagation()}}} onDrop={e=>{e.preventDefault();e.stopPropagation();if(dragged)update({shortcuts:reorderShortcuts(widget.shortcuts,dragged,item.id)});setDragged(null)}}>
      <button className="shortcut-open" aria-label={(editing?t('edit'):t('open'))+' '+item.name} title={item.url} onClick={()=>editing?edit(item):void chromeLauncher.open(item.url).catch(e=>notify(String(e)))}><span className="shortcut-symbol">{item.icon}</span><span>{item.name}</span></button>
      {editing&&<div className="shortcut-actions"><button aria-label={t('moveEarlier')+' '+item.name} disabled={index===0} onClick={()=>order(item.id,-1)}>←</button><button aria-label={t('moveLater')+' '+item.name} disabled={index===widget.shortcuts.length-1} onClick={()=>order(item.id,1)}>→</button><button aria-label={t('removeShortcut')+' '+item.name} onClick={()=>update({shortcuts:widget.shortcuts.filter(s=>s.id!==item.id)})}>×</button></div>}
    </div>)}<button className="shortcut-add" aria-label={t('addWebShortcut')} onClick={()=>edit()}><span>+</span>{t('add')}</button></div>}
    {!draft&&editing&&<p className="widget-hint">{t('editShortcutHint')}</p>}
  </div>;
}
