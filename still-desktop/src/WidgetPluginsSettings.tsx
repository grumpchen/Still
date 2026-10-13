import type {WorkspaceState} from './domain/workspaces.ts';
import {widgetTagColors,type WidgetTagColor} from './domain/workspaces.ts';
import type {WidgetRelaunchMode,WidgetRelaunchPluginStatus} from './domain/widgetRelaunch.ts';
import {widgetPluginCatalog} from './domain/widgetPlugins.ts';
import WidgetRelaunchScope from './WidgetRelaunchScope.tsx';

interface Props{
 state:WorkspaceState;
 update:(patch:Partial<WorkspaceState>)=>void;
 setRelaunchStatus:(status:WidgetRelaunchPluginStatus)=>void;
 setRelaunchColor:(color:WidgetTagColor,mode:WidgetRelaunchMode|null)=>void;
 setScreenshotColor:(color:WidgetTagColor,enabled:boolean)=>void;
 setClockColor:(color:WidgetTagColor,enabled:boolean)=>void;
}

export default function WidgetPluginsSettings({state,update,setRelaunchStatus,setRelaunchColor,setScreenshotColor,setClockColor}:Props){
 return <><h3>Widget plugins</h3>{widgetPluginCatalog.map(plugin=><section key={plugin.id} className="widget-plugin-settings" data-plugin-id={plugin.id} aria-label={plugin.name+' settings'}>
  <div className="widget-plugin-settings-heading"><h4>{plugin.name}</h4><p>{plugin.description}</p></div>
  {plugin.id==='color-tag'&&<p className="notice">Add a color tag with a widget’s + button, then click its tag dot to choose or remove a color.</p>}
  {plugin.id==='lock'&&<p className="notice">Add Lock from a widget’s + menu. A locked widget cannot move or close until you unlock it; its content can still be edited and it can still be resized.</p>}
  {plugin.id==='screenshot'&&<>
   <label className="settings-row"><span>Camera button</span><select aria-label="Screenshot plugin scope" value={state.screenshotPluginMode} onChange={event=>update({screenshotPluginMode:event.target.value as typeof state.screenshotPluginMode})}><option value="global">Apply globally</option><option value="tag-colors">Apply by tag color</option><option value="off">Closed</option></select></label>
   {state.screenshotPluginMode==='tag-colors'&&<fieldset className="screenshot-plugin-colors" aria-label="Screenshot plugin tag colors"><legend>Show screenshot button for</legend>{widgetTagColors.map(color=><label key={color}><input type="checkbox" aria-label={color+' screenshot plugin'} checked={state.screenshotPluginColors.includes(color)} onChange={event=>setScreenshotColor(color,event.target.checked)}/>{color[0].toUpperCase()+color.slice(1)}</label>)}</fieldset>}
  </>}
  {plugin.id==='clock-timer'&&<>
   <label className="settings-row"><span>Clock add-on</span><select aria-label="Clock plugin scope" value={state.clockPluginMode} onChange={event=>update({clockPluginMode:event.target.value as typeof state.clockPluginMode})}><option value="global">Apply globally</option><option value="tag-colors">Apply by tag color</option><option value="off">Closed</option></select></label>
   {state.clockPluginMode==='tag-colors'&&<fieldset className="screenshot-plugin-colors" aria-label="Clock plugin tag colors"><legend>Show Clock timer for</legend>{widgetTagColors.map(color=><label key={color}><input type="checkbox" aria-label={color+' clock plugin'} checked={state.clockPluginColors.includes(color)} onChange={event=>setClockColor(color,event.target.checked)}/>{color[0].toUpperCase()+color.slice(1)}</label>)}</fieldset>}
   <p className="notice">Add Clock to an individual widget from its + button.</p>
  </>}
  {plugin.id==='widget-relaunch'&&<>
   <div className="settings-row"><span>Widget Relaunch<small>Choose which workspace widgets start automatically.</small></span>{state.widgetRelaunchPluginStatus==='enabled'?<><button type="button" aria-label="Disable Widget Relaunch plugin" onClick={()=>setRelaunchStatus('disabled')}>Disable</button><button type="button" aria-label="Remove Widget Relaunch plugin" onClick={()=>setRelaunchStatus('removed')}>Remove</button></>:<><button type="button" aria-label="Enable Widget Relaunch plugin" onClick={()=>setRelaunchStatus('enabled')}>Enable</button>{state.widgetRelaunchPluginStatus==='disabled'&&<button type="button" aria-label="Remove Widget Relaunch plugin" onClick={()=>setRelaunchStatus('removed')}>Remove</button>}</>}</div>
   {state.widgetRelaunchPluginStatus!=='enabled'&&<p className="notice">Widget Relaunch is unavailable; widgets will wait for manual relaunch. Its saved settings are retained.</p>}
   <WidgetRelaunchScope mode={state.widgetRelaunchMode} colors={state.widgetRelaunchColors} setMode={mode=>update({widgetRelaunchMode:mode})} setColor={setRelaunchColor} disabled={state.widgetRelaunchPluginStatus!=='enabled'}/>
  </>}
 </section>)}</>;
}
