import {Icon,widgetRegistry} from './widgets.tsx';
import {TrayDragButton,trayFocusIntoView} from './TrayDragButton.tsx';
import type {WidgetPreset,PresetType} from './domain/presets.ts';
interface Props {presets:WidgetPreset[];add:(preset:WidgetPreset)=>void;edit:(type:PresetType,preset?:WidgetPreset)=>void;remove:(id:string)=>void;attachApp?:()=>void}

function title(preset:WidgetPreset):string {
 if(preset.type==='browser')return preset.url;
 if(preset.type==='files')return preset.resourceKind==='document'?preset.fileName:preset.folderName;
 if(preset.type==='apps')return preset.appName;
 return widgetRegistry[preset.type].name;
}
function label(preset:WidgetPreset):string {
 if(preset.type==='files')return preset.resourceKind==='document'?preset.fileName:preset.folderName;
 return preset.name;
}
export default function PresetTray({presets,add,edit,remove,attachApp}:Props){
 return <section className="preset-tray" aria-label="Saved shortcuts">
  <strong className="preset-tray-label">Saved</strong>
  <div className="preset-tray-entries">{presets.map(preset=>{
   const app=preset.type==='apps',file=preset.type==='files',displayName=label(preset),accessibleName=title(preset);
   const icon=file&&preset.resourceKind==='document'?'notes':file?'files':widgetRegistry[preset.type].icon;
   return <div className={'preset-tray-entry '+(app?'preset-app-entry':'')+(file?' preset-file-entry':'')} key={preset.id}>
    <TrayDragButton className="preset-open" dragPayload={{kind:'preset',id:preset.id}} onFocus={trayFocusIntoView} aria-label={'Open '+accessibleName} title={accessibleName} onClick={()=>add(preset)}>
     {app&&preset.iconData?<img className="preset-app-icon" src={preset.iconData} alt=""/>:<Icon name={icon}/>}
     {!app&&<><span>{displayName}</span><small className="preset-kind">{file?preset.resourceKind==='document'?preset.fileKind.toUpperCase():'Folder':widgetRegistry[preset.type].name}</small></>}
    </TrayDragButton>
    <button className="preset-action" onFocus={trayFocusIntoView} aria-label={'Edit saved '+accessibleName} title={'Edit '+accessibleName} onClick={()=>edit(preset.type,preset)}>✎</button>
    <button className="preset-action" onFocus={trayFocusIntoView} aria-label={'Remove saved '+accessibleName} title={'Remove '+accessibleName} onClick={()=>remove(preset.id)}>×</button>
   </div>;
  })}
  <button className="apps-tray-add" onFocus={trayFocusIntoView} onClick={attachApp} aria-label="Add app shortcut or attach open app" title="Add app shortcut or attach open app">+</button>
  </div>
 </section>;
}
