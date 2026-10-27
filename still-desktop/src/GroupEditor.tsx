import {useState} from 'react';
import {widgetCatalog,widgetTypes} from './domain/widgetCatalog.ts';
import {Icon} from './Icon.tsx';
import {groupWidgetEntry,type SavedGroup,type GroupWidgetEntry} from './domain/workspaces.ts';
import {shortcut,reorderShortcuts,type WebShortcut} from './domain/webShortcuts.ts';
import {useT} from './localization.tsx';

export type GroupEditMode='link'|'widget'|undefined;
interface Props {group:SavedGroup;update:(patch:Partial<Omit<SavedGroup,'id'>>)=>void;openLink?:(link:WebShortcut)=>void;openWidget?:(entry:GroupWidgetEntry)=>void;initialMode?:GroupEditMode;showNameField?:boolean}
const emptyLink=():WebShortcut=>({id:crypto.randomUUID(),name:'',url:'',icon:''});
export default function GroupEditor({group,update,openLink,openWidget,initialMode,showNameField=true}:Props){
 const t=useT();
 const [link,setLink]=useState<WebShortcut|null>(()=>initialMode==='link'?emptyLink():null);
 const [entry,setEntry]=useState<GroupWidgetEntry|null>(()=>initialMode==='widget'?groupWidgetEntry({type:'notes'}):null);
 const [error,setError]=useState('');
 function editLink(item?:WebShortcut){setEntry(null);setLink(item?{...item}:emptyLink());setError('')}
 function editWidget(item?:GroupWidgetEntry){setLink(null);setEntry(item?{...item}:groupWidgetEntry({type:'notes'}));setError('')}
 function cancel(){setEntry(null);setLink(null);setError('')}
 function save(){try{
  if(link){const item=shortcut(link);update({shortcuts:group.shortcuts.some(s=>s.id===item.id)?group.shortcuts.map(s=>s.id===item.id?item:s):[...group.shortcuts,item]})}
  if(entry){const item=groupWidgetEntry(entry);update({widgets:group.widgets.some(s=>s.id===item.id)?group.widgets.map(s=>s.id===item.id?item:s):[...group.widgets,item]})}
  cancel();
 }catch(e){setError(String((e as Error).message))}}
 function moveLink(item:WebShortcut,direction:number){const index=group.shortcuts.findIndex(s=>s.id===item.id),other=group.shortcuts[index+direction];if(other)update({shortcuts:direction<0?reorderShortcuts(group.shortcuts,item.id,other.id):reorderShortcuts(group.shortcuts,other.id,item.id)})}
 function moveWidget(index:number,direction:number){const items=[...group.widgets],next=index+direction;if(next<0||next>=items.length)return;[items[index],items[next]]=[items[next],items[index]];update({widgets:items})}
 return <div className="group-widget">
  {showNameField&&<label className="group-name">{t('groupName')}<input aria-label={t('groupName')} placeholder={t('groupNameExample')} maxLength={60} value={group.name} onChange={e=>update({name:e.target.value})}/></label>}
  {link||entry?<form className="shortcut-form" onSubmit={e=>{e.preventDefault();save()}}>
   {entry&&<label>{t('widgetType')}<select aria-label={t('groupWidgetType')} value={entry.type} onChange={e=>setEntry(groupWidgetEntry({id:entry.id,type:e.target.value as GroupWidgetEntry['type']}))}>{widgetTypes.filter(type=>type!=='group').map(type=><option value={type} key={type}>{t('widget_'+type)}</option>)}</select></label>}
   <label>{t('name')}<input autoFocus aria-label={link?t('resourceName'):t('groupWidgetName')} required maxLength={60} value={(link??entry)!.name} onChange={e=>link?setLink({...link,name:e.target.value}):setEntry({...entry!,name:e.target.value})}/></label>
   {link&&<label>{t('websiteUrl')}<input aria-label={t('resourceUrl')} placeholder="https://…" required value={link.url} onChange={e=>setLink({...link,url:e.target.value})}/></label>}
   <label>{t('icon')}<input aria-label={link?t('resourceIcon'):t('groupWidgetIcon')} placeholder={t('iconExample')} maxLength={8} value={(link??entry)!.icon} onChange={e=>link?setLink({...link,icon:e.target.value}):setEntry({...entry!,icon:e.target.value})}/></label>
   {error&&<p className="widget-error" role="alert">{error}</p>}
   <div className="form-actions"><button type="button" onClick={cancel}>{t('cancel')}</button><button type="submit" className="primary">{link?t('saveLink'):t('saveWidget')}</button></div>
  </form>:<>
   <div className="group-items">
    {group.shortcuts.map((item,index)=><div className="group-item" key={item.id}>
     <button className="group-open" title={item.url} aria-label={t('openInBrowser')+' '+item.name} onClick={()=>openLink?.(item)}><span className="group-icon">{item.icon}</span><span>{item.name}<small>{t('openInBrowser')} ↗</small></span></button>
     <div className="group-item-actions"><button aria-label={t('moveUp')+' '+item.name} disabled={index===0} onClick={()=>moveLink(item,-1)}>↑</button><button aria-label={t('moveDown')+' '+item.name} disabled={index===group.shortcuts.length-1} onClick={()=>moveLink(item,1)}>↓</button><button aria-label={t('edit')+' '+item.name} onClick={()=>editLink(item)}>✎</button><button aria-label={t('remove')+' '+item.name+' '+t('fromGroup')} onClick={()=>update({shortcuts:group.shortcuts.filter(s=>s.id!==item.id)})}>×</button></div>
    </div>)}
    {group.widgets.map((item,index)=><div className={'group-item '+(item.kind==='collected'?'group-item-collected':'')} key={item.id}>
     <button className="group-open" aria-label={item.kind==='collected'?t('restoreToWorkspace')+' '+item.name:t('addFromGroup')+' '+item.name} onClick={()=>openWidget?.(item)}>{item.kind==='collected'?(item.instance?.appIconData?<img className="group-icon group-icon-image" src={item.instance.appIconData} alt=""/>:<span className="group-icon"><Icon name={widgetCatalog[item.type].icon}/></span>):<span className="group-icon">{item.icon}</span>}<span>{item.name}<small>{item.kind==='collected'?t('restoreThisWidget'):t('newWidgetFromGroup')+' '+t('widget_'+item.type)}</small></span></button>
     <div className="group-item-actions"><button aria-label={t('moveUp')+' '+item.name} disabled={index===0} onClick={()=>moveWidget(index,-1)}>↑</button><button aria-label={t('moveDown')+' '+item.name} disabled={index===group.widgets.length-1} onClick={()=>moveWidget(index,1)}>↓</button>{item.kind!=='collected'&&<><button aria-label={t('edit')+' '+item.name} onClick={()=>editWidget(item)}>✎</button><button aria-label={t('remove')+' '+item.name+' '+t('fromGroup')} onClick={()=>update({widgets:group.widgets.filter(s=>s.id!==item.id)})}>×</button></>}</div>
    </div>)}
    {!group.shortcuts.length&&!group.widgets.length&&<p className="group-empty">{t('emptyGroupHelp')}</p>}
   </div>
   <div className="group-add-actions"><button className="group-add" onClick={()=>editWidget()}>+ {t('addWidget')}</button><button className="group-add" onClick={()=>editLink()}>+ {t('addLink')}</button></div>
  </>}
 </div>;
}
