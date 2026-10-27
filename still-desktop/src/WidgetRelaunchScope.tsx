import {useState} from 'react';
import {widgetTagColors,type WidgetTagColor} from './domain/workspaces.ts';
import type {WidgetRelaunchMode} from './domain/widgetRelaunch.ts';
import {useT} from './localization.tsx';

interface Props{
 mode:WidgetRelaunchMode;
 colors:Partial<Record<WidgetTagColor,WidgetRelaunchMode>>;
 setMode:(mode:WidgetRelaunchMode)=>void;
 setColor:(color:WidgetTagColor,mode:WidgetRelaunchMode|null)=>void;
 disabled?:boolean;
 applyModeToAll?:()=>void;
}

export default function WidgetRelaunchScope({mode,colors,setMode,setColor,disabled=false,applyModeToAll}:Props){
 const t=useT();
 const savedColor=widgetTagColors.find(color=>colors[color]!==undefined)??widgetTagColors[0];
 const [scope,setScope]=useState<'global'|'tag-color'>(()=>savedColor&&colors[savedColor]?'tag-color':'global');
 const [color,setSelectedColor]=useState<WidgetTagColor>(savedColor);
 const colorMode=colors[color]??'follow';
 return <section className="widget-relaunch-scope" aria-label={t('widgetRelaunch')}>
  <label className="settings-row"><span>{t('settingScope')}</span><select aria-label={t('settingScope')} value={scope} onChange={event=>setScope(event.target.value as 'global'|'tag-color')}>
   <option value="global">{t('globalAllWidgets')}</option><option value="tag-color">{t('specificTagColor')}</option>
  </select></label>
  {scope==='global'?<>
   <label className="settings-row"><span>{t('whenStillStarts')}</span><select aria-label={t('widgetRelaunch')} disabled={disabled} value={mode} onChange={event=>setMode(event.target.value as WidgetRelaunchMode)}><option value="automatic">{t('automaticRelaunch')}</option><option value="manual">{t('waitManualRelaunch')}</option></select></label>
   {applyModeToAll&&<button type="button" aria-label={t('applyToAll')} disabled={disabled} onClick={applyModeToAll}>{t('applyToAll')}</button>}
  </>:<>
   <label className="settings-row"><span>{t('tagColor')}</span><select aria-label={t('tagColor')} value={color} onChange={event=>setSelectedColor(event.target.value as WidgetTagColor)}>{widgetTagColors.map(item=><option key={item} value={item}>{item[0].toUpperCase()+item.slice(1)}</option>)}</select></label>
   <label className="settings-row"><span>{t('tagBehavior').replace('{color}',color[0].toUpperCase()+color.slice(1))}</span><select aria-label={t('tagBehavior').replace('{color}',color)} disabled={disabled} value={colorMode} onChange={event=>setColor(color,event.target.value==='follow'?null:event.target.value as WidgetRelaunchMode)}><option value="follow">{t('followGlobal')}</option><option value="automatic">{t('automaticRelaunch')}</option><option value="manual">{t('waitManualRelaunch')}</option></select></label>
  </>}
  <p className="notice">{t('changesSyncPriority')}</p>
 </section>;
}
