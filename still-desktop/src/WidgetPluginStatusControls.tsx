import {useState} from 'react';
import {widgetTagColors,type WidgetTagColor} from './domain/widgetTags.ts';
import type {ClockPluginMode} from './domain/clockPlugin.ts';
import type {WidgetPluginColorSettingDefinition,WidgetPluginColorSettingProps,WidgetPluginControlProps} from './domain/widgetPlugins.ts';
import {Icon} from './Icon.tsx';
import {useT} from './localization.tsx';

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
 const t=useT();return <label className="settings-row"><span>{t('allWidgets')}</span><select aria-label={t('globalRelaunchMode')} disabled={!context||context.relaunchPluginStatus!=='enabled'} value={context?.globalMode??'manual'} onChange={event=>context?.setGlobalMode(event.target.value as 'automatic'|'manual')}><option value="automatic">{t('automatic')}</option><option value="manual">{t('manual')}</option></select></label>;
}

export function RelaunchTagColorsControl({context,widget,update}:WidgetPluginControlProps){
 const t=useT();
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
 return <section className="tag-status-color-settings" aria-label={t('pluginSettingsByTagColor')}>
  <label className="tag-status-global-switch"><span>{t('allColorsFollowGlobal')}</span><input type="checkbox" role="switch" aria-label={t('allTagColorsFollowGlobal')} checked={useGlobal} onChange={event=>changeGlobal(event.target.checked)}/></label>
  {summaries.length>0&&<p className="tag-status-summary">{summaries.map(group=><span key={group.mode}>{t(group.mode)}: {group.colors.map(color=>t('tag_'+color)).join(', ')}</span>)}</p>}
  {showRules&&<>
   {selectedColors.map(color=>{
    const selectedSettings=widgetColorSettingCatalog.filter(setting=>setting.available(context?.relaunchPluginStatus??'removed')&&(controls.includes(colorSettingId(color,setting.id))||(setting.id==='relaunch'&&controls.includes(colorControlPrefix+color))));
    const availableSettings=widgetColorSettingCatalog.filter(setting=>setting.available(context?.relaunchPluginStatus??'removed')&&!selectedSettings.some(item=>item.id===setting.id));
    return <div className="tag-status-color-rule" key={color}>
     <div className="tag-status-color-heading"><span className="tag-status-color"><i data-tag-color={color}/>{t('tag_'+color)} {t('tag')}</span><button type="button" aria-label={t('removeTagColorRule')+' '+t('tag_'+color)} onClick={()=>removeColor(color)}>×</button></div>
     {selectedSettings.map(({id,ColorSetting})=><div className="tag-status-plugin-setting" key={id}><span>{t('pluginSetting_'+id)}</span><ColorSetting context={context} color={color}/><button type="button" aria-label={t('removeTagSetting')+' '+t('tag_'+color)+' '+t('pluginSetting_'+id)} onClick={()=>removeSetting(color,id)}>×</button></div>)}
     {availableSettings.length>0&&<label className="tag-status-add-setting"><span>{t('selectPluginSetting')}</span><select aria-label={t('addPluginSettingFor')+' '+t('tag_'+color)} value="" onChange={event=>{if(event.target.value)addSetting(color,event.target.value)}}><option value="" disabled>{t('selectPluginSetting')}</option>{availableSettings.map(setting=><option key={setting.id} value={setting.id}>{t('pluginSetting_'+setting.id)}</option>)}</select></label>}
    </div>
   })}
   {availableColors.length>0&&<label className="tag-status-add-color"><span>{t('selectColorRule')}</span><select aria-label={t('addTagColorSetting')} value="" onChange={event=>{const color=event.target.value as WidgetTagColor;if(widgetTagColors.includes(color))addColor(color)}}><option value="" disabled>{t('selectColor')}</option>{availableColors.map(color=><option key={color} value={color}>{t('tag_'+color)}</option>)}</select></label>}
  </>}
 </section>;
}

export function RelaunchColorSettingControl({context,color}:WidgetPluginColorSettingProps){
 const t=useT();return <select aria-label={t('tagRelaunchMode')+' '+t('tag_'+color)} disabled={!context||context.relaunchPluginStatus!=='enabled'} value={context?.colors[color]??'follow'} onChange={event=>context?.setColorMode(color,event.target.value==='follow'?null:event.target.value as 'automatic'|'manual')}><option value="follow">{t('followGlobal')}</option><option value="automatic">{t('automatic')}</option><option value="manual">{t('manual')}</option></select>;
}

export function ScreenshotColorSettingControl({context,color}:WidgetPluginColorSettingProps){
 const t=useT();
 const override=context?.screenshotColorOverrides[color];
 const value=override===undefined?'follow':override?'enabled':'disabled';
 return <select aria-label={t('tagScreenshotSetting')+' '+t('tag_'+color)} value={value} onChange={event=>context?.setScreenshotColorOverride(color,event.target.value==='follow'?null:event.target.value==='enabled')}><option value="follow">{t('followGlobal')}</option><option value="enabled">{t('cameraEnabled')}</option><option value="disabled">{t('cameraDisabled')}</option></select>;
}

export function ScreenshotSettingsControl({context}:WidgetPluginControlProps){
 const t=useT();return <fieldset className="status-plugin-settings"><legend>{t('screenshotButton')}</legend><label className="settings-row"><span>{t('showFor')}</span><select aria-label={t('screenshotScope')} value={context?.screenshotMode??'global'} onChange={event=>context?.setScreenshotMode(event.target.value as 'global'|'tag-colors'|'off')}><option value="global">{t('allWidgets')}</option><option value="tag-colors">{t('selectedTagColors')}</option><option value="off">{t('off')}</option></select></label>{context?.screenshotMode==='tag-colors'&&<div className="status-plugin-colors">{widgetTagColors.map(color=><label key={color}><input type="checkbox" aria-label={t('screenshotColorFor')+' '+t('tag_'+color)} checked={context.screenshotColors.includes(color)} onChange={event=>context.setScreenshotColor(color,event.target.checked)}/>{t('tag_'+color)}</label>)}</div>}</fieldset>;
}

export function ClockTimerColorSettingControl({context,color}:WidgetPluginColorSettingProps){
 const t=useT();
 const override=context?.clockColorOverrides[color],value=override===undefined?'follow':override?'enabled':'disabled';
 return <select aria-label={t('tagClockSetting')+' '+t('tag_'+color)} value={value} onChange={event=>context?.setClockColorOverride(color,event.target.value==='follow'?null:event.target.value==='enabled')}><option value="follow">{t('followGlobal')}</option><option value="enabled">{t('clockEnabled')}</option><option value="disabled">{t('clockDisabled')}</option></select>;
}

export function ClockTimerSettingsControl({context}:WidgetPluginControlProps){
 const t=useT();return <fieldset className="status-plugin-settings"><legend>{t('clockTimerAddon')}</legend><label className="settings-row"><span>{t('showFor')}</span><select aria-label={t('clockTimerScope')} value={context?.clockMode??'global'} onChange={event=>context?.setClockMode(event.target.value as ClockPluginMode)}><option value="global">{t('allTaggedWidgets')}</option><option value="tag-colors">{t('selectedTagColors')}</option><option value="off">{t('off')}</option></select></label>{context?.clockMode==='tag-colors'&&<div className="status-plugin-colors">{widgetTagColors.map(color=><label key={color}><input type="checkbox" aria-label={t('clockTimerColorFor')+' '+t('tag_'+color)} checked={context.clockColors.includes(color)} onChange={event=>context.setClockColor(color,event.target.checked)}/>{t('tag_'+color)}</label>)}</div>}<p className="notice">{t('clockAddIndividual')}</p></fieldset>;
}

export function LockWidgetControl({widget,update}:WidgetPluginControlProps){
 const t=useT();if(!widget.lockPluginEnabled)return <div className="settings-row"><span>{t('widgetLock')}<small>{t('addLockPluginHint')}</small></span></div>;
 return <div className="settings-row"><span>{t('widgetLock')}<small>{widget.locked?t('widgetLockedDescription'):t('widgetUnlockedDescription')}</small></span><button type="button" aria-label={widget.locked?t('unlockWidget'):t('lockWidget')} aria-pressed={widget.locked} onClick={()=>update({locked:!widget.locked})}><Icon name="lock"/>{widget.locked?t('unlock'):t('lock')}</button></div>;
}
