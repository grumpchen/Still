import {useState} from 'react';
import type {Workspace,WidgetInstance} from './domain/workspaces.ts';
import {executeCollectionOperation} from './platform/collectionOperations.ts';
import {useLocale} from './localization.tsx';

type Props={widget:WidgetInstance;workspaces:Workspace[];notify:(message:string)=>void;onRemoved:()=>void};
export default function LibraryFileReferenceActions({widget,workspaces,notify,onRemoved}:Props){
 const zh=useLocale()==='zh-CN',[name,setName]=useState(widget.fileName||widget.title||''),[destination,setDestination]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const courses=workspaces.filter(item=>item.role==='study'||item.role==='custom'),copy=(en:string,cn:string)=>zh?cn:en;
 async function run(action:Parameters<typeof executeCollectionOperation>[0]){setBusy(true);setError('');try{const result=await executeCollectionOperation(action,{source:'manual'});if(result.status!=='succeeded')throw new Error(result.summary);notify(result.summary);return true}catch(reason){setError(reason instanceof Error?reason.message:String(reason));return false}finally{setBusy(false)}}
 async function rename(){if(!name.trim())return;if(await run({type:'file.renameReference',widgetId:widget.id,name}))setName(name.trim())}
 async function move(){if(!destination)return;if(await run({type:'file.moveReference',widgetId:widget.id,destinationWorkspaceId:destination}))setDestination('')}
 async function remove(){if(!window.confirm(copy('Remove this file shortcut from Still? The original file stays on disk.','从 Still 移除此文件快捷方式？原文件仍保留在磁盘上。')))return;if(await run({type:'file.deleteReference',widgetId:widget.id}))onRemoved()}
 return <div className="library-reference-toolbar">
  <label>{copy('Shortcut name','快捷方式名称')}<input value={name} maxLength={60} onChange={event=>setName(event.target.value)}/></label><button type="button" disabled={busy||!name.trim()||name.trim()===(widget.fileName||widget.title)} onClick={()=>void rename()}>{copy('Rename','重命名')}</button>
  <label>{copy('Move to course','移至课程')}<select value={destination} onChange={event=>setDestination(event.target.value)}><option value="">{copy('Choose course…','选择课程…')}</option>{courses.filter(item=>item.id!==workspaces.find(owner=>owner.widgets.some(candidate=>candidate.id===widget.id))?.id).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button type="button" disabled={busy||!destination} onClick={()=>void move()}>{copy('Move shortcut','移动快捷方式')}</button>
  <button type="button" disabled={busy} onClick={()=>void remove()}>{copy('Remove shortcut','移除快捷方式')}</button>{error&&<p role="alert">{error}</p>}
  <small>{copy('These actions change the Still shortcut only. The original file stays on disk.','这些操作只修改 Still 快捷方式，原文件仍保留在磁盘上。')}</small>
 </div>
}
