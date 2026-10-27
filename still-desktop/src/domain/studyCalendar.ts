export type StudyEventCategory='class'|'assignment'|'exam'|'study';
export interface StudyCalendarEvent {id:string;date:string;title:string;time:string|null;category:StudyEventCategory}

export function calendarDateKey(date:Date):string{
 return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function isCalendarDate(value:unknown):value is string{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const [year,month,day]=value.split('-').map(Number),date=new Date(year,month-1,day);
 return year>=1900&&year<=2200&&date.getFullYear()===year&&date.getMonth()===month-1&&date.getDate()===day;
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
