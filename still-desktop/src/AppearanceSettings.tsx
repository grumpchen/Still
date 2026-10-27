import {defaultGlass,type WorkspaceBackground} from './domain/appearance.ts';
import type {WorkspaceState} from './domain/workspaces.ts';
import {useT} from './localization.tsx';

export default function AppearanceSettings({state,update}:{state:WorkspaceState;update:(patch:Partial<WorkspaceState>)=>void}){
  const t=useT(),glass=state.appearance==='liquid-glass';
  return <><p className="notice">{t('chooseMaterial')}</p>
    <div className="material-options" role="group" aria-label={t('appearance')}>
      {(['minimal','liquid-glass'] as const).map(appearance=><button type="button" key={appearance} className={'material-option '+(state.appearance===appearance?'selected':'')} aria-label={appearance==='minimal'?t('minimalAppearance'):t('liquidGlassAppearance')} aria-pressed={state.appearance===appearance} onClick={()=>update({appearance})}>
        <span className={'material-sample sample-'+appearance} aria-hidden="true"><i/><i/><i/></span>
        <span className="material-name">{appearance==='minimal'?t('minimalAppearance'):t('liquidGlassAppearance')}<span className="material-check" aria-hidden="true">{state.appearance===appearance?'✓':''}</span></span>
        <small>{appearance==='minimal'?t('minimalDescription'):t('liquidGlassDescription')}</small>
      </button>)}
    </div>
    {(['theme','density'] as const).map(key=><label className="settings-row" key={key}><span>{key==='density'?t('spacing'):t('colourMode')}</span><select aria-label={key==='density'?t('spacing'):t('colourMode')} value={state[key]} onChange={event=>update({[key]:event.target.value})}>{(key==='theme'?['light','dark']:['comfortable','compact']).map(option=><option key={option} value={option}>{t(option)}</option>)}</select></label>)}
    {glass?<section className="glass-controls" aria-label={t('backgroundSettings')}><div className="glass-controls-heading"><span>{state.glass.backgroundEffect==='liquid-chrome'?'Liquid Chrome':state.glass.backgroundEffect==='line-waves'?'LineWaves':t('waveMetalEffect').split(' · ')[0]} · {t('backgroundEffect').toLowerCase()}</span><button type="button" onClick={()=>update({glass:defaultGlass()})}>{t('resetLook')}</button></div>
      <label className="settings-row"><span>{t('backgroundEffect')}</span><select aria-label={t('backgroundEffect')} value={state.glass.backgroundEffect} onChange={event=>update({glass:{...state.glass,backgroundEffect:event.target.value as WorkspaceState['glass']['backgroundEffect']}})}><option value="liquid-chrome">{t('liquidChromeEffect')}</option><option value="line-waves">{t('lineWavesEffect')}</option><option value="wave-wallpaper">{t('waveMetalEffect')}</option></select></label>
      <label className="glass-control"><span>{t('glassOpacity')}</span><output>{state.glass.opacity}%</output><input type="range" aria-label={t('glassOpacity')} min={45} max={90} value={state.glass.opacity} onChange={event=>update({glass:{...state.glass,opacity:Number(event.target.value)}})}/></label>
      <p className="glass-footnote">{t('glassFootnote')}</p>
    </section>:null}
    <label className="settings-row"><span>{t('workspaceBackground')}</span><select aria-label={t('workspaceBackground')} value={state.background} onChange={event=>update({background:event.target.value as WorkspaceBackground})}><option value="solid">{t('solid')}</option><option value="transparent">{t('transparent')}</option><option value="dots">{t('dots')}</option></select></label>
  </>;
}
