import type {AppShutdownBehavior} from './domain/appSettings.ts';

interface Props{
 appShutdownBehavior:AppShutdownBehavior;
 saveAppShortcutsOnAttach:boolean;
 update:(patch:{appShutdownBehavior?:AppShutdownBehavior;saveAppShortcutsOnAttach?:boolean})=>void;
}

export default function GeneralSettings({appShutdownBehavior,saveAppShortcutsOnAttach,update}:Props){
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
 </section>;
}
