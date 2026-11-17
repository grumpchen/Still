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
import DeepTutorWidget from './DeepTutorWidget.tsx';


import { Icon } from './Icon.tsx';
import {useT} from './localization.tsx';
export { Icon };
export interface WidgetProps { widget:WidgetInstance; update:(patch:Partial<WidgetInstance>)=>void; obscured:boolean; workspaceWidgets?:WidgetInstance[]; workspaceActive?:boolean; workspaceChoices?:{id:string;name:string}[]; openWorkspace?:(id:string)=>void; relaunchToken?:number; onRelaunchStatus?:(failed:boolean)=>void; notify:(message:string)=>void; appOpenResult?:(widgetId:string,success:boolean,error?:string)=>void; openResource?:(link:WebShortcut)=>void;group?:SavedGroup;updateGroup?:(patch:Partial<Omit<SavedGroup,'id'>>)=>void;openGroupWidget?:(entry:GroupWidgetEntry)=>void;pickApp?:()=>void;saveApp?:()=>void;appAttachment?:import('./platform/appPanel.ts').AppAttachment;appAttachmentHandled?:()=>void;widgetPluginContext?:WidgetPluginContext }
function Calculator({obscured,notify}:WidgetProps){const t=useT();return <div className="calculator-widget"><div className="widget-subbar"><span>{t('desmosScientific')}</span><button onClick={()=>void chromeLauncher.open(DESMOS_URL).catch(e=>notify(String(e)))}>{t('openInChrome')} ↗</button></div><iframe title={t('desmosScientific')} src={DESMOS_URL} referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms" style={{pointerEvents:obscured?'none':undefined}}/></div>}
function Assistant(_props:WidgetProps){const t=useT();return <div className="card-body"><div className="assistant-mark"><Icon name="ai"/></div><h2>{t('assistantWidgetTitle')}</h2><p>{t('assistantWidgetDescription')}</p><button onClick={()=>window.dispatchEvent(new Event('still-open-assistant'))}>{t('openAiAssistant')}</button></div>}
function AiCommand({widget,update}:WidgetProps){const t=useT();const[editing,setEditing]=useState(!widget.text.trim());const run=()=>{window.dispatchEvent(new CustomEvent('still-run-ai-command',{detail:{prompt:widget.text.trim()}}));window.dispatchEvent(new Event('still-open-assistant'))};return <div className="card-body ai-command-widget"><div className="assistant-mark"><Icon name="ai"/></div><label className="field-label">{t('aiCommandName')}<input aria-label={t('aiCommandName')} maxLength={60} placeholder={t('aiCommandNamePlaceholder')} value={widget.title} onChange={event=>update({title:event.target.value.slice(0,60)})}/></label>{editing?<><label className="field-label">{t('aiCommandPrompt')}<textarea aria-label={t('aiCommandPrompt')} maxLength={8000} rows={5} placeholder={t('aiCommandPromptPlaceholder')} value={widget.text} onChange={event=>update({text:event.target.value})}/></label><div className="ai-command-actions"><button type="button" onClick={()=>setEditing(false)} disabled={!widget.text.trim()}>{t('aiCommandDone')}</button><button type="button" className="primary" disabled={!widget.text.trim()} onClick={run}>{t('aiCommandRun')}</button></div></>:<><p className="ai-command-summary">{widget.text.trim()||t('aiCommandEmpty')}</p><div className="ai-command-actions"><button type="button" onClick={()=>setEditing(true)}>{t('aiCommandEdit')}</button><button type="button" className="primary" disabled={!widget.text.trim()} onClick={run}>{t('aiCommandRun')}</button></div></>}</div>}
export interface WidgetDefinition { id:WidgetType; name:string; description:string; icon:string; component:ComponentType<WidgetProps> }
const renderers:Record<WidgetType,ComponentType<WidgetProps>>={group:GroupWidget,desmos:Calculator,notes:NotesWidget,focus:props=><TimerWidget {...props} variant="focus" workspaceActive={props.workspaceActive}/>,ai:Assistant,aiCommand:AiCommand,deeptutor:DeepTutorWidget,files:FilesWidget,apps:AppsWidget,timetable:TimetableWidget,calendar:CalendarWidget,tagStatus:TagColorStatusWidget};
export const widgetRegistry=Object.fromEntries(Object.entries(widgetCatalog).map(([id,meta])=>[id,{id:id as WidgetType,...meta,component:renderers[id as WidgetType]}])) as unknown as Record<WidgetType,WidgetDefinition>;
