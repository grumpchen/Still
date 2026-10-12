import {useState} from 'react';
import {defaultShortcuts,shortcutFromEvent,shortcutLabel,shortcutsError,type AppShortcutAction,type Shortcut,type WorkspaceShortcuts} from './domain/shortcuts.ts';
const fixedActions:[AppShortcutAction,string,string][]=[
 ['up','Workspace above','Previous in the sidebar'],['down','Workspace below','Next in the sidebar'],
 ['overview','Toggle workspace map','Show or hide the map'],['clickThrough','Toggle click-through','Turn whole-window click-through on or off'],
 ['commandPalette','Find an action','Open the command search'],['undo','Undo workspace change','Restore the previous layout'],
];
export default function ShortcutSettings({shortcuts,save,close}:{shortcuts:WorkspaceShortcuts;save:(value:WorkspaceShortcuts)=>Promise<void>;close:()=>void}){
  const [draft,setDraft]=useState(()=>structuredClone(shortcuts));
  const [recording,setRecording]=useState<AppShortcutAction|null>(null);
  const [captureError,setCaptureError]=useState('');const [saving,setSaving]=useState(false);
  const error=shortcutsError(draft);
  function binding(action:AppShortcutAction):Shortcut|undefined{return action.startsWith('workspace:')?draft.numbered[Number(action.slice(10))-1]:draft[action as keyof Pick<WorkspaceShortcuts,'up'|'down'|'overview'|'clickThrough'|'commandPalette'|'undo'>]}
  function row(action:AppShortcutAction,label:string,detail:string){const current=binding(action);if(!current)return null;return <div className="shortcut-row" key={action}>
    <span><strong>{label}</strong><small>{detail}</small></span>
    <button type="button" className={'shortcut-key '+(recording===action?'recording':'')} aria-label={'Change '+label+' shortcut'} aria-pressed={recording===action} disabled={saving}
      onClick={()=>{setCaptureError('');setRecording(recording===action?null:action)}}
      onBlur={()=>{if(recording===action)setRecording(null)}}
      onKeyDown={event=>{if(recording!==action)return;if(event.key==='Tab'){setRecording(null);return}event.preventDefault();event.stopPropagation();if(event.key==='Escape'){setRecording(null);setCaptureError('');return}if(event.repeat)return;const next=shortcutFromEvent(event.nativeEvent);if(!next)return;
        setDraft(value=>action.startsWith('workspace:')?{...value,numbered:value.numbered.map((item,index)=>index===Number(action.slice(10))-1?next:item)}:{...value,[action]:next});setRecording(null);setCaptureError('');
      }}><kbd>{recording===action?'Press keys…':shortcutLabel(current)}</kbd></button>
  </div>}
  return <form className="shortcut-settings" onSubmit={async e=>{
    e.preventDefault();if(error||recording||saving)return;
    setSaving(true);setCaptureError('');try{await save(draft);close()}catch(reason){setCaptureError(String(reason instanceof Error?reason.message:reason));setSaving(false)}
  }}>
    <p className="notice">Click a shortcut, then press the keys you want. Changes take effect when saved.</p>
    <h3>Workspace controls</h3><div className="shortcut-rows">{fixedActions.map(([id,label,detail])=>row(id,label,detail))}{draft.numbered.map((_,index)=>row(`workspace:${index+1}`,`Switch to workspace ${index+1}`,`Ctrl+${index+1} by default`))}</div>
    <h3>Mouse shortcuts</h3><div className="settings-row minimize-gesture-settings"><span>Minimize a widget with right-click<small>Choose which keys must be held while right-clicking a widget.</small></span><div>{(['ctrl','alt','shift'] as const).map(modifier=><label key={modifier}><span>{modifier==='ctrl'?'Ctrl':modifier[0].toUpperCase()+modifier.slice(1)}</span><input type="checkbox" aria-label={'Require '+(modifier==='ctrl'?'Ctrl':modifier[0].toUpperCase()+modifier.slice(1))+' for right-click minimize'} checked={draft.minimizeModifiers[modifier]} disabled={draft.minimizeModifiers[modifier]&&Object.values(draft.minimizeModifiers).filter(Boolean).length===1||saving} onChange={event=>setDraft(value=>({...value,minimizeModifiers:{...value.minimizeModifiers,[modifier]:event.target.checked}}))}/></label>)}</div></div>
    <p className="shortcut-hint">Use Ctrl, Alt, or Shift. Shortcuts pause while a dialog is open. Avoid shortcuts used for typing, browser navigation, or common editing actions.</p>
    {(captureError||error)&&<p className="widget-error" role="alert">{captureError||error}</p>}
    {recording&&<p className="shortcut-listening" role="status">Press your shortcut. Esc cancels.</p>}
    <div className="shortcut-actions"><button type="button" disabled={saving} onClick={()=>{setDraft(defaultShortcuts());setCaptureError('');setRecording(null)}}>Restore defaults</button><button className="primary" type="submit" disabled={!!error||!!recording||saving}>{saving?'Saving…':'Save shortcuts'}</button></div>
  </form>;
}
