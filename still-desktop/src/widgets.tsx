import FilesWidget from './FilesWidget.tsx';
import AppsWidget from './AppsWidget.tsx';
import { useEffect, useState, type ComponentType } from 'react';
import TimetableWidget from './TimetableWidget.tsx';
import CalendarWidget from './CalendarWidget.tsx';
import GroupWidget from './GroupWidget.tsx';
import type {WebShortcut} from './domain/webShortcuts.ts';
import {widgetCatalog} from './domain/widgetCatalog.ts';
import {chromeLauncher} from './platform/chrome.ts';
import { DESMOS_URL, type WidgetInstance, type WidgetType,type SavedGroup,type GroupWidgetEntry } from './domain/workspaces.ts';
import type {WidgetPluginContext} from './domain/widgetPlugins.ts';
import TagColorStatusWidget from './TagColorStatusWidget.tsx';
import TimerWidget from './TimerWidget.tsx';
import NotesWidget from './NotesWidget.tsx';


import { Icon } from './Icon.tsx';
import {useT} from './localization.tsx';
export { Icon };
export interface WidgetProps { widget:WidgetInstance; update:(patch:Partial<WidgetInstance>)=>void; obscured:boolean; workspaceActive?:boolean; workspaceChoices?:{id:string;name:string}[]; openWorkspace?:(id:string)=>void; relaunchToken?:number; onRelaunchStatus?:(failed:boolean)=>void; notify:(message:string)=>void; appOpenResult?:(widgetId:string,success:boolean,error?:string)=>void; openResource?:(link:WebShortcut)=>void;group?:SavedGroup;updateGroup?:(patch:Partial<Omit<SavedGroup,'id'>>)=>void;openGroupWidget?:(entry:GroupWidgetEntry)=>void;pickApp?:()=>void;saveApp?:()=>void;appAttachment?:import('./platform/appPanel.ts').AppAttachment;appAttachmentHandled?:()=>void;widgetPluginContext?:WidgetPluginContext; timetableSchedule?:import('./domain/workspaces.ts').ScheduleEntry[]; editTimetableClass?:(id:string)=>void; timetableEditId?:string|null; clearTimetableEdit?:()=>void }
function Calculator({obscured,notify}:WidgetProps){const t=useT();return <div className="calculator-widget"><div className="widget-subbar"><span>{t('desmosScientific')}</span><button onClick={()=>void chromeLauncher.open(DESMOS_URL).catch(e=>notify(String(e)))}>{t('openInChrome')} ↗</button></div><iframe title={t('desmosScientific')} src={DESMOS_URL} referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms" style={{pointerEvents:obscured?'none':undefined}}/></div>}
function Assistant(_props:WidgetProps){const t=useT();return <div className="card-body"><div className="assistant-mark"><Icon name="ai"/></div><h2>{t('assistantWidgetTitle')}</h2><p>{t('assistantWidgetDescription')}</p><button onClick={()=>window.dispatchEvent(new Event('still-open-assistant'))}>{t('openAiAssistant')}</button></div>}
export interface WidgetDefinition { id:WidgetType; name:string; description:string; icon:string; component:ComponentType<WidgetProps> }
const renderers:Record<WidgetType,ComponentType<WidgetProps>>={group:GroupWidget,desmos:Calculator,notes:NotesWidget,focus:props=><TimerWidget {...props} variant="focus" workspaceActive={props.workspaceActive}/>,ai:Assistant,files:FilesWidget,apps:AppsWidget,timetable:TimetableWidget,calendar:CalendarWidget,tagStatus:TagColorStatusWidget};
export const widgetRegistry=Object.fromEntries(Object.entries(widgetCatalog).map(([id,meta])=>[id,{id:id as WidgetType,...meta,component:renderers[id as WidgetType]}])) as unknown as Record<WidgetType,WidgetDefinition>;
