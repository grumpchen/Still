import {Icon} from './Icon.tsx';
import {widgetRegistry} from './widgets.tsx';
import {widgetTypes,type SavedGroup,type WidgetInstance,type WidgetType} from './domain/workspaces.ts';
import type {WidgetPreset,PresetType} from './domain/presets.ts';
import type {GroupEditMode} from './GroupEditor.tsx';
import {useT} from './localization.tsx';

interface Props {
 widgets:WidgetInstance[];groups:SavedGroup[];presets:WidgetPreset[];
 add:(type:WidgetType)=>void;editPreset:(type:PresetType,preset?:WidgetPreset)=>void;renamePreset:(id:string)=>void;removePreset:(id:string)=>void;
 editGroup:(id:string,mode:GroupEditMode)=>void;renameGroup:(id:string)=>void;openGroup:(id:string)=>void;removeGroup:(id:string)=>void;
 removeWidget:(id:string)=>void;hideSidebar:()=>void;hideWidgetTray:()=>void;arrange:()=>void;attach:()=>void;
}
export default function TrayEditor(p:Props){
 const t=useT();
 return <div className="tray-editor">
  <section><h3>{t('workspace')}</h3><div className="tray-editor-actions"><button onClick={p.hideSidebar}>{t('hideSidebar')}</button><button onClick={p.hideWidgetTray}>{t('hideBottomAppsBar')}</button><button onClick={p.arrange}>{t('arrangeWorkspace')}</button><button onClick={p.attach}>{t('attachOpenApp')}</button></div></section>
  <section><h3>{t('addWidget')}</h3><div className="tray-editor-actions">{widgetTypes.filter(type=>type!=='ai').map(type=><button key={type} onClick={()=>p.add(type)}><Icon name={widgetRegistry[type].icon}/>{t('widget_'+type)}</button>)}</div></section>
  <details className="tray-editor-collapsible"><summary><span>{t('savedShortcuts')}</span><Icon name="chevronDown"/></summary><div className="tray-editor-collapsible-content"><p className="notice">{t('dragWidgetToSavedHelp')}</p>{p.presets.map(item=><div className="tray-editor-row" key={item.id}><span>{item.type==='apps'&&item.iconData?<img src={item.iconData} alt=""/>:<Icon name={widgetRegistry[item.type].icon}/>} {item.name}</span><button onClick={()=>p.renamePreset(item.id)}>{t('renameShortcut')}</button><button onClick={()=>p.editPreset(item.type,item)}>{t('edit')}</button><button aria-label={t('removeSavedShortcut')+' '+item.name} onClick={()=>p.removePreset(item.id)}>{t('removeShortcut')}</button></div>)}<div className="tray-editor-actions">{widgetTypes.filter(type=>type!=='group'&&type!=='ai').map(type=><button key={type} onClick={()=>p.editPreset(type as PresetType)}>+ {t('widget_'+type)}</button>)}</div></div></details>
  <section><h3>{t('groups')}</h3>{p.groups.map(group=><div className="tray-editor-row" key={group.id}><span><Icon name="group"/>{group.name||t('group')} ({group.widgets.length+group.shortcuts.length})</span><button onClick={()=>p.renameGroup(group.id)}>{t('renameGroup')}</button><button onClick={()=>p.editGroup(group.id,undefined)}>{t('edit')}</button><button onClick={()=>p.editGroup(group.id,'widget')}>{t('addWidget')}</button><button onClick={()=>p.editGroup(group.id,'link')}>{t('addLink')}</button><button onClick={()=>p.openGroup(group.id)}>{t('open')}</button><button onClick={()=>p.removeGroup(group.id)}>{t('removeGroup')}</button></div>)}</section>
  <section><h3>{t('removeOpenWidget')}</h3><p className="notice">{t('removeWidgetOnlyNote')}</p>{p.widgets.map(widget=><div className="tray-editor-row" key={widget.id}><span><Icon name={widgetRegistry[widget.type].icon}/>{widget.title||t('widget_'+widget.type)}</span><button aria-label={t('remove')+' '+(widget.title||t('widget_'+widget.type))} onClick={()=>p.removeWidget(widget.id)}>{t('remove')}</button></div>)}</section>
 </div>;
}
