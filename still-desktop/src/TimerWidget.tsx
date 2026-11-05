import {useEffect,useRef,useState} from 'react';
import type {WidgetInstance} from './domain/workspaces.ts';
import {useT} from './localization.tsx';

interface TimerWidgetProps {
 widget:WidgetInstance;
 variant:'focus'|'clock';
 workspaceActive?:boolean;
 update:(patch:Partial<WidgetInstance>)=>void;
 notify:(message:string)=>void;
}

const hourMarks=[1,2,3,4,5,6,7,8,9,10,11,12];
const minuteMarks=[0,5,10,15,20,25,30,35,40,45,50,55];
const pad=(value:number)=>String(value).padStart(2,'0');

export default function TimerWidget({widget,variant,workspaceActive=true,update,notify}:TimerWidgetProps){
 const t=useT();
 const [now,setNow]=useState(Date.now());
 const [mode,setMode]=useState<'hour'|'minute'>('hour');
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
 const marks=mode==='hour'?hourMarks:minuteMarks;
 const selectedMark=mode==='hour'?(hours||0):Math.round(minutes/5)*5%60;
 const dialValue=mode==='hour'?(hours||12):Math.round(minutes/5)%12;
 const handAngle=dialValue*30;
 const value=mode==='hour'?hours:minutes;
 const duration=Math.max(0,selected);
 function setPart(next:number){
  setSelected(mode==='hour'?Math.max(0,Math.min(12,next))*3600+minutes*60:hours*3600+Math.max(0,Math.min(59,next))*60);
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
 const dialHour=mode==='hour'?(hours%12)*30:minutes*6;

 return <div className={`card-body timer-widget timer-widget-${variant}`}>
  <div className="timer-widget-top"><span>{variant==='focus'?t('focusSession'):t('clockTimer')}</span><span>{running?t('timerRunning'):t('timerSetDuration')}</span></div>
  <div className="timer-mode-switch" role="group" aria-label={t('timerDialUnit')}>
   <button type="button" aria-pressed={mode==='hour'} onClick={()=>setMode('hour')}>{t('timerHour')}</button>
   <button type="button" aria-pressed={mode==='minute'} onClick={()=>setMode('minute')}>{t('timerMinuteShort')}</button>
  </div>
  <div className="timer-dial" role="group" aria-label={t('setTimerDuration')} aria-disabled={running}>
   <div className="timer-dial-ring" aria-hidden="true"/>
   <div className="timer-dial-hand" aria-hidden="true" style={{transform:`rotate(${running?dialHour:handAngle}deg)`}}/>
   {marks.map((mark,index)=>{
    const angle=index*30*Math.PI/180;
    const label=mode==='hour'?String(mark):pad(mark);
    const isSelected=mode==='hour'?mark===selectedMark:mark===selectedMark;
    const accessibleLabel=mode==='hour'?t('setTimerHour').replace('{count}',String(mark)).replace('(s)',mark===1?'':'s'):t('setTimerMinutes').replace('{count}',label);
    return <button key={mark} type="button" className={`timer-dial-mark ${isSelected?'selected':''}`} style={{left:`${50+Math.sin(angle)*40}%`,top:`${50-Math.cos(angle)*40}%`}} aria-label={accessibleLabel} aria-pressed={isSelected} disabled={running} onClick={()=>setPart(mark)}>{label}</button>;
   })}
   <div className="timer-dial-center"><strong>{pad(displayHours)}:{pad(displayMinutes)}</strong><span>{running?pad(displaySeconds)+' '+t('timerSecondsShort'):variant==='focus'?t('focusLabel'):t('timerLabel')}</span></div>
  </div>
  <div className="timer-range-wrap">
   <input type="range" aria-label={mode==='hour'?t('timerHours'):t('timerMinutes')} min={0} max={mode==='hour'?12:59} step={1} value={value} disabled={running} onChange={event=>setPart(Number(event.target.value))}/>
   <div className="timer-range-labels" aria-hidden="true">{(mode==='hour'?['0','3','6','9','12']:['00','15','30','45','59']).map(mark=><span key={mark}>{mark}</span>)}</div>
  </div>
  <div className="timer-widget-actions">
   <button type="button" onClick={cancelSelection} disabled={running}>{t('cancel')}</button>
   <button type="button" className="timer-set-button" onClick={setTime} disabled={running}>{t('setTimeButton')}</button>
   <button type="button" className="timer-start-button" onClick={toggleTimer}>{running?t('pauseTimer'):t('startTimer')}</button>
   <button type="button" className="timer-reset-button" onClick={reset}>{t('resetTimer')}</button>
  </div>
 </div>;
}
