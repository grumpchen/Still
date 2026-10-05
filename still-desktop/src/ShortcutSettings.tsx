import { useState } from 'react';
import { defaultShortcuts, shortcutFromEvent, shortcutLabel, shortcutsError, type WorkspaceDirection, type WorkspaceShortcuts } from './domain/shortcuts.ts';
export default function ShortcutSettings({shortcuts,save,close}:{shortcuts:WorkspaceShortcuts;save:(value:WorkspaceShortcuts)=>Promise<void>;close:()=>void}){
  const [draft,setDraft]=useState(()=>structuredClone(shortcuts));
  const [recording,setRecording]=useState<WorkspaceDirection|null>(null);
  const [captureError,setCaptureError]=useState('');const [saving,setSaving]=useState(false);
  const error=shortcutsError(draft);
  return <form className="shortcut-settings" onSubmit={async e=>{
    e.preventDefault();if(error||recording||saving)return;
    setSaving(true);setCaptureError('');try{await save(draft);close()}catch(reason){setCaptureError(String(reason instanceof Error?reason.message:reason));setSaving(false)}
  }}>
    <p className="notice">Move through your workspaces while Still is active. Click a shortcut, then press your preferred keys.</p>
    <div className="shortcut-rows">{(['up','down'] as const).map(direction=><div className="shortcut-row" key={direction}>
      <span><strong>{direction==='up'?'↑ Workspace above':'↓ Workspace below'}</strong><small>{direction==='up'?'Previous in the sidebar':'Next in the sidebar'}</small></span>
      <button type="button" className={'shortcut-key '+(recording===direction?'recording':'')} aria-label={'Change workspace '+direction+' shortcut'} aria-pressed={recording===direction} disabled={saving}
        onClick={()=>{setCaptureError('');setRecording(recording===direction?null:direction)}}
        onBlur={()=>{if(recording===direction)setRecording(null)}}
        onKeyDown={e=>{
          if(recording!==direction)return;
          if(e.key==='Tab'){setRecording(null);return}
          e.preventDefault();e.stopPropagation();
          if(e.key==='Escape'){setRecording(null);setCaptureError('');return}
          if(e.repeat)return;
          const binding=shortcutFromEvent(e.nativeEvent);if(!binding)return;
          setDraft(value=>({...value,[direction]:binding}));setRecording(null);setCaptureError('');
        }}><kbd>{recording===direction?'Press keys…':shortcutLabel(draft[direction])}</kbd></button>
    </div>)}</div>
    <p className="shortcut-hint">Use Alt, Ctrl or Shift. Shift-only shortcuts pause while typing in a text field. Navigation wraps through all workspaces. Shortcuts pause while a dialog is open.</p>
    {(captureError||error)&&<p className="widget-error" role="alert">{captureError||error}</p>}
    {recording&&<p className="shortcut-listening" role="status">Press your shortcut. Esc cancels.</p>}
    <div className="shortcut-actions"><button type="button" disabled={saving} onClick={()=>{setDraft(defaultShortcuts());setCaptureError('');setRecording(null)}}>Restore defaults</button><button className="primary" type="submit" disabled={!!error||!!recording||saving}>{saving?'Saving…':'Save shortcuts'}</button></div>
  </form>;
}
