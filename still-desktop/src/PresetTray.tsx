import {Icon} from './Icon.tsx';
import {widgetRegistry} from './widgets.tsx';
import {TrayDragButton,trayFocusIntoView} from './TrayDragButton.tsx';
import type {WidgetPreset,PresetType} from './domain/presets.ts';
interface Props {presets:WidgetPreset[];add:(preset:WidgetPreset)=>void;onContextMenu:(event:React.MouseEvent<HTMLButtonElement>,id:string)=>void}

function title(preset:WidgetPreset):string {
 if(preset.type==='files')return preset.resourceKind==='document'?preset.fileName:preset.folderName;
 if(preset.type==='apps')return preset.appName;
 return widgetRegistry[preset.type].name;
}
function label(preset:WidgetPreset):string {
 return preset.name;
}
export default function PresetTray({presets,add,onContextMenu}:Props){
 return <section className="preset-tray" aria-label="Saved shortcuts">
  <div className="preset-tray-entries">{presets.map(preset=>{
   const app=preset.type==='apps',file=preset.type==='files',displayName=label(preset),accessibleName=preset.name===title(preset)?preset.name:preset.name+' · '+title(preset);
   const icon=file&&preset.resourceKind==='document'?'notes':file?'files':widgetRegistry[preset.type].icon;
   return <div className={'preset-tray-entry '+(app?'preset-app-entry':'')+(file?' preset-file-entry':'')} key={preset.id}>
    <TrayDragButton className="preset-open" dragPayload={{kind:'preset',id:preset.id}} onFocus={trayFocusIntoView} onContextMenu={event=>onContextMenu(event,preset.id)} aria-label={'Open '+accessibleName} title={accessibleName} onClick={()=>add(preset)}>
     {app&&preset.iconData?<img className="preset-app-icon" src={preset.iconData} alt=""/>:<Icon name={icon}/>}
     {!app&&<span>{displayName}</span>}
    </TrayDragButton>
   </div>;
  })}
  </div>
 </section>;
}
