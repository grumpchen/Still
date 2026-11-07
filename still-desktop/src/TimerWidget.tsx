import {useEffect,useRef,useState} from 'react';
import type {KeyboardEvent,WheelEvent} from 'react';
import type {WidgetInstance} from './domain/workspaces.ts';
import {useT} from './localization.tsx';

interface TimerWidgetProps {
 widget:WidgetInstance;
 variant:'focus'|'clock';
 workspaceActive?:boolean;
 update:(patch:Partial<WidgetInstance>)=>void;
 notify:(message:string)=>void;
}

const pad=(value:number)=>String(value).padStart(2,'0');

export default function TimerWidget({widget,variant,workspaceActive=true,update,notify}:TimerWidgetProps){
 const t=useT();
 const [now,setNow]=useState(Date.now());
 const [selected,setSelected]=useState(widget.remaining);
 const completedEnd=useRef<number|null>(null);
 useEffect(()=>{
  if(!workspaceActive)return;
  setNow(Date.now());
  const interval=setInterval(()=>setNow(Date.now()),1000);
  return()=>clearInterval(interval);
 },[workspaceActive]);
 const remaining=widget.end?Math.max(0,Math.ceil((widget.end-now)/1000)):widget.remaining;
 useEffect(()=>{if(!widget.end)setSelected(widget.remaining)},[widget.end,widget.remaining]);
 useEffect(()=>{
  if(workspaceActive&&variant==='focus'&&widget.end&&remaining===0&&completedEnd.current!==widget.end){
   completedEnd.current=widget.end;
   update({end:null,remaining:0});
   notify(variant==='focus'?t('focusComplete'):t('clockTimerComplete'));
  }
 },[workspaceActive,remaining,widget.end,variant,update,notify,t]);

 const hours=Math.min(12,Math.floor(selected/3600));
 const minutes=Math.floor(selected%3600/60);
 const duration=Math.max(0,selected);
 function setPart(next:number,unit:'hour'|'minute'){
  setSelected(unit==='hour'?Math.max(0,Math.min(12,next))*3600+minutes*60:hours*3600+Math.max(0,Math.min(59,next))*60);
 }
 function handlePickerWheel(event:WheelEvent<HTMLDivElement>,unit:'hour'|'minute'){
  if(running||event.deltaY===0)return;
  event.preventDefault();
  const currentValue=unit==='hour'?hours:minutes;
  setPart(currentValue+(event.deltaY>0?1:-1),unit);
 }
 function handlePickerKeyDown(event:KeyboardEvent<HTMLDivElement>,unit:'hour'|'minute'){
  if(running)return;
  const currentValue=unit==='hour'?hours:minutes;
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
   event.preventDefault();
   setPart(currentValue+(event.key==='ArrowDown'?1:-1),unit);
  }else if(event.key==='PageDown'||event.key==='PageUp'){
   event.preventDefault();
   setPart(currentValue+(event.key==='PageDown'?5:-5),unit);
  }else if(event.key==='Home'){
   event.preventDefault();
   setPart(0,unit);
  }else if(event.key==='End'){
   event.preventDefault();
   setPart(unit==='hour'?12:59,unit);
  }
 }
 function cancelSelection(){setSelected(widget.end?remaining:widget.remaining)}
 function setTime(){update({remaining:duration,end:null});completedEnd.current=null}
 function toggleTimer(){
  if(widget.end){update({end:null,remaining});completedEnd.current=null;return}
  const seconds=widget.remaining||duration||1500;
  update({remaining:seconds,end:Date.now()+seconds*1000});
 }
 function reset(){completedEnd.current=null;setSelected(1500);update({end:null,remaining:1500})}
 const running=!!widget.end;
 const displayed=running?remaining:duration;
 const displayHours=Math.floor(displayed/3600),displayMinutes=Math.floor(displayed%3600/60),displaySeconds=displayed%60;
 function pickerValues(unit:'hour'|'minute'){
  const value=unit==='hour'?hours:minutes;
  return Array.from({length:5},(_,index)=>value+index-2).filter(mark=>mark>=0&&mark<=(unit==='hour'?12:59));
 }
 function valuePicker(unit:'hour'|'minute'){
  const value=unit==='hour'?hours:minutes;
  const label=unit==='hour'?t('timerHour'):t('timerMinuteShort');
  return <div className="timer-value-column"><span className="timer-value-label">{label}</span><div className="timer-value-wheel" role="listbox" tabIndex={running?-1:0} aria-label={unit==='hour'?t('timerHours'):t('timerMinutes')} aria-disabled={running} onWheel={event=>handlePickerWheel(event,unit)} onKeyDown={event=>handlePickerKeyDown(event,unit)}>
   {pickerValues(unit).map(mark=>{
    const distance=Math.abs(mark-value);
    const accessibleLabel=unit==='hour'?t('setTimerHour').replace('{count}',String(mark)).replace('(s)',mark===1?'':'s'):t('setTimerMinutes').replace('{count}',pad(mark));
    return <button key={mark} type="button" role="option" aria-label={accessibleLabel} aria-selected={mark===value} className="timer-value-option" data-distance={distance} disabled={running} onClick={()=>setPart(mark,unit)}>{unit==='hour'?String(mark):pad(mark)}</button>;
   })}
  </div></div>;
 }

 return <div className={`card-body timer-widget timer-widget-${variant}`}>
  <div className="timer-widget-top"><span>{variant==='focus'?t('focusSession'):t('clockTimer')}</span><span>{running?t('timerRunning'):t('timerSetDuration')}</span></div>
  <div className="timer-duration-editor" role="group" aria-label={t('setTimerDuration')} aria-disabled={running}>
   <div className="timer-duration-readout" aria-live="polite"><strong>{pad(displayHours)}:{pad(displayMinutes)}</strong><span>{running?pad(displaySeconds)+' '+t('timerSecondsShort'):variant==='focus'?t('focusLabel'):t('timerLabel')}</span></div>
   {valuePicker('hour')}
   {valuePicker('minute')}
   <span className="timer-wheel-hint" aria-hidden="true">{t('timerScrollHint')}</span>
  </div>
  <div className="timer-widget-actions">
   <button type="button" onClick={cancelSelection} disabled={running}>{t('cancel')}</button>
   <button type="button" className="timer-set-button" onClick={setTime} disabled={running}>{t('setTimeButton')}</button>
   <button type="button" className="timer-start-button" onClick={toggleTimer}>{running?t('pauseTimer'):t('startTimer')}</button>
   <button type="button" className="timer-reset-button" onClick={reset}>{t('resetTimer')}</button>
  </div>
 </div>;
}
