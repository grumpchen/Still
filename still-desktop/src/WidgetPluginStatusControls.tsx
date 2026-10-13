import {useState} from 'react';
import {widgetTagColors,type WidgetTagColor} from './domain/widgetTags.ts';
import type {ClockPluginMode} from './domain/clockPlugin.ts';
import type {WidgetPluginColorSettingDefinition,WidgetPluginColorSettingProps,WidgetPluginControlProps} from './domain/widgetPlugins.ts';
import {Icon} from './Icon.tsx';

const colorControlPrefix='widget-relaunch.color.';
const colorRulePrefix='widget-color-rule.';
const colorSettingPrefix='widget-color-setting.';
const colorSettingId=(color:WidgetTagColor,id:string)=>`${colorSettingPrefix}${color}.${id}`;
const hasColorRule=(controls:string[],color:WidgetTagColor)=>controls.includes(colorRulePrefix+color)||controls.some(id=>id.startsWith(colorSettingPrefix+color+'.'))||controls.includes(colorControlPrefix+color);
function selectedColorControls(pluginControls:string[],overrides:WidgetTagColor[]=[]):WidgetTagColor[]{return widgetTagColors.filter(color=>hasColorRule(pluginControls,color)||overrides.includes(color))}
const relaunchAvailable=(status:string)=>status==='enabled';
const screenshotAvailable=()=>true;
export const widgetColorSettingCatalog:WidgetPluginColorSettingDefinition[]=[
 {id:'relaunch',pluginId:'widget-relaunch',label:'Auto relaunch',ColorSetting:RelaunchColorSettingControl,available:relaunchAvailable},
 {id:'screenshot',pluginId:'screenshot',label:'Screenshot',ColorSetting:ScreenshotColorSettingControl,available:screenshotAvailable},
 {id:'clock-timer',pluginId:'clock-timer',label:'Clock timer',ColorSetting:ClockTimerColorSettingControl,available:screenshotAvailable},
];

export function RelaunchGlobalModeControl({context}:WidgetPluginControlProps){
 return <label className="settings-row"><span>All widgets</span><select aria-label="Status card global relaunch mode" disabled={!context||context.relaunchPluginStatus!=='enabled'} value={context?.globalMode??'manual'} onChange={event=>context?.setGlobalMode(event.target.value as 'automatic'|'manual')}><option value="automatic">Automatic</option><option value="manual">Manual</option></select></label>;
}

export function RelaunchTagColorsControl({context,widget,update}:WidgetPluginControlProps){
 const controls=widget.pluginControls??[];
 const selectedColors=selectedColorControls(controls,[...Object.keys(context?.colors??{}),...Object.keys(context?.screenshotColorOverrides??{}),...Object.keys(context?.clockColorOverrides??{})] as WidgetTagColor[]);
 const hasOverrides=widgetTagColors.some(color=>context?.colors[color]||context?.screenshotColorOverrides[color]!==undefined||context?.clockColorOverrides[color]!==undefined);
 const [expanded,setExpanded]=useState(selectedColors.length>0||hasOverrides);
 const useGlobal=selectedColors.length===0&&!hasOverrides&&!expanded;
 const showRules=expanded||selectedColors.length>0||hasOverrides;
 const availableColors=widgetTagColors.filter(color=>!selectedColors.includes(color));
 const summaries=(['automatic','manual'] as const).map(mode=>({mode,colors:widgetTagColors.filter(color=>context?.colors[color]===mode)})).filter(group=>group.colors.length>0);
 function changeGlobal(checked:boolean){
  if(!checked){setExpanded(true);return}
  update({pluginControls:controls.filter(id=>!id.startsWith(colorControlPrefix)&&!id.startsWith(colorRulePrefix)&&!id.startsWith(colorSettingPrefix))});
  for(const color of widgetTagColors)context?.setColorMode(color,null);
  for(const color of widgetTagColors)context?.setScreenshotColorOverride(color,null);
  for(const color of widgetTagColors)context?.setClockColorOverride(color,null);
  setExpanded(false);
 }
 function addColor(color:WidgetTagColor){
  const id=colorRulePrefix+color;
  if(!controls.includes(id))update({pluginControls:[...controls,id]});
  setExpanded(true);
 }
 function addSetting(color:WidgetTagColor,id:string){const token=colorSettingId(color,id);if(!controls.includes(token))update({pluginControls:[...controls,token]});setExpanded(true)}
 function removeSetting(color:WidgetTagColor,id:string){
  update({pluginControls:controls.filter(item=>item!==colorSettingId(color,id)&&!(id==='relaunch'&&item===colorControlPrefix+color))});
  if(id==='relaunch')context?.setColorMode(color,null);if(id==='screenshot')context?.setScreenshotColorOverride(color,null);if(id==='clock-timer')context?.setClockColorOverride(color,null);
 }
 function removeColor(color:WidgetTagColor){
  update({pluginControls:controls.filter(id=>id!==colorRulePrefix+color&&id!==colorControlPrefix+color&&!id.startsWith(colorSettingPrefix+color+'.'))});
  context?.setColorMode(color,null);
  context?.setScreenshotColorOverride(color,null);
  context?.setClockColorOverride(color,null);
  if(selectedColors.length===1)setExpanded(false);
 }
 return <section className="tag-status-color-settings" aria-label="Plugin settings by tag color">
  <label className="tag-status-global-switch"><span>All colors follow global</span><input type="checkbox" role="switch" aria-label="All tag colors follow global mode" checked={useGlobal} onChange={event=>changeGlobal(event.target.checked)}/></label>
  {summaries.length>0&&<p className="tag-status-summary">{summaries.map(group=><span key={group.mode}>{group.mode[0].toUpperCase()+group.mode.slice(1)}: {group.colors.map(color=>color[0].toUpperCase()+color.slice(1)).join(', ')}</span>)}</p>}
  {showRules&&<>
   {selectedColors.map(color=>{
    const selectedSettings=widgetColorSettingCatalog.filter(setting=>setting.available(context?.relaunchPluginStatus??'removed')&&(controls.includes(colorSettingId(color,setting.id))||(setting.id==='relaunch'&&controls.includes(colorControlPrefix+color))));
    const availableSettings=widgetColorSettingCatalog.filter(setting=>setting.available(context?.relaunchPluginStatus??'removed')&&!selectedSettings.some(item=>item.id===setting.id));
    return <div className="tag-status-color-rule" key={color}>
     <div className="tag-status-color-heading"><span className="tag-status-color"><i data-tag-color={color}/>{color[0].toUpperCase()+color.slice(1)} tag</span><button type="button" aria-label={'Remove '+color+' color rule'} onClick={()=>removeColor(color)}>×</button></div>
     {selectedSettings.map(({id,label,ColorSetting})=><div className="tag-status-plugin-setting" key={id}><span>{label}</span><ColorSetting context={context} color={color}/><button type="button" aria-label={'Remove '+color+' '+label+' setting'} onClick={()=>removeSetting(color,id)}>×</button></div>)}
     {availableSettings.length>0&&<label className="tag-status-add-setting"><span>Select plugin/setting</span><select aria-label={'Add '+color+' plugin setting'} value="" onChange={event=>{if(event.target.value)addSetting(color,event.target.value)}}><option value="" disabled>Select plugin/setting…</option>{availableSettings.map(setting=><option key={setting.id} value={setting.id}>{setting.label}</option>)}</select></label>}
    </div>
   })}
   {availableColors.length>0&&<label className="tag-status-add-color"><span>Select color rule</span><select aria-label="Add tag color relaunch setting" value="" onChange={event=>{const color=event.target.value as WidgetTagColor;if(widgetTagColors.includes(color))addColor(color)}}><option value="" disabled>Select color…</option>{availableColors.map(color=><option key={color} value={color}>{color[0].toUpperCase()+color.slice(1)}</option>)}</select></label>}
  </>}
 </section>;
}

export function RelaunchColorSettingControl({context,color}:WidgetPluginColorSettingProps){
 return <select aria-label={'Status card '+color+' relaunch mode'} disabled={!context||context.relaunchPluginStatus!=='enabled'} value={context?.colors[color]??'follow'} onChange={event=>context?.setColorMode(color,event.target.value==='follow'?null:event.target.value as 'automatic'|'manual')}><option value="follow">Follow global</option><option value="automatic">Automatic</option><option value="manual">Manual</option></select>;
}

export function ScreenshotColorSettingControl({context,color}:WidgetPluginColorSettingProps){
 const override=context?.screenshotColorOverrides[color];
 const value=override===undefined?'follow':override?'enabled':'disabled';
 return <select aria-label={'Status card '+color+' screenshot setting'} value={value} onChange={event=>context?.setScreenshotColorOverride(color,event.target.value==='follow'?null:event.target.value==='enabled')}><option value="follow">Follow global</option><option value="enabled">Camera enabled</option><option value="disabled">Camera disabled</option></select>;
}

export function ScreenshotSettingsControl({context}:WidgetPluginControlProps){
 return <fieldset className="status-plugin-settings"><legend>Screenshot button</legend><label className="settings-row"><span>Show for</span><select aria-label="Status card screenshot scope" value={context?.screenshotMode??'global'} onChange={event=>context?.setScreenshotMode(event.target.value as 'global'|'tag-colors'|'off')}><option value="global">All widgets</option><option value="tag-colors">Selected tag colors</option><option value="off">Off</option></select></label>{context?.screenshotMode==='tag-colors'&&<div className="status-plugin-colors">{widgetTagColors.map(color=><label key={color}><input type="checkbox" aria-label={'Status card '+color+' screenshot color'} checked={context.screenshotColors.includes(color)} onChange={event=>context.setScreenshotColor(color,event.target.checked)}/>{color[0].toUpperCase()+color.slice(1)}</label>)}</div>}</fieldset>;
}

export function ClockTimerColorSettingControl({context,color}:WidgetPluginColorSettingProps){
 const override=context?.clockColorOverrides[color],value=override===undefined?'follow':override?'enabled':'disabled';
 return <select aria-label={'Status card '+color+' clock timer setting'} value={value} onChange={event=>context?.setClockColorOverride(color,event.target.value==='follow'?null:event.target.value==='enabled')}><option value="follow">Follow global</option><option value="enabled">Clock enabled</option><option value="disabled">Clock disabled</option></select>;
}

export function ClockTimerSettingsControl({context}:WidgetPluginControlProps){
 return <fieldset className="status-plugin-settings"><legend>Clock timer add-on</legend><label className="settings-row"><span>Show for</span><select aria-label="Status card clock timer scope" value={context?.clockMode??'global'} onChange={event=>context?.setClockMode(event.target.value as ClockPluginMode)}><option value="global">All tagged and untagged widgets</option><option value="tag-colors">Selected tag colors</option><option value="off">Off</option></select></label>{context?.clockMode==='tag-colors'&&<div className="status-plugin-colors">{widgetTagColors.map(color=><label key={color}><input type="checkbox" aria-label={'Status card '+color+' clock timer color'} checked={context.clockColors.includes(color)} onChange={event=>context.setClockColor(color,event.target.checked)}/>{color[0].toUpperCase()+color.slice(1)}</label>)}</div>}<p className="notice">Add Clock timer to an individual card with its + button. Color rules can override this setting.</p></fieldset>;
}

export function LockWidgetControl({widget,update}:WidgetPluginControlProps){
 if(!widget.lockPluginEnabled)return <div className="settings-row"><span>Widget Lock<small>Add the Lock plugin from a widget’s + menu.</small></span></div>;
 return <div className="settings-row"><span>Widget Lock<small>{widget.locked?'Movement and close are disabled.':'Widget can be moved and closed.'}</small></span><button type="button" aria-label={widget.locked?'Unlock widget':'Lock widget'} aria-pressed={widget.locked} onClick={()=>update({locked:!widget.locked})}><Icon name="lock"/>{widget.locked?'Unlock':'Lock'}</button></div>;
}
