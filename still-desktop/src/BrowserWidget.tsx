import {useEffect,useRef,useState} from 'react';
import {Icon,type WidgetProps} from './widgets.tsx';
import {overlayVisible} from './domain/chromeOverlay.ts';
import {chromePanel} from './platform/chromePanel.ts';
import {chromeLauncher} from './platform/chrome.ts';

export default function BrowserWidget({widget,obscured,workspaceActive=true,lecture}:WidgetProps){
 const host=useRef<HTMLDivElement>(null),current=useRef({widget,obscured,workspaceActive});current.current={widget,obscured,workspaceActive};
 const [ready,setReady]=useState(false),[opening,setOpening]=useState(false),[error,setError]=useState('');
 const schedule=useRef<()=>void>(()=>{}),launch=useRef<()=>Promise<void>>(async()=>{});
 useEffect(()=>{
  if(!chromePanel.available)return;
  let disposed=false,frame=0,stop:(()=>void)|undefined,opened=false,launching=false,busy=false,dirty=false,last='';
  const node=host.current!,viewport=node.closest('.canvas-viewport') as HTMLElement,canvas=node.closest('.workspace-canvas')!;
  function rectangle(){const r=node.getBoundingClientRect();return{x:Math.max(0,r.x),y:Math.max(0,r.y),width:Math.max(1,r.width),height:Math.max(1,r.height)}}
  async function sync(){frame=0;if(disposed||!opened)return;if(busy){dirty=true;return}busy=true;
   try{
    const r=node.getBoundingClientRect(),outer=viewport.getBoundingClientRect(),content=node.closest('.widget-content')!.getBoundingClientRect(),card=node.closest('.canvas-card') as HTMLElement,level=Number(card.style.zIndex);
    const v={left:Math.max(outer.left,content.left),right:Math.min(outer.right,content.right),top:Math.max(outer.top,content.top),bottom:Math.min(outer.bottom,content.bottom)};
    const overlap=Array.from(canvas.querySelectorAll<HTMLElement>('.canvas-card')).some(other=>{if(other===card||Number(other.style.zIndex)<=level)return false;const b=other.getBoundingClientRect();return b.left<r.right&&b.right>r.left&&b.top<r.bottom&&b.bottom>r.top});
    const show=overlayVisible(r,v,current.current.workspaceActive,current.current.obscured,overlap),bounds=rectangle(),next=JSON.stringify({show,bounds});
    if(next!==last){await chromePanel.present(widget.id,bounds,show);last=next;node.dataset.nativeVisible=String(show)}
   }catch(e){if(!disposed){setError(String(e));node.dataset.nativeVisible='false';if(String(e).includes('closed')){opened=false;last='';setReady(false)}}}finally{busy=false;if(dirty){dirty=false;schedule.current()}}
  }
  schedule.current=()=>{if(!disposed&&!frame)frame=requestAnimationFrame(()=>void sync())};
  launch.current=async()=>{
   if(disposed||busy||opened||launching)return;launching=true;setOpening(true);setError('');
   try{await chromePanel.open(widget.id,current.current.widget.url,rectangle());if(disposed)return;opened=true;last='';setReady(true);schedule.current()}
   catch(e){if(!disposed)setError(String(e))}finally{launching=false;if(!disposed)setOpening(false)}
  };
  const resize=new ResizeObserver(schedule.current);resize.observe(node);resize.observe(viewport);
  const mutation=new MutationObserver(schedule.current);mutation.observe(canvas,{subtree:true,attributes:true,attributeFilter:['style','class'],childList:true});
  const scroll=()=>schedule.current();canvas.addEventListener('scroll',scroll,true);viewport.addEventListener('scroll',scroll,{passive:true});window.addEventListener('resize',scroll);
  void chromePanel.subscribe(event=>{if(disposed||event.id!==widget.id)return;if(!event.open){opened=false;last='';setReady(false);node.dataset.nativeVisible='false';setError('Chrome was closed. Reopen it below.')}}).then(unlisten=>{if(disposed)unlisten();else{stop=unlisten;void launch.current()}}).catch(e=>{if(!disposed)setError(String(e))});
  return()=>{disposed=true;cancelAnimationFrame(frame);resize.disconnect();mutation.disconnect();canvas.removeEventListener('scroll',scroll,true);viewport.removeEventListener('scroll',scroll);window.removeEventListener('resize',scroll);stop?.();void chromePanel.close(widget.id).catch(()=>undefined)};
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
