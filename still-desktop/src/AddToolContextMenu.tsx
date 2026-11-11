import {useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {Icon} from './Icon.tsx';
import {widgetCatalog,widgetTypes,type WidgetType} from './domain/widgetCatalog.ts';
import {useT} from './localization.tsx';

export interface AddToolMenuTarget {x:number;y:number}
interface Props {target:AddToolMenuTarget;close:()=>void;choose:(type:WidgetType)=>void}

export default function AddToolContextMenu({target,close,choose}:Props){
 const t=useT();
 const menu=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  function dismissOutside(event:PointerEvent){if(!menu.current?.contains(event.target as Node))close()}
  function dismissEscape(event:KeyboardEvent){if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close()}}
  document.addEventListener('pointerdown',dismissOutside,true);
  document.addEventListener('keydown',dismissEscape,true);
  window.addEventListener('resize',close);
  window.addEventListener('scroll',close,true);
  return()=>{document.removeEventListener('pointerdown',dismissOutside,true);document.removeEventListener('keydown',dismissEscape,true);window.removeEventListener('resize',close);window.removeEventListener('scroll',close,true)};
 },[close]);
 const width=248,height=Math.min(window.innerHeight-16,52+widgetTypes.length*38);
 const left=Math.max(8,Math.min(target.x,window.innerWidth-width-8)),top=Math.max(8,Math.min(target.y,window.innerHeight-height-8));
 return createPortal(<div ref={menu} className="add-tool-context-menu" role="menu" aria-label={t('addTool')} style={{left,top}} onContextMenu={event=>event.preventDefault()}>
  <p className="add-tool-heading">{t('addTool')}</p>
  {widgetTypes.map(type=><button key={type} type="button" role="menuitem" onClick={()=>{close();choose(type)}}><Icon name={widgetCatalog[type].icon}/><span>{t('widget_'+type)}</span></button>)}
 </div>,document.body);
}
