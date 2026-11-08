import type {AppShutdownBehavior} from './domain/appSettings.ts';
import type {WidgetTagColor} from './domain/workspaces.ts';
import type {WidgetRelaunchMode} from './domain/widgetRelaunch.ts';
import type {WorkspaceShortcuts} from './domain/shortcuts.ts';
import {shortcutLabel} from './domain/shortcuts.ts';
import type {CanvasFrameRate} from './domain/performance.ts';
import type {StartupStatus} from './domain/startup.ts';
import {Icon} from './Icon.tsx';
import WidgetRelaunchScope from './WidgetRelaunchScope.tsx';
import {type Locale,useT} from './localization.tsx';

interface Props{
 locale:Locale;
 appShutdownBehavior:AppShutdownBehavior;
 closeAppOnWidgetClose:boolean;
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
 autoOpenCourseEnvironments:boolean;
 startup:StartupStatus;
 startupLoading:boolean;
 setStartupEnabled:(enabled:boolean)=>void;
 shortcuts:WorkspaceShortcuts;
 openShortcuts:()=>void;
 runTutorial:()=>void;
 update:(patch:{locale?:Locale;appShutdownBehavior?:AppShutdownBehavior;closeAppOnWidgetClose?:boolean;saveAppShortcutsOnAttach?:boolean;widgetRelaunchMode?:WidgetRelaunchMode;showAppAttachAction?:boolean;showAppDetachAction?:boolean;showWidgetRelaunchAction?:boolean;showWidgetExportPngAction?:boolean;passThroughTransparentBackground?:boolean;enableWholeWindowClickThrough?:boolean;canvasFrameRate?:CanvasFrameRate;followWidgetToWorkspace?:boolean;autoOpenCourseEnvironments?:boolean;shortcuts?:WorkspaceShortcuts})=>void;
 setRelaunchColor:(color:WidgetTagColor,mode:WidgetRelaunchMode|null)=>void;
 applyRelaunchModeToAll:()=>void;
 toggleClickThrough:()=>void;
}

export default function GeneralSettings({locale,appShutdownBehavior,closeAppOnWidgetClose,saveAppShortcutsOnAttach,showAppAttachAction,showAppDetachAction,showAppSaveAction,showWidgetRelaunchAction,showWidgetExportPngAction,widgetRelaunchMode,widgetRelaunchColors,shortcuts,openShortcuts,runTutorial,background,passThroughTransparentBackground,enableWholeWindowClickThrough,clickThroughActive,canvasFrameRate,followWidgetToWorkspace,autoOpenCourseEnvironments,startup,startupLoading,setStartupEnabled,update,setRelaunchColor,applyRelaunchModeToAll,toggleClickThrough}:Props){
 const t=useT();
 return <section className="settings-page general-settings" role="tabpanel" id="settings-general" aria-labelledby="settings-tab-general">
  <h3>{t('generalSettings')}</h3>
  <h4>{t('language')}</h4>
  <label className="settings-row"><span>{t('language')}</span><select aria-label={t('language')} value={locale} onChange={event=>update({locale:event.target.value as Locale})}><option value="en">{t('english')}</option><option value="zh-CN">{t('simplifiedChinese')}</option></select></label>
  <h4>{t('gettingStarted')}</h4>
  <div className="settings-row"><span>{t('stillTutorial')}<small>{t('tutorialDescription')}</small></span><button type="button" onClick={runTutorial}>{t('runTutorialAgain')}</button></div>
  <h4>{t('stillStartup')}</h4>
  <label className="settings-row general-settings-toggle"><span>{t('launchAtSignIn')}<small>{startup.supported?t('launchAtSignInDescription'):t('windowsAppOnly')}</small></span><input aria-label={t('launchAtSignIn')} type="checkbox" checked={startup.enabled} disabled={!startup.supported||startupLoading} onChange={event=>setStartupEnabled(event.target.checked)}/></label>
  <h4>{t('workspacePerformance')}</h4>
  <label className="settings-row"><span>{t('widgetMotionRate')}<small>{t('widgetMotionRateDescription')}</small></span><select aria-label={t('widgetMotionRate')} value={canvasFrameRate} onChange={event=>update({canvasFrameRate:event.target.value==='30'?30:event.target.value==='60'?60:'display'})}><option value="30">30 FPS · {t('reducedLoad')}</option><option value="60">60 FPS · {t('balanced')}</option><option value="display">{t('displayRefresh')} · {t('smoothest')}</option></select></label>
  <label className="settings-row general-settings-toggle"><span>{t('followWidget')}<small>{t('followWidgetDescription')}</small></span><input aria-label={t('followWidget')} type="checkbox" checked={followWidgetToWorkspace} onChange={event=>update({followWidgetToWorkspace:event.target.checked})}/></label>
  <label className="settings-row general-settings-toggle"><span>{t('autoOpenCourseEnvironments')}<small>{t('autoOpenCourseEnvironmentsDescription')}</small></span><input aria-label={t('autoOpenCourseEnvironments')} type="checkbox" checked={autoOpenCourseEnvironments} onChange={event=>update({autoOpenCourseEnvironments:event.target.checked})}/></label>
 <h4>{t('keyboardShortcuts')}</h4>
  <button className="shortcut-settings-link" onClick={openShortcuts}><span>{t('customizeShortcuts')}</span><kbd>{shortcutLabel(shortcuts.up)} / {shortcutLabel(shortcuts.down)}</kbd><span aria-hidden="true">→</span></button>
  <h4>{t('clickThrough')}</h4>
  <label className="settings-row general-settings-toggle"><span>{t('passTransparentClicks')}<small>{background==='transparent'?t('passTransparentClicksDescription'):t('chooseTransparentAppearance')}</small></span><input aria-label={t('passTransparentClicks')} type="checkbox" checked={passThroughTransparentBackground} disabled={background!=='transparent'} onChange={event=>update({passThroughTransparentBackground:event.target.checked})}/></label>
  <label className="settings-row general-settings-toggle"><span>{t('wholeWindowShortcut')}<small>{t('wholeWindowShortcutDescription').replace('{shortcut}',shortcutLabel(shortcuts.clickThrough))}</small></span><input aria-label={t('wholeWindowShortcut')} type="checkbox" checked={enableWholeWindowClickThrough} onChange={event=>update({enableWholeWindowClickThrough:event.target.checked})}/></label>
  {enableWholeWindowClickThrough&&<div className="settings-row"><span>{clickThroughActive?t('clickThroughOn'):t('clickThroughOff')}</span><button type="button" aria-label={clickThroughActive?t('turnOff'):t('turnOn')} onClick={toggleClickThrough}>{clickThroughActive?t('turnOff'):t('turnOn')}</button></div>}
  <label className="settings-row"><span>{t('whenStillCloses')}</span><select aria-label={t('whenStillCloses')} value={appShutdownBehavior} onChange={event=>update({appShutdownBehavior:event.target.value as AppShutdownBehavior})}>
   <option value="minimize">{t('minimizeAttachedApps')}</option>
   <option value="close">{t('closeAttachedApps')}</option>
   <option value="leaveOpen">{t('leaveAttachedAppsOpen')}</option>
  </select></label>
  <p className="notice">{t('normalCloseRequest')}</p>
  <label className="settings-row"><span>{t('whenAppsWidgetCloses')}<small>{t('whenAppsWidgetClosesDescription')}</small></span><select aria-label={t('whenAppsWidgetCloses')} value={closeAppOnWidgetClose?'close':'leaveOpen'} onChange={event=>update({closeAppOnWidgetClose:event.target.value==='close'})}><option value="close">{t('closeAppToo')}</option><option value="leaveOpen">{t('leaveAttachedAppsOpen')}</option></select></label>
  <p className="notice">{t('normalCloseRequest')}</p>
  <label className="settings-row general-settings-toggle"><span>{t('saveShortcutOnAttach')}</span><input aria-label={t('saveShortcutOnAttach')} type="checkbox" checked={saveAppShortcutsOnAttach} onChange={event=>update({saveAppShortcutsOnAttach:event.target.checked})}/></label>
  <p className="notice">{t('attachCheckboxNote')}</p>
  <h4>{t('appsWidgetButtons')}</h4>
  {([{key:'showAppAttachAction',label:t('showAttachButton'),icon:'attach',checked:showAppAttachAction},{key:'showAppDetachAction',label:t('showDetachButton'),icon:'eject',checked:showAppDetachAction},{key:'showAppSaveAction',label:t('showSaveToTrayButton'),icon:'tray',checked:showAppSaveAction}] as const).map(action=><label key={action.key} className="settings-row general-settings-toggle general-settings-action-toggle"><span>{action.label}<Icon name={action.icon}/></span><input type="checkbox" aria-label={action.label} checked={action.checked} onChange={event=>update({[action.key]:event.target.checked})}/></label>)}
  <label className="settings-row general-settings-toggle general-settings-action-toggle"><span>{t('showRelaunchButton')}<Icon name="refresh"/></span><input type="checkbox" aria-label={t('showRelaunchButton')} checked={showWidgetRelaunchAction} onChange={event=>update({showWidgetRelaunchAction:event.target.checked})}/></label>
  {([{key:'showWidgetExportPngAction',label:t('showExportPngButton'),icon:'download',checked:showWidgetExportPngAction}] as const).map(action=><label key={action.key} className="settings-row general-settings-toggle general-settings-action-toggle"><span>{action.label}<Icon name={action.icon}/></span><input type="checkbox" aria-label={action.label} checked={action.checked} onChange={event=>update({[action.key]:event.target.checked})}/></label>)}
  <h3>{t('widgetRelaunch')}</h3>
  <WidgetRelaunchScope mode={widgetRelaunchMode} colors={widgetRelaunchColors} setMode={mode=>update({widgetRelaunchMode:mode})} setColor={setRelaunchColor} applyModeToAll={applyRelaunchModeToAll}/>
  <p className="notice">{t('nextStartupSettings')}</p>
 </section>;
}
