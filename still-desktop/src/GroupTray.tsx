import {TrayDragButton} from './TrayDragButton.tsx';
import {Icon} from './widgets.tsx';
import type {SavedGroup,GroupWidgetEntry} from './domain/workspaces.ts';
import type {WebShortcut} from './domain/webShortcuts.ts';
import type {GroupEditMode} from './GroupEditor.tsx';

interface Props {groups:SavedGroup[];update:(id:string,patch:Partial<Omit<SavedGroup,'id'>>)=>void;openGroup:(id:string)=>void;openLink:(link:WebShortcut)=>void;openWidget:(entry:GroupWidgetEntry)=>void;edit:(id:string,mode:GroupEditMode)=>void;remove:(id:string)=>void}
export function GroupTrayButtons({groups,update}:Pick<Props,'groups'|'update'>){
 return <>{groups.map(group=><TrayDragButton key={group.id} dragPayload={{kind:'group',id:group.id}} className="tray-group-button" aria-label={(group.expanded?'Collapse ':'Expand ')+(group.name||'Group')+' group'} aria-expanded={group.expanded} aria-controls={'tray-group-'+group.id} onClick={()=>update(group.id,{expanded:!group.expanded})}><Icon name="group"/><span>{group.name||'Group'}</span><small>{group.shortcuts.length+group.widgets.length}</small><span aria-hidden="true">{group.expanded?'▴':'▾'}</span></TrayDragButton>)}</>;
}
export default function GroupTray({groups,update,openGroup,openLink,openWidget,edit,remove}:Props){
 return <div className="tray-group-shelves">{groups.filter(g=>g.expanded).map(group=><section className="tray-group-shelf" id={'tray-group-'+group.id} key={group.id} aria-label={(group.name||'Group')+' group items'}>
  <div className="tray-group-heading"><strong>{group.name||'Group'}</strong><button onClick={()=>edit(group.id,undefined)} aria-label={'Edit '+(group.name||'Group')+' group'}>Edit</button><button onClick={()=>openGroup(group.id)}>Open group</button><button className="tray-group-close" onClick={()=>update(group.id,{expanded:false})} aria-label={'Collapse '+(group.name||'Group')+' group items'}>▴</button></div>
  <div className="tray-group-entries">
   {group.shortcuts.map(item=><TrayDragButton key={item.id} dragPayload={{kind:'group-entry',groupId:group.id,id:item.id,entryKind:'link'}} title={item.url} aria-label={'Open '+item.name+' from '+(group.name||'Group')} onClick={()=>openLink(item)}><span className="tray-entry-icon">{item.icon}</span>{item.name}</TrayDragButton>)}
   {group.widgets.map(item=><TrayDragButton key={item.id} dragPayload={{kind:'group-entry',groupId:group.id,id:item.id,entryKind:'widget'}} aria-label={'Add '+item.name+' from '+(group.name||'Group')} onClick={()=>openWidget(item)}><span className="tray-entry-icon">{item.icon}</span>{item.name}</TrayDragButton>)}
   <button className="tray-group-add" onClick={()=>edit(group.id,'widget')}>+ Add widget</button><button className="tray-group-add" onClick={()=>edit(group.id,'link')}>+ Add link</button>
  </div>
  <button className="tray-group-remove" onClick={()=>remove(group.id)}>Remove group</button>
 </section>)}</div>;
}
