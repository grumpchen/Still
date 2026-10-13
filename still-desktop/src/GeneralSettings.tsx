import type {AppShutdownBehavior} from './domain/appSettings.ts';
import type {WidgetTagColor} from './domain/workspaces.ts';
import type {WidgetRelaunchMode} from './domain/widgetRelaunch.ts';
import type {WorkspaceShortcuts} from './domain/shortcuts.ts';
import {shortcutLabel} from './domain/shortcuts.ts';
import type {CanvasFrameRate} from './domain/performance.ts';
import type {StartupStatus} from './domain/startup.ts';
import {Icon} from './Icon.tsx';
import WidgetRelaunchScope from './WidgetRelaunchScope.tsx';

interface Props{
 appShutdownBehavior:AppShutdownBehavior;
 saveAppShortcutsOnAttach:boolean;
 showAppAttachAction:boolean;
 showAppDetachAction:boolean;
 showAppSaveAction:boolean;
 showWidgetRelaunchAction:boolean;
 showWidgetExportPngAction:boolean;
 widgetRelaunchMode:WidgetRelaunchMode;
 widgetRelaunchColors:Partial<Record<WidgetTagColor,WidgetRelaunchMode>>;
 background:'solid'|'dots'|'transparent';
 passThroughTransparentBackground:boolean;
 enableWholeWindowClickThrough:boolean;
 clickThroughActive:boolean;
 canvasFrameRate:CanvasFrameRate;
 followWidgetToWorkspace:boolean;
 startup:StartupStatus;
 startupLoading:boolean;
 setStartupEnabled:(enabled:boolean)=>void;
 shortcuts:WorkspaceShortcuts;
 openShortcuts:()=>void;
 update:(patch:{appShutdownBehavior?:AppShutdownBehavior;saveAppShortcutsOnAttach?:boolean;widgetRelaunchMode?:WidgetRelaunchMode;showAppAttachAction?:boolean;showAppDetachAction?:boolean;showAppSaveAction?:boolean;showWidgetRelaunchAction?:boolean;showWidgetExportPngAction?:boolean;passThroughTransparentBackground?:boolean;enableWholeWindowClickThrough?:boolean;canvasFrameRate?:CanvasFrameRate;followWidgetToWorkspace?:boolean;shortcuts?:WorkspaceShortcuts})=>void;
 setRelaunchColor:(color:WidgetTagColor,mode:WidgetRelaunchMode|null)=>void;
 applyRelaunchModeToAll:()=>void;
 toggleClickThrough:()=>void;
}

export default function GeneralSettings({appShutdownBehavior,saveAppShortcutsOnAttach,showAppAttachAction,showAppDetachAction,showAppSaveAction,showWidgetRelaunchAction,showWidgetExportPngAction,widgetRelaunchMode,widgetRelaunchColors,shortcuts,openShortcuts,background,passThroughTransparentBackground,enableWholeWindowClickThrough,clickThroughActive,canvasFrameRate,followWidgetToWorkspace,startup,startupLoading,setStartupEnabled,update,setRelaunchColor,applyRelaunchModeToAll,toggleClickThrough}:Props){
 return <section className="settings-page general-settings" role="tabpanel" id="settings-general" aria-labelledby="settings-tab-general">
  <h3>General settings</h3>
  <h4>Still startup</h4>
  <label className="settings-row general-settings-toggle"><span>Launch Still when I sign in<small>{startup.supported?'Start Still automatically after you sign in to Windows.':'Available in the installed Windows app.'}</small></span><input aria-label="Launch Still when I sign in" type="checkbox" checked={startup.enabled} disabled={!startup.supported||startupLoading} onChange={event=>setStartupEnabled(event.target.checked)}/></label>
  <h4>Workspace performance</h4>
  <label className="settings-row"><span>Widget drag and resize rate<small>Lower rates reduce work while moving cards. Display refresh uses the fastest rate supported by your screen.</small></span><select aria-label="Widget drag and resize rate" value={canvasFrameRate} onChange={event=>update({canvasFrameRate:event.target.value==='30'?30:event.target.value==='60'?60:'display'})}><option value="30">30 FPS · Reduced load</option><option value="60">60 FPS · Balanced</option><option value="display">Display refresh · Smoothest</option></select></label>
  <label className="settings-row general-settings-toggle"><span>Follow a widget to its workspace<small>When you drop a widget on another workspace, Still switches there after moving it.</small></span><input aria-label="Follow a widget to its workspace" type="checkbox" checked={followWidgetToWorkspace} onChange={event=>update({followWidgetToWorkspace:event.target.checked})}/></label>
 <h4>Keyboard shortcuts</h4>
  <button className="shortcut-settings-link" onClick={openShortcuts}><span>Customize keyboard shortcuts</span><kbd>{shortcutLabel(shortcuts.up)} / {shortcutLabel(shortcuts.down)}</kbd><span aria-hidden="true">→</span></button>
  <h4>Click through Still</h4>
  <label className="settings-row general-settings-toggle"><span>Pass clicks through transparent background<small>{background==='transparent'?'Widgets remain interactive.':'Choose Transparent under Appearance → Workspace background to use this.'}</small></span><input aria-label="Pass clicks through transparent background" type="checkbox" checked={passThroughTransparentBackground} disabled={background!=='transparent'} onChange={event=>update({passThroughTransparentBackground:event.target.checked})}/></label>
  <label className="settings-row general-settings-toggle"><span>Enable whole-window click-through shortcut<small>{shortcutLabel(shortcuts.clickThrough)} passes clicks through Still, including its widgets. Press it again to restore input.</small></span><input aria-label="Enable whole-window click-through shortcut" type="checkbox" checked={enableWholeWindowClickThrough} onChange={event=>update({enableWholeWindowClickThrough:event.target.checked})}/></label>
  {enableWholeWindowClickThrough&&<div className="settings-row"><span>Whole-window click-through is {clickThroughActive?'on':'off'}</span><button type="button" aria-label={clickThroughActive?'Turn off whole-window click-through':'Turn on whole-window click-through'} onClick={toggleClickThrough}>{clickThroughActive?'Turn off':'Turn on'}</button></div>}
  <label className="settings-row"><span>When Still closes</span><select aria-label="When Still closes" value={appShutdownBehavior} onChange={event=>update({appShutdownBehavior:event.target.value as AppShutdownBehavior})}>
   <option value="minimize">Minimize attached apps</option>
   <option value="close">Close attached app windows</option>
   <option value="leaveOpen">Leave attached apps open</option>
  </select></label>
  <p className="notice">Closing sends each app a normal Windows close request, so its own save prompts can appear.</p>
  <label className="settings-row general-settings-toggle"><span>Save an Apps shortcut automatically when attaching</span><input aria-label="Save an Apps shortcut automatically when attaching" type="checkbox" checked={saveAppShortcutsOnAttach} onChange={event=>update({saveAppShortcutsOnAttach:event.target.checked})}/></label>
  <p className="notice">The Attach Open App checkbox can still change this choice for one app.</p>
  <h4>Apps widget buttons</h4>
  {([{key:'showAppAttachAction',label:'Show Attach button',icon:'attach',checked:showAppAttachAction},{key:'showAppDetachAction',label:'Show Detach button',icon:'eject',checked:showAppDetachAction},{key:'showAppSaveAction',label:'Show Save to tray button',icon:'tray',checked:showAppSaveAction}] as const).map(action=><label key={action.key} className="settings-row general-settings-toggle general-settings-action-toggle"><span>{action.label}<Icon name={action.icon}/></span><input type="checkbox" aria-label={action.label} checked={action.checked} onChange={event=>update({[action.key]:event.target.checked})}/></label>)}
  {([{key:'showWidgetRelaunchAction',label:'Show Relaunch button',icon:'restart',checked:showWidgetRelaunchAction},{key:'showWidgetExportPngAction',label:'Show Export PNG button',icon:'download',checked:showWidgetExportPngAction}] as const).map(action=><label key={action.key} className="settings-row general-settings-toggle general-settings-action-toggle"><span>{action.label}<Icon name={action.icon}/></span><input type="checkbox" aria-label={action.label} checked={action.checked} onChange={event=>update({[action.key]:event.target.checked})}/></label>)}
  <h3>Widget Relaunch</h3>
  <WidgetRelaunchScope mode={widgetRelaunchMode} colors={widgetRelaunchColors} setMode={mode=>update({widgetRelaunchMode:mode})} setColor={setRelaunchColor} applyModeToAll={applyRelaunchModeToAll}/>
  <p className="notice">These choices apply next time Still starts. Changing them does not close or restart open widgets.</p>
 </section>;
}
