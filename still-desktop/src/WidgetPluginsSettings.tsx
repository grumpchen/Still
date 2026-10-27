import type {WorkspaceState} from './domain/workspaces.ts';
import {widgetTagColors,type WidgetTagColor} from './domain/workspaces.ts';
import type {WidgetRelaunchMode,WidgetRelaunchPluginStatus} from './domain/widgetRelaunch.ts';
import {widgetPluginCatalog} from './domain/widgetPlugins.ts';
import WidgetRelaunchScope from './WidgetRelaunchScope.tsx';
import {useT} from './localization.tsx';

interface Props{
 state:WorkspaceState;
 update:(patch:Partial<WorkspaceState>)=>void;
 setRelaunchStatus:(status:WidgetRelaunchPluginStatus)=>void;
 setRelaunchColor:(color:WidgetTagColor,mode:WidgetRelaunchMode|null)=>void;
 setScreenshotColor:(color:WidgetTagColor,enabled:boolean)=>void;
 setClockColor:(color:WidgetTagColor,enabled:boolean)=>void;
}

export default function WidgetPluginsSettings({state,update,setRelaunchStatus,setRelaunchColor,setScreenshotColor,setClockColor}:Props){
 const t=useT();
 return <><h3>{t('widgetPluginsTitle')}</h3>{widgetPluginCatalog.map(plugin=>{const key=plugin.id.replace('-','_');const name=t('plugin_'+key+'_name');return <section key={plugin.id} className="widget-plugin-settings" data-plugin-id={plugin.id} aria-label={name+' settings'}>
  <div className="widget-plugin-settings-heading"><h4>{name}</h4><p>{t('plugin_'+key+'_desc')}</p></div>
  {plugin.id==='color-tag'&&<p className="notice">{t('tagHelp')}</p>}
  {plugin.id==='lock'&&<p className="notice">{t('lockHelp')}</p>}
  {plugin.id==='screenshot'&&<>
   <label className="settings-row"><span>{t('cameraButton')}</span><select aria-label={t('plugin_screenshot_name')} value={state.screenshotPluginMode} onChange={event=>update({screenshotPluginMode:event.target.value as typeof state.screenshotPluginMode})}><option value="global">{t('applyGlobally')}</option><option value="tag-colors">{t('applyByTag')}</option><option value="off">{t('closed')}</option></select></label>
   {state.screenshotPluginMode==='tag-colors'&&<fieldset className="screenshot-plugin-colors" aria-label={t('plugin_screenshot_name')+' · '+t('tagColor')}><legend>{t('showScreenshotFor')}</legend>{widgetTagColors.map(color=><label key={color}><input type="checkbox" aria-label={color+' '+t('plugin_screenshot_name')} checked={state.screenshotPluginColors.includes(color)} onChange={event=>setScreenshotColor(color,event.target.checked)}/>{color[0].toUpperCase()+color.slice(1)}</label>)}</fieldset>}
  </>}
  {plugin.id==='clock-timer'&&<>
   <label className="settings-row"><span>{t('clockAddon')}</span><select aria-label={t('plugin_clock_timer_name')} value={state.clockPluginMode} onChange={event=>update({clockPluginMode:event.target.value as typeof state.clockPluginMode})}><option value="global">{t('applyGlobally')}</option><option value="tag-colors">{t('applyByTag')}</option><option value="off">{t('closed')}</option></select></label>
   {state.clockPluginMode==='tag-colors'&&<fieldset className="screenshot-plugin-colors" aria-label={t('plugin_clock_timer_name')+' · '+t('tagColor')}><legend>{t('showClockFor')}</legend>{widgetTagColors.map(color=><label key={color}><input type="checkbox" aria-label={color+' '+t('plugin_clock_timer_name')} checked={state.clockPluginColors.includes(color)} onChange={event=>setClockColor(color,event.target.checked)}/>{color[0].toUpperCase()+color.slice(1)}</label>)}</fieldset>}
   <p className="notice">{t('addClockIndividual')}</p>
  </>}
  {plugin.id==='widget-relaunch'&&<>
   <div className="settings-row"><span>{name}<small>{t('relaunchDesc')}</small></span>{state.widgetRelaunchPluginStatus==='enabled'?<><button type="button" aria-label={t('disable')+' '+name} onClick={()=>setRelaunchStatus('disabled')}>{t('disable')}</button><button type="button" aria-label={t('remove')+' '+name} onClick={()=>setRelaunchStatus('removed')}>{t('remove')}</button></>:<><button type="button" aria-label={t('enable')+' '+name} onClick={()=>setRelaunchStatus('enabled')}>{t('enable')}</button>{state.widgetRelaunchPluginStatus==='disabled'&&<button type="button" aria-label={t('remove')+' '+name} onClick={()=>setRelaunchStatus('removed')}>{t('remove')}</button>}</>}</div>
   {state.widgetRelaunchPluginStatus!=='enabled'&&<p className="notice">{t('relaunchUnavailable')}</p>}
   <WidgetRelaunchScope mode={state.widgetRelaunchMode} colors={state.widgetRelaunchColors} setMode={mode=>update({widgetRelaunchMode:mode})} setColor={setRelaunchColor} disabled={state.widgetRelaunchPluginStatus!=='enabled'}/>
  </>}
 </section>})}</>;
}
