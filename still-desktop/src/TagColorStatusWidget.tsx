import {useState} from 'react';
import {availableStatusControls,type WidgetPluginContext} from './domain/widgetPlugins.ts';
import type {WidgetProps} from './widgets.tsx';
import {useT} from './localization.tsx';

export default function TagColorStatusWidget({widget,update,widgetPluginContext}:WidgetProps){
 const t=useT();
 const [customizing,setCustomizing]=useState(false),context=widgetPluginContext;
 const controls=availableStatusControls(context?.relaunchPluginStatus??'removed');
 const selected=widget.pluginControls??[];
 function toggle(id:string){update({pluginControls:selected.includes(id)?selected.filter(item=>item!==id):[...selected,id]})}
 const has=(id:string)=>selected.includes(id)&&controls.some(control=>control.id===id);
 return <section className="tag-status-widget">
  <div className="tag-status-heading"><div><h2>{t('pluginStatus')}</h2><p>{t('choosePluginControls')}</p></div><button type="button" aria-label={t('customizeStatusControls')} aria-expanded={customizing} onClick={()=>setCustomizing(value=>!value)}>{t('customize')}</button></div>
  {customizing&&<fieldset className="tag-status-customizer"><legend>{t('controlsOnThisCard')}</legend>{controls.map(control=><label key={control.id}><input type="checkbox" aria-label={t('show')+' '+t('statusControl_'+control.id)} checked={selected.includes(control.id)} onChange={()=>toggle(control.id)}/>{t('statusControl_'+control.id)}</label>)}</fieldset>}
  {controls.filter(control=>has(control.id)).map(({id,StatusControl})=><StatusControl key={id} context={context} widget={widget} update={update}/>)}
  {!controls.length&&<p className="notice">{t('noPluginControlsAvailable')}</p>}
  {controls.length&&!controls.some(control=>has(control.id))&&<p className="notice">{t('chooseControlsForCard')}</p>}
 </section>;
}
