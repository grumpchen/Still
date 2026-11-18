import {useState} from 'react';
import type {WidgetInstance,Workspace} from './domain/workspaces.ts';
import {widgetRegistry} from './widgets.tsx';
import {Icon} from './Icon.tsx';
import {useLocale,useT} from './localization.tsx';

interface DashboardHomeProps {
 dashboard:Workspace;
 library:Workspace|null;
 update:(id:string,patch:Partial<WidgetInstance>)=>void;
 notify:(message:string)=>void;
 workspaceActive:boolean;
 workspaceChoices:{id:string;name:string}[];
 openWorkspace:(id:string)=>void;
 openLibrary:()=>void;
 addCalendarEvent:()=>void;
 planStudy:()=>void;
 askAi:()=>void;
 copyWidgets:(workspaceId:string,types:WidgetInstance['type'][])=>void;
 undoCopy:()=>void;
 workspaceTargets:{id:string;name:string}[];
}

export default function DashboardHome({dashboard,library,update,notify,workspaceActive,workspaceChoices,openWorkspace,openLibrary,addCalendarEvent,planStudy,askAi,copyWidgets,undoCopy,workspaceTargets}:DashboardHomeProps){
 const layoutKey='still-dashboard-layout-v1-'+dashboard.id;
 const readSizes=()=>{try{return JSON.parse(localStorage.getItem(layoutKey)||'{}') as Record<string,{width:number;height:number}>}catch{return {}}};
 const [editing,setEditing]=useState(false),[sizes,setSizes]=useState<Record<string,{width:number;height:number}>>(readSizes),[before,setBefore]=useState<Record<string,{width:number;height:number}>>({}),[layouts,setLayouts]=useState<Array<{id:string;name:string;sizes:Record<string,{width:number;height:number}>}>>(()=>{try{return JSON.parse(localStorage.getItem('still-dashboard-layouts-v1')||'[]')}catch{return []}}),[layoutDialog,setLayoutDialog]=useState(false),[layoutName,setLayoutName]=useState(''),[targetId,setTargetId]=useState(''),[previewId,setPreviewId]=useState('');
 const t=useT(),locale=useLocale(),widgets=dashboard.widgets;
 const calendar=widgets.find(widget=>widget.type==='calendar'),focus=widgets.find(widget=>widget.type==='focus'),timetable=widgets.find(widget=>widget.type==='timetable');
 const resources=library?.widgets.find(widget=>widget.type==='files');
 const date=new Intl.DateTimeFormat(locale==='zh-CN'?'zh-CN':undefined,{weekday:'long',month:'long',day:'numeric'}).format(new Date());
 function moduleContent(widget:WidgetInstance|undefined){
  if(!widget)return <p className="dashboard-module-empty">{t('dashboardTitle')}</p>;
  const Renderer=widgetRegistry[widget.type].component;
  return <Renderer widget={widget} update={patch=>update(widget.id,patch)} obscured={false} workspaceActive={workspaceActive} workspaceChoices={workspaceChoices} openWorkspace={openWorkspace} notify={notify}/>;
 }
 function finishEdit(save:boolean){const next=save?sizes:before;setSizes(next);if(save)localStorage.setItem(layoutKey,JSON.stringify(next));setEditing(false)}
 function persistLayouts(next:typeof layouts){setLayouts(next);localStorage.setItem('still-dashboard-layouts-v1',JSON.stringify(next))}
 function saveLayout(){const name=layoutName.trim();if(!name)return;persistLayouts([...layouts,{id:crypto.randomUUID(),name,sizes:{...sizes}}]);setLayoutName('')}
 function copyLayout(){const layout=layouts.find(item=>item.id===previewId);if(!layout||!targetId)return;copyWidgets(targetId,['calendar','focus','timetable'])}
 function captureSize(key:string,event:React.PointerEvent<HTMLElement>){const rect=event.currentTarget.getBoundingClientRect();if(rect.width>0&&rect.height>0)setSizes(current=>({...current,[key]:{width:Math.round(rect.width),height:Math.round(rect.height)}}))}
 const sizeStyle=(key:string)=>sizes[key]?{width:sizes[key].width,height:sizes[key].height}:undefined;
 return <section className={'dashboard-home'+(editing?' dashboard-editing':'')} aria-label={t('dashboardWorkspace')}>
  <header className="dashboard-hero">
   <div className="dashboard-hero-copy"><span className="dashboard-eyebrow">{t('dashboardTagline')}</span><h2>{t('dashboardTitle')}</h2><p>{date}</p></div>
   <div className="dashboard-hero-actions">{editing?<><button type="button" onClick={()=>finishEdit(false)}>Cancel</button><button type="button" onClick={()=>setLayoutDialog(true)}>Layouts</button><button type="button" className="primary" onClick={()=>finishEdit(true)}>Done</button></>:<><button type="button" onClick={()=>{const measured=Object.fromEntries(['calendar','focus','timetable','library'].flatMap(key=>{const node=document.querySelector<HTMLElement>('.dashboard-'+key+'-module'),rect=node?.getBoundingClientRect();return rect?[ [key,{width:Math.round(rect.width),height:Math.round(rect.height)}] ]:[]}));setBefore(sizes);setSizes(current=>({...measured,...current}));setEditing(true)}}>Edit Layout</button><button type="button" onClick={()=>setLayoutDialog(true)}>Layouts</button><button type="button" onClick={openLibrary}><Icon name="files"/>{t('library')}</button><button type="button" onClick={addCalendarEvent}>{t('addToCalendar')}</button><button type="button" onClick={planStudy}>{t('planStudySession')}</button><button type="button" className="primary" onClick={askAi}>{t('askAi')}</button></>}</div>
  </header>
  <div className="dashboard-grid">
   <article style={sizeStyle('calendar')} onPointerUp={e=>editing&&captureSize('calendar',e)} className={'dashboard-module dashboard-calendar-module'+(editing?' dashboard-resizable':'')}><header className="dashboard-module-head"><span className="dashboard-module-icon"><Icon name="calendar"/></span><div><h3>{t('widget_calendar')}</h3><p>{t('agenda')}</p></div><button type="button" onClick={addCalendarEvent}>{t('addEvent')}</button></header><div className="dashboard-module-body dashboard-calendar-body">{moduleContent(calendar)}</div></article>
   <article style={sizeStyle('focus')} onPointerUp={e=>editing&&captureSize('focus',e)} className={'dashboard-module dashboard-focus-module'+(editing?' dashboard-resizable':'')}><header className="dashboard-module-head"><span className="dashboard-module-icon"><Icon name="focus"/></span><div><h3>{t('widget_focus')}</h3><p>{t('dashboardTagline')}</p></div></header><div className="dashboard-module-body dashboard-focus-body">{moduleContent(focus)}</div></article>
   <article style={sizeStyle('timetable')} onPointerUp={e=>editing&&captureSize('timetable',e)} className={'dashboard-module dashboard-timetable-module'+(editing?' dashboard-resizable':'')}><header className="dashboard-module-head"><span className="dashboard-module-icon"><Icon name="timetable"/></span><div><h3>{t('widget_timetable')}</h3><p>{t('weeklySchedule')}</p></div></header><div className="dashboard-module-body dashboard-timetable-body">{moduleContent(timetable)}</div></article>
   <article style={sizeStyle('library')} onPointerUp={e=>editing&&captureSize('library',e)} className={'dashboard-module dashboard-library-module'+(editing?' dashboard-resizable':'')}><header className="dashboard-module-head"><span className="dashboard-module-icon"><Icon name="files"/></span><div><h3>{t('library')}</h3><p>{t('downloadsInbox')}</p></div><button type="button" onClick={openLibrary}>{t('openLibrary')}</button></header><div className="dashboard-module-body dashboard-library-body">{resources&&workspaceActive?moduleContent(resources):<div className="dashboard-library-empty"><p>{t('emptyLibrary')}</p><button type="button" onClick={openLibrary}>{t('openLibrary')}</button></div>}</div></article>
  </div>
  {layoutDialog&&<div className="dashboard-layout-dialog" role="dialog" aria-modal="true" aria-label="Layouts"><div className="dashboard-layout-panel"><button className="dashboard-layout-close" onClick={()=>setLayoutDialog(false)}>Close</button><h2>Layouts</h2><form onSubmit={event=>{event.preventDefault();saveLayout()}}><label>Save current layout <input aria-label="Layout name" value={layoutName} onChange={event=>setLayoutName(event.target.value)} placeholder="Layout name"/></label><button type="submit" disabled={!layoutName.trim()}>Save</button></form>{layouts.map(layout=><section key={layout.id} className="dashboard-saved-layout"><button type="button" onClick={()=>setPreviewId(layout.id)}>{layout.name}</button><button type="button" onClick={()=>{const name=window.prompt('Rename layout',layout.name);if(name?.trim())persistLayouts(layouts.map(item=>item.id===layout.id?{...item,name:name.trim()}:item))}}>Rename</button><button type="button" onClick={()=>persistLayouts([...layouts,{...layout,id:crypto.randomUUID(),name:layout.name+' copy',sizes:{...layout.sizes}}])}>Duplicate</button></section>)}{previewId&&<section className="dashboard-layout-preview"><h3>Preview and copy</h3><p>This layout fits Calendar, Focus, and Timetable. Library is Dashboard-only and will not be copied.</p><div className="dashboard-layout-preview-grid"><span>Calendar</span><span>Focus</span><span>Timetable</span></div><label>Target workspace <select aria-label="Target workspace" value={targetId} onChange={event=>setTargetId(event.target.value)}><option value="">Choose workspace</option>{workspaceTargets.map(target=><option key={target.id} value={target.id}>{target.name}</option>)}</select></label><button type="button" disabled={!targetId} onClick={copyLayout}>Copy layout</button><button type="button" onClick={undoCopy}>Undo copy</button></section>}</div></div>}
 </section>;
}
