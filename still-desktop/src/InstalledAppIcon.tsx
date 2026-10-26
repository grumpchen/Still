import {useEffect,useRef,useState} from 'react';
import {Icon} from './Icon.tsx';
import {loadInstalledAppIcon} from './platform/installedAppIcons.ts';

export function InstalledAppIcon({id,className}:{id:string;className:string}){
 const ref=useRef<HTMLSpanElement>(null),[url,setUrl]=useState<string>();
 useEffect(()=>{let cancelled=false,started=false;setUrl(undefined);
  const load=()=>{if(started)return;started=true;void loadInstalledAppIcon(id).then(result=>{if(!cancelled)setUrl(result.url)})};
  const node=ref.current;if(!node)return;
  const observer=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){observer?.disconnect();load()}},{rootMargin:'100px'});
  if(observer)observer.observe(node);else load();
  return()=>{cancelled=true;observer?.disconnect()};
 },[id]);
 return <span ref={ref} className={className} style={{display:'grid',placeItems:'center',overflow:'hidden',background:url?'transparent':undefined}}>{url?<img src={url} alt="" style={{width:'100%',height:'100%',objectFit:'contain'}}/>:<Icon name="apps"/>}</span>;
}
