import {useEffect,useMemo,useState} from 'react';
import type {WidgetProps} from './widgets.tsx';
import {calendarDateKey,calendarMonthCells,type StudyEventCategory,type StudyCalendarEvent} from './domain/studyCalendar.ts';
import {Icon} from './Icon.tsx';
import {useLocale,useT} from './localization.tsx';

const categories:StudyEventCategory[]=['class','assignment','exam','study'];
const categoryNames:Record<StudyEventCategory,string>={class:'Class',assignment:'Assignment',exam:'Exam',study:'Study'};
const weekdays=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const formatMonth=(date:Date,locale:string)=>new Intl.DateTimeFormat(locale,{month:'long',year:'numeric'}).format(date);
const formatDate=(key:string,locale:string)=>new Intl.DateTimeFormat(locale,{weekday:'long',month:'long',day:'numeric'}).format(new Date(`${key}T12:00:00`));

export default function CalendarWidget({widget,update,timetableSchedule=[],editTimetableClass}:WidgetProps){
 const locale=useLocale(),t=useT(),locales=locale==='zh-CN'?'zh-CN':'en';
 const today=calendarDateKey(new Date()),[month,setMonth]=useState(()=>new Date()),[selected,setSelected]=useState(today),[draft,setDraft]=useState(false),[title,setTitle]=useState(''),[time,setTime]=useState(''),[category,setCategory]=useState<StudyEventCategory>('study');
 const days=useMemo(()=>calendarMonthCells(month),[month]),events=widget.calendarEvents??[],selectedEvents=events.filter(event=>event.date===selected);
 const selectedDay=(new Date(`${selected}T12:00:00`).getDay()+6)%7,selectedClasses=timetableSchedule.filter(entry=>entry.day===selectedDay).sort((a,b)=>a.time.localeCompare(b.time));
 useEffect(()=>{const open=()=>{setSelected(today);setMonth(new Date());setDraft(true)};window.addEventListener('still-calendar-add-event',open);return()=>window.removeEventListener('still-calendar-add-event',open)},[today]);
 function save(event:React.FormEvent){event.preventDefault();const clean=title.trim();if(!clean)return;const item:StudyCalendarEvent={id:crypto.randomUUID(),date:selected,title:clean,time:time||null,category};update({calendarEvents:[...events,item]});setTitle('');setTime('');setDraft(false)}
 return <div className="study-calendar">
  <div className="study-calendar-month"><button aria-label={t('previousMonth')} onClick={()=>setMonth(date=>new Date(date.getFullYear(),date.getMonth()-1,1))}><Icon name="chevronLeft"/></button><strong>{formatMonth(month,locales)}</strong><button aria-label={t('nextMonth')} onClick={()=>setMonth(date=>new Date(date.getFullYear(),date.getMonth()+1,1))}><Icon name="chevronRight"/></button><button className="study-calendar-today" onClick={()=>{setMonth(new Date());setSelected(today)}}>{t('today')}</button></div>
  <div className="study-calendar-grid" role="grid" aria-label={formatMonth(month,locales)}>{(locale==='zh-CN'?['一','二','三','四','五','六','日']:weekdays).map(day=><span className="study-calendar-weekday" key={day}>{day}</span>)}{days.map(date=>{const key=calendarDateKey(date),inMonth=date.getMonth()===month.getMonth(),marked=events.some(event=>event.date===key)||timetableSchedule.some(entry=>entry.day===(date.getDay()+6)%7);return <button key={key} role="gridcell" aria-selected={selected===key} aria-label={`${formatDate(key,locales)}${marked?t('hasEventsSuffix'):''}`} className={`${inMonth?'':'outside-month'}${key===today?' is-today':''}${selected===key?' is-selected':''}${marked?' has-events':''}`} onClick={()=>setSelected(key)}>{date.getDate()}<i/></button>})}</div>
  <section className="study-calendar-agenda"><div className="study-calendar-agenda-head"><div><small>{t('agenda').toUpperCase()}</small><strong>{formatDate(selected,locales)}</strong></div><button onClick={()=>setDraft(value=>!value)}>{draft?t('cancel'):t('addEvent')}</button></div>
   {draft&&<form className="study-calendar-form" onSubmit={save}><input aria-label={t('eventTitle')} placeholder={t('eventTitle')} maxLength={160} value={title} onChange={event=>setTitle(event.target.value)} required autoFocus/><div><input aria-label={t('eventTime')} type="time" value={time} onChange={event=>setTime(event.target.value)}/><select aria-label={t('eventCategory')} value={category} onChange={event=>setCategory(event.target.value as StudyEventCategory)}>{categories.map(value=><option key={value} value={value}>{t(value)}</option>)}</select><button className="primary" type="submit">{t('save')}</button></div></form>}
   <div className="study-calendar-events">{selectedClasses.map(entry=><article key={`class-${entry.id}`} className="study-event event-class"><time>{entry.time}</time><span><strong>{entry.title}</strong><small>{t('weeklySchedule')}{entry.location?` · ${entry.location}`:''}</small></span>{editTimetableClass&&<button aria-label={`${t('edit')} ${entry.title}`} onClick={()=>editTimetableClass(entry.id)}>{t('edit')}</button>}</article>)}{selectedEvents.map(event=><article key={event.id} className={`study-event event-${event.category}`}><time>{event.time||t('allDay')}</time><span><strong>{event.title}</strong><small>{t(event.category)}</small></span><button aria-label={t('removeEvent').replace('{title}',event.title)} onClick={()=>update({calendarEvents:events.filter(item=>item.id!==event.id)})}>×</button></article>)}{!selectedClasses.length&&!selectedEvents.length&&!draft&&<p className="widget-hint">{t('calendarEmpty')}</p>}</div>
  </section>
 </div>
}
