import {widgetTagColors,type WidgetTagColor} from './domain/workspaces.ts';
import type {WidgetPluginControlProps} from './domain/widgetPlugins.ts';

export function RelaunchGlobalModeControl({context}:WidgetPluginControlProps){
 return <label className="settings-row"><span>All widgets</span><select aria-label="Status card global relaunch mode" disabled={!context||context.relaunchPluginStatus!=='enabled'} value={context?.globalMode??'manual'} onChange={event=>context?.setGlobalMode(event.target.value as 'automatic'|'manual')}><option value="automatic">Automatic</option><option value="manual">Manual</option></select></label>;
}

export function RelaunchTagColorsControl({context}:WidgetPluginControlProps){
 return <>{widgetTagColors.map((color:WidgetTagColor)=><label key={color} className="settings-row"><span className="tag-status-color"><i data-tag-color={color}/>{color[0].toUpperCase()+color.slice(1)}</span><select aria-label={'Status card '+color+' relaunch mode'} disabled={!context||context.relaunchPluginStatus!=='enabled'} value={context?.colors[color]??'follow'} onChange={event=>context?.setColorMode(color,event.target.value==='follow'?null:event.target.value as 'automatic'|'manual')}><option value="follow">Follow global</option><option value="automatic">Automatic</option><option value="manual">Manual</option></select></label>)}</>;
}

export function ScreenshotSettingsControl({context}:WidgetPluginControlProps){
 return <fieldset className="status-plugin-settings"><legend>Screenshot button</legend><label className="settings-row"><span>Show for</span><select aria-label="Status card screenshot scope" value={context?.screenshotMode??'global'} onChange={event=>context?.setScreenshotMode(event.target.value as 'global'|'tag-colors'|'off')}><option value="global">All widgets</option><option value="tag-colors">Selected tag colors</option><option value="off">Off</option></select></label>{context?.screenshotMode==='tag-colors'&&<div className="status-plugin-colors">{widgetTagColors.map(color=><label key={color}><input type="checkbox" aria-label={'Status card '+color+' screenshot color'} checked={context.screenshotColors.includes(color)} onChange={event=>context.setScreenshotColor(color,event.target.checked)}/>{color[0].toUpperCase()+color.slice(1)}</label>)}</div>}</fieldset>;
}
