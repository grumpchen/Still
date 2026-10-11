import {useState} from 'react';
import {availableStatusControls,type WidgetPluginContext} from './domain/widgetPlugins.ts';
import type {WidgetProps} from './widgets.tsx';

export default function TagColorStatusWidget({widget,update,widgetPluginContext}:WidgetProps){
 const [customizing,setCustomizing]=useState(false),context=widgetPluginContext;
 const controls=availableStatusControls(context?.relaunchPluginStatus??'removed');
 const selected=widget.pluginControls??[];
 function toggle(id:string){update({pluginControls:selected.includes(id)?selected.filter(item=>item!==id):[...selected,id]})}
 const has=(id:string)=>selected.includes(id)&&controls.some(control=>control.id===id);
 return <section className="tag-status-widget">
  <div className="tag-status-heading"><div><h2>Plugin status</h2><p>Choose which widget-plugin controls to keep here.</p></div><button type="button" aria-label="Customize status controls" aria-expanded={customizing} onClick={()=>setCustomizing(value=>!value)}>Customize</button></div>
  {customizing&&<fieldset className="tag-status-customizer"><legend>Controls on this card</legend>{controls.map(control=><label key={control.id}><input type="checkbox" aria-label={'Show '+control.label} checked={selected.includes(control.id)} onChange={()=>toggle(control.id)}/>{control.label}</label>)}</fieldset>}
  {controls.filter(control=>has(control.id)).map(({id,StatusControl})=><StatusControl key={id} context={context} widget={widget} update={update}/>)}
  {!controls.length&&<p className="notice">No widget-plugin controls are available. Your saved choices are retained.</p>}
  {controls.length&&!controls.some(control=>has(control.id))&&<p className="notice">Choose controls to display on this card.</p>}
 </section>;
}
