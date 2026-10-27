import {useState} from 'react';
import {defaultShortcuts,shortcutFromEvent,shortcutLabel,shortcutsError,type AppShortcutAction,type Shortcut,type WorkspaceShortcuts} from './domain/shortcuts.ts';
import {useT} from './localization.tsx';
const fixedActions:[AppShortcutAction,string,string][]=[
 ['up','workspaceAbove','previousSidebar'],['down','workspaceBelow','nextSidebar'],
 ['overview','workspaceMap','showHideMap'],['clickThrough','clickThroughShortcut','clickThroughDetail'],
 ['commandPalette','findAction','openCommandSearch'],['undo','undoWorkspace','restorePreviousLayout'],
];
export default function ShortcutSettings({shortcuts,save,close}:{shortcuts:WorkspaceShortcuts;save:(value:WorkspaceShortcuts)=>Promise<void>;close:()=>void}){
  const t=useT();
  const [draft,setDraft]=useState(()=>structuredClone(shortcuts));
  const [recording,setRecording]=useState<AppShortcutAction|null>(null);
  const [captureError,setCaptureError]=useState('');const [saving,setSaving]=useState(false);
  const error=shortcutsError(draft);
  function binding(action:AppShortcutAction):Shortcut|undefined{return action.startsWith('workspace:')?draft.numbered[Number(action.slice(10))-1]:draft[action as keyof Pick<WorkspaceShortcuts,'up'|'down'|'overview'|'clickThrough'|'commandPalette'|'undo'>]}
  function row(action:AppShortcutAction,label:string,detail:string){const current=binding(action);if(!current)return null;return <div className="shortcut-row" key={action}>
    <span><strong>{label}</strong><small>{detail}</small></span>
    <button type="button" className={'shortcut-key '+(recording===action?'recording':'')} aria-label={t('changeShortcut')+' '+label} aria-pressed={recording===action} disabled={saving}
      onClick={()=>{setCaptureError('');setRecording(recording===action?null:action)}}
      onBlur={()=>{if(recording===action)setRecording(null)}}
      onKeyDown={event=>{if(recording!==action)return;if(event.key==='Tab'){setRecording(null);return}event.preventDefault();event.stopPropagation();if(event.key==='Escape'){setRecording(null);setCaptureError('');return}if(event.repeat)return;const next=shortcutFromEvent(event.nativeEvent);if(!next)return;
        setDraft(value=>action.startsWith('workspace:')?{...value,numbered:value.numbered.map((item,index)=>index===Number(action.slice(10))-1?next:item)}:{...value,[action]:next});setRecording(null);setCaptureError('');
      }}><kbd>{recording===action?t('pressKeys'):shortcutLabel(current)}</kbd></button>
  </div>}
  return <form className="shortcut-settings" onSubmit={async e=>{
    e.preventDefault();if(error||recording||saving)return;
    setSaving(true);setCaptureError('');try{await save(draft);close()}catch(reason){setCaptureError(String(reason instanceof Error?reason.message:reason));setSaving(false)}
  }}>
    <p className="notice">{t('shortcutHelp')}</p>
    <h3>{t('workspaceControls')}</h3><div className="shortcut-rows">{fixedActions.map(([id,label,detail])=>row(id,t(label),t(detail)))}{draft.numbered.map((_,index)=>{const number=String(index+1);return row(`workspace:${index+1}`,t('switchWorkspace').replace('{number}',number),t('workspaceShortcutDefault').replace('{number}',number))})}</div>
    <h3>{t('mouseShortcuts')}</h3><div className="settings-row minimize-gesture-settings"><span>{t('rightClickMinimize')}<small>{t('rightClickDescription')}</small></span><div>{(['ctrl','alt','shift'] as const).map(modifier=><label key={modifier}><span>{modifier==='ctrl'?'Ctrl':modifier[0].toUpperCase()+modifier.slice(1)}</span><input type="checkbox" aria-label={t('rightClickMinimize')+' · '+(modifier==='ctrl'?'Ctrl':modifier[0].toUpperCase()+modifier.slice(1))} checked={draft.minimizeModifiers[modifier]} disabled={draft.minimizeModifiers[modifier]&&Object.values(draft.minimizeModifiers).filter(Boolean).length===1||saving} onChange={event=>setDraft(value=>({...value,minimizeModifiers:{...value.minimizeModifiers,[modifier]:event.target.checked}}))}/></label>)}</div></div>
    <p className="shortcut-hint">{t('shortcutModifierHint')}</p>
    {(captureError||error)&&<p className="widget-error" role="alert">{captureError||error}</p>}
    {recording&&<p className="shortcut-listening" role="status">{t('pressShortcut')}</p>}
    <div className="shortcut-actions"><button type="button" disabled={saving} onClick={()=>{setDraft(defaultShortcuts());setCaptureError('');setRecording(null)}}>{t('restoreDefaults')}</button><button className="primary" type="submit" disabled={!!error||!!recording||saving}>{saving?t('saving'):t('saveShortcuts')}</button></div>
  </form>;
}
