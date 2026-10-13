import {useState} from 'react';
import {shortcutLabel,type WorkspaceShortcuts} from './domain/shortcuts.ts';

interface Props {shortcuts:WorkspaceShortcuts;onFinish:()=>void;onOpenAssistant:()=>void}

export default function GettingStartedTour({shortcuts,onFinish,onOpenAssistant}:Props){
 const [step,setStep]=useState(0);
 const modifiers=[...(shortcuts.minimizeModifiers.ctrl?['Ctrl']:[]),...(shortcuts.minimizeModifiers.alt?['Alt']:[]),...(shortcuts.minimizeModifiers.shift?['Shift']:[])].join(' + ');
 const pages:Array<{eyebrow:string;title:string;body:string;tip?:string;keys?:[string,string][]}>=[
  {eyebrow:'Your workspace',title:'Move things where they help.',body:'Drag a widget by its header to move it. Drag a widget onto another workspace in the sidebar to move it there; Still follows it when that setting is enabled.',tip:'Drag onto Saved + to keep a reusable copy. Drop onto a Group to collect the original widget.'},
  {eyebrow:'Keyboard shortcuts',title:'Move around without reaching for the mouse.',body:'These shortcuts use your current settings. Change them any time in Settings → General → Customize keyboard shortcuts.',keys:[
   [shortcutLabel(shortcuts.up),'Previous workspace'],[shortcutLabel(shortcuts.down),'Next workspace'],
   [shortcutLabel(shortcuts.overview),'Toggle workspace map'],[shortcutLabel(shortcuts.commandPalette),'Find an action'],
   [shortcutLabel(shortcuts.undo),'Undo workspace change'],['Ctrl + 1–9','Switch to a numbered workspace'],
  ]},
  {eyebrow:'Mouse shortcut',title:'Minimize a widget with one gesture.',body:`Hold ${modifiers}, then right-click a widget to minimize it to a compact card. Other right-clicks will not minimize the widget.`,tip:'You can change which keys are required in Settings → General → Customize keyboard shortcuts.'},
  {eyebrow:'Still AI',title:'Ask Still to help with your workspace.',body:'Open AI assistant from the sidebar to ask questions or manage widgets. You can ask it to create a Note, arrange your workspace, or start a Focus timer. Selecting a widget with @ is a quick way to point Still at it, but it is optional.',tip:'Try: “Add a Focus widget and start a 10 minute timer.”'},
 ];
 const page=pages[step];
 return <section className="getting-started-tour" aria-label="Still getting started tutorial">
  <div className="tour-progress" aria-label={`Step ${step+1} of ${pages.length}`}>
   {pages.map((item,index)=><span key={item.eyebrow} className={index===step?'active':index<step?'complete':''}/>) }
  </div>
  <div className="tour-page" aria-live="polite">
   <p className="tour-eyebrow">{page.eyebrow} · {step+1} of {pages.length}</p>
   <h3>{page.title}</h3>
   <p>{page.body}</p>
   {page.keys&&<dl className="tour-shortcut-list">{page.keys.map(([key,label])=><div key={label}><dt>{label}</dt><dd><kbd>{key}</kbd></dd></div>)}</dl>}
   {page.tip&&<p className="tour-tip">{page.tip}</p>}
  </div>
  <div className="tour-actions">
   <button type="button" className="tour-skip" onClick={onFinish}>Skip tutorial</button>
   <div className="tour-step-actions">
    {step>0&&<button type="button" onClick={()=>setStep(current=>current-1)}>Back</button>}
    {step<pages.length-1?<button type="button" className="primary" onClick={()=>setStep(current=>current+1)}>Next</button>:<><button type="button" onClick={onFinish}>Finish</button><button type="button" className="primary" onClick={onOpenAssistant}>Open Still AI</button></>}
   </div>
  </div>
 </section>;
}
