import {invoke,isTauri} from '@tauri-apps/api/core';
import {toBlob} from 'html-to-image';
export async function captureWidget(node:HTMLElement,copy:boolean,includeNativeApps=true,requireNativeApp=true):Promise<Blob> {
  if(isTauri()){
    const rect=node.getBoundingClientRect();
    if(rect.left<0||rect.top<0||rect.right>innerWidth||rect.bottom>innerHeight)throw new Error('Bring the whole widget into view before capturing it.');
    const hosts=includeNativeApps?[...node.querySelectorAll<HTMLElement>('[data-native-app-id]')]:[];
    for(const host of hosts)for(let attempt=0;attempt<30&&host.dataset.nativeVisible!=='true';attempt++)await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
    const visibleHosts=hosts.filter(host=>host.dataset.nativeVisible==='true');
    if(requireNativeApp&&hosts.length&&!visibleHosts.length)throw new Error('Let the app finish opening and bring the whole widget into view before capturing it.');
    const appRegions=visibleHosts.flatMap(host=>{
      const appRect=host.getBoundingClientRect();
      if(appRect.width<1||appRect.height<1||appRect.left<rect.left||appRect.top<rect.top||appRect.right>rect.right||appRect.bottom>rect.bottom)return [];
      return [{id:host.dataset.nativeAppId,x:appRect.x,y:appRect.y,width:appRect.width,height:appRect.height}];
    });
    if(appRegions.length>12)throw new Error('A screenshot can include up to 12 visible attached app panels at once.');
    const bytes=await invoke<number[]>('widget_capture',{bounds:{x:rect.x,y:rect.y,width:rect.width,height:rect.height,viewportWidth:innerWidth,viewportHeight:innerHeight},appRegions,copy});
    return new Blob([new Uint8Array(bytes)],{type:'image/png'});
  }
  if(node.querySelector('iframe'))throw new Error('Calculator screenshots require the Windows app. Web previews cannot capture a cross-site iframe.');
  const blob=await toBlob(node,{pixelRatio:2,backgroundColor:document.body.classList.contains('dark')?'#23342b':'#eef4ef',filter:el=>!(el instanceof HTMLElement&&el.hasAttribute('data-capture-ignore')),style:{position:'relative',left:'0',top:'0',transform:'none',animation:'none'}});
  if(!blob)throw new Error('Unable to capture this widget.');
  if(copy){if(!navigator.clipboard?.write || typeof ClipboardItem==='undefined')throw new Error('Clipboard access is unavailable. Use Export PNG instead.');await navigator.clipboard.write([new ClipboardItem({'image/png':blob})])}
  return blob;
}
export async function downloadCapture(blob:Blob,name:string):Promise<boolean>{
  if(isTauri())return invoke<boolean>('widget_export',{png:Array.from(new Uint8Array(await blob.arrayBuffer())),name});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name.replace(/[^a-z0-9 _-]/gi,'').trim()+'-'+Date.now()+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);return true;
}
