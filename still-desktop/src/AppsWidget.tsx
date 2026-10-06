import {useEffect,useRef,useState} from 'react';
import {Icon,type WidgetProps} from './widgets.tsx';
import {localApps,previewFileDrop,type DroppedResource} from './platform/resourceDrop.ts';
import {appPanel,type AppAttachment,type AppPanelInfo} from './platform/appPanel.ts';
import {appPanelFit,appPanelGeometry} from './domain/appPanel.ts';
import {observeCanvasScroll} from './platform/canvasScroll.ts';

export default function AppsWidget({widget,update,notify,obscured,workspaceActive=true,pickApp,saveApp,appAttachment,appAttachmentHandled}:WidgetProps){
 const host=useRef<HTMLDivElement>(null),picker=useRef<HTMLInputElement>(null),current=useRef({widget,update,obscured,workspaceActive,appAttachment,appAttachmentHandled});current.current={widget,update,obscured,workspaceActive,appAttachment,appAttachmentHandled};
 const [busy,setBusy]=useState(false),[ready,setReady]=useState(false),[opening,setOpening]=useState(false),[error,setError]=useState('');
 const schedule=useRef<()=>void>(()=>{}),launch=useRef<()=>Promise<void>>(async()=>{}),detach=useRef<()=>Promise<void>>(async()=>{}),attach=useRef<(window:AppAttachment)=>Promise<void>>(async()=>{});
  function selected(app:DroppedResource){if(app.kind!=='app'||!app.sourceId)throw new Error('Choose an app shortcut or application.');update({appKey:app.sourceId,appName:app.name,title:widget.title.trim()||app.name.slice(0,60),appPanelOpen:false,appReuseExisting:false,appMinWidth:undefined,appMinHeight:undefined});setError('')}
 async function choose(){setError('');if(!localApps.native){picker.current?.click();return}setBusy(true);try{const app=await localApps.choose();if(app)selected(app)}catch(e){setError(String(e))}finally{setBusy(false)}}
 useEffect(()=>{
  setReady(false);setOpening(false);if(!appPanel.available)return;
  let disposed=false,frame=0,opened=false,launching=false,presenting=false,dirty=false,scrolling=false,last='',stop:(()=>void)|undefined,stopScroll:(()=>void)|undefined;
  const node=host.current!,viewport=node.closest('.canvas-viewport') as HTMLElement,canvas=node.closest('.workspace-canvas')!;
  function geometry(){const content=node.closest('.widget-content')!.getBoundingClientRect(),v=viewport.getBoundingClientRect(),grip=node.closest('.canvas-card')?.querySelector<HTMLElement>('.widget-resize')?.getBoundingClientRect()??null;const clipped={left:Math.max(v.left,content.left),top:Math.max(v.top,content.top),right:Math.min(v.right,content.right),bottom:Math.min(v.bottom,content.bottom),width:0,height:0};return appPanelGeometry(node.getBoundingClientRect(),clipped,current.current.workspaceActive,current.current.obscured,grip)}
  function fit(info:AppPanelInfo){const c=current.current,card=node.closest('.canvas-card')!.getBoundingClientRect(),r=node.getBoundingClientRect(),frameWidth=Math.max(0,card.width-r.width),frameHeight=Math.max(0,card.height-r.height);
   const patch=appPanelFit(c.widget,info,frameWidth,frameHeight);
   if(Object.keys(patch).length)c.update(patch);
  }
  async function sync(){frame=0;if(disposed||!opened)return;if(scrolling){dirty=true;return}if(presenting){dirty=true;return}presenting=true;
    try{const g=geometry(),next=JSON.stringify(g);if(next!==last){const info=await appPanel.present(widget.id,g.bounds,g.clip,g.grip,g.visible&&!scrolling);last=next;node.dataset.nativeVisible=String(g.visible&&!scrolling);if(g.visible&&!scrolling&&info.probing){last='';schedule.current()}else if(g.visible&&!scrolling&&info.measured)fit(info)}}
   catch(reason){if(!disposed&&opened){setError(String(reason));node.dataset.nativeVisible='false';if(String(reason).includes('closed')){opened=false;setReady(false);current.current.update({appPanelOpen:false})}}}
   finally{presenting=false;if(dirty){dirty=false;schedule.current()}}
  }
  schedule.current=()=>{if(!disposed&&!frame)frame=requestAnimationFrame(()=>void sync())};
  launch.current=async()=>{
   const c=current.current;if(disposed||opened||launching||c.appAttachment||!c.widget.appKey||!c.workspaceActive||c.obscured)return;
   launching=true;setOpening(true);setError('');
   try{const g=geometry(),info=await appPanel.open(widget.id,c.widget.appKey,g.bounds,g.clip,g.grip,c.widget.appReuseExisting);if(disposed)return;opened=true;last='';setReady(true);fit(info);schedule.current()}
   catch(reason){if(!disposed)setError(String(reason))}finally{launching=false;if(!disposed)setOpening(false)}
  };
  attach.current=async(window:AppAttachment)=>{
   const c=current.current;if(disposed||launching||opened||!c.workspaceActive||c.obscured)return;launching=true;setOpening(true);setError('');
   try{const g=geometry(),info=await appPanel.attach(widget.id,window,g.bounds,g.clip,g.grip);if(disposed)return;opened=true;last='';setReady(true);current.current.update({appPanelOpen:true});fit(info);schedule.current()}
   catch(reason){if(!disposed){setError(String(reason));current.current.update({appPanelOpen:false})}}finally{launching=false;c.appAttachmentHandled?.();if(!disposed)setOpening(false)}
  };
  detach.current=async()=>{if(!opened&&!launching)return;opened=false;last='';node.dataset.nativeVisible='false';try{await appPanel.release(widget.id);if(!disposed){setReady(false);setError('')}}catch(reason){if(!disposed)setError(String(reason))}};
  const resize=new ResizeObserver(schedule.current);resize.observe(node);resize.observe(viewport);
  const mutation=new MutationObserver(schedule.current);mutation.observe(canvas,{subtree:true,attributes:true,attributeFilter:['style','class'],childList:true});
  stopScroll=observeCanvasScroll(viewport,value=>{scrolling=value;if(value){if(frame){cancelAnimationFrame(frame);frame=0}dirty=true;const g=geometry();void appPanel.present(widget.id,g.bounds,g.clip,g.grip,false).catch(()=>undefined)}else{last='';dirty=false;schedule.current()}});
  const scroll=()=>schedule.current();window.addEventListener('resize',scroll);
  void appPanel.subscribe(event=>{if(disposed||event.id!==widget.id)return;if(!event.open){opened=false;last='';setReady(false);node.dataset.nativeVisible='false';current.current.update({appPanelOpen:false});setError('The app was closed. Open it in the panel again.')}else if(event.error!==undefined)setError(event.error??'')}).then(unlisten=>{if(disposed)unlisten();else{stop=unlisten;const c=current.current;if(c.appAttachment)void attach.current(c.appAttachment);else if(c.widget.appPanelOpen&&c.workspaceActive)void launch.current()}}).catch(reason=>{if(!disposed)setError(String(reason))});
  return()=>{disposed=true;cancelAnimationFrame(frame);resize.disconnect();mutation.disconnect();window.removeEventListener('resize',scroll);stopScroll?.();stop?.();void appPanel.release(widget.id).catch(()=>undefined)};
 },[widget.id,widget.appKey]);
 useEffect(()=>{schedule.current();if(appAttachment&&workspaceActive&&!obscured)void attach.current(appAttachment);else if(widget.appPanelOpen&&workspaceActive&&!obscured)void launch.current();else if(!widget.appPanelOpen)void detach.current()},[appAttachment,widget.appPanelOpen,workspaceActive,obscured,widget.placement]);
 return <div className="app-panel">
  <input ref={picker} aria-label="Choose app shortcut" type="file" accept=".exe,.lnk" hidden onChange={e=>{try{const result=previewFileDrop(Array.from(e.target.files??[]));if(result.entries[0])selected(result.entries[0]);else setError(result.errors.join(' '))}catch(reason){setError(String(reason))}e.target.value=''}}/>
  <div className="app-panel-tools"><input aria-label="Rename app widget" placeholder={widget.appName||'Desktop app'} value={widget.title} maxLength={60} onChange={e=>update({title:e.target.value})}/><button disabled={opening||busy} onClick={pickApp}>Attach open app</button>{widget.appKey&&<button disabled={opening||busy} onClick={saveApp}>Save to tray</button>}{ready&&<button disabled={opening||busy} onClick={()=>{update({appPanelOpen:false});void detach.current();notify('App released to your desktop.')}}>Detach</button>}<button disabled={opening||busy} onClick={()=>void choose()}>{widget.appKey?'Change app':'Choose app'}</button></div>
  {error&&<p className="widget-error" role="alert">{error}</p>}
  <div ref={host} className="app-panel-host" data-native-app-id={appPanel.available&&ready?widget.id:undefined}>
   <div className="app-panel-placeholder"><span className="document-type-symbol type-app"><Icon name="apps"/></span><h2>{opening?'Opening app in panel…':ready?widget.appName+' · attached':widget.appName||'Your desktop apps'}</h2>
    <p>{!widget.appKey?'Attach an open app above, or choose an app shortcut.':!appPanel.available?'The Windows version positions the real app window inside this panel.':ready?'The app follows this widget. Resize the card to give it more room.':'Open the real app inside this widget, with its normal tools and documents.'}</p>
    {widget.appKey&&!ready&&<button className="primary" disabled={opening||busy||!appPanel.available} onClick={()=>{update({appPanelOpen:true});void launch.current()}}>{opening?'Opening…':'Open in panel'}</button>}
   </div>
  </div>
  <div className="app-panel-status"><span>{ready?'App attached':opening?'Starting app…':appPanel.available?'App panel':'Windows app required'}</span><span>Resize ↘</span></div>
 </div>;
}
