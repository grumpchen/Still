import {TrayDragButton,trayFocusIntoView} from './TrayDragButton.tsx';
import {Icon} from './widgets.tsx';
import type {SavedGroup,GroupWidgetEntry} from './domain/workspaces.ts';
import type {WebShortcut} from './domain/webShortcuts.ts';
import type {GroupEditMode} from './GroupEditor.tsx';

interface Props {groups:SavedGroup[];update:(id:string,patch:Partial<Omit<SavedGroup,'id'>>)=>void;openGroup:(id:string)=>void;openLink:(link:WebShortcut)=>void;openWidget:(entry:GroupWidgetEntry)=>void;edit:(id:string,mode:GroupEditMode)=>void;remove:(id:string)=>void;activeDropGroupId?:string|null}
export default function GroupTray({groups,update,openGroup,openLink,openWidget,edit,remove,activeDropGroupId}:Props){
 return <>{groups.map(group=><div className="tray-group-inline" key={group.id}>
  <TrayDragButton dragPayload={{kind:'group',id:group.id}} data-group-drop-target="existing" data-group-id={group.id} className={'tray-group-button '+(activeDropGroupId===group.id?'tray-save-target':'')} onFocus={trayFocusIntoView} aria-label={(group.expanded?'Collapse ':'Expand ')+(group.name||'Group')+' group'} aria-expanded={group.expanded} aria-controls={'tray-group-'+group.id} onClick={()=>update(group.id,{expanded:!group.expanded})}><Icon name="group"/><span>{group.name||'Group'}</span><small>{group.shortcuts.length+group.widgets.length}</small><span aria-hidden="true">{group.expanded?'‹':'›'}</span></TrayDragButton>
  {group.expanded&&<section className={'tray-group-inline-contents '+(activeDropGroupId===group.id?'tray-save-target':'')} id={'tray-group-'+group.id} data-group-drop-target="existing" data-group-id={group.id} aria-label={(group.name||'Group')+' group items'}>
   <strong className="tray-group-inline-title">{group.name||'Group'}</strong>
   {group.shortcuts.map(item=><TrayDragButton key={item.id} dragPayload={{kind:'group-entry',groupId:group.id,id:item.id,entryKind:'link'}} onFocus={trayFocusIntoView} title={item.url} aria-label={'Open '+item.name+' from '+(group.name||'Group')} onClick={()=>openLink(item)}><span className="tray-entry-icon">{item.icon}</span>{item.name}</TrayDragButton>)}
   {group.widgets.map(item=><TrayDragButton key={item.id} dragPayload={{kind:'group-entry',groupId:group.id,id:item.id,entryKind:'widget'}} onFocus={trayFocusIntoView} aria-label={'Add '+item.name+' from '+(group.name||'Group')} onClick={()=>openWidget(item)}>{item.iconData?<img className="tray-entry-image" src={item.iconData} alt=""/>:<span className="tray-entry-icon">{item.icon}</span>}{item.name}</TrayDragButton>)}
   <button className="tray-group-add" onFocus={trayFocusIntoView} onClick={()=>edit(group.id,'widget')}>+ Add widget</button><button className="tray-group-add" onFocus={trayFocusIntoView} onClick={()=>edit(group.id,'link')}>+ Add link</button>
   <button onFocus={trayFocusIntoView} onClick={()=>edit(group.id,undefined)} aria-label={'Edit '+(group.name||'Group')+' group'}>Edit</button><button onFocus={trayFocusIntoView} onClick={()=>openGroup(group.id)}>Open group</button><button onFocus={trayFocusIntoView} onClick={()=>remove(group.id)}>Remove group</button>
   <button className="tray-group-close" onFocus={trayFocusIntoView} onClick={()=>update(group.id,{expanded:false})} aria-label={'Collapse '+(group.name||'Group')+' group items'}>▴</button>
  </section>}
 </div>)}</>;
}
