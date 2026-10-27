import {useEffect,useRef,useState} from 'react';
import {Icon} from './Icon.tsx';
import type {WidgetProps} from './widgets.tsx';
import {localApps,previewFileDrop,type DroppedResource} from './platform/resourceDrop.ts';
import {appPanel,type AppAttachment,type AppPanelInfo} from './platform/appPanel.ts';
import {appPanelFit,appPanelGeometry} from './domain/appPanel.ts';
import {constrainPlacement} from './domain/layout.ts';
import {observeCanvasScroll} from './platform/canvasScroll.ts';
import {useT} from './localization.tsx';

export default function AppsWidget({widget,update,notify,appOpenResult,obscured,workspaceActive=true,relaunchToken=0,onRelaunchStatus,appAttachment,appAttachmentHandled,pickApp}:WidgetProps){
 const t=useT();
 const host=useRef<HTMLDivElement>(null),picker=useRef<HTMLInputElement>(null),current=useRef({widget,update,notify,appOpenResult,obscured,workspaceActive,appAttachment,appAttachmentHandled,onRelaunchStatus,t});current.current={widget,update,notify,appOpenResult,obscured,workspaceActive,appAttachment,appAttachmentHandled,onRelaunchStatus,t};
 const [busy,setBusy]=useState(false),[ready,setReady]=useState(false),[opening,setOpening]=useState(false),[relaunchFailed,setRelaunchFailed]=useState(false),[externalOpened,setExternalOpened]=useState(false),[error,setError]=useState('');
 const [collectionResumed,setCollectionResumed]=useState(false);
 const schedule=useRef<()=>void>(()=>{}),launch=useRef<()=>Promise<boolean>>(async()=>false),resume=useRef<()=>Promise<boolean>>(async()=>false),detach=useRef<()=>Promise<void>>(async()=>{}),attach=useRef<(window:AppAttachment)=>Promise<boolean>>(async()=>false),relaunch=useRef<()=>Promise<void>>(async()=>{});
  function selected(app:DroppedResource){if(app.kind!=='app'||!app.sourceId)throw new Error('Choose an app shortcut or application.');update({appKey:app.sourceId,appName:app.name,title:widget.title.trim()||app.name.slice(0,60),appPanelOpen:false,appReuseExisting:false,appMinWidth:undefined,appMinHeight:undefined});setExternalOpened(false);setRelaunchFailed(false);setError('')}
 async function choose(){setError('');if(!localApps.native){picker.current?.click();return}setBusy(true);try{const app=await localApps.choose();if(app)selected(app)}catch(e){setError(String(e))}finally{setBusy(false)}}
 useEffect(()=>{
  setReady(false);setOpening(false);setRelaunchFailed(false);if(!appPanel.available){relaunch.current=async()=>{setRelaunchFailed(true);setError('Reopening native apps is available in the Windows version of Still.');current.current.onRelaunchStatus?.(true)};return}
  const retainedOnMount=appPanel.consumeCollectionRetention(widget.id),shouldResumeCollection=retainedOnMount||widget.appWasCollected===true;setCollectionResumed(shouldResumeCollection);
  let disposed=false,frame=0,opened=false,launching=false,presenting=false,dirty=false,scrolling=false,last='',revision=0,stop:(()=>void)|undefined,stopScroll:(()=>void)|undefined;
  const node=host.current!,viewport=node.closest('.canvas-viewport') as HTMLElement,canvas=node.closest('.workspace-canvas')!;
  function geometry(){const content=node.closest('.widget-content')!.getBoundingClientRect(),v=viewport.getBoundingClientRect(),card=node.closest('.canvas-card') as HTMLElement,level=Number(card.style.zIndex),grip=card.querySelector<HTMLElement>('.widget-resize')?.getBoundingClientRect()??null;const clipped={left:Math.max(v.left,content.left),top:Math.max(v.top,content.top),right:Math.min(v.right,content.right),bottom:Math.min(v.bottom,content.bottom),width:0,height:0};const higher=Array.from(canvas.querySelectorAll<HTMLElement>('.canvas-card')).filter(other=>other!==card&&Number(other.style.zIndex)>level).map(other=>other.getBoundingClientRect()),reserved=Array.from(viewport.parentElement?.querySelectorAll<HTMLElement>('[data-app-panel-occlusion]')??[]).map(item=>item.getBoundingClientRect());return{...appPanelGeometry(node.getBoundingClientRect(),clipped,current.current.workspaceActive,current.current.obscured,grip,higher,v.right,v.left,reserved),stackingRank:level}}
   function fit(info:AppPanelInfo){const c=current.current,card=node.closest('.canvas-card')!.getBoundingClientRect(),r=node.getBoundingClientRect(),frameWidth=Math.max(0,card.width-r.width),frameHeight=Math.max(0,card.height-r.height),canvas=node.closest('.workspace-canvas') as HTMLElement;
    const patch=appPanelFit(c.widget,info,frameWidth,frameHeight);
    if(patch.placement)patch.placement=constrainPlacement('apps',patch.placement,canvas.clientWidth,{width:c.widget.appMinWidth,height:c.widget.appMinHeight},canvas.clientHeight);
    if(Object.keys(patch).length)c.update(patch);
  }
  function invalidate(forceClear=false){revision++;if(forceClear||presenting)last='';return revision}
  async function sync(){frame=0;if(disposed||!opened)return;if(scrolling){dirty=true;return}if(presenting){dirty=true;return}presenting=true;let requestRevision=revision;
    try{const g=geometry(),next=JSON.stringify(g);requestRevision=revision;if(next!==last){const info=await appPanel.present(widget.id,g.bounds,g.clip,g.grip,g.occlusions??[],g.visible&&!scrolling,g.stackingRank,requestRevision,g.viewportRight);if(disposed||requestRevision!==revision)return;last=next;node.dataset.nativeVisible=String(info.shown);if(g.visible&&!scrolling&&info.probing){last='';schedule.current()}else if(g.visible&&!scrolling&&info.measured)fit(info)}}
   catch(reason){if(!disposed&&opened&&requestRevision===revision){setError(String(reason));node.dataset.nativeVisible='false';if(String(reason).includes('closed')){opened=false;setReady(false);current.current.update({appPanelOpen:false})}}}
   finally{presenting=false;if(dirty){dirty=false;schedule.current()}}
  }
  schedule.current=()=>{if(disposed)return;invalidate();if(!frame)frame=requestAnimationFrame(()=>void sync())};
  launch.current=async()=>{
   const c=current.current;if(disposed||opened||launching||c.appAttachment||!c.widget.appKey||!c.workspaceActive||c.obscured)return false;
   launching=true;setOpening(true);setRelaunchFailed(false);setError('');
   try{const g=geometry(),info=await appPanel.open(widget.id,c.widget.appKey,g.bounds,g.clip,g.grip,c.widget.appReuseExisting);if(disposed)return false;if(info.openedExternally){setExternalOpened(true);setReady(false);current.current.update({appPanelOpen:false});current.current.notify(current.current.t('chromeOpenedSeparately'));current.current.appOpenResult?.(widget.id,true);return true}opened=true;last='';setExternalOpened(false);setReady(true);fit(info);schedule.current();current.current.appOpenResult?.(widget.id,true);return true}
   catch(reason){if(!disposed){const message=String(reason);setError(message);setRelaunchFailed(true);current.current.update({appPanelOpen:false});current.current.appOpenResult?.(widget.id,false,message)}return false}finally{launching=false;if(!disposed)setOpening(false)}
  };
  resume.current=async()=>{
   if(disposed||opened||launching)return false;launching=true;setOpening(true);setError('');
   try{const info=await appPanel.resume(widget.id);if(disposed)return false;opened=true;last='';setCollectionResumed(true);setReady(true);setRelaunchFailed(false);current.current.update({appPanelOpen:true,appWasCollected:false});fit(info);schedule.current();return true}
   catch(reason){if(!disposed){setCollectionResumed(false);setError(String(reason))}return false}finally{launching=false;if(!disposed)setOpening(false)}
  };
  attach.current=async(window:AppAttachment)=>{
   const c=current.current;if(disposed||launching||!c.workspaceActive||c.obscured)return false;launching=true;setOpening(true);setError('');
   try{if(opened){opened=false;last='';setReady(false);await appPanel.release(widget.id)}const g=geometry(),info=await appPanel.attach(widget.id,window,g.bounds,g.clip,g.grip);if(disposed)return false;opened=true;last='';setReady(true);setRelaunchFailed(false);current.current.update({appPanelOpen:true,appWasCollected:false});fit(info);schedule.current();current.current.appOpenResult?.(widget.id,true);return true}
   catch(reason){if(!disposed){const message=String(reason);setError(message);current.current.update({appPanelOpen:false});current.current.appOpenResult?.(widget.id,false,message);if(window.capture&&!current.current.appOpenResult)current.current.notify('Window attachment failed: '+message)}return false}finally{launching=false;c.appAttachmentHandled?.();if(!disposed)setOpening(false)}
  };
  detach.current=async()=>{if(!opened&&!launching)return;opened=false;last='';setCollectionResumed(false);node.dataset.nativeVisible='false';try{await appPanel.release(widget.id);if(!disposed){setReady(false);setError('');current.current.update({appWasCollected:false})}}catch(reason){if(!disposed)setError(String(reason))}};
  relaunch.current=async()=>{
   if(disposed||launching)return;setError('');
   try{
    const identity=await appPanel.identity(widget.id);if(disposed)return;
    if(identity){opened=true;last='';setReady(true);setRelaunchFailed(false);current.current.update({appPanelOpen:true,appWasCollected:false});current.current.onRelaunchStatus?.(false);schedule.current();return}
    opened=false;setReady(false);node.dataset.nativeVisible='false';const c=current.current;
    let reopened=false;
    if(c.widget.appWasCollected||collectionResumed)reopened=await resume.current();
    else if(c.appAttachment)reopened=await attach.current(c.appAttachment);
    else if(c.widget.appKey){c.update({appPanelOpen:true});reopened=await launch.current()}
    else{setRelaunchFailed(true);setError('The attached app window is no longer available. Reattach it from Apps.')}
    current.current.onRelaunchStatus?.(!reopened);
   }catch(reason){if(!disposed){setRelaunchFailed(true);setError(String(reason));current.current.onRelaunchStatus?.(true)}}
  };
  const resize=new ResizeObserver(schedule.current);resize.observe(node);resize.observe(viewport);
  const mutation=new MutationObserver(schedule.current);mutation.observe(viewport.parentElement??canvas,{subtree:true,attributes:true,attributeFilter:['style','class'],childList:true});
  stopScroll=observeCanvasScroll(viewport,value=>{scrolling=value;if(value){invalidate(true);if(frame){cancelAnimationFrame(frame);frame=0}dirty=true;const g=geometry(),hideRevision=revision;void appPanel.present(widget.id,g.bounds,g.clip,g.grip,g.occlusions??[],false,g.stackingRank,hideRevision,g.viewportRight).then(info=>{if(!disposed&&hideRevision===revision)node.dataset.nativeVisible=String(info.shown)}).catch(()=>undefined)}else{dirty=false;schedule.current()}});
  const scroll=()=>schedule.current();window.addEventListener('resize',scroll);
  const dragFinished=(event:Event)=>{if((event as CustomEvent<{id:string}>).detail?.id===widget.id)schedule.current()};window.addEventListener('still-app-panel-drag-finished',dragFinished);
  void appPanel.subscribe(event=>{if(disposed||event.id!==widget.id)return;if(!event.open){opened=false;last='';setReady(false);setCollectionResumed(false);setRelaunchFailed(false);node.dataset.nativeVisible='false';current.current.update({appPanelOpen:false,appWasCollected:false});setError('The app was closed. Open it in the panel again.')}else if(event.error!==undefined)setError(event.error??'')}).then(unlisten=>{if(disposed)unlisten();else{stop=unlisten;const c=current.current;if(shouldResumeCollection)void resume.current();else if(c.appAttachment)void attach.current(c.appAttachment);else if(c.widget.appPanelOpen&&c.workspaceActive)void launch.current()}}).catch(reason=>{if(!disposed)setError(String(reason))});
  return()=>{disposed=true;relaunch.current=async()=>{};invalidate();cancelAnimationFrame(frame);resize.disconnect();mutation.disconnect();window.removeEventListener('resize',scroll);window.removeEventListener('still-app-panel-drag-finished',dragFinished);stopScroll?.();stop?.();if(!appPanel.isCollectionRetained(widget.id))void appPanel.release(widget.id).catch(()=>undefined)};
 },[widget.id,widget.appKey]);
 useEffect(()=>{if(relaunchToken>0)void relaunch.current()},[relaunchToken]);
 useEffect(()=>{schedule.current();if(appAttachment&&workspaceActive&&!obscured)void attach.current(appAttachment);else if(widget.appPanelOpen&&workspaceActive&&!obscured)void launch.current();else if(!widget.appPanelOpen&&!collectionResumed)void detach.current()},[appAttachment,widget.appPanelOpen,workspaceActive,obscured,widget.placement,collectionResumed]);
 return <div className="app-panel">
  <input ref={picker} aria-label={t('chooseAppShortcut')} type="file" accept=".exe,.lnk" hidden onChange={e=>{try{const result=previewFileDrop(Array.from(e.target.files??[]));if(result.entries[0])selected(result.entries[0]);else setError(result.errors.join(' '))}catch(reason){setError(String(reason))}e.target.value=''}}/>
  {error&&<p className="widget-error" role="alert">{error}</p>}
  <div ref={host} className="app-panel-host" data-native-app-id={appPanel.available&&ready?widget.id:undefined}>
   <div className="app-panel-placeholder">{widget.appIconData?<img className="app-panel-app-icon" src={widget.appIconData} alt={widget.appName?t('appLogo')+' '+widget.appName:''}/>:<span className="document-type-symbol type-app"><Icon name="apps"/></span>}<h2>{opening?t('openingAppInPanel'):ready?widget.appName+' · '+t('attached'):externalOpened?t('openedInChrome'):widget.appName||t('yourDesktopApps')}</h2>
    <p>{externalOpened?t('chromeOutsideStill'):!widget.appKey?t('attachOpenAppHelp'):!appPanel.available?t('realAppWindowsOnly'):ready?t('appFollowsWidget'):t('openRealAppInWidget')}</p>
    {!ready&&(widget.appWasCollected||(!widget.appKey&&widget.appName))&&<button disabled={opening||busy} onClick={()=>pickApp?.()}>{t('reattachOpenApp')}</button>}
    {!ready&&<button disabled={opening||busy} onClick={()=>void choose()}>{widget.appKey?t('changeApp'):t('chooseApp')}</button>}
   {widget.appKey&&!ready&&!opening&&!widget.appPanelOpen&&<button className={'primary'+(relaunchFailed?' app-panel-relaunch-failed':'')} aria-invalid={relaunchFailed||undefined} aria-label={externalOpened?t('chooseAnotherChromeProfile'):t('reopenAppInWidget')+' '+widget.appName} disabled={busy||!appPanel.available} onClick={()=>{update({appPanelOpen:true});void launch.current()}}>{externalOpened?t('chooseChromeProfile'):relaunchFailed?t('retryOpeningApp'):t('reopenAppInWidget')}</button>}
   </div>
  </div>
 </div>;
}
