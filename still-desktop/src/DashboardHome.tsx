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
}

export default function DashboardHome({dashboard,library,update,notify,workspaceActive,workspaceChoices,openWorkspace,openLibrary,addCalendarEvent,planStudy,askAi}:DashboardHomeProps){
 const t=useT(),locale=useLocale(),widgets=dashboard.widgets;
 const calendar=widgets.find(widget=>widget.type==='calendar'),focus=widgets.find(widget=>widget.type==='focus'),timetable=widgets.find(widget=>widget.type==='timetable');
 const resources=library?.widgets.find(widget=>widget.type==='files');
 const date=new Intl.DateTimeFormat(locale==='zh-CN'?'zh-CN':undefined,{weekday:'long',month:'long',day:'numeric'}).format(new Date());
 function moduleContent(widget:WidgetInstance|undefined){
  if(!widget)return <p className="dashboard-module-empty">{t('dashboardTitle')}</p>;
  const Renderer=widgetRegistry[widget.type].component;
  return <Renderer widget={widget} update={patch=>update(widget.id,patch)} obscured={false} workspaceActive={workspaceActive} workspaceChoices={workspaceChoices} openWorkspace={openWorkspace} notify={notify}/>;
 }
 return <section className="dashboard-home" aria-label={t('dashboardWorkspace')}>
  <header className="dashboard-hero">
   <div className="dashboard-hero-copy"><span className="dashboard-eyebrow">{t('dashboardTagline')}</span><h2>{t('dashboardTitle')}</h2><p>{date}</p></div>
   <div className="dashboard-hero-actions"><button type="button" onClick={openLibrary}><Icon name="files"/>{t('library')}</button><button type="button" onClick={addCalendarEvent}>{t('addToCalendar')}</button><button type="button" onClick={planStudy}>{t('planStudySession')}</button><button type="button" className="primary" onClick={askAi}>{t('askAi')}</button></div>
  </header>
  <div className="dashboard-grid">
   <article className="dashboard-module dashboard-calendar-module"><header className="dashboard-module-head"><span className="dashboard-module-icon"><Icon name="calendar"/></span><div><h3>{t('widget_calendar')}</h3><p>{t('agenda')}</p></div><button type="button" onClick={addCalendarEvent}>{t('addEvent')}</button></header><div className="dashboard-module-body dashboard-calendar-body">{moduleContent(calendar)}</div></article>
   <article className="dashboard-module dashboard-focus-module"><header className="dashboard-module-head"><span className="dashboard-module-icon"><Icon name="focus"/></span><div><h3>{t('widget_focus')}</h3><p>{t('dashboardTagline')}</p></div></header><div className="dashboard-module-body dashboard-focus-body">{moduleContent(focus)}</div></article>
   <article className="dashboard-module dashboard-timetable-module"><header className="dashboard-module-head"><span className="dashboard-module-icon"><Icon name="timetable"/></span><div><h3>{t('widget_timetable')}</h3><p>{t('weeklySchedule')}</p></div></header><div className="dashboard-module-body dashboard-timetable-body">{moduleContent(timetable)}</div></article>
   <article className="dashboard-module dashboard-library-module"><header className="dashboard-module-head"><span className="dashboard-module-icon"><Icon name="files"/></span><div><h3>{t('library')}</h3><p>{t('downloadsInbox')}</p></div><button type="button" onClick={openLibrary}>{t('openLibrary')}</button></header><div className="dashboard-module-body dashboard-library-body">{resources&&workspaceActive?moduleContent(resources):<div className="dashboard-library-empty"><p>{t('emptyLibrary')}</p><button type="button" onClick={openLibrary}>{t('openLibrary')}</button></div>}</div></article>
  </div>
 </section>;
}
