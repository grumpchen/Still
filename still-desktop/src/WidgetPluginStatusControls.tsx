import {useState} from 'react';
import {widgetTagColors,type WidgetTagColor} from './domain/widgetTags.ts';
import type {WidgetPluginControlProps} from './domain/widgetPlugins.ts';

const colorControlPrefix='widget-relaunch.color.';
function selectedColorControls(pluginControls:string[]):WidgetTagColor[]{
 return widgetTagColors.filter(color=>pluginControls.includes(colorControlPrefix+color));
}

export function RelaunchGlobalModeControl({context}:WidgetPluginControlProps){
 return <label className="settings-row"><span>All widgets</span><select aria-label="Status card global relaunch mode" disabled={!context||context.relaunchPluginStatus!=='enabled'} value={context?.globalMode??'manual'} onChange={event=>context?.setGlobalMode(event.target.value as 'automatic'|'manual')}><option value="automatic">Automatic</option><option value="manual">Manual</option></select></label>;
}

export function RelaunchTagColorsControl({context,widget,update}:WidgetPluginControlProps){
 const selectedColors=selectedColorControls(widget.pluginControls??[]);
 const hasOverrides=widgetTagColors.some(color=>context?.colors[color]);
 const [expanded,setExpanded]=useState(selectedColors.length>0||hasOverrides);
 const useGlobal=selectedColors.length===0&&!hasOverrides&&!expanded;
 const showRules=expanded||selectedColors.length>0||hasOverrides;
 const availableColors=widgetTagColors.filter(color=>!selectedColors.includes(color));
 const summaries=(['automatic','manual'] as const).map(mode=>({mode,colors:widgetTagColors.filter(color=>context?.colors[color]===mode)})).filter(group=>group.colors.length>0);
 function changeGlobal(checked:boolean){
  if(!checked){setExpanded(true);return}
  update({pluginControls:(widget.pluginControls??[]).filter(id=>!id.startsWith(colorControlPrefix))});
  for(const color of widgetTagColors)context?.setColorMode(color,null);
  setExpanded(false);
 }
 function addColor(color:WidgetTagColor){
  const id=colorControlPrefix+color;
  if(!widget.pluginControls.includes(id))update({pluginControls:[...widget.pluginControls,id]});
  setExpanded(true);
 }
 function removeColor(color:WidgetTagColor){
  update({pluginControls:widget.pluginControls.filter(id=>id!==colorControlPrefix+color)});
  context?.setColorMode(color,null);
  const otherOverrides=widgetTagColors.some(item=>item!==color&&context?.colors[item]);
  if(selectedColors.length===1&&!otherOverrides)setExpanded(false);
 }
 return <section className="tag-status-color-settings" aria-label="Relaunch by tag color">
  <label className="tag-status-global-switch"><span>All colors follow global</span><input type="checkbox" role="switch" aria-label="All tag colors follow global mode" checked={useGlobal} onChange={event=>changeGlobal(event.target.checked)}/></label>
  {summaries.length>0&&<p className="tag-status-summary">{summaries.map(group=><span key={group.mode}>{group.mode[0].toUpperCase()+group.mode.slice(1)}: {group.colors.map(color=>color[0].toUpperCase()+color.slice(1)).join(', ')}</span>)}</p>}
  {showRules&&<>
   {selectedColors.map(color=><div className="tag-status-color-rule" key={color}><span className="tag-status-color"><i data-tag-color={color}/>{color[0].toUpperCase()+color.slice(1)} tag</span><select aria-label={'Status card '+color+' relaunch mode'} disabled={!context||context.relaunchPluginStatus!=='enabled'} value={context?.colors[color]??'follow'} onChange={event=>context?.setColorMode(color,event.target.value==='follow'?null:event.target.value as 'automatic'|'manual')}><option value="follow">Follow global</option><option value="automatic">Automatic</option><option value="manual">Manual</option></select><button type="button" aria-label={'Remove '+color+' relaunch rule'} onClick={()=>removeColor(color)}>×</button></div>)}
   {availableColors.length>0&&<label className="tag-status-add-color"><span>Add a color rule</span><select aria-label="Add tag color relaunch setting" value="" onChange={event=>{const color=event.target.value as WidgetTagColor;if(widgetTagColors.includes(color))addColor(color)}}><option value="" disabled>Add tag color…</option>{availableColors.map(color=><option key={color} value={color}>{color[0].toUpperCase()+color.slice(1)}</option>)}</select></label>}
  </>}
 </section>;
}

export function ScreenshotSettingsControl({context}:WidgetPluginControlProps){
 return <fieldset className="status-plugin-settings"><legend>Screenshot button</legend><label className="settings-row"><span>Show for</span><select aria-label="Status card screenshot scope" value={context?.screenshotMode??'global'} onChange={event=>context?.setScreenshotMode(event.target.value as 'global'|'tag-colors'|'off')}><option value="global">All widgets</option><option value="tag-colors">Selected tag colors</option><option value="off">Off</option></select></label>{context?.screenshotMode==='tag-colors'&&<div className="status-plugin-colors">{widgetTagColors.map(color=><label key={color}><input type="checkbox" aria-label={'Status card '+color+' screenshot color'} checked={context.screenshotColors.includes(color)} onChange={event=>context.setScreenshotColor(color,event.target.checked)}/>{color[0].toUpperCase()+color.slice(1)}</label>)}</div>}</fieldset>;
}
