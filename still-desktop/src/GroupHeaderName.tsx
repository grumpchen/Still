import {useEffect,useRef,useState,type KeyboardEvent,type PointerEvent} from 'react';

interface Props {name:string;displayName:string;save:(name:string)=>void;label?:string;tooltip?:string}

export default function GroupHeaderName({name,displayName,save,label='Group name',tooltip='Click to rename group'}:Props){
 const [editing,setEditing]=useState(false),[draft,setDraft]=useState(name);
 const input=useRef<HTMLInputElement>(null),cancelled=useRef(false),finished=useRef(false);
 useEffect(()=>{if(!editing)setDraft(name)},[editing,name]);
 useEffect(()=>{if(editing){input.current?.focus();input.current?.select()}},[editing]);
 function stopPointer(event:PointerEvent<HTMLElement>){event.stopPropagation()}
 function commit(){
  if(finished.current)return;
  finished.current=true;
  const next=draft.trim().slice(0,60);
  setEditing(false);
  if(next!==name)save(next);
 }
 function cancel(){
  if(finished.current)return;
  finished.current=true;cancelled.current=true;setDraft(name);setEditing(false);input.current?.blur();
 }
 function key(event:KeyboardEvent<HTMLInputElement>){
  event.stopPropagation();
  if(event.key==='Enter'){event.preventDefault();commit()}
  else if(event.key==='Escape'){event.preventDefault();cancel()}
 }
 if(editing)return <input ref={input} className="group-header-name-input" data-capture-ignore aria-label={label} maxLength={60} value={draft} onPointerDown={stopPointer} onClick={event=>event.stopPropagation()} onChange={event=>setDraft(event.target.value)} onKeyDown={key} onBlur={()=>{if(cancelled.current){cancelled.current=false;return}commit()}}/>;
 return <button type="button" className="group-header-name" data-capture-ignore aria-label={'Rename '+(displayName||label)} title={tooltip} onPointerDown={stopPointer} onClick={event=>{event.stopPropagation();finished.current=false;setDraft(name);setEditing(true)}}>{displayName||'Group'}</button>;
}
