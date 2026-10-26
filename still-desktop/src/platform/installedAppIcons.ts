import {appIconData} from '../domain/appPicker.ts';
import {appPanel} from './appPanel.ts';

type LoadedIcon={url:string|undefined};
const cache=new Map<string,Promise<LoadedIcon>>();
const queue:Array<()=>void>=[];
let running=0;
const MAX_CONCURRENT=3, MAX_CACHED=128;
function pump(){while(running<MAX_CONCURRENT&&queue.length){running++;queue.shift()!()}}

/** Load only visible icons, with a bounded number of native requests in flight. */
export function loadInstalledAppIcon(id:string):Promise<LoadedIcon>{
 const cached=cache.get(id);if(cached)return cached;
 const task=new Promise<LoadedIcon>(resolve=>{
  queue.push(()=>{void Promise.resolve().then(()=>appPanel.installedIcon(id)).then(bytes=>resolve({url:appIconData(bytes)})).catch(()=>resolve({url:undefined})).finally(()=>{running--;pump()})});
 });
 cache.set(id,task);
 if(cache.size>MAX_CACHED){const oldest=cache.keys().next().value;if(oldest!==undefined&&oldest!==id)cache.delete(oldest)}
 void task.then(result=>{if(!result.url&&cache.get(id)===task)cache.delete(id)});
 pump();return task;
}
