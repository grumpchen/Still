import {useEffect,useRef,useState} from 'react';
import {Icon,type WidgetProps} from './widgets.tsx';
import {chromeClipGeometry} from './domain/chromeOverlay.ts';
import {chromePanel} from './platform/chromePanel.ts';
import {chromeLauncher} from './platform/chrome.ts';
import {observeCanvasScroll} from './platform/canvasScroll.ts';

export default function BrowserWidget({widget,obscured,workspaceActive=true,lecture}:WidgetProps){
 const host=useRef<HTMLDivElement>(null),current=useRef({widget,obscured,workspaceActive});current.current={widget,obscured,workspaceActive};
 const [ready,setReady]=useState(false),[opening,setOpening]=useState(false),[error,setError]=useState('');
 const schedule=useRef<()=>void>(()=>{}),launch=useRef<()=>Promise<void>>(async()=>{});
 useEffect(()=>{
  if(!chromePanel.available)return;
  let disposed=false,frame=0,stop:(()=>void)|undefined,stopScroll:(()=>void)|undefined,opened=false,launching=false,busy=false,dirty=false,scrolling=false,last='',revision=0;
  const node=host.current!,viewport=node.closest('.canvas-viewport') as HTMLElement,canvas=node.closest('.workspace-canvas')!;
   function rectangle(){const r=node.getBoundingClientRect();return{x:r.x,y:r.y,width:Math.max(1,r.width),height:Math.max(1,r.height)}}
   function geometry(){
    const r=node.getBoundingClientRect(),v=viewport.getBoundingClientRect(),content=node.closest('.widget-content')!.getBoundingClientRect(),card=node.closest('.canvas-card') as HTMLElement,level=Number(card.style.zIndex);
    const higher=Array.from(canvas.querySelectorAll<HTMLElement>('.canvas-card')).filter(other=>other!==card&&Number(other.style.zIndex)>level).map(other=>other.getBoundingClientRect());
    return{...chromeClipGeometry(r,v,content,higher,current.current.workspaceActive,current.current.obscured),stackingRank:level};
   }
   function invalidate(forceClear=false){revision++;if(forceClear||busy)last='';return revision}
   async function sync(){frame=0;if(disposed||!opened)return;if(scrolling||busy){dirty=true;return}busy=true;let requestRevision=revision;
    try{
     const g=geometry(),next=JSON.stringify(g);requestRevision=revision;
     if(next!==last){const shown=await chromePanel.present(widget.id,g.bounds,g.clip,g.occlusions,g.visible,g.stackingRank,requestRevision);if(disposed||requestRevision!==revision)return;last=next;node.dataset.nativeVisible=String(shown)}
   }catch(e){if(!disposed&&requestRevision===revision){setError(String(e));node.dataset.nativeVisible='false';if(String(e).includes('closed')){opened=false;last='';setReady(false)}}}finally{busy=false;if(dirty){dirty=false;schedule.current()}}
  }
  schedule.current=()=>{if(disposed)return;invalidate();if(!frame)frame=requestAnimationFrame(()=>void sync())};
  launch.current=async()=>{
   if(disposed||busy||opened||launching)return;launching=true;setOpening(true);setError('');
   try{await chromePanel.open(widget.id,current.current.widget.url,rectangle());if(disposed)return;opened=true;last='';setReady(true);schedule.current()}
   catch(e){if(!disposed)setError(String(e))}finally{launching=false;if(!disposed)setOpening(false)}
  };
  const resize=new ResizeObserver(schedule.current);resize.observe(node);resize.observe(viewport);
  const mutation=new MutationObserver(schedule.current);mutation.observe(canvas,{subtree:true,attributes:true,attributeFilter:['style','class'],childList:true});
  stopScroll=observeCanvasScroll(viewport,value=>{scrolling=value;if(value){invalidate(true);if(frame){cancelAnimationFrame(frame);frame=0}dirty=true;const g=geometry(),hideRevision=revision;void chromePanel.present(widget.id,g.bounds,g.clip,g.occlusions,false,g.stackingRank,hideRevision).then(shown=>{if(!disposed&&hideRevision===revision)node.dataset.nativeVisible=String(shown)}).catch(()=>undefined)}else{dirty=false;schedule.current()}},120);
  const scroll=()=>schedule.current();window.addEventListener('resize',scroll);
  void chromePanel.subscribe(event=>{if(disposed||event.id!==widget.id)return;if(!event.open){opened=false;last='';setReady(false);node.dataset.nativeVisible='false';setError('Chrome was closed. Reopen it below.')}}).then(unlisten=>{if(disposed)unlisten();else{stop=unlisten;void launch.current()}}).catch(e=>{if(!disposed)setError(String(e))});
  return()=>{disposed=true;invalidate();cancelAnimationFrame(frame);resize.disconnect();mutation.disconnect();window.removeEventListener('resize',scroll);stopScroll?.();stop?.();void chromePanel.close(widget.id).catch(()=>undefined)};
 },[widget.id]);
 useEffect(()=>{schedule.current()},[workspaceActive,obscured,widget.placement,error]);
 return <div className="embedded-browser chrome-panel">
  <div className="browser-tools browser-main-tools"><span>Google Chrome</span>
   <button className="lecture-button" aria-pressed={!!widget.lectureRestore} onClick={()=>lecture?.()} title="Use 80% of the visible workspace, or restore the previous size">{widget.lectureRestore?'Restore size':'Lecture · 80%'}</button>
  </div>
  {error&&<p className="widget-error" role="alert">{error}</p>}
  <div ref={host} className="browser-host" data-native-browser-id={chromePanel.available?widget.id:undefined} data-chrome-overlay={chromePanel.available?'true':undefined}>
   <div className="browser-placeholder"><span className="site-symbol"><Icon name="browser"/></span><h2>{opening?'Opening Chrome…':ready?'Chrome, in your workspace.':widget.title||'Your real Chrome browser.'}</h2>
    <p>{ready?'Enlarge this panel to at least 500 × 220 and bring it fully into view. Keep other widgets clear of the browser area.':chromePanel.available?'Chrome provides tabs, bookmarks, extensions and sign-in.':'The Windows app opens a separate real Chrome window for this widget. This is a web preview.'}</p>
    {chromePanel.available&&!ready&&<button className="primary" disabled={opening} onClick={()=>void launch.current()}>{opening?'Opening…':'Reopen Chrome'}</button>}
    {!chromePanel.available&&<button className="button-link" onClick={()=>void chromeLauncher.open(widget.url).catch(e=>setError(String(e)))}>Open website in Chrome</button>}
   </div>
  </div>
  <div className="browser-status"><span>{chromePanel.available?(ready?'Google Chrome · Still profile':opening?'Starting Chrome…':'Chrome closed'):'Design preview'}</span><span>Resize ↘</span></div>
 </div>;
}
