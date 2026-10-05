import {createContext,useContext,useEffect,useMemo,useRef,type ButtonHTMLAttributes,type ReactNode} from 'react';
import type {WidgetType} from './domain/workspaces.ts';

export type TrayDragPayload =
 | {kind:'type';type:WidgetType}
 | {kind:'preset';id:string}
 | {kind:'group';id:string}
 | {kind:'group-entry';groupId:string;id:string;entryKind:'link'|'widget'};
export interface TrayDragPosition {payload:TrayDragPayload;clientX:number;clientY:number}
interface DragContext {
 enabled:()=>boolean;
 change:(drag:TrayDragPosition|null)=>void;
 drop:(drag:TrayDragPosition)=>void;
 registerCancel:(cancel:()=>void)=>()=>void;
}
const Context=createContext<DragContext|null>(null);

/** Pointer dragging stays inside the webview even when native file drops are enabled. */
export function TrayDragProvider({children,onChange,onDrop,enabled=true}:{children:ReactNode;onChange:(drag:TrayDragPosition|null)=>void;onDrop:(drag:TrayDragPosition)=>void;enabled?:boolean}){
 const callbacks=useRef({onChange,onDrop}),cancel=useRef<(()=>void)|null>(null),enabledRef=useRef(enabled);
 callbacks.current={onChange,onDrop};
 enabledRef.current=enabled;
 const context=useMemo<DragContext>(()=>({
  enabled:()=>enabledRef.current,
  change:drag=>callbacks.current.onChange(drag),
  drop:drag=>callbacks.current.onDrop(drag),
  registerCancel:next=>{cancel.current?.();cancel.current=next;return()=>{if(cancel.current===next)cancel.current=null}},
 }),[]);
 useEffect(()=>{if(!enabled)cancel.current?.()},[enabled]);
 useEffect(()=>{
  function escape(event:globalThis.KeyboardEvent){if(event.key==='Escape'&&cancel.current){event.preventDefault();event.stopPropagation();cancel.current()}}
  document.addEventListener('keydown',escape,true);
  return()=>{document.removeEventListener('keydown',escape,true);cancel.current?.()};
 },[]);
 return <Context.Provider value={context}>{children}</Context.Provider>;
}

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>,'draggable'> {dragPayload:TrayDragPayload}
interface Gesture {pointerId:number;startX:number;startY:number;payload:TrayDragPayload;target:HTMLButtonElement;active:boolean;unregister:()=>void}
export function TrayDragButton({dragPayload,onPointerDown,onPointerMove,onPointerUp,onPointerCancel,onLostPointerCapture,onClickCapture,onClick,onDragStart,style,disabled,...props}:Props){
 const context=useContext(Context),gesture=useRef<Gesture|null>(null),suppressClick=useRef(false);
 function finish(clientX:number,clientY:number,cancelled=false){
  const current=gesture.current;if(!current)return;
  gesture.current=null;current.unregister();
  if(current.target.hasPointerCapture(current.pointerId))current.target.releasePointerCapture(current.pointerId);
  // A fresh pointer down or keyboard click clears this flag, so cancelling a
  // drag cannot accidentally swallow the user's next deliberate activation.
  if(current.active||cancelled)suppressClick.current=true;
  if(!current.active)return;
  context?.change(null);
  if(!cancelled&&context?.enabled())context.drop({payload:current.payload,clientX,clientY});
 }
 useEffect(()=>()=>{const current=gesture.current;if(current)finish(current.startX,current.startY,true)},[]);
 return <button {...props} disabled={disabled} draggable={false} style={{...style,touchAction:'none',userSelect:'none'}}
  onDragStart={event=>{onDragStart?.(event);event.preventDefault()}}
  onPointerDown={event=>{
   onPointerDown?.(event);suppressClick.current=false;
   if(!context||!context.enabled()||disabled||event.defaultPrevented||event.button!==0||!event.isPrimary)return;
   if(gesture.current)finish(event.clientX,event.clientY,true);
   suppressClick.current=false;
   const current:Gesture={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,payload:dragPayload,target:event.currentTarget,active:false,unregister:()=>{}};
   gesture.current=current;
   current.unregister=context.registerCancel(()=>finish(current.startX,current.startY,true));
   event.currentTarget.setPointerCapture(event.pointerId);
  }}
  onPointerMove={event=>{
   onPointerMove?.(event);const current=gesture.current;if(!current||current.pointerId!==event.pointerId)return;
   if(!current.active&&Math.hypot(event.clientX-current.startX,event.clientY-current.startY)<5)return;
   current.active=true;event.preventDefault();context?.change({payload:current.payload,clientX:event.clientX,clientY:event.clientY});
  }}
  onPointerUp={event=>{onPointerUp?.(event);if(gesture.current?.pointerId===event.pointerId)finish(event.clientX,event.clientY)}}
  onPointerCancel={event=>{onPointerCancel?.(event);if(gesture.current?.pointerId===event.pointerId)finish(event.clientX,event.clientY,true)}}
  onLostPointerCapture={event=>{onLostPointerCapture?.(event);if(gesture.current?.pointerId===event.pointerId)finish(event.clientX,event.clientY,true)}}
  onClickCapture={event=>{
   if(suppressClick.current&&event.detail!==0){suppressClick.current=false;event.preventDefault();event.stopPropagation();return}
   suppressClick.current=false;onClickCapture?.(event);
  }}
  onClick={onClick}
 />;
}
