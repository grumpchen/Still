export type StudyEventCategory='class'|'assignment'|'exam'|'study';
export interface StudyCalendarEvent {id:string;date:string;title:string;time:string|null;category:StudyEventCategory}
export type StudyCalendarEventDraft=Omit<StudyCalendarEvent,'id'>;
export const STUDY_CALENDAR_PROPOSAL_LIMIT=14;

export function calendarDateKey(date:Date):string{
 return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function isCalendarDate(value:unknown):value is string{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const [year,month,day]=value.split('-').map(Number),date=new Date(year,month-1,day);
 return year>=1900&&year<=2200&&date.getFullYear()===year&&date.getMonth()===month-1&&date.getDate()===day;
}
export function checkedStudyCalendarDrafts(value:unknown):StudyCalendarEventDraft[]{
 if(!Array.isArray(value)||value.length>STUDY_CALENDAR_PROPOSAL_LIMIT)throw new Error(`Choose up to ${STUDY_CALENDAR_PROPOSAL_LIMIT} calendar events. Nothing was added.`);
 return value.map(item=>{
  if(!item||typeof item!=='object'||Array.isArray(item))throw new Error('The AI returned an invalid calendar event. Nothing was added.');
  const draft=item as Partial<StudyCalendarEventDraft>;
  if(!isCalendarDate(draft.date)||typeof draft.title!=='string'||!draft.title.trim()||draft.title.length>160||!(draft.time===null||draft.time===undefined||draft.time===''||typeof draft.time==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time))||!['class','assignment','exam','study'].includes(draft.category??''))throw new Error('The AI returned an invalid calendar event. Nothing was added.');
  return {date:draft.date,title:draft.title.trim(),time:draft.time||null,category:draft.category as StudyEventCategory};
 });
}
export function checkedCalendarEvents(value:unknown):StudyCalendarEvent[]{
 if(!Array.isArray(value))return[];
 const ids=new Set<string>();
 return value.slice(0,500).flatMap((item):StudyCalendarEvent[]=>{
  if(!item||typeof item!=='object'||Array.isArray(item))return[];
  const event=item as Partial<StudyCalendarEvent>;
  if(typeof event.id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(event.id)||ids.has(event.id)||!isCalendarDate(event.date)||typeof event.title!=='string'||!event.title.trim()||event.title.length>160||!['class','assignment','exam','study'].includes(event.category??''))return[];
  const time=event.time===null||event.time===undefined||event.time===''?null:typeof event.time==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(event.time)?event.time:undefined;
  if(time===undefined)return[];
  ids.add(event.id);return[{id:event.id,date:event.date,title:event.title.trim(),time,category:event.category as StudyEventCategory}];
 }).sort((a,b)=>a.date.localeCompare(b.date)||(a.time??'').localeCompare(b.time??'')||a.title.localeCompare(b.title));
}
export function calendarMonthCells(month:Date):Date[]{
 const first=new Date(month.getFullYear(),month.getMonth(),1),mondayOffset=(first.getDay()+6)%7;
 return Array.from({length:42},(_,index)=>new Date(month.getFullYear(),month.getMonth(),1-mondayOffset+index));
}
