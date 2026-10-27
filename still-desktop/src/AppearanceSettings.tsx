import { defaultGlass,type WorkspaceBackground } from './domain/appearance.ts';
import type { WorkspaceState } from './domain/workspaces.ts';
export default function AppearanceSettings({state,update}:{state:WorkspaceState;update:(patch:Partial<WorkspaceState>)=>void}){
  const glass=state.appearance==='liquid-glass';
  return <><p className="notice">Choose a material. Make it your own.</p>
    <div className="material-options" role="group" aria-label="Appearance style">
      {(['minimal','liquid-glass'] as const).map(appearance=><button type="button" key={appearance} className={'material-option '+(state.appearance===appearance?'selected':'')} aria-label={appearance==='minimal'?'Quiet minimal appearance':'Liquid Glass appearance'} aria-pressed={state.appearance===appearance} onClick={()=>update({appearance})}>
        <span className={'material-sample sample-'+appearance} aria-hidden="true"><i/><i/><i/></span>
        <span className="material-name">{appearance==='minimal'?'Quiet minimal':'Liquid Glass'}<span className="material-check" aria-hidden="true">{state.appearance===appearance?'✓':''}</span></span>
        <small>{appearance==='minimal'?'Clear, calm surfaces':'Soft light. Gentle depth.'}</small>
      </button>)}
    </div>
    {(['theme','density'] as const).map(key=><label className="settings-row" key={key}><span>{key==='density'?'Spacing':'Colour mode'}</span><select aria-label={key==='density'?'Spacing':'Colour mode'} value={state[key]} onChange={event=>update({[key]:event.target.value})}>{(key==='theme'?['light','dark']:['comfortable','compact']).map(option=><option key={option} value={option}>{option[0].toUpperCase()+option.slice(1)}</option>)}</select></label>)}
    {glass?<section className="glass-controls" aria-label="Liquid Chrome settings"><div className="glass-controls-heading"><span>Liquid Chrome · interactive metal</span><button type="button" onClick={()=>update({glass:defaultGlass()})}>Reset look</button></div>
      <label className="glass-control"><span>Glass opacity</span><output>{state.glass.opacity}%</output><input type="range" aria-label="Glass opacity" min={45} max={90} value={state.glass.opacity} onChange={event=>update({glass:{...state.glass,opacity:Number(event.target.value)}})}/></label>
      <p className="glass-footnote">A gently flowing chrome surface follows your pointer. Changes save automatically.</p>
    </section>:null}
    <label className="settings-row"><span>Workspace background</span><select aria-label="Background" value={state.background} onChange={event=>update({background:event.target.value as WorkspaceBackground})}><option value="solid">Solid</option><option value="transparent">Transparent</option><option value="dots">Dots</option></select></label>
  </>;
}
