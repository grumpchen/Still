import {Icon} from './Icon.tsx';
import {widgetRegistry} from './widgets.tsx';
import {widgetTypes,type SavedGroup,type WidgetInstance,type WidgetType} from './domain/workspaces.ts';
import type {WidgetPreset,PresetType} from './domain/presets.ts';
import type {GroupEditMode} from './GroupEditor.tsx';

interface Props {
 widgets:WidgetInstance[];groups:SavedGroup[];presets:WidgetPreset[];
 add:(type:WidgetType)=>void;editPreset:(type:PresetType,preset?:WidgetPreset)=>void;renamePreset:(id:string)=>void;removePreset:(id:string)=>void;
 editGroup:(id:string,mode:GroupEditMode)=>void;renameGroup:(id:string)=>void;openGroup:(id:string)=>void;removeGroup:(id:string)=>void;
 removeWidget:(id:string)=>void;hideSidebar:()=>void;hideWidgetTray:()=>void;arrange:()=>void;attach:()=>void;
}
export default function TrayEditor(p:Props){
 return <div className="tray-editor">
  <section><h3>Workspace</h3><div className="tray-editor-actions"><button onClick={p.hideSidebar}>Hide sidebar</button><button onClick={p.hideWidgetTray}>Hide widget tray</button><button onClick={p.arrange}>Arrange workspace</button><button onClick={p.attach}>Attach open app</button></div></section>
  <section><h3>Add widget</h3><div className="tray-editor-actions">{widgetTypes.filter(t=>t!=='ai').map(type=><button key={type} onClick={()=>p.add(type)}><Icon name={widgetRegistry[type].icon}/>{widgetRegistry[type].name}</button>)}</div></section>
  <section><h3>Saved shortcuts</h3><p className="notice">Drag an open widget onto Saved + to copy its supported settings.</p>{p.presets.map(item=><div className="tray-editor-row" key={item.id}><span>{item.type==='apps'&&item.iconData?<img src={item.iconData} alt=""/>:<Icon name={widgetRegistry[item.type].icon}/>} {item.name}</span><button onClick={()=>p.renamePreset(item.id)}>Rename shortcut</button><button onClick={()=>p.editPreset(item.type,item)}>Edit</button><button aria-label={'Remove saved '+item.name} onClick={()=>p.removePreset(item.id)}>Remove shortcut</button></div>)}<div className="tray-editor-actions">{widgetTypes.filter(t=>t!=='group'&&t!=='ai').map(type=><button key={type} onClick={()=>p.editPreset(type as PresetType)}>+ {widgetRegistry[type].name}</button>)}</div></section>
  <section><h3>Groups</h3>{p.groups.map(group=><div className="tray-editor-row" key={group.id}><span><Icon name="group"/>{group.name||'Group'} ({group.widgets.length+group.shortcuts.length})</span><button onClick={()=>p.renameGroup(group.id)}>Rename group</button><button onClick={()=>p.editGroup(group.id,undefined)}>Edit</button><button onClick={()=>p.editGroup(group.id,'widget')}>Add widget</button><button onClick={()=>p.editGroup(group.id,'link')}>Add link</button><button onClick={()=>p.openGroup(group.id)}>Open</button><button onClick={()=>p.removeGroup(group.id)}>Remove group</button></div>)}</section>
  <section><h3>Remove an open widget</h3><p className="notice">Removes only the Still widget. Attached external apps are detached.</p>{p.widgets.map(widget=><div className="tray-editor-row" key={widget.id}><span><Icon name={widgetRegistry[widget.type].icon}/>{widget.title||widgetRegistry[widget.type].name}</span><button aria-label={'Remove '+(widget.title||widgetRegistry[widget.type].name)} onClick={()=>p.removeWidget(widget.id)}>Remove</button></div>)}</section>
 </div>;
}
