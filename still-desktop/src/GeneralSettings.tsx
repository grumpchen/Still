import type {AppShutdownBehavior} from './domain/appSettings.ts';
import {widgetTagColors,type WidgetTagColor} from './domain/workspaces.ts';
import type {WidgetRelaunchMode} from './domain/widgetRelaunch.ts';

interface Props{
 appShutdownBehavior:AppShutdownBehavior;
 saveAppShortcutsOnAttach:boolean;
 widgetRelaunchMode:WidgetRelaunchMode;
 widgetRelaunchColors:Partial<Record<WidgetTagColor,WidgetRelaunchMode>>;
 update:(patch:{appShutdownBehavior?:AppShutdownBehavior;saveAppShortcutsOnAttach?:boolean;widgetRelaunchMode?:WidgetRelaunchMode})=>void;
 setRelaunchColor:(color:WidgetTagColor,mode:WidgetRelaunchMode|null)=>void;
 applyRelaunchModeToAll:()=>void;
}

export default function GeneralSettings({appShutdownBehavior,saveAppShortcutsOnAttach,widgetRelaunchMode,widgetRelaunchColors,update,setRelaunchColor,applyRelaunchModeToAll}:Props){
 return <section className="settings-page general-settings" role="tabpanel" id="settings-general" aria-labelledby="settings-tab-general">
  <h3>General settings</h3>
  <label className="settings-row"><span>When Still closes</span><select aria-label="When Still closes" value={appShutdownBehavior} onChange={event=>update({appShutdownBehavior:event.target.value as AppShutdownBehavior})}>
   <option value="minimize">Minimize attached apps</option>
   <option value="close">Close attached app windows</option>
   <option value="leaveOpen">Leave attached apps open</option>
  </select></label>
  <p className="notice">Closing sends each app a normal Windows close request, so its own save prompts can appear.</p>
  <label className="settings-row general-settings-toggle"><span>Save an Apps shortcut automatically when attaching</span><input aria-label="Save an Apps shortcut automatically when attaching" type="checkbox" checked={saveAppShortcutsOnAttach} onChange={event=>update({saveAppShortcutsOnAttach:event.target.checked})}/></label>
  <p className="notice">The Attach Open App checkbox can still change this choice for one app.</p>
  <h3>Widget Relaunch</h3>
  <label className="settings-row"><span>When Still starts</span><select aria-label="Widget relaunch mode" value={widgetRelaunchMode} onChange={event=>update({widgetRelaunchMode:event.target.value as WidgetRelaunchMode})}><option value="automatic">Automatically relaunch widgets</option><option value="manual">Wait for manual relaunch</option></select></label>
  <button type="button" aria-label="Apply widget relaunch mode to all" onClick={applyRelaunchModeToAll}>Apply to All</button>
  <p className="notice">These choices apply next time Still starts. Changing them does not close or restart open widgets.</p>
  <h4>Automatic relaunch by tag color</h4>
  {widgetTagColors.map(color=><label key={color} className="settings-row"><span>{color[0].toUpperCase()+color.slice(1)} tag</span><select aria-label={color+' tag relaunch mode'} value={widgetRelaunchColors[color]??'follow'} onChange={event=>setRelaunchColor(color,event.target.value==='follow'?null:event.target.value as WidgetRelaunchMode)}><option value="follow">Follow global</option><option value="automatic">Automatic</option><option value="manual">Manual</option></select></label>)}
  <p className="notice">An individual widget choice takes priority over its tag color. The Widget Relaunch plugin must be enabled for automatic relaunch.</p>
 </section>;
}
