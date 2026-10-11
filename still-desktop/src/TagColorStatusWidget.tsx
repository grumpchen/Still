import {useState} from 'react';
import {widgetTagColors,type WidgetTagColor} from './domain/workspaces.ts';
import {availableStatusControls,widgetPluginCatalog,type WidgetPluginContext} from './domain/widgetPlugins.ts';
import type {WidgetProps} from './widgets.tsx';

export default function TagColorStatusWidget({widget,update,widgetPluginContext}:WidgetProps){
 const [customizing,setCustomizing]=useState(false),context=widgetPluginContext;
 const controls=availableStatusControls(context?.relaunchPluginStatus??'removed');
 const selected=widget.pluginControls??[];
 function toggle(id:string){update({pluginControls:selected.includes(id)?selected.filter(item=>item!==id):[...selected,id]})}
 const has=(id:string)=>selected.includes(id)&&controls.some(control=>control.id===id);
 return <section className="tag-status-widget">
  <div className="tag-status-heading"><div><h2>Widget startup</h2><p>Choose relaunch behavior by tag color.</p></div><button type="button" aria-label="Customize status controls" aria-expanded={customizing} onClick={()=>setCustomizing(value=>!value)}>Customize</button></div>
  {customizing&&<fieldset className="tag-status-customizer"><legend>Controls on this card</legend>{widgetPluginCatalog.flatMap(plugin=>plugin.controls).map(control=><label key={control.id}><input type="checkbox" checked={selected.includes(control.id)} onChange={()=>toggle(control.id)}/>{control.label}</label>)}</fieldset>}
  {has('widget-relaunch.global-mode')&&<label className="settings-row"><span>All widgets</span><select aria-label="Status card global relaunch mode" disabled={!context||context.relaunchPluginStatus!=='enabled'} value={context?.globalMode??'manual'} onChange={event=>context?.setGlobalMode(event.target.value as 'automatic'|'manual')}><option value="automatic">Automatic</option><option value="manual">Manual</option></select></label>}
  {has('widget-relaunch.tag-colors')&&widgetTagColors.map((color:WidgetTagColor)=><label key={color} className="settings-row"><span className="tag-status-color"><i data-tag-color={color}/>{color[0].toUpperCase()+color.slice(1)}</span><select aria-label={'Status card '+color+' relaunch mode'} disabled={!context||context.relaunchPluginStatus!=='enabled'} value={context?.colors[color]??'follow'} onChange={event=>context?.setColorMode(color,event.target.value==='follow'?null:event.target.value as 'automatic'|'manual')}><option value="follow">Follow global</option><option value="automatic">Automatic</option><option value="manual">Manual</option></select></label>)}
  {!controls.length&&<p className="notice">Enable Widget Relaunch in Settings to use these controls. Your saved choices are retained.</p>}
  {controls.length&&!has('widget-relaunch.global-mode')&&!has('widget-relaunch.tag-colors')&&<p className="notice">Choose controls to display on this card.</p>}
 </section>;
}
