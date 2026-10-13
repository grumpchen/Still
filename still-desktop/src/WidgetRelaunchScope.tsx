import {useState} from 'react';
import {widgetTagColors,type WidgetTagColor} from './domain/workspaces.ts';
import type {WidgetRelaunchMode} from './domain/widgetRelaunch.ts';

interface Props{
 mode:WidgetRelaunchMode;
 colors:Partial<Record<WidgetTagColor,WidgetRelaunchMode>>;
 setMode:(mode:WidgetRelaunchMode)=>void;
 setColor:(color:WidgetTagColor,mode:WidgetRelaunchMode|null)=>void;
 disabled?:boolean;
 applyModeToAll?:()=>void;
}

export default function WidgetRelaunchScope({mode,colors,setMode,setColor,disabled=false,applyModeToAll}:Props){
 const savedColor=widgetTagColors.find(color=>colors[color]!==undefined)??widgetTagColors[0];
 const [scope,setScope]=useState<'global'|'tag-color'>(()=>savedColor&&colors[savedColor]?'tag-color':'global');
 const [color,setSelectedColor]=useState<WidgetTagColor>(savedColor);
 const colorMode=colors[color]??'follow';
 return <section className="widget-relaunch-scope" aria-label="Widget relaunch scope settings">
  <label className="settings-row"><span>Choose setting scope</span><select aria-label="Widget relaunch setting scope" value={scope} onChange={event=>setScope(event.target.value as 'global'|'tag-color')}>
   <option value="global">Global · all widgets</option><option value="tag-color">Specific tag color</option>
  </select></label>
  {scope==='global'?<>
   <label className="settings-row"><span>When Still starts</span><select aria-label="Widget relaunch mode" disabled={disabled} value={mode} onChange={event=>setMode(event.target.value as WidgetRelaunchMode)}><option value="automatic">Automatically relaunch widgets</option><option value="manual">Wait for manual relaunch</option></select></label>
   {applyModeToAll&&<button type="button" aria-label="Apply widget relaunch mode to all" disabled={disabled} onClick={applyModeToAll}>Apply to All</button>}
  </>:<>
   <label className="settings-row"><span>Tag color</span><select aria-label="Widget relaunch tag color" value={color} onChange={event=>setSelectedColor(event.target.value as WidgetTagColor)}>{widgetTagColors.map(item=><option key={item} value={item}>{item[0].toUpperCase()+item.slice(1)}</option>)}</select></label>
   <label className="settings-row"><span>{color[0].toUpperCase()+color.slice(1)} tag behavior</span><select aria-label={color+' tag relaunch mode'} disabled={disabled} value={colorMode} onChange={event=>setColor(color,event.target.value==='follow'?null:event.target.value as WidgetRelaunchMode)}><option value="follow">Follow global</option><option value="automatic">Automatic</option><option value="manual">Manual</option></select></label>
  </>}
  <p className="notice">Changes stay in sync with Widget Plugins and Tag Color Status. Individual widget choices take priority over tag color, which takes priority over global.</p>
 </section>;
}
