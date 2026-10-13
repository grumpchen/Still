import { backgroundSettingsUpdate,backgroundSettingsValue,defaultGlass,type WorkspaceBackgroundChoice } from './domain/appearance.ts';
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
    {glass?<section className="glass-controls" aria-label="Liquid Glass settings"><div className="glass-controls-heading"><span>Liquid Glass · your leaf photo</span><button type="button" onClick={()=>update({glass:defaultGlass()})}>Reset look</button></div>
      {([{key:'blur',label:'Background blur',min:0,max:18,unit:'px'},{key:'saturation',label:'Colour saturation',min:40,max:100,unit:'%'},{key:'opacity',label:'Glass opacity',min:45,max:90,unit:'%'}] as const).map(control=><label key={control.key} className="glass-control"><span>{control.label}</span><output>{state.glass[control.key]}{control.unit}</output><input type="range" aria-label={control.label} min={control.min} max={control.max} value={state.glass[control.key]} onChange={event=>update({glass:{...state.glass,[control.key]:Number(event.target.value)}})}/></label>)}
      <label className="glass-toggle"><span><strong>Glass widget headers</strong><small>Add a frosted, highlighted surface to each widget title bar. Turn it off for a plain header.</small></span><input aria-label="Glass widget headers" type="checkbox" checked={state.glass.widgetHeaders} onChange={event=>update({glass:{...state.glass,widgetHeaders:event.target.checked}})}/></label>
      <p className="glass-footnote">A softly defocused background, with crisp text above it. Changes save automatically.</p>
    </section>:null}
    <label className="settings-row"><span>Workspace background</span><select aria-label="Background" value={backgroundSettingsValue(state.appearance,state.background)} onChange={event=>update(backgroundSettingsUpdate(event.target.value as WorkspaceBackgroundChoice))}><option value="solid">Solid</option><option value="transparent">Transparent</option><option value="dots">Dots</option><option value="leaf-photo">Leaf photo · Liquid Glass</option></select></label>
  </>;
}
