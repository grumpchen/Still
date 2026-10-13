import {TrayDragButton,trayFocusIntoView} from './TrayDragButton.tsx';
import {Icon} from './Icon.tsx';
import {widgetCatalog} from './domain/widgetCatalog.ts';
import type {SavedGroup,GroupWidgetEntry} from './domain/workspaces.ts';
import type {WebShortcut} from './domain/webShortcuts.ts';
import type {GroupEditMode} from './GroupEditor.tsx';

interface Props {groups:SavedGroup[];update:(id:string,patch:Partial<Omit<SavedGroup,'id'>>)=>void;openGroup:(id:string)=>void;openLink:(link:WebShortcut)=>void;openWidget:(entry:GroupWidgetEntry)=>void;edit:(id:string,mode:GroupEditMode)=>void;remove:(id:string)=>void;onContextMenu:(event:React.MouseEvent<HTMLButtonElement>,id:string)=>void;activeDropGroupId?:string|null}
export default function GroupTray({groups,update,openLink,openWidget,onContextMenu,activeDropGroupId}:Props){
 return <>{groups.map(group=><div className="tray-group-inline" key={group.id}>
  <TrayDragButton dragPayload={{kind:'group',id:group.id}} data-group-drop-target="existing" data-group-id={group.id} className={'tray-group-button '+(activeDropGroupId===group.id?'tray-save-target':'')} onContextMenu={event=>onContextMenu(event,group.id)} onFocus={trayFocusIntoView} aria-label={(group.expanded?'Collapse ':'Expand ')+(group.name||'Group')+' group'} title={(group.name||'Group')+' · '+(group.shortcuts.length+group.widgets.length)+' items'} aria-expanded={group.expanded} aria-controls={'tray-group-'+group.id} onClick={()=>update(group.id,{expanded:!group.expanded})}><Icon name="group"/><span>{group.name||'Group'}</span><small>{group.shortcuts.length+group.widgets.length}</small><span className="tray-group-chevron" aria-hidden="true"><Icon name="chevronRight"/></span></TrayDragButton>
  <section className={'tray-group-inline-contents '+(activeDropGroupId===group.id?'tray-save-target':'')} id={'tray-group-'+group.id} data-group-drop-target="existing" data-group-id={group.id} aria-label={(group.name||'Group')+' group items'} aria-hidden={!group.expanded} inert={!group.expanded}>
   {group.shortcuts.map(item=><TrayDragButton key={item.id} dragPayload={{kind:'group-entry',groupId:group.id,id:item.id,entryKind:'link'}} onFocus={trayFocusIntoView} title={item.url} aria-label={'Open '+item.name+' from '+(group.name||'Group')} onClick={()=>openLink(item)}><span className="tray-entry-icon">{item.icon}</span>{item.name}</TrayDragButton>)}
   {group.widgets.map(item=><TrayDragButton key={item.id} dragPayload={{kind:'group-entry',groupId:group.id,id:item.id,entryKind:'widget'}} onFocus={trayFocusIntoView} aria-label={item.kind==='collected'?'Restore '+item.name+' from '+(group.name||'Group'):'Add '+item.name+' from '+(group.name||'Group')} onClick={()=>openWidget(item)}>{item.kind==='collected'?(item.instance?.appIconData?<img className="tray-entry-image" src={item.instance.appIconData} alt=""/>:<Icon name={widgetCatalog[item.type].icon}/>):item.iconData?<img className="tray-entry-image" src={item.iconData} alt=""/>:<span className="tray-entry-icon">{item.icon}</span>}{item.name}</TrayDragButton>)}
  </section>
 </div>)}</>;
}
