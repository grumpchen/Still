import {useState} from 'react';
import type {Workspace} from './domain/workspaces.ts';
import type {WebShortcut} from './domain/webShortcuts.ts';
import {executeCollectionOperation} from './platform/collectionOperations.ts';
import type {CollectionLinkOrigin} from './domain/collectionOperations.ts';
import {Icon} from './Icon.tsx';
import {useLocale,useT} from './localization.tsx';
import {chromeLauncher} from './platform/chrome.ts';
export interface LibraryLink extends WebShortcut {workspaceId:string;workspaceName:string;groupName:string;origin?:CollectionLinkOrigin}
type Props={links:LibraryLink[];workspaces:Workspace[];workspaceActive:boolean;openLink:(workspaceId:string,link:WebShortcut)=>void;notify:(message:string)=>void};
type Editing={key:string;mode:'rename'|'url'|'move';name:string;url:string;destination:string};
const keyOf=(link:LibraryLink)=>`${link.workspaceId}:${link.origin?.kind==='browser'?link.origin.widgetId:link.origin?.kind==='group'?link.origin.groupId:link.groupName}:${link.id}`;
const isBrowserShortcutWidget=(owner:Workspace,widgetId:string)=>{const widget=owner.widgets.find(item=>item.id===widgetId);if(!widget)return false;const kind=String(widget.type);return kind==='browser'||kind==='group'&&!owner.groups.some(group=>group.id===(widget.groupId??widget.id))};
export default function LibraryLinksPanel({links,workspaces,workspaceActive,openLink,notify}:Props){
 const t=useT(),zh=useLocale()==='zh-CN',[editing,setEditing]=useState<Editing|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const copy=(en:string,cn:string)=>zh?cn:en;
 const destinations=workspaces.filter(owner=>owner.role!=='library').flatMap(owner=>[
  <option key={`${owner.id}|`} value={`${owner.id}|`}>{owner.name} · {copy('Saved links (create if needed)','收藏（如无则创建）')}</option>,
  ...owner.groups.map(group=><option key={`${owner.id}|${group.id}`} value={`${owner.id}|${group.id}`}>{owner.name} · {group.name||copy('Group','分组')}</option>)
 ]);
 function target(link:LibraryLink):CollectionLinkOrigin|null{const owner=workspaces.find(item=>item.id===link.workspaceId),origin=link.origin;if(!owner)return null;if(origin?.kind==='group'&&owner.groups.some(group=>group.id===origin.groupId&&group.shortcuts.some(saved=>saved.id===link.id)))return origin;if(origin?.kind==='browser'&&isBrowserShortcutWidget(owner,origin.widgetId)&&owner.widgets.some(widget=>widget.id===origin.widgetId&&widget.shortcuts.some(saved=>saved.id===link.id)))return origin;const group=owner.groups.find(item=>item.shortcuts.some(saved=>saved.id===link.id));if(group)return{kind:'group',workspaceId:owner.id,groupId:group.id};const widget=owner.widgets.find(item=>isBrowserShortcutWidget(owner,item.id)&&item.shortcuts.some(saved=>saved.id===link.id));return widget?{kind:'browser',workspaceId:owner.id,widgetId:widget.id}:null}
 function open(link:LibraryLink){if(target(link)?.kind==='browser'){void chromeLauncher.open(link.url).catch(reason=>notify(String(reason)));return}openLink(link.workspaceId,link)}
 function begin(link:LibraryLink,mode:Editing['mode']){setError('');setEditing({key:keyOf(link),mode,name:link.name,url:link.url,destination:''})}
 async function save(link:LibraryLink){if(!editing||editing.key!==keyOf(link)||busy)return;const source=target(link);if(!source){setError(copy('This saved link no longer belongs to its Group.','此链接已不在原分组中。'));return}setBusy(true);setError('');try{
  const [destinationWorkspaceId,destinationGroupId]=editing.destination.split('|');
  const request=editing.mode==='rename'?{type:'link.rename' as const,origin:source,linkId:link.id,name:editing.name}:editing.mode==='url'?{type:'link.editUrl' as const,origin:source,linkId:link.id,url:editing.url}:{type:'link.move' as const,origin:source,linkId:link.id,destinationWorkspaceId,destinationGroupId:destinationGroupId||undefined};
  const result=await executeCollectionOperation(request,{source:'manual'});if(result.status!=='succeeded')throw new Error(result.summary);notify(result.summary);setEditing(null);
 }catch(reason){setError(reason instanceof Error?reason.message:String(reason))}finally{setBusy(false)}}
 async function remove(link:LibraryLink){const source=target(link);if(!source){setError(copy('This saved link no longer belongs to its source.','此链接已不在原来源中。'));return}setBusy(true);setError('');try{const result=await executeCollectionOperation({type:'link.delete',origin:source,linkId:link.id},{source:'manual'});if(result.status!=='succeeded')throw new Error(result.summary);notify(result.summary)}catch(reason){setError(reason instanceof Error?reason.message:String(reason))}finally{setBusy(false)}}
 return <div className="library-recent-list library-link-list" aria-label={t('savedStudyLinks')}>
  {error&&<p className="library-search-notice" role="alert">{error}</p>}
  {workspaceActive&&links.length?links.map(link=>{const key=keyOf(link),current=editing?.key===key;return <article key={key} className="library-link-card"><div className="library-link-row"><span className="library-recent-icon"><Icon name="browser"/></span><button type="button" className="library-recent-copy" title={link.url} onClick={()=>open(link)}><strong>{link.name}</strong><small>{link.workspaceName} · {link.groupName} · {link.url}</small></button><button type="button" disabled={busy} onClick={()=>begin(link,'rename')}>{copy('Rename','重命名')}</button><button type="button" disabled={busy} onClick={()=>begin(link,'url')}>{copy('Edit URL','编辑网址')}</button><button type="button" disabled={busy} onClick={()=>begin(link,'move')}>{copy('Move','移动')}</button><button type="button" className="library-link-delete" disabled={busy} onClick={()=>void remove(link)}>{copy('Remove saved link','移除保存的链接')}</button></div>
   {current&&<div className="library-link-edit"><label>{editing.mode==='rename'?copy('Link name','链接名称'):editing.mode==='url'?'URL':copy('Destination course and Group','目标课程和分组')}{editing.mode==='rename'?<input value={editing.name} maxLength={60} onChange={event=>setEditing({...editing,name:event.target.value})}/>:editing.mode==='url'?<input value={editing.url} maxLength={2048} onChange={event=>setEditing({...editing,url:event.target.value})}/>:<select value={editing.destination} onChange={event=>setEditing({...editing,destination:event.target.value})}><option value="">{copy('Choose destination…','选择目标…')}</option>{destinations}</select>}</label><button type="button" disabled={busy||editing.mode==='rename'&&!editing.name.trim()||editing.mode==='url'&&!editing.url.trim()||editing.mode==='move'&&!editing.destination} onClick={()=>void save(link)}>{t('save')}</button><button type="button" disabled={busy} onClick={()=>setEditing(null)}>{t('cancel')}</button></div>}
  </article>}):<div className="library-empty-state"><Icon name="browser"/><p>{t('noSavedStudyLinks')}</p></div>}
 </div>;
}
