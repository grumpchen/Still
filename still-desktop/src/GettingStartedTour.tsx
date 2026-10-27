import {useState} from 'react';
import {shortcutLabel,type WorkspaceShortcuts} from './domain/shortcuts.ts';
import {useT} from './localization.tsx';

interface Props {shortcuts:WorkspaceShortcuts;onFinish:()=>void;onOpenAssistant:()=>void}

export default function GettingStartedTour({shortcuts,onFinish,onOpenAssistant}:Props){
 const t=useT();
 const [step,setStep]=useState(0);
 const modifiers=[...(shortcuts.minimizeModifiers.ctrl?['Ctrl']:[]),...(shortcuts.minimizeModifiers.alt?['Alt']:[]),...(shortcuts.minimizeModifiers.shift?['Shift']:[])].join(' + ');
 const pages:Array<{eyebrow:string;title:string;body:string;tip?:string;keys?:[string,string][]}>=[
  {eyebrow:'tourWorkspace',title:'tourMoveThingsTitle',body:'tourWorkspaceBody',tip:'tourWorkspaceTip'},
  {eyebrow:'tourKeyboardShortcuts',title:'tourKeyboardTitle',body:'tourKeyboardBody',keys:[
   [shortcutLabel(shortcuts.up),'tourPreviousWorkspace'],[shortcutLabel(shortcuts.down),'tourNextWorkspace'],
   [shortcutLabel(shortcuts.overview),'tourToggleMap'],[shortcutLabel(shortcuts.commandPalette),'tourFindAction'],
   [shortcutLabel(shortcuts.undo),'tourUndoWorkspace'],['Ctrl + 1–9','tourSwitchWorkspace'],
  ]},
  {eyebrow:'tourMouseShortcut',title:'tourMouseTitle',body:'tourMouseBody',tip:'tourMouseTip'},
  {eyebrow:'tourStillAi',title:'tourAiTitle',body:'tourAiBody',tip:'tourAiTip'},
 ];
 const page=pages[step];
 return <section className="getting-started-tour" aria-label={t('tourAccessibleName')}>
  <div className="tour-progress" aria-label={t('tourStep').replace('{step}',String(step+1)).replace('{total}',String(pages.length))}>
   {pages.map((item,index)=><span key={item.eyebrow} className={index===step?'active':index<step?'complete':''}/>) }
  </div>
  <div className="tour-page" aria-live="polite">
   <p className="tour-eyebrow">{t(page.eyebrow)} · {step+1} {t('of')} {pages.length}</p>
   <h3>{t(page.title)}</h3>
   <p>{t(page.body).replace('{modifiers}',modifiers)}</p>
   {page.keys&&<dl className="tour-shortcut-list">{page.keys.map(([key,label])=><div key={label}><dt>{t(label)}</dt><dd><kbd>{key}</kbd></dd></div>)}</dl>}
   {page.tip&&<p className="tour-tip">{t(page.tip)}</p>}
  </div>
  <div className="tour-actions">
   <button type="button" className="tour-skip" onClick={onFinish}>{t('skipTutorial')}</button>
   <div className="tour-step-actions">
    {step>0&&<button type="button" onClick={()=>setStep(current=>current-1)}>{t('back')}</button>}
    {step<pages.length-1?<button type="button" className="primary" onClick={()=>setStep(current=>current+1)}>{t('next')}</button>:<><button type="button" onClick={onFinish}>{t('finish')}</button><button type="button" className="primary" onClick={onOpenAssistant}>{t('openStillAi')}</button></>}
   </div>
  </div>
 </section>;
}
