import {Icon,widgetRegistry} from './widgets.tsx';
import {TrayDragButton} from './TrayDragButton.tsx';
import type {WidgetPreset,PresetType} from './domain/presets.ts';
interface Props {type:PresetType;presets:WidgetPreset[];add:(preset:WidgetPreset)=>void;edit:(type:PresetType,preset?:WidgetPreset)=>void;remove:(id:string)=>void;collapse:()=>void;attachApp?:()=>void}
export default function PresetTray({type,presets,add,edit,remove,collapse,attachApp}:Props){
 const label=widgetRegistry[type].name;
 return <section className="preset-tray" id={'preset-tray-'+type} aria-label={'Custom '+label+' widgets'}>
  <div className="tray-group-heading"><strong>Custom {label}</strong><button className="tray-group-close" aria-label={'Collapse custom '+label+' widgets'} onClick={collapse}>▴</button></div>
  <div className="tray-group-entries">{type==='apps'&&<button className="tray-group-add" onClick={attachApp}>Attach open app</button>}{presets.filter(p=>p.type===type).map(preset=><div className="preset-tray-entry" key={preset.id}>
   <TrayDragButton className="preset-open" dragPayload={{kind:'preset',id:preset.id}} aria-label={'Add '+preset.name+' widget'} title={preset.type==='browser'?preset.url:preset.type==='files'?preset.resourceKind==='document'?preset.fileName:preset.folderName:preset.type==='apps'?preset.appName:label} onClick={()=>add(preset)}><Icon name={preset.type==='files'&&preset.resourceKind==='document'?'notes':widgetRegistry[type].icon}/><span>{preset.name}</span><small className="preset-kind">{preset.type==='files'?preset.resourceKind==='document'?preset.fileKind.toUpperCase():'Folder':label}</small></TrayDragButton>
   <button className="preset-action" aria-label={'Edit saved '+preset.name} onClick={()=>edit(type,preset)}>✎</button><button className="preset-action" aria-label={'Remove saved '+preset.name} onClick={()=>remove(preset.id)}>×</button>
  </div>)}<button className="tray-group-add" onClick={()=>edit(type)}>+ Custom {label}</button></div>
 </section>;
}
