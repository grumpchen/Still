import {Icon,widgetRegistry} from './widgets.tsx';
import {TrayDragButton,trayFocusIntoView} from './TrayDragButton.tsx';
import type {WidgetPreset,PresetType} from './domain/presets.ts';
interface Props {type:PresetType;presets:WidgetPreset[];add:(preset:WidgetPreset)=>void;edit:(type:PresetType,preset?:WidgetPreset)=>void;remove:(id:string)=>void;attachApp?:()=>void}
export default function PresetTray({type,presets,add,edit,remove,attachApp}:Props){
 const label=widgetRegistry[type].name;
 return <section className="preset-tray" id={'preset-tray-'+type} aria-label={type==='apps'?'Saved Apps shortcuts':'Custom '+label+' widgets'}>
  {type!=='apps'&&<strong className="preset-tray-label">Custom {label}</strong>}
  <div className="preset-tray-entries">{presets.filter(p=>p.type===type).map(preset=><div className={'preset-tray-entry '+(type==='apps'?'preset-app-entry':'')} key={preset.id}>
   <TrayDragButton className="preset-open" dragPayload={{kind:'preset',id:preset.id}} onFocus={trayFocusIntoView} aria-label={'Open '+preset.name} title={preset.type==='browser'?preset.url:preset.type==='files'?preset.resourceKind==='document'?preset.fileName:preset.folderName:preset.type==='apps'?preset.appName:label} onClick={()=>add(preset)}>{preset.type==='apps'&&preset.iconData?<img className="preset-app-icon" src={preset.iconData} alt=""/>:<Icon name={preset.type==='files'&&preset.resourceKind==='document'?'notes':widgetRegistry[type].icon}/>}{type!=='apps'&&<><span>{preset.name}</span><small className="preset-kind">{preset.type==='files'?preset.resourceKind==='document'?preset.fileKind.toUpperCase():'Folder':label}</small></>}</TrayDragButton>
   <button className="preset-action" onFocus={trayFocusIntoView} aria-label={'Edit saved '+preset.name} onClick={()=>edit(type,preset)}>✎</button><button className="preset-action" onFocus={trayFocusIntoView} aria-label={'Remove saved '+preset.name} onClick={()=>remove(preset.id)}>×</button>
  </div>)}{type==='apps'?<button className="apps-tray-add" onFocus={trayFocusIntoView} onClick={attachApp} aria-label="Add app shortcut or attach open app" title="Add app shortcut or attach open app">+</button>:<button className="tray-group-add" onFocus={trayFocusIntoView} onClick={()=>edit(type)}>+ Custom {label}</button>}</div>
 </section>;
}
