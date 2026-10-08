import {useState} from 'react';
import {widgetCatalog,widgetTypes} from './domain/widgetCatalog.ts';
import {Icon} from './widgets.tsx';
import {groupWidgetEntry,type SavedGroup,type GroupWidgetEntry} from './domain/workspaces.ts';
import {shortcut,reorderShortcuts,type WebShortcut} from './domain/webShortcuts.ts';

export type GroupEditMode='link'|'widget'|undefined;
interface Props {group:SavedGroup;update:(patch:Partial<Omit<SavedGroup,'id'>>)=>void;openLink?:(link:WebShortcut)=>void;openWidget?:(entry:GroupWidgetEntry)=>void;initialMode?:GroupEditMode;showNameField?:boolean}
const emptyLink=():WebShortcut=>({id:crypto.randomUUID(),name:'',url:'',icon:''});
export default function GroupEditor({group,update,openLink,openWidget,initialMode,showNameField=true}:Props){
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
  {showNameField&&<label className="group-name">Group name<input aria-label="Group name" placeholder="e.g. CHEM111" maxLength={60} value={group.name} onChange={e=>update({name:e.target.value})}/></label>}
  {link||entry?<form className="shortcut-form" onSubmit={e=>{e.preventDefault();save()}}>
   {entry&&<label>Widget type<select aria-label="Group widget type" value={entry.type} onChange={e=>setEntry(groupWidgetEntry({id:entry.id,type:e.target.value as GroupWidgetEntry['type']}))}>{widgetTypes.filter(t=>t!=='group').map(t=><option value={t} key={t}>{widgetCatalog[t].name}</option>)}</select></label>}
   <label>Name<input autoFocus aria-label={link?'Resource name':'Group widget name'} required maxLength={60} value={(link??entry)!.name} onChange={e=>link?setLink({...link,name:e.target.value}):setEntry({...entry!,name:e.target.value})}/></label>
   {link&&<label>Website URL<input aria-label="Resource URL" placeholder="https://…" required value={link.url} onChange={e=>setLink({...link,url:e.target.value})}/></label>}
   <label>Icon<input aria-label={link?'Resource icon':'Group widget icon'} placeholder="e.g. ▶, ∑, PDF" maxLength={8} value={(link??entry)!.icon} onChange={e=>link?setLink({...link,icon:e.target.value}):setEntry({...entry!,icon:e.target.value})}/></label>
   {error&&<p className="widget-error" role="alert">{error}</p>}
   <div className="form-actions"><button type="button" onClick={cancel}>Cancel</button><button type="submit" className="primary">{link?'Save link':'Save widget'}</button></div>
  </form>:<>
   <div className="group-items">
    {group.shortcuts.map((item,index)=><div className="group-item" key={item.id}>
     <button className="group-open" title={item.url} aria-label={'Open '+item.name+' as a new widget'} onClick={()=>openLink?.(item)}><span className="group-icon">{item.icon}</span><span>{item.name}<small>New Browser widget ↗</small></span></button>
     <div className="group-item-actions"><button aria-label={'Move '+item.name+' up'} disabled={index===0} onClick={()=>moveLink(item,-1)}>↑</button><button aria-label={'Move '+item.name+' down'} disabled={index===group.shortcuts.length-1} onClick={()=>moveLink(item,1)}>↓</button><button aria-label={'Edit '+item.name} onClick={()=>editLink(item)}>✎</button><button aria-label={'Remove '+item.name+' from group'} onClick={()=>update({shortcuts:group.shortcuts.filter(s=>s.id!==item.id)})}>×</button></div>
    </div>)}
    {group.widgets.map((item,index)=><div className={'group-item '+(item.kind==='collected'?'group-item-collected':'')} key={item.id}>
     <button className="group-open" aria-label={item.kind==='collected'?'Restore '+item.name+' to workspace':'Add '+item.name+' from group'} onClick={()=>openWidget?.(item)}>{item.kind==='collected'?(item.instance?.appIconData?<img className="group-icon group-icon-image" src={item.instance.appIconData} alt=""/>:<span className="group-icon"><Icon name={widgetCatalog[item.type].icon}/></span>):<span className="group-icon">{item.icon}</span>}<span>{item.name}<small>{item.kind==='collected'?'Restore this widget':'New '+widgetCatalog[item.type].name+' widget'}</small></span></button>
     <div className="group-item-actions"><button aria-label={'Move '+item.name+' up'} disabled={index===0} onClick={()=>moveWidget(index,-1)}>↑</button><button aria-label={'Move '+item.name+' down'} disabled={index===group.widgets.length-1} onClick={()=>moveWidget(index,1)}>↓</button>{item.kind!=='collected'&&<><button aria-label={'Edit '+item.name} onClick={()=>editWidget(item)}>✎</button><button aria-label={'Remove '+item.name+' from group'} onClick={()=>update({widgets:group.widgets.filter(s=>s.id!==item.id)})}>×</button></>}</div>
    </div>)}
    {!group.shortcuts.length&&!group.widgets.length&&<p className="group-empty">Save course links and widget types here, then add fresh instances from the tray whenever you need them.</p>}
   </div>
   <div className="group-add-actions"><button className="group-add" onClick={()=>editWidget()}>+ Add widget</button><button className="group-add" onClick={()=>editLink()}>+ Add link</button></div>
  </>}
 </div>;
}
