import {useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {useT} from './localization.tsx';

export interface SavedItemMenuTarget {kind:'preset'|'group';id:string;x:number;y:number}
interface Props {target:SavedItemMenuTarget;close:()=>void;rename:()=>void;remove:()=>void}

export default function SavedItemContextMenu({target,close,rename,remove}:Props){
 const t=useT();
 const menu=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  function dismissOutside(event:PointerEvent){if(!menu.current?.contains(event.target as Node))close()}
  function dismissEscape(event:KeyboardEvent){if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close()}}
  document.addEventListener('pointerdown',dismissOutside,true);
  document.addEventListener('keydown',dismissEscape,true);
  return()=>{document.removeEventListener('pointerdown',dismissOutside,true);document.removeEventListener('keydown',dismissEscape,true)};
 },[close]);
 const left=Math.max(8,Math.min(target.x,window.innerWidth-152)),top=Math.max(8,Math.min(target.y,window.innerHeight-104));
 return createPortal(<div ref={menu} className="saved-item-context-menu" role="menu" aria-label={t('savedItemActions')} style={{left,top}} onContextMenu={event=>event.preventDefault()}>
  <button role="menuitem" autoFocus onClick={()=>{close();rename()}}>{t('rename')}</button>
  <button role="menuitem" onClick={()=>{close();remove()}}>{t('deleteItem')}</button>
 </div>,document.body);
}
