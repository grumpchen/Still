import {useState} from 'react';
import {availableStatusControls,type WidgetPluginContext} from './domain/widgetPlugins.ts';
import {widgetTaskStatusCounts,type WidgetTaskStatusFilter} from './domain/widgetTaskStatus.ts';
import type {WidgetTaskStatus} from './domain/widgetTaskStatus.ts';
import type {WidgetProps} from './widgets.tsx';
import {useT} from './localization.tsx';

export default function TagColorStatusWidget({widget,update,widgetPluginContext,workspaceWidgets=[]}:WidgetProps){
 const t=useT();
 const [customizing,setCustomizing]=useState(false),context=widgetPluginContext;
 const controls=availableStatusControls(context?.relaunchPluginStatus??'removed');
 const selected=widget.pluginControls??[];
 const counts=widgetTaskStatusCounts(workspaceWidgets.filter(item=>item.type!=='tagStatus'));
 const taskStatusFilter=context?.taskStatusFilter??'all';
 const statusFilters:WidgetTaskStatusFilter[]=['all','todo','in-progress','done','unset'];
 function toggle(id:string){update({pluginControls:selected.includes(id)?selected.filter(item=>item!==id):[...selected,id]})}
 const has=(id:string)=>selected.includes(id)&&controls.some(control=>control.id===id);
 return <section className="tag-status-widget">
  <div className="task-status-overview"><div><h2>{t('taskStatusAddon')}</h2><p>{t('taskStatusOverviewDescription')}</p></div><div className="task-status-filters" role="group" aria-label={t('taskStatusAddon')}>{statusFilters.map(filter=>{const label=t(filter==='all'?'taskStatusAll':filter==='unset'?'taskStatusUnset':`taskStatus${filter==='todo'?'Todo':filter==='done'?'Done':'InProgress'}`),count=filter==='all'?counts.all:filter==='unset'?counts.unset:counts[filter as WidgetTaskStatus];return <button key={filter} type="button" aria-pressed={taskStatusFilter===filter} onClick={()=>context?.setTaskStatusFilter?.(filter)}>{t('taskStatusCount').replace('{label}',label).replace('{count}',String(count))}</button>})}</div></div>
  <div className="tag-status-heading"><div><h2>{t('pluginStatus')}</h2><p>{t('choosePluginControls')}</p></div><button type="button" aria-label={t('customizeStatusControls')} aria-expanded={customizing} onClick={()=>setCustomizing(value=>!value)}>{t('customize')}</button></div>
  {customizing&&<fieldset className="tag-status-customizer"><legend>{t('controlsOnThisCard')}</legend>{controls.map(control=><label key={control.id}><input type="checkbox" aria-label={t('show')+' '+t('statusControl_'+control.id)} checked={selected.includes(control.id)} onChange={()=>toggle(control.id)}/>{t('statusControl_'+control.id)}</label>)}</fieldset>}
  {controls.filter(control=>has(control.id)).map(({id,StatusControl})=><StatusControl key={id} context={context} widget={widget} update={update}/>)}
  {!controls.length&&<p className="notice">{t('noPluginControlsAvailable')}</p>}
  {controls.length&&!controls.some(control=>has(control.id))&&<p className="notice">{t('chooseControlsForCard')}</p>}
 </section>;
}
